// Synthesised sound effects (WebAudio), no audio files.
import { ARENA } from '/kit/arena/engine.js';

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.budget = 0;
  }

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggle() {
    this.muted = !this.muted;
    return this.muted;
  }

  out(x, gain) {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const p = this.ctx.createStereoPanner();
    p.pan.value = x == null ? 0 : Math.max(-0.8, Math.min(0.8, (x / ARENA.width) * 1.6 - 0.8));
    g.connect(p).connect(this.master);
    return g;
  }

  env(node, t, a, d, peak = 1) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  noiseBurst(dest, t, dur, type, f1, f2, q = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f1, t);
    f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  tone(dest, t, dur, type, f1, f2, peak = 1) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.005, dur, peak);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name, x) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'shot': {
        const o = this.out(x, 0.32);
        this.noiseBurst(o, t, 0.14, 'lowpass', 2600, 400);
        this.tone(o, t, 0.16, 'sine', 140, 45);
        break;
      }
      case 'ricochet': {
        const o = this.out(x, 0.12);
        this.tone(o, t, 0.16, 'sine', 2600 + Math.random() * 600, 1300);
        this.noiseBurst(o, t, 0.05, 'highpass', 3000, 5000);
        break;
      }
      case 'impact': {
        const o = this.out(x, 0.12);
        this.noiseBurst(o, t, 0.08, 'bandpass', 1200, 500, 2);
        break;
      }
      case 'hit': {
        const o = this.out(x, 0.35);
        this.noiseBurst(o, t, 0.18, 'bandpass', 1400, 400, 1.5);
        this.tone(o, t, 0.12, 'square', 190, 90, 0.4);
        break;
      }
      case 'zoneTick': {
        const o = this.out(x, 0.05);
        this.tone(o, t, 0.06, 'sawtooth', 260, 200);
        break;
      }
      case 'death': {
        const o = this.out(x, 0.7);
        this.noiseBurst(o, t, 1.4, 'lowpass', 1800, 90);
        this.tone(o, t, 0.9, 'sine', 90, 28);
        this.noiseBurst(o, t + 0.05, 0.5, 'bandpass', 700, 200, 1);
        break;
      }
      case 'clash': {
        const o = this.out(x, 0.2);
        this.tone(o, t, 0.3, 'triangle', 1700, 1500);
        this.tone(o, t, 0.25, 'triangle', 2550, 2300, 0.6);
        break;
      }
      case 'pickup': {
        const o = this.out(x, 0.18);
        [660, 880, 1320].forEach((f, i) => this.tone(o, t + i * 0.07, 0.14, 'sine', f, f));
        break;
      }
      case 'beep': {
        this.tone(this.out(null, 0.2), t, 0.12, 'sine', 880, 880);
        break;
      }
      case 'go': {
        const o = this.out(null, 0.25);
        this.tone(o, t, 0.4, 'sawtooth', 660, 1320, 0.5);
        this.tone(o, t, 0.4, 'sine', 1320, 1320);
        break;
      }
      case 'alarm': {
        const o = this.out(null, 0.14);
        for (let i = 0; i < 3; i++) this.tone(o, t + i * 0.28, 0.22, 'sawtooth', 330, 220);
        break;
      }
      case 'win': {
        const o = this.out(null, 0.2);
        [523, 659, 784, 1046].forEach((f, i) => this.tone(o, t + i * 0.09, 0.35, 'triangle', f, f));
        break;
      }
    }
  }

  // Engine events -> sounds. Rate-limited so 4x speed stays listenable.
  events(events) {
    for (const e of events) {
      if (e.type === 'shot') this.play('shot', e.x);
      else if (e.type === 'ricochet') this.play('ricochet', e.x);
      else if (e.type === 'impact') this.play('impact', e.x);
      else if (e.type === 'hit' && e.cause === 'zone') {
        if (Math.random() < 0.15) this.play('zoneTick', e.x);
      } else if (e.type === 'hit') this.play('hit', e.x);
      else if (e.type === 'death') this.play('death', e.x);
      else if (e.type === 'clash') this.play('clash', e.x);
      else if (e.type === 'pickup') this.play('pickup', e.x);
      else if (e.type === 'zoneStart') this.play('alarm');
    }
  }
}
