// Поиск медленных тиков: node lab/spikes.mjs --b lab/opponents/haiku --sa 1,0,4,5 --rounds 8 --limit 15
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const E = await import(pathToFileURL(join(root, 'arena', 'engine.js')).href);
function resolveBotDir(spec) {
  const cands = [resolve(process.cwd(), spec), resolve(root, spec), join(root, 'arena', 'sparring', spec), join(here, 'opponents', spec), join(here, 'snap', spec)];
  for (const c of cands) if (existsSync(join(c, 'bot.js'))) return c;
  throw new Error(`нет bot.js для ${spec}`);
}
const parseStats = (s) => { if (!s) return null; const [armor, engine, gun, reload] = s.split(',').map(Number); return { armor, engine, gun, reload }; };
const argv = process.argv.slice(2);
const parseParams = (s) => Object.fromEntries(s.split(',').map((kv) => { const [k, v] = kv.split('='); return [k, Number.isNaN(Number(v)) ? v : Number(v)]; }));
const opt = { pa: null, pb: null, a: 'tank', b: 'hunter', rounds: 8, sa: null, sb: null, limit: 15, spread: 60, seed: 1 };
for (let i = 0; i < argv.length; i++) {
  const k = argv[i], v = argv[i + 1];
  if (k === '--a') { opt.a = v; i++; } else if (k === '--b') { opt.b = v; i++; }
  else if (k === '--rounds') { opt.rounds = +v; i++; } else if (k === '--sa') { opt.sa = parseStats(v); i++; }
  else if (k === '--sb') { opt.sb = parseStats(v); i++; } else if (k === '--limit') { opt.limit = +v; i++; }
  else if (k === '--spread') { opt.spread = +v; i++; }
  else if (k === '--pa') { opt.pa = parseParams(v); i++; } else if (k === '--pb') { opt.pb = parseParams(v); i++; } else if (k === '--seed') { opt.seed = +v; i++; }
}
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = mulberry32(opt.seed);
const A = (await import(pathToFileURL(join(resolveBotDir(opt.a), 'bot.js')).href + '?x=a')).default;
const B = (await import(pathToFileURL(join(resolveBotDir(opt.b), 'bot.js')).href + '?x=b')).default;
if (opt.sa) A.stats = opt.sa;
if (opt.sb) B.stats = opt.sb;
if (A._PROF) A._PROF.on = true;
if (opt.pa && A._P) Object.assign(A._P, opt.pa);
if (opt.pb && B._P) Object.assign(B._P, opt.pb);
const hist = new Map();
let total = 0, n = 0, worst = 0;
for (let i = 0; i < opt.rounds; i++) {
  const plan = E.roundPlan(i);
  const aSide = plan.swap ? 1 : 0;
  const bots = aSide === 0 ? [A, B] : [B, A];
  const round = E.createRound({ mapIndex: plan.mapIndex, tanks: bots.map((b) => ({ name: b.name, stats: b.stats })) });
  if (opt.spread > 0) for (const t of round.tanks) {
    for (let tries = 0; tries < 20; tries++) {
      const nx = t.x + (rng() * 2 - 1) * opt.spread, ny = t.y + (rng() * 2 - 1) * opt.spread * 2;
      const ok = nx > 30 && nx < 1570 && ny > 30 && ny < 870 && !round.map.walls.some((w) => nx > w.x - 30 && nx < w.x + w.w + 30 && ny > w.y - 30 && ny < w.y + w.h + 30);
      if (ok) { t.x = nx; t.y = ny; break; }
    }
    t.heading += (rng() * 2 - 1) * 0.8; t.turret = t.heading;
  }
  for (let s = 0; s < 2; s++) bots[s].init?.({ round: i, side: s, mapName: round.map.name, view: E.botView(round, s) });
  while (!round.over) {
    const views = [E.botView(round, 0), E.botView(round, 1)];
    const acts = [null, null];
    for (let s = 0; s < 2; s++) {
      const t0 = performance.now();
      acts[s] = bots[s].tick(views[s]);
      const d = performance.now() - t0;
      if (s === aSide) {
        total += d; n++; worst = Math.max(worst, d);
        const b = d < 1 ? '<1' : d < 2 ? '1-2' : d < 5 ? '2-5' : d < 10 ? '5-10' : d < 20 ? '10-20' : d < 50 ? '20-50' : '>50';
        hist.set(b, (hist.get(b) || 0) + 1);
        if (d > opt.limit) {
          const v = views[s];
          console.log(`раунд ${i + 1} ${round.map.name} тик ${v.tick} ${d.toFixed(1)} мс · ${A._PROF ? Object.entries(A._PROF.last || {}).map(([k, x]) => k + ' ' + x.toFixed(1)).join(' ') : ''} · пуль ${v.bullets.length} · я (${v.me.x.toFixed(0)},${v.me.y.toFixed(0)}) враг (${v.enemy.x.toFixed(0)},${v.enemy.y.toFixed(0)}) жив ${v.enemy.alive}`);
        }
      }
    }
    E.stepRound(round, acts);
  }
}
console.log(`ср. ${(total / n).toFixed(3)} мс, макс ${worst.toFixed(1)} мс`);
if (A._PROF) console.log(Object.entries(A._PROF.t).map(([k, v]) => `${k}: ${(v / n).toFixed(3)} мс/тик`).join(', '));
console.log([...hist.entries()].map(([k, v]) => `${k}: ${v}`).join(', '));
