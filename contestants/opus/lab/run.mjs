#!/usr/bin/env node
// Стенд: параллельные матчи A против B с подробной статистикой.
//   node lab/run.mjs --a tank --b hunter --matches 20 --rounds 8 --jitter 0.02
//   --a/--b: папка с bot.js (tank, hunter, dummy, lab/opponents/x, lab/snap/v1 ...)
//   --sa/--sb "armor,engine,gun,reload" — подменить характеристики
//   --pa/--pb "key=val,key=val" — подменить bot._P
//   --jitter p — с вероятностью p за тик оба танка на 5..15 тиков получают случайный газ/поворот
//   --map имя — только одна карта
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import os from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const enginePath = join(root, 'arena', 'engine.js');

function resolveBotDir(spec) {
  const cands = [resolve(process.cwd(), spec), resolve(root, spec), join(root, 'arena', 'sparring', spec), join(here, 'opponents', spec), join(here, 'snap', spec)];
  for (const c of cands) if (existsSync(join(c, 'bot.js'))) return c;
  throw new Error(`нет bot.js для ${spec}`);
}

function parseStats(s) {
  if (!s) return null;
  const [armor, engine, gun, reload] = s.split(',').map(Number);
  return { armor, engine, gun, reload };
}
function parseParams(s) {
  if (!s) return null;
  const o = {};
  for (const kv of s.split(',')) {
    const [k, v] = kv.split('=');
    o[k] = Number.isNaN(Number(v)) ? v : Number(v);
  }
  return o;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function runMatch(job) {
  const E = await import(pathToFileURL(enginePath).href);
  const load = async (dir, tag) => {
    const mod = await import(pathToFileURL(join(dir, 'bot.js')).href + `?m=${job.id}-${tag}-${Math.random()}`);
    return mod.default ?? mod;
  };
  const A = await load(job.a, 'a');
  const B = await load(job.b, 'b');
  if (job.sa) A.stats = job.sa;
  if (job.sb) B.stats = job.sb;
  if (job.pa && A._P) Object.assign(A._P, job.pa);
  if (job.pb && B._P) Object.assign(B._P, job.pb);
  const rng = mulberry32(job.seed);
  const entries = [
    { bot: A, time: 0, max: 0, calls: 0, errors: 0 },
    { bot: B, time: 0, max: 0, calls: 0, errors: 0 },
  ];
  const call = (e, fn, arg) => {
    const t0 = performance.now();
    try { return e.bot[fn]?.(arg); } catch (err) { e.errors++; if (e.errors < 3) console.error(String(err?.stack || err)); return null; }
    finally { if (fn === 'tick') { const d = performance.now() - t0; e.time += d; e.calls++; if (d > e.max) e.max = d; } }
  };
  const out = [];
  for (let i = 0; i < job.rounds; i++) {
    const plan = E.roundPlan(i + (job.offset || 0));
    const mapIndex = job.map >= 0 ? job.map : plan.mapIndex;
    const aSide = plan.swap ? 1 : 0;
    const bySide = aSide === 0 ? [entries[0], entries[1]] : [entries[1], entries[0]];
    const round = E.createRound({ mapIndex, tanks: bySide.map((e) => ({ name: e.bot.name, stats: e.bot.stats })) });
    if (job.spread > 0) {
      // Случайный сдвиг старта (симметрично для обеих сторон не делаем — разнообразие важнее).
      for (const t of round.tanks) {
        for (let tries = 0; tries < 20; tries++) {
          const nx = t.x + (rng() * 2 - 1) * job.spread, ny = t.y + (rng() * 2 - 1) * job.spread * 2;
          const ok = nx > 30 && nx < 1570 && ny > 30 && ny < 870 && !round.map.walls.some((w) => nx > w.x - 30 && nx < w.x + w.w + 30 && ny > w.y - 30 && ny < w.y + w.h + 30);
          if (ok) { t.x = nx; t.y = ny; break; }
        }
        t.heading += (rng() * 2 - 1) * 0.8;
        t.turret = t.heading;
      }
    }
    for (let s = 0; s < 2; s++) call(bySide[s], 'init', { round: i, side: s, mapName: round.map.name, view: E.botView(round, s) });
    const jit = [null, null];
    let firstHit = null;
    const hitsLog = [];
    while (!round.over) {
      const acts = [0, 1].map((s) => call(bySide[s], 'tick', E.botView(round, s)));
      if (job.jitter > 0) {
        for (let s = 0; s < 2; s++) {
          if (jit[s] && jit[s].left-- > 0) { acts[s] = { ...(acts[s] || {}), throttle: jit[s].thr, turn: jit[s].turn }; continue; }
          jit[s] = null;
          if (rng() < job.jitter) jit[s] = { left: 5 + Math.floor(rng() * 10), thr: rng() * 2 - 1, turn: rng() * 2 - 1 };
        }
      }
      const ev = E.stepRound(round, acts);
      for (const e of ev) {
        if (e.type === 'hit' && e.cause !== 'zone') {
          const victimIsA = e.side === aSide;
          hitsLog.push({ t: +round.time.toFixed(2), v: victimIsA ? 'A' : 'B', d: Math.round(e.damage), r: !!e.ricochet, self: e.cause === 'self' });
        }
      }
    }
    const ta = round.tanks[aSide], tb = round.tanks[1 - aSide];
    out.push({
      map: round.map.name, aSide, time: round.time, reason: round.endReason,
      winner: round.winner === null ? 'D' : round.winner === aSide ? 'A' : 'B',
      hpA: ta.hp, hpB: tb.hp, maxA: ta.stats.maxHp, maxB: tb.stats.maxHp,
      tA: ta.tally, tB: tb.tally, hits: hitsLog, seed: job.seed, idx: i,
    });
  }
  return { rounds: out, perf: entries.map((e) => ({ avg: e.calls ? e.time / e.calls : 0, max: e.max, errors: e.errors })), names: [A.name, B.name] };
}

if (!isMainThread) {
  runMatch(workerData).then((r) => parentPort.postMessage(r)).catch((err) => parentPort.postMessage({ error: String(err?.stack || err) }));
} else {
  const argv = process.argv.slice(2);
  const opt = { a: 'tank', b: 'hunter', matches: 8, rounds: 8, jitter: 0, spread: 60, workers: Math.max(1, os.cpus().length - 2), seed: 1, map: null, sa: null, sb: null, pa: null, pb: null, json: false, verbose: false, offset: 0 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--a') { opt.a = v; i++; }
    else if (k === '--b') { opt.b = v; i++; }
    else if (k === '--matches') { opt.matches = +v; i++; }
    else if (k === '--rounds') { opt.rounds = +v; i++; }
    else if (k === '--jitter') { opt.jitter = +v; i++; }
    else if (k === '--spread') { opt.spread = +v; i++; }
    else if (k === '--workers') { opt.workers = +v; i++; }
    else if (k === '--seed') { opt.seed = +v; i++; }
    else if (k === '--map') { opt.map = v; i++; }
    else if (k === '--sa') { opt.sa = parseStats(v); i++; }
    else if (k === '--sb') { opt.sb = parseStats(v); i++; }
    else if (k === '--pa') { opt.pa = parseParams(v); i++; }
    else if (k === '--pb') { opt.pb = parseParams(v); i++; }
    else if (k === '--offset') { opt.offset = +v; i++; }
    else if (k === '--json') opt.json = true;
    else if (k === '-v' || k === '--verbose') opt.verbose = true;
  }
  const E = await import(pathToFileURL(enginePath).href);
  const mapIdx = opt.map === null ? -1 : E.MAPS.findIndex((m, i) => m.name.toLowerCase() === String(opt.map).toLowerCase() || String(i) === String(opt.map));
  const aDir = resolveBotDir(opt.a), bDir = resolveBotDir(opt.b);
  const jobs = [];
  for (let m = 0; m < opt.matches; m++) {
    jobs.push({ id: m, a: aDir, b: bDir, rounds: opt.rounds, jitter: opt.jitter, spread: opt.spread, seed: opt.seed * 1000 + m, map: mapIdx, sa: opt.sa, sb: opt.sb, pa: opt.pa, pb: opt.pb, offset: opt.offset });
  }
  const t0 = Date.now();
  const results = [];
  let next = 0;
  await new Promise((done) => {
    let running = 0;
    const launch = () => {
      while (running < opt.workers && next < jobs.length) {
        const job = jobs[next++];
        running++;
        const w = new Worker(fileURLToPath(import.meta.url), { workerData: job });
        w.once('message', (r) => {
          if (r.error) console.error(r.error); else results.push(r);
          running--;
          w.terminate();
          if (next >= jobs.length && running === 0) done(); else launch();
        });
        w.once('error', (err) => { console.error(err); running--; if (next >= jobs.length && running === 0) done(); else launch(); });
      }
    };
    launch();
  });
  const all = results.flatMap((r) => r.rounds);
  const sum = { A: 0, B: 0, D: 0 };
  const byMap = {};
  let fracDiff = 0, dealtA = 0, dealtB = 0, shotsA = 0, hitsA = 0, shotsB = 0, hitsB = 0, selfA = 0, selfB = 0, kitsA = 0, kitsB = 0, zoneA = 0, zoneB = 0, timeSum = 0, kills = 0, ricA = 0, ricB = 0, icA = 0, icB = 0;
  for (const r of all) {
    sum[r.winner]++;
    const key = `${r.map}/${r.aSide ? 'R' : 'L'}`;
    byMap[key] ??= { A: 0, B: 0, D: 0 };
    byMap[key][r.winner]++;
    fracDiff += r.hpA / r.maxA - r.hpB / r.maxB;
    dealtA += r.tA.damageDealt; dealtB += r.tB.damageDealt;
    shotsA += r.tA.shots; hitsA += r.tA.hits; shotsB += r.tB.shots; hitsB += r.tB.hits;
    selfA += r.tA.selfDamage; selfB += r.tB.selfDamage; kitsA += r.tA.kits; kitsB += r.tB.kits;
    zoneA += r.tA.zoneDamage; zoneB += r.tB.zoneDamage; ricA += r.tA.ricochetHits; ricB += r.tB.ricochetHits; icA += r.tA.intercepts; icB += r.tB.intercepts;
    timeSum += r.time; if (r.reason === 'kill') kills++;
  }
  const n = all.length || 1;
  const names = results[0]?.names || ['A', 'B'];
  const perfA = results.map((r) => r.perf[0]), perfB = results.map((r) => r.perf[1]);
  const avgA = perfA.reduce((s, p) => s + p.avg, 0) / (perfA.length || 1), maxA = Math.max(0, ...perfA.map((p) => p.max));
  const avgB = perfB.reduce((s, p) => s + p.avg, 0) / (perfB.length || 1), maxB = Math.max(0, ...perfB.map((p) => p.max));
  const score = (sum.A + 0.5 * sum.D) / n;
  if (opt.json) {
    console.log(JSON.stringify({ score, sum, n, byMap, fracDiff: fracDiff / n }));
  } else {
    console.log(`${names[0]} (${opt.a}) vs ${names[1]} (${opt.b}) · ${n} раундов · jitter ${opt.jitter} spread ${opt.spread} · ${((Date.now() - t0) / 1000).toFixed(1)} с`);
    console.log(`Счёт A ${sum.A} : ${sum.B} B, ничьих ${sum.D} → доля A ${(100 * score).toFixed(1)}%   ΔHP% ${(100 * fracDiff / n).toFixed(1)}   убийств ${kills}/${n}, ср. время ${(timeSum / n).toFixed(1)} с`);
    console.log(`Урон A→B ${(dealtA / n).toFixed(0)}, B→A ${(dealtB / n).toFixed(0)} за раунд · точность A ${(100 * hitsA / Math.max(1, shotsA)).toFixed(1)}% (${(shotsA / n).toFixed(0)} выстр.), B ${(100 * hitsB / Math.max(1, shotsB)).toFixed(1)}% (${(shotsB / n).toFixed(0)})`);
    console.log(`Рикошетные попадания A ${ricA}, B ${ricB} · урон себе A ${selfA.toFixed(0)}, B ${selfB.toFixed(0)} · аптечки A ${kitsA}, B ${kitsB} · зона A ${zoneA.toFixed(0)}, B ${zoneB.toFixed(0)} · перехваты A ${icA}, B ${icB}`);
    console.log('По картам (A:B:D): ' + Object.entries(byMap).sort().map(([k, v]) => `${k} ${v.A}:${v.B}:${v.D}`).join(' · '));
    console.log(`tick A ср. ${avgA.toFixed(2)} мс, макс ${maxA.toFixed(1)} · B ср. ${avgB.toFixed(2)} мс, макс ${maxB.toFixed(1)}`);
    if (opt.verbose) {
      for (const r of all) {
        console.log(`${r.map.padEnd(9)} ${r.aSide ? 'R' : 'L'} ${r.winner} ${r.reason} ${r.time.toFixed(1)}s HP ${Math.ceil(r.hpA)}/${r.maxA} vs ${Math.ceil(r.hpB)}/${r.maxB} зонаA ${r.tA.zoneDamage.toFixed(0)} себеA ${r.tA.selfDamage.toFixed(0)} seed ${r.seed} №${r.idx}  hits: ${r.hits.map((h) => `${h.t}${h.v}${h.r ? 'r' : ''}${h.self ? 's' : ''}`).join(' ')}`);
      }
    }
  }
}
