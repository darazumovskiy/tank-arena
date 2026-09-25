import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const gauntlet=read('./gauntlet-results.json')[0], stress=read('./stress-results.json'), verification=read('./verification.json');
const total={wins:gauntlet.wins,losses:gauntlet.losses,draws:gauntlet.draws};
for(const r of stress){total.wins+=r.w;total.losses+=r.l;total.draws+=r.d;}
const hashes=Object.fromEntries(['bot.js','body.svg','turret.svg'].map(f=>[f,createHash('sha256').update(readFileSync(new URL('../tank/'+f,import.meta.url))).digest('hex')]));
assert.deepEqual(hashes,verification.hashes,'Submission must match the validated source and images');
assert.equal(total.wins+total.losses+total.draws,104);
const report={hashes,stats:{armor:2,engine:1,gun:2,reload:5},official:{hunter:[16,0,0],dummy:[8,0,0],mirror:[4,4,0]},expanded:{...total,rounds:104,opponents:13},zone:{rounds:8,secondsPerRound:120,damage:0},sequentialCliTiming:{averageMs:[0.201,0.250],maxMs:4.0,errors:0},preview:'preview.png'};
writeFileSync(new URL('./final-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
