#!/usr/bin/env node
// Для каждой попавшей в A пули: существовал ли манёвр ухода в момент, когда пуля стала видна.
// Перебор на настоящем движке: A выполняет двухфазный план, B стоит, в поле только эта пуля.
//   node lab/dodgecheck.mjs --a tank --b v1 --sa 1,0,4,5 --sb 1,0,4,5 --rounds 8
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
const argv = process.argv.slice(2);
const opt = { a: 'tank', b: 'v1', rounds: 8, sa: null, sb: null, offset: 0 };
for (let i = 0; i < argv.length; i++) {
  const k = argv[i], v = argv[i + 1];
  if (k === '--a') { opt.a = v; i++; } else if (k === '--b') { opt.b = v; i++; }
  else if (k === '--rounds') { opt.rounds = +v; i++; } else if (k === '--sa') { opt.sa = parseStats(v); i++; }
  else if (k === '--sb') { opt.sb = parseStats(v); i++; } else if (k === '--offset') { opt.offset = +v; i++; }
}
const A = (await import(pathToFileURL(join(resolveBotDir(opt.a), 'bot.js')).href + '?x=a')).default;
const B = (await import(pathToFileURL(join(resolveBotDir(opt.b), 'bot.js')).href + '?x=b')).default;
if (opt.sa) A.stats = opt.sa;
if (opt.sb) B.stats = opt.sb;
if (A._DBG) A._DBG.on = true;

const LV = [-1, -0.5, 0, 0.5, 1];
const SPL = [1, 2, 3, 5, 8, 12, 16, 22];
function escapes(snap, aSide, bid) {
  let ok = 0, total = 0;
  for (const t1 of LV) for (const u1 of LV) for (const k1 of SPL) for (const t2 of LV) for (const u2 of LV) {
    total++;
    const r = structuredClone(snap);
    r.bullets = r.bullets.filter((b) => b.id === bid);
    let hit = false;
    for (let k = 0; k < 60 && !hit && r.bullets.length; k++) {
      const act = k < k1 ? { throttle: t1, turn: u1 } : { throttle: t2, turn: u2 };
      const acts = aSide === 0 ? [act, null] : [null, act];
      const ev = E.stepRound(r, acts);
      if (ev.some((e) => e.type === 'hit' && e.side === aSide)) hit = true;
      if (r.over) break;
    }
    if (!hit) ok++;
  }
  return { ok, total };
}

let stat = { hits: 0, escapable: 0, plannerSafe: 0 };
for (let i = 0; i < opt.rounds; i++) {
  const plan = E.roundPlan(i + opt.offset);
  const aSide = plan.swap ? 1 : 0;
  const bots = aSide === 0 ? [A, B] : [B, A];
  const round = E.createRound({ mapIndex: plan.mapIndex, tanks: bots.map((b) => ({ name: b.name, stats: b.stats })) });
  for (let s = 0; s < 2; s++) bots[s].init?.({ round: i, side: s, mapName: round.map.name, view: E.botView(round, s) });
  if (A._DBG) A._DBG.log = [];
  const snaps = new Map();
  const seen = new Set();
  console.log(`Раунд ${i + 1} ${round.map.name}, A ${aSide ? 'справа' : 'слева'}`);
  while (!round.over) {
    const acts = [0, 1].map((s) => bots[s].tick(E.botView(round, s)));
    const before = new Map(round.bullets.map((b) => [b.id, { ...b }]));
    const ev = E.stepRound(round, acts);
    for (const b of round.bullets) {
      if (!seen.has(b.id)) {
        seen.add(b.id);
        if (b.owner !== aSide) snaps.set(b.id, { snap: structuredClone(round), tick: round.tick, d: Math.hypot(round.tanks[0].x - round.tanks[1].x, round.tanks[0].y - round.tanks[1].y) });
      }
    }
    for (const e of ev) {
      if (e.type !== 'hit' || e.cause === 'zone' || e.side !== aSide) continue;
      let bid = null, bd = 1e9;
      for (const [id, b] of before) {
        if (round.bullets.some((x) => x.id === id) || b.owner === aSide) continue;
        const d = Math.hypot(b.x - e.bx, b.y - e.by_);
        if (d < bd) { bd = d; bid = id; }
      }
      const s = bid !== null ? snaps.get(bid) : null;
      if (!s) { console.log(`  ${round.time.toFixed(1)}с попадание без снимка`); continue; }
      const res = escapes(s.snap, aSide, bid);
      const L = A._DBG ? A._DBG.log.find((l) => l.tick === s.tick) : null;
      stat.hits++;
      if (res.ok > 0) stat.escapable++;
      if (L && L.nSafe > 0) stat.plannerSafe++;
      const me = s.snap.tanks[aSide];
      console.log(`  ${round.time.toFixed(1)}с дист ${s.d.toFixed(0)} полёт ${((round.tick - s.tick + 1) / 30).toFixed(2)}с · уходов ${res.ok}/${res.total} · у планировщика безопасных ${L ? L.nSafe : '?'} · v ${me.speed.toFixed(0)}`);
    }
  }
}
console.log(`Итого попаданий ${stat.hits}, из них можно было уйти ${stat.escapable}, планировщик видел уход ${stat.plannerSafe}`);
