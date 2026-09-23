/**
 * Website crawler — multi-page site learning.
 *
 * Upgrades the old single-page regex stripper to:
 *   - jsdom + @mozilla/readability (Mozilla's Reader-View engine) to extract
 *     the meaningful article body — not raw tag soup with nav/footer/ads
 *   - sitemap.xml (+ nested sitemap indexes) and robots.txt discovery,
 *     then same-origin BFS over page links
 *   - 8-way concurrent fetches under a hard dispatch deadline, so a full
 *     site crawl typically finishes in 2–4s on a VPS
 *   - SSRF guard: DNS resolution + private-IP/port checks on every request
 *     AND every redirect hop (users supply these URLs on a multi-tenant box)
 *
 * Budget: MAX_PAGES pages, DISCOVER_DEADLINE_MS to start new fetches,
 * PER_PAGE_TIMEOUT_MS per fetch — worst case ≈ deadline + one timeout.
 */
const dns = require('dns').promises;
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const iconv = require('iconv-lite');

const UA = 'OneWayChatAI-Bot/1.0 (+https://onewaychat.ai)';

/* UA identifies ordinary fetches; browser retry headers are built inline in fetchGuarded. */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const MAX_PAGES = 40;                 // pages learned per crawl (VPS-powered)
const CONCURRENCY = 10;               // parallel fetch+extract workers
const PER_PAGE_TIMEOUT_MS = 6000;     // per fetch (applies to each redirect hop)
const DISCOVER_DEADLINE_MS = 12000;   // stop pulling new URLs after this
const AUX_TIMEOUT_MS = 4000;          // robots.txt / sitemap fetches
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 2.5 * 1024 * 1024;
const MAX_PAGE_CHARS = 18000;         // per-page content cap
const MAX_TOTAL_CHARS = 300000;       // whole-crawl content cap

// Paths / extensions that are never content pages
const BLOCKED_EXT = /\.(pdf|jpe?g|png|gif|svg|webp|avif|ico|zip|gz|mp3|mp4|webm|mov|avi|docx?|xlsx?|pptx?|csv|xml|json|rss|atom|txt|woff2?|ttf|eot|css)$/i;
const BLOCKED_PATH = /\/(login|signin|signup|register|cart|checkout|wp-admin|wp-login\.php|account|logout|admin|search)(\/|$)/i;

/* ------------------------------------------------------------------ */
/* SSRF guard                                                          */
/* ------------------------------------------------------------------ */

function isPrivateIpv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;              // 0/8, 10/8, 127/8
  if (a === 172 && b >= 16 && b <= 31) return true;               // 172.16/12
  if (a === 192 && b === 168) return true;                        // 192.168/16
  if (a === 169 && b === 254) return true;                        // link-local (cloud metadata)
  if (a === 100 && b >= 64 && b <= 127) return true;              // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true;           // benchmarking
  if (a >= 224) return true;                                      // multicast + reserved
  return false;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIpv4(v.slice(7));
  if (v.includes(':')) {
    // IPv6: loopback, unspecified, ULA (fc00::/7), link-local (fe80::/10), multicast
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd')
      || /^fe[89ab]/.test(v) || v.startsWith('ff');
  }
  return isPrivateIpv4(v);
}

/**
 * Validate a URL is safe to fetch: http(s), standard port, and every
 * resolved DNS address is public. Results cached per host per crawl.
 */
function assertPublicUrl(urlStr, cache) {
  let u;
  try { u = new URL(urlStr); } catch {
    throw Object.assign(new Error(`Blocked invalid URL: ${urlStr}`), { status: 400 });
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw Object.assign(new Error(`Blocked non-HTTP URL: ${u.protocol}`), { status: 400 });
  }
  if (u.port && u.port !== '80' && u.port !== '443') {
    throw Object.assign(new Error(`Blocked non-standard port ${u.port}`), { status: 400 });
  }
  const host = u.hostname.toLowerCase();
  if (!cache.has(host)) {
    cache.set(host, dns.lookup(host, { all: true, verbatim: true }).then((addrs) => {
      if (!addrs.length) throw new Error(`No DNS records for ${host}`);
      for (const a of addrs) {
        if (isPrivateIp(a.address)) throw new Error(`Blocked private address ${a.address}`);
      }
    }));
  }
  return cache.get(host);
}

/**
 * Fetch with SSRF validation on every hop (redirects handled manually so
 * a public host cannot bounce us into 127.0.0.1 or 169.254.169.254).
 */
