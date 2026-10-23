/**
 * Vercel Routing Middleware: rate limiting at the edge, before the site is served.
 *
 * The game runs entirely in the player's browser, so the only load on our side
 * is downloading the page and its files. Three limits protect that:
 *   1. per visitor, page loads:   PAGE_LIMIT per minute  (reloading in a loop, scrapers)
 *   2. per visitor, all files:    FILE_LIMIT per minute  (hammering scripts/styles)
 *   3. whole site, page loads:    GLOBAL_PAGES_PER_SEC   (a flood from many visitors)
 *   4. per visitor, /api calls:   API_LIMIT per minute   (each call costs database commands)
 * Over a limit, people get a friendly "System is busy" page that counts down and
 * retries by itself (HTTP 429 with Retry-After), and scripts get a short 429.
 *
 * Counters live in this edge instance's memory, so limits are per region and
 * best-effort. The Vercel Firewall rate-limit rule (dashboard) is the hard backstop.
 */

export const config = {
  // Everything except Vercel's own internal paths
  matcher: '/((?!_vercel|\\.well-known).*)'
};

export const LIMITS = {
  WINDOW_MS: 60_000,
  PAGE_LIMIT: 30,            // page loads per visitor per minute
  FILE_LIMIT: 900,           // any request per visitor per minute (one page load ≈ 45 files)
  GLOBAL_PAGES_PER_SEC: 40,  // page loads per second for the whole site (per edge instance)
  API_LIMIT: 10,             // /api calls per visitor per minute (presence pings come once a minute)
  MAX_TRACKED: 10_000        // visitors remembered before old entries are dropped
};

const visitors = new Map();   // ip → { start, pages, files }
let globalSecond = { start: 0, pages: 0 };

function clientIp(request) {
  const h = request.headers;
  return (h.get('x-real-ip') || h.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
}

function isPageRequest(url) {
  return url.pathname === '/' || url.pathname.endsWith('.html');
}

function prune(now) {
  if (visitors.size <= LIMITS.MAX_TRACKED) return;
  for (const [ip, v] of visitors) {
    if (now - v.start > LIMITS.WINDOW_MS) visitors.delete(ip);
  }
}

/** Decide whether a request may pass. Returns null (allow) or { retryAfter, reason }. */
export function check(request, now = Date.now()) {
  const url = new URL(request.url);
  const page = isPageRequest(url);
  const ip = clientIp(request);

  // Whole-site valve: too many page loads this second
  if (page) {
    if (now - globalSecond.start >= 1000) globalSecond = { start: now, pages: 0 };
    globalSecond.pages += 1;
    if (globalSecond.pages > LIMITS.GLOBAL_PAGES_PER_SEC) return { retryAfter: 5, reason: 'busy', page };
  }

  // Per visitor, fixed one-minute window
  let v = visitors.get(ip);
  if (!v || now - v.start >= LIMITS.WINDOW_MS) {
    v = { start: now, pages: 0, files: 0, api: 0 };
    visitors.set(ip, v);
    prune(now);
  }
  v.files += 1;
  if (page) v.pages += 1;
  const retryAfter = Math.max(1, Math.ceil((v.start + LIMITS.WINDOW_MS - now) / 1000));
  if (page && v.pages > LIMITS.PAGE_LIMIT) return { retryAfter, reason: 'visitor', page };
  if (url.pathname.startsWith('/api/')) {
    v.api += 1;
    if (v.api > LIMITS.API_LIMIT) return { retryAfter, reason: 'api', page: false };
  }
  if (v.files > LIMITS.FILE_LIMIT) return { retryAfter, reason: 'visitor', page };
  return null;
}

/** The friendly page real people see when they're over a limit. */
export function busyPage(retryAfter, reason) {
  const why = reason === 'busy'
    ? 'Lots of people are playing right now, so we\'re letting players in a few at a time.'
    : 'You\'ve loaded the game many times in the last minute, so we\'re giving the servers a short breather.';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Busy · Scale Architect</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
    background: radial-gradient(circle at 50% 30%, #13203a, #070b14 70%); color: #e2e8f0;
    font: 16px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; box-sizing: border-box; }
  .card { max-width: 420px; width: 100%; text-align: center; padding: 28px 24px; border-radius: 20px;
    background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(6, 214, 160, 0.35);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5); }
  .icon { font-size: 44px; }
  h1 { font-size: 22px; margin: 10px 0 6px; }
  p { color: #94a3b8; margin: 0 0 18px; }
  .count { font: 700 40px/1 ui-monospace, Menlo, monospace; color: #06d6a0; }
  .bar { height: 6px; border-radius: 99px; background: rgba(255,255,255,0.08); overflow: hidden; margin: 14px 0 18px; }
  .bar span { display: block; height: 100%; width: 100%; background: #06d6a0; transition: width 1s linear; }
  button { min-height: 44px; padding: 0 22px; border-radius: 12px; border: 0; font-weight: 700;
    background: #06d6a0; color: #052e22; cursor: pointer; }
  button:disabled { opacity: 0.4; cursor: default; }
  small { display: block; margin-top: 14px; color: #64748b; }
</style></head>
<body><main class="card">
  <div class="icon">🚦</div>
  <h1>The system is busy</h1>
  <p>${why} Your progress is saved in this browser.</p>
  <div class="count" id="n">${retryAfter}</div>
  <div class="bar"><span id="bar"></span></div>
  <button id="go" disabled>Try again</button>
  <small>This is the same rate limiting you build in the game, protecting the real servers.</small>
</main>
<script>
  var total = ${retryAfter}, left = total, n = document.getElementById('n'),
      bar = document.getElementById('bar'), go = document.getElementById('go');
  go.onclick = function () { location.reload(); };
  var t = setInterval(function () {
    left -= 1;
    n.textContent = Math.max(0, left);
    bar.style.width = Math.max(0, left / total * 100) + '%';
    if (left <= 0) { clearInterval(t); go.disabled = false; location.reload(); }
  }, 1000);
</script>
</body></html>`;
}

export default function middleware(request) {
  const blocked = check(request);
  if (!blocked) return; // let the request through to the site
  const headers = { 'Retry-After': String(blocked.retryAfter), 'Cache-Control': 'no-store' };
  if (blocked.page) {
    return new Response(busyPage(blocked.retryAfter, blocked.reason), {
      status: 429,
      headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  return new Response('Too many requests. Please slow down.', {
    status: 429,
    headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

/** For tests: forget every counter. */
export function _reset() {
  visitors.clear();
  globalSecond = { start: 0, pages: 0 };
}
