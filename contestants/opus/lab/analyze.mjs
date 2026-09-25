#!/usr/bin/env node
// Разбор раундов: для каждого попадания — дистанция и время полёта, рикошет, скорость жертвы.
//   node lab/analyze.mjs --a tank --b v1 --rounds 8 [--sa ..] [--sb ..] [--jitter 0.02 --seed 3]
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
const opt = { a: 'tank', b: 'v1', rounds: 8, sa: null, sb: null, jitter: 0, seed: 1, offset: 0, quiet: false };
for (let i = 0; i < argv.length; i++) {
  const k = argv[i], v = argv[i + 1];
  if (k === '--a') { opt.a = v; i++; } else if (k === '--b') { opt.b = v; i++; }
  else if (k === '--rounds') { opt.rounds = +v; i++; } else if (k === '--sa') { opt.sa = parseStats(v); i++; }
  else if (k === '--sb') { opt.sb = parseStats(v); i++; } else if (k === '--jitter') { opt.jitter = +v; i++; }
  else if (k === '--seed') { opt.seed = +v; i++; } else if (k === '--offset') { opt.offset = +v; i++; }
  else if (k === '-q') opt.quiet = true;
}
const A = (await import(pathToFileURL(join(resolveBotDir(opt.a), 'bot.js')).href + '?x=a')).default;
const B = (await import(pathToFileURL(join(resolveBotDir(opt.b), 'bot.js')).href + '?x=b')).default;
if (opt.sa) A.stats = opt.sa;
if (opt.sb) B.stats = opt.sb;
const rng = mulberry32(opt.seed);
if (A._DBG) A._DBG.on = true;

const agg = { A: [], B: [] }; // попадания по A / по B
for (let i = 0; i < opt.rounds; i++) {
  const plan = E.roundPlan(i + opt.offset);
  const aSide = plan.swap ? 1 : 0;
  const bots = aSide === 0 ? [A, B] : [B, A];
  const round = E.createRound({ mapIndex: plan.mapIndex, tanks: bots.map((b) => ({ name: b.name, stats: b.stats })) });
  for (let s = 0; s < 2; s++) bots[s].init?.({ round: i, side: s, mapName: round.map.name, view: E.botView(round, s) });
  const born = new Map(); // id -> инфо о выстреле
  if (A._DBG) A._DBG.log = [];
  const jit = [null, null];
  const lines = [];
  while (!round.over) {
    const acts = [0, 1].map((s) => bots[s].tick(E.botView(round, s)));
    if (opt.jitter > 0) {
      for (let s = 0; s < 2; s++) {
        if (jit[s] && jit[s].left-- > 0) { acts[s] = { ...acts[s], throttle: jit[s].thr, turn: jit[s].turn }; continue; }
        jit[s] = null;
        if (rng() < opt.jitter) jit[s] = { left: 5 + Math.floor(rng() * 10), thr: rng() * 2 - 1, turn: rng() * 2 - 1 };
      }
    }
    const before = new Map(round.bullets.map((b) => [b.id, { ...b }]));
    const ev = E.stepRound(round, acts);
    for (const b of round.bullets) {
      if (!born.has(b.id)) {
        const sh = round.tanks[b.owner], vi = round.tanks[1 - b.owner];
        born.set(b.id, { t: round.time, d: Math.hypot(sh.x - vi.x, sh.y - vi.y), vSpeed: vi.speed, vHead: vi.heading, ang: Math.atan2(b.vy, b.vx) });
      }
    }
    for (const e of ev) {
      if (e.type !== 'hit' || e.cause === 'zone') continue;
      // найти снаряд, который исчез в этот тик и был рядом
      let best = null, bd = 1e9;
      for (const [id, b] of before) {
        if (round.bullets.some((x) => x.id === id)) continue;
        if (b.owner !== e.by) continue;
        const d = Math.hypot(b.x - e.bx, b.y - e.by_);
        if (d < bd) { bd = d; best = id; }
      }
      let info = best !== null ? born.get(best) : null;
      if (!info) {
        // снаряд, родившийся и попавший в тот же тик
        info = { t: round.time, d: Math.hypot(round.tanks[0].x - round.tanks[1].x, round.tanks[0].y - round.tanks[1].y), vSpeed: 0, vHead: 0, ang: 0, instant: true };
      }
      const victimIsA = e.side === aSide;
      const flight = round.time - info.t + E.DT;
      const lat = Math.abs(Math.sin(info.vHead - info.ang));
      let tl = '';
      if (victimIsA && A._DBG && best !== null) {
        for (const L of A._DBG.log) { if (L.tick < Math.round(info.t / E.DT) - 1) continue; tl += L.hits.includes(best) ? (L.nSafe > 0 ? 'h' : 'H') : L.threats.includes(best) ? '.' : '_'; }
      }
      const rec = { t: round.time, victim: victimIsA ? 'A' : 'B', d: info.d, flight, ric: e.ricochet, self: e.cause === 'self', lat, vSpeed: info.vSpeed, dmg: e.damage };
      agg[rec.victim].push(rec);
      lines.push(`  ${rec.t.toFixed(1)}s по ${rec.victim}${rec.self ? ' (сам)' : ''}${rec.ric ? ' рикошет' : ''} дист ${rec.d.toFixed(0)} полёт ${rec.flight.toFixed(2)}с бок ${rec.lat.toFixed(2)} v ${rec.vSpeed.toFixed(0)} ${tl}`);
    }
  }
  const ta = round.tanks[aSide], tb = round.tanks[1 - aSide];
  const w = round.winner === null ? 'D' : round.winner === aSide ? 'A' : 'B';
  console.log(`Раунд ${i + 1} ${round.map.name} A ${aSide ? 'справа' : 'слева'} → ${w} ${round.endReason} ${round.time.toFixed(1)}с HP A ${Math.ceil(ta.hp)}/${ta.stats.maxHp} B ${Math.ceil(tb.hp)}/${tb.stats.maxHp} · аптечки A ${ta.tally.kits} B ${tb.tally.kits} · зона A ${ta.tally.zoneDamage.toFixed(0)} B ${tb.tally.zoneDamage.toFixed(0)}`);
  if (!opt.quiet) for (const l of lines) console.log(l);
}
for (const side of ['A', 'B']) {
  const hs = agg[side];
  if (!hs.length) continue;
  const bins = [[0, 150], [150, 250], [250, 350], [350, 450], [450, 600], [600, 2000]];
  const s = bins.map(([lo, hi]) => `${lo}-${hi}: ${hs.filter((h) => h.d >= lo && h.d < hi).length}`).join(', ');
  console.log(`Попаданий по ${side}: ${hs.length} (рикошет ${hs.filter((h) => h.ric).length}, сам ${hs.filter((h) => h.self).length}) · по дистанции выстрела: ${s} · ср. полёт ${(hs.reduce((a, h) => a + h.flight, 0) / hs.length).toFixed(2)}с`);
}
