require('../node_modules/dotenv').config({path:'../.env'});
const { crawlSite } = require('../src/services/crawler.js');
const ingest = require('../src/services/ingest.js');

(async () => {
  const crawl = await crawlSite('https://onewaynepal.com');
  console.log('Crawl OK:', crawl.pages, 'pages');

  let neb = 0, nep = 0;
  const nebRe = new RegExp('Nebal', 'gi');
  const nepRe = new RegExp('Nepal', 'gi');
  let m;
  while ((m = nebRe.exec(crawl.text)) !== null) neb++;
  while ((m = nepRe.exec(crawl.text)) !== null) nep++;
  console.log('Crawled text - Nebal:', neb, 'Nepal:', nep);

  const chunks = ingest.chunkText(crawl.text);
  console.log('Chunks:', chunks.length);
  for (let i = 0; i < Math.min(3, chunks.length); i++) {
    let cNeb = 0, cNep = 0;
    const cr = new RegExp('Nebal', 'gi');
    const cpr = new RegExp('Nepal', 'gi');
    while ((m = cr.exec(chunks[i])) !== null) cNeb++;
    while ((m = cpr.exec(chunks[i])) !== null) cNep++;
    console.log(`Chunk ${i}: Nebal=${cNeb} Nepal=${cNep} first80="${chunks[i].substring(0, 80)}"`);
  }
})();