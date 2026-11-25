import { useEffect } from 'react';

/**
 * PostHog analytics (V4) — loads only when NEXT_PUBLIC_POSTHOG_KEY is set.
 * Free tier: 1M events/month. Tracks pageviews automatically and
 * exposes window.posthog for custom events elsewhere in the app.
 */
/*
 * Auth pages are excluded from analytics entirely: a password-recovery
 * URL carries access_token / refresh_token / code parameters, and no
 * analytics event may ever contain them. The reset page also scrubs
 * its URL on mount, but PostHog must not even initialise there —
 * scrubbing alone would race the first pageview capture.
 */
const ANALYTICS_EXCLUDED_PATHS = ['/forgot-password', '/reset-password'];

function isExcludedPath() {
  return ANALYTICS_EXCLUDED_PATHS.some((p) => window.location.pathname.endsWith(p));
}

/*
 * Belt-and-braces for every other page: strip the URL fragment and any
 * auth parameters from $current_url before an event leaves the browser.
 */
function sanitizeUrl(raw) {
  if (typeof raw !== 'string') return raw;
  try {
    const url = new URL(raw);
    url.hash = '';
    for (const p of ['code', 'access_token', 'refresh_token', 'error', 'error_description', 'error_code']) {
      url.searchParams.delete(p);
    }
    return url.toString();
  } catch {
    return raw.split('#')[0];
  }
}

export default function PostHog() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    if (!key || window.posthog) return;
    if (isExcludedPath()) return;

    // Official PostHog JS snippet (async, no dependencies)
    (function (t, e) {
      var o, n, p, r;
      e.__SV ||
        ((window.posthog = e),
        (e._i = []),
        (e.init = function (i, s, a) {
          function g(t, e) {
            var o = e.split('.');
            2 == o.length && ((t = t[o[0]]), (e = o[1])),
              (t[e] = function () {
                t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
              });
          }
          ((p = t.createElement('script')).type = 'text/javascript'),
            (p.async = !0),
            (p.src = s.api_host + '/static/array.js'),
            (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r);
          var u = e;
          for (
            void 0 !== a ? (u = e[a] = []) : (a = 'posthog'),
              u.people = u.people || [],
              u.toString = function (t) {
                var e = 'posthog';
                return 'posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e;
              },
              u.people.toString = function () {
                return u.toString(1) + '.people (stub)';
              },
              o =
                'capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset'.split(
                  ' '
                ),
              n = 0;
            n < o.length;
            n++
          )
            g(u, o[n]);
          e._i.push([i, s, a]);
        }),
        (e.__SV = 1));
    })(document, window.posthog);

    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      persistence: 'localStorage+cookie',
      before_send: (event) => {
        if (!event) return event;
        // Never send events captured on an excluded auth page (e.g. an
        // SPA navigation that landed there after init elsewhere).
        try {
          const currentPath = window.location.pathname;
          if (ANALYTICS_EXCLUDED_PATHS.some((p) => currentPath.endsWith(p))) {
            return null;
          }
        } catch {
          // Ignore — fall through to URL sanitising.
        }
        if (event.properties) {
          if (event.properties.$current_url) {
            event.properties.$current_url = sanitizeUrl(event.properties.$current_url);
          }
          if (event.properties.$referrer) {
            event.properties.$referrer = sanitizeUrl(event.properties.$referrer);
          }
        }
        return event;
      },
    });
  }, []);

  return null;
}