async function fetchGuarded(url, timeoutMs, hostCache) {
  let current = url;
  let browserRetry = false;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current, hostCache);
    const browserish = browserRetry;
    let res = await fetch(current, {
      headers: browserish
        ? {
            'user-agent': BROWSER_UA,
            accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
            'accept-encoding': 'gzip, deflate, br',
            'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'upgrade-insecure-requests': '1',
          }
        : {
            'user-agent': UA,
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'en',
          },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });

    /*
      Cloudflare/WAF bot-challenge: sites that 401/403/429/999 the bot UA
      often accept a browser-shaped request. Retry ONCE per hop with real
      browser headers before giving up on the page.
    */
    if (
      !browserRetry &&
      [401, 403, 429, 999].includes(res.status) &&
      res.headers.get('cf-ray')
    ) {
      browserRetry = true;
      res = await fetch(current, {
        headers: {
          'user-agent': BROWSER_UA,
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
          'upgrade-insecure-requests': '1',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error(`Redirect without location from ${current}`);
      current = new URL(loc, current).href;
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new Error(`Too many redirects for ${url}`);
}


/* ------------------------------------------------------------------ */
/* Extraction: jsdom + Readability                                     */
/* ------------------------------------------------------------------ */

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'NAV', 'ASIDE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'UL', 'OL', 'DL', 'DT', 'DD',
  'TR', 'TD', 'TH', 'TABLE', 'BLOCKQUOTE', 'PRE', 'FIGURE', 'FIGCAPTION',
  'HR', 'ADDRESS', 'CENTER',
]);

function normalizeText(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Serialize a DOM subtree to text, newline at block boundaries. */
function walkText(root) {
  const out = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        out.push(child.nodeValue);
      } else if (child.nodeType === 1) {
        const tag = child.tagName;
        if (tag === 'BR') { out.push('\n'); continue; }
        walk(child);
        if (BLOCK_TAGS.has(tag)) out.push('\n');
      }
    }
  };
  walk(root);
  return out.join('');
}

/**
 * Flatten JSON-LD structured data (Organization, LocalBusiness, FAQPage…)
 * into "label: value" lines — phone, address, hours and FAQ pairs are the
 * highest-signal content a support bot can learn.
 */
