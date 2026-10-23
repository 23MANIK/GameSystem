/**
 * Presence — "N people playing now".
 *
 * While the game tab is visible it pings /api/presence once a minute with a
 * random session id and the product being played. The answer is the live count
 * (sessions that pinged in the last 90 s), overall and per product.
 * If the API isn't there (local dev) or isn't set up yet, the count stays
 * null and the game simply doesn't show it.
 */

const PING_MS = 60_000;

function sessionId() {
  try {
    let id = sessionStorage.getItem('sa_presence_id');
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
      sessionStorage.setItem('sa_presence_id', id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 18).padEnd(8, '0');
  }
}

export default class Presence {
  constructor() {
    this.id = sessionId();
    this.product = null;      // set once a game is running
    this.online = null;       // total playing now (null = unknown / not set up)
    this.byProduct = {};
    this.listeners = [];
    this.timer = null;
    this.disabled = false;    // the API isn't deployed here
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.tick();
    });
  }

  onChange(cb) {
    this.listeners.push(cb);
  }

  /** Just read the count (start screen). */
  async peek() {
    await this.request('GET');
  }

  /** Start pinging for a product (the game is running). */
  start(product) {
    this.product = product;
    this.tick();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), PING_MS);
  }

  tick() {
    if (!this.product || document.visibilityState !== 'visible') return;
    this.request('POST');
  }

  async request(method) {
    if (this.disabled) return;
    try {
      const res = await fetch('/api/presence', method === 'POST'
        ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: this.id, product: this.product }) }
        : { method });
      if (res.status === 404) { this.disabled = true; return; }
      if (!res.ok) return;
      const data = await res.json();
      if (!data.configured) { this.disabled = true; return; }
      if (data.online == null) return;
      this.online = data.online;
      this.byProduct = data.byProduct || {};
      for (const cb of this.listeners) cb(this);
    } catch {
      // Offline or blocked: keep the last number, try again next minute
    }
  }

  /** "🟢 12 playing now" or '' when unknown. */
  label(product = null) {
    if (this.online == null) return '';
    const here = product ? this.byProduct[product] : null;
    const total = `${this.online.toLocaleString()} playing now`;
    return here != null && product ? `${total} · ${here.toLocaleString()} in this product` : total;
  }
}
