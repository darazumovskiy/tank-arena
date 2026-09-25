// Main-thread side of a bot worker: request/response with timeouts.
export const TICK_TIMEOUT_MS = 50;
const FREEZE_AFTER = 90; // consecutive missed ticks (~3 s) -> the bot is considered hung

export class BotHost {
  constructor(entry) {
    this.entry = entry;
    this.worker = null;
    this.pending = new Map();
    this.seq = 0;
    this.busy = false;
    this.last = null;
    this.frozen = false;
    this.errors = 0;
    this.missed = 0;
    this.missedInRow = 0;
    this.lastError = '';
  }

  async load() {
    this.worker = new Worker(new URL('./bot-worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => this.onMessage(e.data);
    this.worker.onerror = (e) => {
      this.errors++;
      this.lastError = e.message;
    };
    const url = `${location.origin}${this.entry.dir}bot.js?v=${Date.now()}`;
    const info = await this.request({ type: 'load', url }, 15000);
    if (!info) throw new Error(`${this.entry.id}: бот не загрузился за 15 с`);
    if (info.error) throw new Error(`${this.entry.id}: ${info.error}`);
    if (!info.hasTick) throw new Error(`${this.entry.id}: нет функции tick`);
    return info;
  }

  request(msg, timeout) {
    const id = ++this.seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve(undefined);
      }, timeout);
      this.pending.set(id, (v) => {
        clearTimeout(timer);
        resolve(v);
      });
      this.worker.postMessage({ ...msg, id });
    });
  }

  onMessage(m) {
    if (m.type === 'error') {
      this.errors++;
      this.lastError = m.error;
      if (this.errors <= 3) console.warn(`[${this.entry.id}] ${m.where}:`, m.error);
      return;
    }
    if (m.type === 'action' || m.type === 'ok') this.busy = false;
    const cb = this.pending.get(m.id);
    if (cb) {
      this.pending.delete(m.id);
      cb(m);
    }
  }

  async init(info) {
    if (this.frozen) return;
    this.busy = true;
    await this.request({ type: 'init', info }, 2000);
  }

  async tick(view) {
    if (this.frozen) return null;
    // A slow bot is still thinking about an older tick: do not queue more work.
    if (this.busy) return this.miss();
    this.busy = true;
    const r = await this.request({ type: 'tick', view }, TICK_TIMEOUT_MS);
    if (r === undefined) return this.miss();
    this.missedInRow = 0;
    this.last = r.action;
    return r.action;
  }

  miss() {
    this.missed++;
    this.missedInRow++;
    if (this.missedInRow >= FREEZE_AFTER) {
      this.frozen = true;
      this.lastError = 'бот завис и отключён';
      this.worker.terminate();
      return null;
    }
    return this.last;
  }

  dispose() {
    this.worker?.terminate();
    this.pending.clear();
  }
}
