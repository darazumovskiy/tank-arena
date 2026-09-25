import { createRound, stepRound, botView, roundPlan } from '../arena/engine.js';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2);
const sweep = args.includes('--sweep');
const configs = sweep ? [
  [2,1,2,5], [1,2,2,5], [1,1,3,5], [2,0,3,5], [0,2,3,5],
  [0,3,2,5], [2,2,1,5], [3,0,2,5], [0,1,4,5], [1,0,4,5],
  [1,3,1,5], [2,1,3,4], [2,2,2,4], [3,1,2,4], [0,0,5,5],
  [1,2,3,4], [1,3,2,4], [0,4,2,4], [1,4,1,4], [3,2,0,5],
] : [[2,1,2,5]];
const stat = a => Object.fromEntries(['armor','engine','gun','reload'].map((k,i) => [k,a[i]]));
const opponents = [
  { name: 'hunter', file: '../arena/sparring/hunter/bot.js', stats: [3,3,2,2] },
  { name: 'fast-hunter', file: '../arena/sparring/hunter/bot.js', stats: [0,5,2,3] },
  { name: 'v1-balanced', file: './reference-v1/bot.js', stats: [2,1,2,5] },
  { name: 'v1-mobile', file: './reference-v1/bot.js', stats: [1,3,2,4] },
  { name: 'v1-glass', file: './reference-v1/bot.js', stats: [0,0,5,5] },
  { name: 'v1-armored', file: './reference-v1/bot.js', stats: [4,0,1,5] },
];
let serial = 0;
async function load(file) { return (await import(new URL(file + '?test=' + serial++, import.meta.url))).default; }
const all = [];
for (const config of configs) {
  const record = { config, wins: 0, losses: 0, draws: 0, score: 0, damage: 0, taken: 0, self: 0, zone: 0, kits: 0, calls: 0, ms: 0, maxMs: 0, matches: [] };
  for (const opponent of opponents) {
    const mine = await load('../tank/bot.js'), theirs = await load(opponent.file);
    mine.stats = stat(config); theirs.stats = stat(opponent.stats);
    const pair = { opponent: opponent.name, w: 0, l: 0, d: 0, rounds: [] };
    for (let i = 0; i < 8; i++) {
      const plan = roundPlan(i), side = plan.swap ? 1 : 0;
      const bots = side === 0 ? [mine, theirs] : [theirs, mine];
      const r = createRound({ mapIndex: plan.mapIndex, tanks: bots });
      for (let j = 0; j < 2; j++) bots[j].init?.({ round: i, side: j, mapName: r.map.name, view: botView(r,j) });
      while (!r.over) {
        const actions = bots.map((b,j) => {
          const s = botView(r,j), start = performance.now(), action = b.tick(s);
          if (j === side) { const ms = performance.now()-start; record.calls++; record.ms += ms; record.maxMs = Math.max(record.maxMs,ms); }
          if (![action.throttle, action.turn, action.turretTurn].every(v => Number.isFinite(v) && v >= -1 && v <= 1)) throw new Error('Invalid action');
          return action;
        });
        stepRound(r,actions);
      }
      const a = r.tanks[side], b = r.tanks[1-side];
      const result = r.winner === null ? 'd' : r.winner === side ? 'w' : 'l';
      pair[result]++; record[result === 'w' ? 'wins' : result === 'l' ? 'losses' : 'draws']++;
      record.score += a.hp/a.stats.maxHp-b.hp/b.stats.maxHp;
      record.damage += a.tally.damageDealt; record.taken += a.tally.damageTaken; record.self += a.tally.selfDamage;
      record.zone += a.tally.zoneDamage; record.kits += a.tally.kits;
      pair.rounds.push({ map:r.map.name, side, result, seconds:r.time, hp:a.hp, enemyHp:b.hp, tally:a.tally });
    }
    record.matches.push(pair);
  }
  all.push(record);
  console.log(JSON.stringify({ config, w:record.wins,l:record.losses,d:record.draws,score:+record.score.toFixed(2), self:record.self, zone:+record.zone.toFixed(1), ms:+(record.ms/record.calls).toFixed(3), max:+record.maxMs.toFixed(1), opponents:record.matches.map(p=>p.opponent+':'+p.w+'-'+p.l+'-'+p.d) }));
  writeFileSync(new URL(sweep ? './stats-sweep.json' : './gauntlet-results.json',import.meta.url),JSON.stringify(all,null,2));
}
