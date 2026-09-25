import { createRound, stepRound, botView, roundPlan } from '../arena/engine.js';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['rush','sniper','kite','reckless','evasive','pacifist','camper'];
const report=[]; let serial=0;
for(const name of names){
  const mine=(await import('../tank/bot.js?stress='+serial++)).default;
  const theirs=(await import('./opponents/'+name+'/bot.js?stress='+serial++)).default;
  const record={name,w:0,l:0,d:0,ms:[],rounds:[]};
  for(let i=0;i<8;i++){
    const plan=roundPlan(i),side=plan.swap?1:0,bots=side===0?[mine,theirs]:[theirs,mine];
    const r=createRound({mapIndex:plan.mapIndex,tanks:bots});
    for(let j=0;j<2;j++)bots[j].init?.({round:i,side:j,mapName:r.map.name,view:botView(r,j)});
    const trace=[];
    while(!r.over){
      const actions=bots.map((bot,j)=>{const view=botView(r,j),t=performance.now(),a=bot.tick(view); if(j===side)record.ms.push(performance.now()-t);return a;});
      const events=stepRound(r,actions);
      if(r.tick%15===0||events.some(e=>e.type==='hit'))trace.push({time:r.time,tanks:r.tanks.map(t=>({x:t.x,y:t.y,heading:t.heading,turret:t.turret,hp:t.hp})),events:events.filter(e=>e.type==='hit'||e.type==='pickup')});
    }
    const a=r.tanks[side],b=r.tanks[1-side],result=r.winner===null?'d':r.winner===side?'w':'l';
    record[result]++;record.rounds.push({map:r.map.name,side,result,time:r.time,hp:a.hp,enemyHp:b.hp,tally:a.tally});
    if(result!=='w'||r.time>60)writeFileSync(new URL('./trace-'+name+'-'+i+'.json',import.meta.url),JSON.stringify({map:r.map,side,trace}));
  }
  record.ms.sort((a,b)=>a-b);record.timing={calls:record.ms.length,p99:record.ms[Math.floor(record.ms.length*.99)],max:record.ms.at(-1)};delete record.ms;
  report.push(record);console.log(JSON.stringify(record));
  writeFileSync(new URL('./stress-results.json',import.meta.url),JSON.stringify(report,null,2));
}