function collectJsonLd(doc) {
  const seen = new Set();
  const lines = [];
  const add = (label, value) => {
    if (!value) return;
    const clean = normalizeText(String(value)).replace(/\s+/g, ' ').slice(0, 300);
    if (!clean) return;
    const key = `${label}:${clean}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(`${label}: ${clean}`);
  };
  const strip = (htmlStr) => {
    try { const d = doc.createElement('div'); d.innerHTML = String(htmlStr); return d.textContent || ''; }
    catch { return String(htmlStr); }
  };
  const visit = (node) => {
    if (!node || typeof node !== 'object' || lines.join('\n').length > 3000) return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const type = String(node['@type'] || '');
    if (/FAQPage/i.test(type) && Array.isArray(node.mainEntity)) {
      for (const q of node.mainEntity) {
        const question = q && q.name;
        const answer = q && q.acceptedAnswer && q.acceptedAnswer.text;
        if (question && answer) add('FAQ', `${strip(question)} → ${strip(answer)}`);
      }
    }
    for (const k of ['name', 'telephone', 'email', 'priceRange', 'openingHours', 'description']) {
      const v = node[k];
      if (typeof v === 'string' && v.trim()) add(k, v);
    }
    const addr = node.address;
    if (addr && typeof addr === 'object' && /PostalAddress/i.test(String(addr['@type'] || ''))) {
      add('address', [addr.streetAddress, addr.addressLocality, addr.addressRegion,
        addr.postalCode, addr.addressCountry].filter(Boolean).join(', '));
    }
    if (node['@graph']) visit(node['@graph']);
    for (const k of ['publisher', 'provider']) if (node[k] && typeof node[k] === 'object') visit(node[k]);
  };
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try { visit(JSON.parse(s.textContent)); } catch { /* invalid JSON-LD */ }
    if (lines.join('\n').length > 3000) break;
  }
  return lines.join('\n');
}


function parseRobots(txt) {
  const rules = { disallow: [], sitemaps: [] };
  let active = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).toLowerCase().trim();
    const value = line.slice(idx + 1).trim();
    if (field === 'sitemap') { rules.sitemaps.push(value); continue; }
    if (field === 'user-agent') { active = value === '*' || /onewaychat/i.test(value); continue; }
    if (field === 'disallow' && active && value) rules.disallow.push(value);
  }
  return rules;
}

function isRobotsBlocked(pathname, rules) {
  return rules.some((raw) => {
    if (!raw) return false;
    const anchored = raw.endsWith('$');
    const pattern = anchored ? raw.slice(0, -1) : raw;
    try {
      const rx = '^' + pattern.split('*')
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') + (anchored ? '$' : '');
      return new RegExp(rx).test(pathname);
    } catch {
      return pathname.startsWith(raw);
    }
  });
}


/** Content links from a page (deduped, fragment-stripped, protocol-checked). */
function collectLinks(doc, pageUrl) {
  const out = [];
  const seen = new Set();
  for (const a of doc.querySelectorAll('a[href]')) {
    try {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || /^(mailto|tel|javascript|data):/i.test(href)) continue;
      const u = new URL(href, pageUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      u.hash = '';
      if (seen.has(u.href)) continue;
      seen.add(u.href);
      out.push(u.href);
    } catch { /* malformed href */ }
  }
  return out;
}

function isBlockedPath(urlStr) {
  try {
    const u = new URL(urlStr);
    return BLOCKED_EXT.test(u.pathname) || BLOCKED_PATH.test(u.pathname);
  } catch {
    return true;
  }
}

/**
 * Pull clean content out of one page's HTML:
 *   1. read title / meta description / JSON-LD / links (non-destructive)
 *   2. Readability for the article body (it mutates — hence step 1 first)
 *   3. cleaned-DOM walker as fallback for thin pages Readability declines
 */
function extractPage(html, pageUrl) {
  let dom;
  try { dom = new JSDOM(html, { url: pageUrl }); } catch { return null; }
  const doc = dom.window.document;
  if (!doc.body) { dom.window.close(); return null; }

  let title = (doc.querySelector('title')?.textContent || '').trim();
  const metaDesc = doc.querySelector('meta[name="description"]')
    || doc.querySelector('meta[property="og:description"]');
  const desc = metaDesc ? (metaDesc.getAttribute('content') || '').trim() : '';
  const ld = collectJsonLd(doc);
  const links = collectLinks(doc, pageUrl);

  let text = '';
  let gotArticle = false;
  try {
    const article = new Readability(doc, { charThreshold: 60 }).parse();
    if (article && normalizeText(article.textContent).length >= 60) {
      // Prefer walking the article HTML: textContent concatenates paragraphs
      // with no separator ("end.Next heading"), which merges topics inside
      // RAG chunks. walkText restores block-level newlines.
      try {
        const tmp = doc.createElement('div');
        tmp.innerHTML = article.content || '';
        const walked = normalizeText(walkText(tmp));
        text = walked.length >= 60 ? walked : article.textContent;
      } catch {
        text = article.textContent;
      }
      if (!title && article.title) title = article.title.trim();
      gotArticle = true;
    }
  } catch { /* fall through to walker */ }

  if (gotArticle) {
    try { dom.window.close(); } catch { /* noop */ }
  } else {
    // Readability declined (thin/odd page) — re-parse fresh (it mutates the
    // document) and walk a cleaned DOM ourselves.
    try { dom.window.close(); } catch { /* noop */ }
    try { dom = new JSDOM(html, { url: pageUrl }); } catch { return null; }
    const doc2 = dom.window.document;
    if (!doc2.body) { dom.window.close(); return null; }
    const junk = doc2.querySelectorAll(
      'script,style,noscript,template,svg,iframe,object,embed,canvas,form,input,select,textarea,nav,header,footer,aside'
    );
    junk.forEach((n) => n.remove());
    text = walkText(doc2.body);
    try { dom.window.close(); } catch { /* noop */ }
  }

  return { title, desc, ld, links, text: normalizeText(text) };
}

async function fetchAndExtract(url, hostCache) {
  const { res, finalUrl } = await fetchGuarded(url, PER_PAGE_TIMEOUT_MS, hostCache);
  if (!res.ok) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct && !/text\/html|application\/xhtml\+xml/i.test(ct)) return null;
  const len = parseInt(res.headers.get('content-length') || '0', 10);
  if (Number.isFinite(len) && len > MAX_HTML_BYTES) return null;

  /*
    Charset-correct decode: charset from the Content-Type header, else a
    sniff of the raw bytes' meta tag, else UTF-8. Non-UTF-8 pages
    (latin-1, Shift_JIS, GBK…) decode via iconv-lite instead of
    producing mojibake that would poison the knowledge base.
  */
  const headerCharset = (ct.match(/charset=([\w-]+)/i) || [])[1];
  const raw = Buffer.from(await res.arrayBuffer());
  let charset = headerCharset;
  if (!charset) {
    const head = raw.subarray(0, 4096).toString('latin1');
    charset = (head.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
  }
  let html;
  try {
    const normalized = (charset || 'utf-8').toLowerCase();
    html =
      normalized === 'utf-8' || normalized === 'utf8'
        ? raw.toString('utf8')
        : iconv.decode(raw, charset);
  } catch {
    html = raw.toString('utf8');
  }
  if (html.length > MAX_HTML_BYTES) html = html.slice(0, MAX_HTML_BYTES);
  // Reject JSON/RSS 200s that aren't actually documents
  if (!/<(?:!doctype|html|head|body|div|p|main|article)\b/i.test(html)) return null;
  return extractPage(html, finalUrl);
}

/* ------------------------------------------------------------------ */
/* Sitemap discovery + orchestration                                   */
/* ------------------------------------------------------------------ */

function originKey(urlStr) {
  try { return new URL(urlStr).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; }
}

function sameSite(urlStr, seedKey) {
  try {
    const u = new URL(urlStr);
    return (u.protocol === 'http:' || u.protocol === 'https:') && originKey(u.href) === seedKey;
  } catch { return false; }
}

/**
 * Best-effort sitemap URLs: robots-declared Sitemap lines + /sitemap.xml,
 * descending one level into sitemap indexes. Fails open — sites without a
 * sitemap simply rely on link discovery.
 */
async function discoverSitemapUrls(origin, robotsSitemaps, hostCache) {
  const pages = [];
  const seen = new Set();
  const collectLocs = (xml) => {
    const out = [];
    for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) out.push(m[1].trim());
    return out;
  };
  const trySitemap = async (loc, depth) => {
    if (seen.has(loc) || depth > 1 || pages.length >= MAX_PAGES * 4) return;
    seen.add(loc);
    try {
      const { res } = await fetchGuarded(loc, AUX_TIMEOUT_MS, hostCache);
      if (!res.ok) return;
      const ct = res.headers.get('content-type') || '';
      if (ct && !/xml|text/i.test(ct)) return;
      const xml = (await res.text()).slice(0, 2 * 1024 * 1024);
      const locs = collectLocs(xml);
      const nested = locs.filter((l) => /\.xml(\?|$)/i.test(l));
      const regular = locs.filter((l) => !/\.xml(\?|$)/i.test(l));
      pages.push(...regular);
      if (depth < 1) await Promise.all(nested.slice(0, 3).map((n) => trySitemap(n, depth + 1)));
    } catch { /* best effort */ }
  };

  const declared = (robotsSitemaps || []).filter((s) => sameSite(s, originKey(origin)));
  const start = [...new Set([...declared, `${origin}/sitemap.xml`])].slice(0, 4);
  await Promise.all(start.map((s) => trySitemap(s, 0)));
  return pages.filter((p) => sameSite(p, originKey(origin)) && !isBlockedPath(p));
}

async function fetchRobots(origin, hostCache) {
  try {
    const { res } = await fetchGuarded(`${origin}/robots.txt`, AUX_TIMEOUT_MS, hostCache);
    if (!res.ok) return { disallow: [], sitemaps: [] };
    const txt = (await res.text()).slice(0, 200000);
    return parseRobots(txt);
  } catch {
    return { disallow: [], sitemaps: [] }; // fail-open: unreachable robots ≠ disallow
  }
}

/**
 * Cross-page boilerplate: fat footers / legal lines that Readability keeps
 * on some themes repeat verbatim across many pages. Count normalized lines
 * and strip the ones appearing on 3+ pages before assembly.
 */
function stripRepeatedBoilerplate(pages) {
  if (pages.length < 3) return pages;
  const counts = new Map();
  const keyOf = (raw) => raw.trim().replace(/\s+/g, ' ').toLowerCase();
  for (const p of pages) {
    const seenOnPage = new Set();
    for (const raw of p.text.split('\n')) {
      const line = raw.trim();
      if (line.length < 40 || line.length > 500) continue;
      const key = keyOf(line);
      if (seenOnPage.has(key)) continue; // count each page once
      seenOnPage.add(key);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const repeated = new Set();
  for (const [key, n] of counts) if (n >= 3) repeated.add(key);
  if (!repeated.size) return pages;
  return pages.map((p) => ({
    ...p,
    text: p.text
      .split('\n')
      .filter((raw) => {
        const line = raw.trim();
        if (line.length < 40 || line.length > 500) return true;
        return !repeated.has(keyOf(line));
      })
      .join('\n')
      .trim(),
  }));
}

/**
 * Crawl up to MAX_PAGES pages of a site and return one learnable document.
 * Workers pull from a shared BFS queue until the page cap, the char budget,
 * the queue empties, or the dispatch deadline passes — the /crawl route runs
 * this as a background job, so deep crawls never block the client.
 */
async function crawlSite(rawUrl) {
  let seedUrl;
  try { seedUrl = new URL(rawUrl); } catch {
    throw Object.assign(new Error('Invalid URL'), { status: 400 });
  }
  if (seedUrl.protocol !== 'http:' && seedUrl.protocol !== 'https:') {
    throw Object.assign(new Error('Only http(s) URLs can be crawled'), { status: 400 });
  }

  const hostCache = new Map();
  await assertPublicUrl(seedUrl.href, hostCache); // fail fast on private targets

  const seedKey = originKey(seedUrl.href);
  const robots = await fetchRobots(seedUrl.origin, hostCache);
  const sitemapSeeds = await discoverSitemapUrls(seedUrl.origin, robots.sitemaps, hostCache);

  const queue = [];
  const queued = new Set();
  const visited = new Set();
  const pushUrl = (u) => {
    if (queued.has(u) || visited.has(u)) return;
    if (!sameSite(u, seedKey)) return;
    if (queue.length >= MAX_PAGES * 4) return;
    if (isBlockedPath(u)) return;
    let path = '/';
    try { path = new URL(u).pathname; } catch { return; }
    if (isRobotsBlocked(path, robots.disallow)) return;
    queued.add(u);
    queue.push(u);
  };
  pushUrl(seedUrl.href);
  for (const s of sitemapSeeds) pushUrl(s);

  const pages = [];
  const seenContent = new Set();
  let siteMeta = { title: '', desc: '', ld: '' };
  let collectedChars = 0;
  const deadline = Date.now() + DISCOVER_DEADLINE_MS;

  const worker = async () => {
    while (
      pages.length < MAX_PAGES &&
      collectedChars < MAX_TOTAL_CHARS &&
      queue.length > 0 &&
      Date.now() < deadline
    ) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);
      let page = null;
      try { page = await fetchAndExtract(url, hostCache); } catch { continue; }
      if (!page || page.text.length < 60) continue; // 404 shell / thin page
      const fingerprint = page.text.toLowerCase().replace(/\W+/g, '').slice(0, 200);
      if (fingerprint && seenContent.has(fingerprint)) continue; // alias pages
      if (pages.length >= MAX_PAGES) break;
      seenContent.add(fingerprint);
      pages.push({ url, title: page.title, text: page.text.slice(0, MAX_PAGE_CHARS) });
      collectedChars += page.text.length;
      if (pages.length === 1) siteMeta = { title: page.title, desc: page.desc, ld: page.ld };
      for (const link of page.links) pushUrl(link);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  if (pages.length === 0) {
    throw Object.assign(
      new Error('Could not read that site — it may block bots, sit behind a login, or be unreachable'),
      { status: 400 }
    );
  }

  // Cross-page footer/nav dedupe before assembly
  const cleaned = stripRepeatedBoilerplate(pages);

  // Assemble one learnable document: site header + per-page sections
  const header = [`Website: ${siteMeta.title || seedUrl.hostname}`, `Source: ${seedUrl.hostname}`];
  if (siteMeta.desc) header.push(siteMeta.desc);
  if (siteMeta.ld) header.push('', 'Structured data:', siteMeta.ld);
  const sections = [header.join('\n')];
  let total = sections[0].length;
  let learned = 0;
  for (const p of cleaned) {
    const section = `\n\n---\n${p.title || 'Page'}\n${p.url}\n\n${p.text}`;
    if (total + section.length > MAX_TOTAL_CHARS) break;
    sections.push(section);
    total += section.length;
    learned += 1;
  }

  return {
    text: sections.join('\n').trim(),
    pages: learned || cleaned.length,
    urls: cleaned.slice(0, learned || cleaned.length).map((p) => p.url),
    // Per-page objects so ingestion can chunk + tag sources individually.
    sections: cleaned
      .slice(0, learned || cleaned.length)
      .map((p) => ({ title: p.title, url: p.url, text: p.text })),
  };
}

module.exports = { crawlSite };
