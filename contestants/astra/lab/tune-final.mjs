import { createRound, stepRound, botView, roundPlan } from '../arena/engine.js';
import { readFileSync, writeFileSync } from 'node:fs';
const source=readFileSync(new URL('../tank/bot.js',import.meta.url),'utf8');
const anticipation = weight => `
function anticipate(s,frames,forecast) {
  const e=s.enemy,m=s.me;
  if(e.reloadLeft>0.55) return null;
  const f=Math.max(0,Math.ceil(e.reloadLeft/DT)-1),when=f*DT;
  const origin=predict(forecast,when+DT),speed=e.stats.bulletSpeed;
  let t=(distance(origin,m)-34)/speed,point;
  for(let i=0;i<4;i++) {point={x:m.x+m.vx*(when+t),y:m.y+m.vy*(when+t)};t=(distance(origin,point)-34)/speed;}
  const a=Math.atan2(point.y-origin.y,point.x-origin.x);
  if(Math.abs(angle(a-e.turret))>e.stats.turretRate*(when+DT)+0.09) return null;
  const b={x:origin.x+34*Math.cos(a),y:origin.y+34*Math.sin(a),vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,bouncesLeft:1,mine:false,canHitOwner:false};
  if(!free(b.x,b.y,5)||!clear(b,point,5))return null;
  const path=[];
  for(let i=0;i<frames;i++)path.push(i<f||b.dead?[]:advanceBullet(b));
  return {path,damage:e.stats.damage*${weight}};
}
`;
const ghost=(s,w)=>s.replace('const threats = bulletForecast(s, frames);','const threats = bulletForecast(s, frames); const incoming=anticipate(s,frames,forecast); if(incoming) threats.push(incoming);')+anticipation(w);
const fast=s=>s.replace('t - 0.35','t - (e.stats.maxSpeed > 150 ? 0.12 : 0.35)');
const variants=[
 ['control',s=>s],
 ['fast-turn',s=>fast(s)],
 ['fast-linear',s=>s.replace('const tr = enemyTurn *','const tr = (e.stats.maxSpeed > 150 ? 0 : enemyTurn) *')],
 ['anticipate-12',s=>ghost(s,.12)],
 ['anticipate-30',s=>ghost(s,.30)],
 ['anticipate-fast',s=>fast(ghost(s,.12))],
 ['gunner',s=>s.replace('armor: 2, engine: 1, gun: 2, reload: 5','armor: 2, engine: 0, gun: 3, reload: 5')],
 ['gunner-anticipate',s=>fast(ghost(s,.12)).replace('armor: 2, engine: 1, gun: 2, reload: 5','armor: 2, engine: 0, gun: 3, reload: 5')],
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
 writeFileSync(new URL('./final-tuning-results.json',import.meta.url),JSON.stringify(results,null,2));
}
