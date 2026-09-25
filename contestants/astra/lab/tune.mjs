import { createRound, stepRound, botView, roundPlan } from '../arena/engine.js';
import { readFileSync, writeFileSync } from 'node:fs';
const source=readFileSync(new URL('../tank/bot.js',import.meta.url),'utf8');
const variants=[
  ['control',s=>s],
  ['exact-arrival',s=>s.replace('predict(forecast, t + DT)','predict(forecast, t)')],
  ['short-turn',s=>s.replace('t - 0.35','t - 0.15').replace('predict(forecast, t + DT)','predict(forecast, t)')],
  ['long-turn',s=>s.replace('t - 0.35','t - 0.65').replace('predict(forecast, t + DT)','predict(forecast, t)')],
  ['straight-lead',s=>s.replace('const tr = enemyTurn *','const tr = 0 *').replace('predict(forecast, t + DT)','predict(forecast, t)')],
  ['careful',s=>s.replace('threats[j].damage * 7','threats[j].damage * 12')],
  ['assertive',s=>s.replace('threats[j].damage * 7','threats[j].damage * 3')],
  ['close-range',s=>s.replace('enemy.stats.maxSpeed > 180 ? 300 : 350','enemy.stats.maxSpeed > 180 ? 230 : 300')],
  ['wall-clearance',s=>s.replace('clear(from, nodes[i], 24.2)','clear(from, nodes[i], 23.7)')],
];
const foes=[
  ['baseline','./reference-v1/bot.js',null],
  ['gunner','./reference-v1/bot.js',{armor:2,engine:0,gun:3,reload:5}],
  ['glass','./reference-v1/bot.js',{armor:0,engine:0,gun:5,reload:5}],
  ['evasive','./opponents/evasive/bot.js',null],
  ['brawler','./opponents/reckless/bot.js',null],
];
let serial=0;const results=[];
for(const [name,transform] of variants){
 const code=transform(source),record={name,w:0,l:0,d:0,score:0,self:0,damage:0,taken:0,zone:0,pairs:[]};
 for(const [foe,file,stats] of foes){
  const mine=(await import('data:text/javascript;base64,'+Buffer.from(code+'\n//'+serial++).toString('base64'))).default;
  const theirs=(await import(file+'?tune='+serial++)).default;if(stats)theirs.stats=stats;
  const pair={foe,w:0,l:0,d:0};
  for(let i=0;i<8;i++){
   const plan=roundPlan(i),side=plan.swap?1:0,bots=side===0?[mine,theirs]:[theirs,mine];
   const r=createRound({mapIndex:plan.mapIndex,tanks:bots});
   for(let j=0;j<2;j++)bots[j].init?.({round:i,side:j,mapName:r.map.name,view:botView(r,j)});
   while(!r.over)stepRound(r,bots.map((b,j)=>b.tick(botView(r,j))));
   const a=r.tanks[side],b=r.tanks[1-side],outcome=r.winner===null?'d':r.winner===side?'w':'l';
   record[outcome]++;pair[outcome]++;record.score+=a.hp/a.stats.maxHp-b.hp/b.stats.maxHp;
   record.self+=a.tally.selfDamage;record.damage+=a.tally.damageDealt;record.taken+=a.tally.damageTaken;record.zone+=a.tally.zoneDamage;
  }
  record.pairs.push(pair);
 }
 results.push(record);console.log(JSON.stringify(record));
 writeFileSync(new URL('./tuning-results.json',import.meta.url),JSON.stringify(results,null,2));
}
