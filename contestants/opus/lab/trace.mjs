// Трасса раунда матча (с тем же сдвигом старта, что в run.mjs):
//   node lab/trace.mjs --a tank --b v5 --sb 0,1,4,5 --seed 7000 --round 8 --from 60 --every 15 [--dump тик]
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const E = await import(pathToFileURL(join(root, 'arena', 'engine.js')).href);
function resolveBotDir(spec) {
  const cands = [resolve(process.cwd(), spec), resolve(root, spec), join(root, 'arena', 'sparring', spec), join(here, 'opponents', spec), join(here, 'snap', spec)];
  for (const c of cands) if (existsSync(join(c, 'bot.js'))) return c;
  throw new Error(`нет bot.js для ${spec}`);
}
const parseStats = (s) => { if (!s) return null; const [armor, engine, gun, reload] = s.split(',').map(Number); return { armor, engine, gun, reload }; };
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const argv = process.argv.slice(2);
const parseParams = (s) => Object.fromEntries(s.split(',').map((kv) => { const [k, v] = kv.split('='); return [k, Number.isNaN(Number(v)) ? v : Number(v)]; }));
const opt = { pa: null, pb: null, a: 'tank', b: 'v5', round: 1, from: 0, to: 999, every: 15, sa: null, sb: null, seed: null, spread: 60, dump: -1, bullets: false };
for (let i = 0; i < argv.length; i++) {
  const k = argv[i], v = argv[i + 1];
  if (k === '--a') { opt.a = v; i++; } else if (k === '--b') { opt.b = v; i++; }
  else if (k === '--round') { opt.round = +v; i++; } else if (k === '--from') { opt.from = +v; i++; }
  else if (k === '--to') { opt.to = +v; i++; } else if (k === '--every') { opt.every = +v; i++; }
  else if (k === '--sa') { opt.sa = parseStats(v); i++; } else if (k === '--sb') { opt.sb = parseStats(v); i++; }
  else if (k === '--seed') { opt.seed = +v; i++; } else if (k === '--spread') { opt.spread = +v; i++; }
  else if (k === '--dump') { opt.dump = +v; i++; }
  else if (k === '--pa') { opt.pa = parseParams(v); i++; } else if (k === '--pb') { opt.pb = parseParams(v); i++; } else if (k === '--bullets') opt.bullets = true;
}
const A = (await import(pathToFileURL(join(resolveBotDir(opt.a), 'bot.js')).href + '?x=a')).default;
const B = (await import(pathToFileURL(join(resolveBotDir(opt.b), 'bot.js')).href + '?x=b')).default;
if (opt.sa) A.stats = opt.sa;
if (opt.sb) B.stats = opt.sb;
if (opt.pa && A._P) Object.assign(A._P, opt.pa);
if (opt.pb && B._P) Object.assign(B._P, opt.pb);
const rng = opt.seed !== null ? mulberry32(opt.seed) : null;
for (let i = 0; i < opt.round; i++) {
  const show = i === opt.round - 1;
  A._DBG.on = show;
  A._DBG.dumpTick = show ? opt.dump : -1;
  const plan = E.roundPlan(i);
  const aSide = plan.swap ? 1 : 0;
  const bots = aSide === 0 ? [A, B] : [B, A];
  const round = E.createRound({ mapIndex: plan.mapIndex, tanks: bots.map((b) => ({ name: b.name, stats: b.stats })) });
  if (rng && opt.spread > 0) {
    for (const t of round.tanks) {
      for (let tries = 0; tries < 20; tries++) {
        const nx = t.x + (rng() * 2 - 1) * opt.spread, ny = t.y + (rng() * 2 - 1) * opt.spread * 2;
        const ok = nx > 30 && nx < 1570 && ny > 30 && ny < 870 && !round.map.walls.some((w) => nx > w.x - 30 && nx < w.x + w.w + 30 && ny > w.y - 30 && ny < w.y + w.h + 30);
        if (ok) { t.x = nx; t.y = ny; break; }
      }
      t.heading += (rng() * 2 - 1) * 0.8;
      t.turret = t.heading;
    }
  }
  for (let s = 0; s < 2; s++) bots[s].init?.({ round: i, side: s, mapName: round.map.name, view: E.botView(round, s) });
  A._DBG.log = [];
  if (show) console.log(`${round.map.name}, A ${aSide ? 'справа' : 'слева'}`);
  while (!round.over) {
    const acts = [0, 1].map((s) => bots[s].tick(E.botView(round, s)));
    const ev = E.stepRound(round, acts);
    if (!show) continue;
    const L = A._DBG.log[A._DBG.log.length - 1];
    const t = round.time;
    const inWin = t >= opt.from && t <= opt.to;
    if (round.tick - 1 === opt.dump && A._DBG.dump) {
      const d = A._DBG.dump.map((x, j) => ({ j, ...x })).sort((p, q) => p.total - q.total);
      for (const x of d.slice(0, 8)) console.log('   plan', JSON.stringify(Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : v]))));
    }
    for (const e of ev) {
      if (!inWin) continue;
      if (e.type === 'hit' && e.cause !== 'zone') console.log(`   * ${t.toFixed(2)} попадание по ${e.side === aSide ? 'A' : 'B'} ${e.ricochet ? '(рикошет)' : ''}${e.cause === 'self' ? ' (САМ)' : ''}`);
      if (e.type === 'shot' && opt.bullets) console.log(`   > ${t.toFixed(2)} выстрел ${e.side === aSide ? 'A' : 'B'} угол ${e.angle.toFixed(2)} из (${e.x.toFixed(0)},${e.y.toFixed(0)})${e.side === aSide && L && L.icpt ? ' ПЕРЕХВАТ' : ''}`);
      if (e.type === 'clash' && opt.bullets) console.log(`   x ${t.toFixed(2)} столкновение снарядов (${e.x.toFixed(0)},${e.y.toFixed(0)})`);
      if (e.type === 'ricochet' && opt.bullets) console.log(`   ~ ${t.toFixed(2)} рикошет снаряда ${e.owner === aSide ? 'A' : 'B'} (${e.x.toFixed(0)},${e.y.toFixed(0)})`);
    }
    if (L && inWin && round.tick % opt.every === 0) {
      const ta = round.tanks[aSide], tb = round.tanks[1 - aSide];
      const zd = Math.hypot(ta.x - 800, ta.y - 450);
      console.log(`${t.toFixed(1)} A(${ta.x.toFixed(0)},${ta.y.toFixed(0)} h${ta.heading.toFixed(2)} v${ta.speed.toFixed(0)} hp${ta.hp.toFixed(0)} rl${ta.reloadLeft.toFixed(2)}) B(${tb.x.toFixed(0)},${tb.y.toFixed(0)} hp${tb.hp.toFixed(0)} rl${tb.reloadLeft.toFixed(2)}) зона r${round.zone.radius.toFixed(0)} dA${zd.toFixed(0)} · ${L.mode} цель(${L.gx},${L.gy}) pref${L.pref.toFixed(0)} min${L.minSafe.toFixed(0)} cost${L.cost.toFixed(0)} act ${L.thr.toFixed(1)}/${L.turn.toFixed(1)}`);
    }
  }
  if (show) console.log(`Итог: победитель ${round.winner === null ? 'ничья' : round.winner === aSide ? 'A' : 'B'} ${round.endReason} ${round.time.toFixed(1)} · зона A ${round.tanks[aSide].tally.zoneDamage.toFixed(0)} · себе A ${round.tanks[aSide].tally.selfDamage.toFixed(0)}`);
}
