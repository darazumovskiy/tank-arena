import assert from 'node:assert/strict';
import { createRound, stepRound, botView, roundPlan, checkStats } from '../arena/engine.js';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const a = (await import('../tank/bot.js?verify=0')).default;
const b = (await import('../tank/bot.js?verify=1')).default;
assert.equal(checkStats(a.stats).total, 10);
assert.ok(a.name.length <= 20 && a.motto.length <= 60);
const checks = [], timings = [];
// With guns disabled, force all maps through the complete 60..100 s zone
// shrink and the 120 s endgame; normal short victories do not exercise this.
for (let i = 0; i < 8; i++) {
  const plan = roundPlan(i), bots = plan.swap ? [b,a] : [a,b];
  const r = createRound({ mapIndex: plan.mapIndex, tanks: bots });
  bots.forEach((bot,side)=>bot.init({ round:i, side, mapName:r.map.name, view:botView(r,side) }));
  while (!r.over) {
    const actions = bots.map((bot,side)=> {
      const s=botView(r,side), t=performance.now(), action=bot.tick(s);
      timings.push(performance.now()-t);
      assert.ok([action.throttle,action.turn,action.turretTurn].every(v=>Number.isFinite(v)&&v>=-1&&v<=1));
      return { ...action, fire:false };
    });
    stepRound(r,actions);
  }
  const entry={map:r.map.name,round:i,seconds:r.time,hp:r.tanks.map(t=>t.hp),zoneDamage:r.tanks.map(t=>t.tally.zoneDamage)};
  checks.push(entry);
  assert.equal(r.time,120,'must survive the full zone test');
  for(const t of r.tanks) assert.equal(t.tally.zoneDamage,0,'avoid damage from the shrinking zone');
  console.log(JSON.stringify(entry));
}
timings.sort((a,b)=>a-b);
const hashes=Object.fromEntries(['bot.js','body.svg','turret.svg'].map(f=>[f,createHash('sha256').update(readFileSync(new URL('../tank/'+f,import.meta.url))).digest('hex')]));
const report={hashes,checks,timing:{calls:timings.length,p99:timings[Math.floor(timings.length*.99)],max:timings.at(-1)}};
writeFileSync(new URL('./verification.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report.timing));
