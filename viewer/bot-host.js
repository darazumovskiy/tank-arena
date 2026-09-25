// Main-thread side of a bot worker: request/response with timeouts.
export const TICK_TIMEOUT_MS = 50;
// A bot is considered hung only after this much real time without any answer.
// Counting missed ticks instead would freeze a bot after one slow tick in the
// unpaced tournament mode, where ticks follow each other without waiting.
const FREEZE_MS = 3000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class BotHost {
  constructor(entry) {
    this.entry = entry;
    this.worker = null;
    this.pending = new Map();
    this.seq = 0;
    this.busy = false;
    this.busySince = 0;
    this.idle = Promise.resolve();
    this.markIdle = null;
    this.last = null;
    this.frozen = false;
    this.errors = 0;
    this.missed = 0;
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

  // Send work that occupies the worker; `busy` stays set until it answers,
  // even if we stopped waiting for the answer.
  work(msg, timeout) {
    this.busy = true;
    this.busySince = performance.now();
    this.idle = new Promise((r) => (this.markIdle = r));
    return this.request(msg, timeout);
  }

  onMessage(m) {
    if (m.type === 'error') {
      this.errors++;
      this.lastError = m.error;
      if (this.errors <= 3) console.warn(`[${this.entry.id}] ${m.where}:`, m.error);
      return;
    }
    if (m.type === 'action' || m.type === 'ok') {
      this.busy = false;
      this.markIdle?.();
    }
    const cb = this.pending.get(m.id);
    if (cb) {
      this.pending.delete(m.id);
      cb(m);
    }
  }

  async init(info) {
    if (this.frozen) return;
    if (this.busy) await Promise.race([this.idle, sleep(2000)]);
    if (this.busy) return this.checkFrozen();
    await this.work({ type: 'init', info }, 2000);
  }

  async tick(view) {
    if (this.frozen) return null;
    // Still thinking about an older tick: give it the same time budget to finish
    // before skipping this turn, so one slow tick costs one turn, not a streak.
    if (this.busy) await Promise.race([this.idle, sleep(TICK_TIMEOUT_MS)]);
    if (this.busy) {
      this.missed++;
      this.checkFrozen();
      return this.frozen ? null : this.last;
    }
    const r = await this.work({ type: 'tick', view }, TICK_TIMEOUT_MS);
    if (r === undefined) {
      this.missed++;
      return this.last;
    }
    this.last = r.action;
    return r.action;
  }

  checkFrozen() {
    if (this.busy && performance.now() - this.busySince > FREEZE_MS) {
      this.frozen = true;
      this.lastError = 'бот не отвечал 3 с и отключён';
      this.worker.terminate();
    }
  }

  dispose() {
    this.worker?.terminate();
    this.pending.clear();
  }
}
