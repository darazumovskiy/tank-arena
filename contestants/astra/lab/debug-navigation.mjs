import { readFileSync } from 'node:fs';
import { createRound,stepRound,botView } from '../arena/engine.js';
const source=readFileSync(new URL('../tank/bot.js',import.meta.url),'utf8')
 .replace('return { point: path[index], length: best };','return { point: path[index], length: best, path, index };')
 +'\nexport const debug=s=>({target,route:route(s.me,s.enemy)});';
const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const mine=mod.default,theirs=(await import('./opponents/evasive/bot.js')).default;
const r=createRound({mapIndex:1,tanks:[mine,theirs]});
for(let i=0;i<2;i++)[mine,theirs][i].init({round:5,side:i,mapName:r.map.name,view:botView(r,i)});
while(!r.over&&r.time<22){
 const s=botView(r,0),a=mine.tick(s),b=theirs.tick(botView(r,1));
 if(r.tick%90===0)console.log(JSON.stringify({t:r.time,me:s.me,action:a,...mod.debug(s)}));
 stepRound(r,[a,b]);
}
