import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const base = readFileSync(new URL('../arena/sparring/hunter/bot.js', import.meta.url),'utf8')
  .replace('clamp(-back * 3, -1, 1)', 'clamp(back * 6, -1, 1)')
  .replace('clamp(turretDiff * 8, -1, 1)', 'clamp(turretDiff / (2.8 / 30), -1, 1)');
const ref = readFileSync(new URL('./reference-v1/bot.js', import.meta.url),'utf8');
const write = (name, code) => { const dir = new URL('./opponents/'+name+'/',import.meta.url); mkdirSync(dir,{recursive:true}); writeFileSync(new URL('bot.js',dir),code); };
write('rush',base.replace("name: 'Охотник'", "name: 'Rush'")
  .replace('armor: 3, engine: 3, gun: 2, reload: 2','armor: 2, engine: 1, gun: 2, reload: 5')
  .replace('const danger = threat(me, s.bullets);','const danger = null;')
  .replace('if (goal.x === enemy.x && los && dist < 420)', 'if (goal.x === enemy.x && los && dist < 65)'));
write('sniper',base.replace("name: 'Охотник'", "name: 'Sniper'")
  .replace('armor: 3, engine: 3, gun: 2, reload: 2','armor: 2, engine: 0, gun: 4, reload: 4')
  .replace('const danger = threat(me, s.bullets);','const danger = null;')
  .replace('return { throttle: drive.throttle, turn: drive.turn, turretTurn, fire };','return { throttle: los ? 0 : drive.throttle, turn: los ? 0 : drive.turn, turretTurn, fire };'));
write('kite',base.replace("name: 'Охотник'", "name: 'Kite'")
  .replace('armor: 3, engine: 3, gun: 2, reload: 2','armor: 1, engine: 4, gun: 2, reload: 3')
  .replace('dist < 420', 'dist < 650').replace('dist < 250 ? 330 : 300','dist < 400 ? 550 : 500'));
write('reckless',ref.replace("name: 'ПАРАЛЛАКС'","name: 'Brawler'")
  .replace('enemy.stats.maxSpeed > 180 ? 300 : 350','100')
  .replace('if (d < 150) cost += (150 - d) * 0.09;','if (d < 60) cost += (60 - d) * 0.09;')
  .replace('threats[j].damage * 7','threats[j].damage * 2'));
write('evasive',ref.replace("name: 'ПАРАЛЛАКС'","name: 'Evasive'")
  .replace('armor: 2, engine: 1, gun: 2, reload: 5','armor: 1, engine: 4, gun: 2, reload: 3')
  .replace('enemy.stats.maxSpeed > 180 ? 300 : 350','520'));
write('pacifist',ref.replace("name: 'ПАРАЛЛАКС'","name: 'Pacifist'")
  .replace('armor: 2, engine: 1, gun: 2, reload: 5','armor: 5, engine: 5, gun: 0, reload: 0')
  .replace('fire: shot.fire','fire: false'));
write('camper',`export default {name:'Camper',stats:{armor:5,engine:0,gun:5,reload:0},tick(s){
const dx=s.enemy.x-s.me.x,dy=s.enemy.y-s.me.y,t=Math.hypot(dx,dy)/s.me.stats.bulletSpeed;
const a=Math.atan2(dy+s.enemy.vy*t,dx+s.enemy.vx*t)-s.me.turret;
const e=Math.atan2(Math.sin(a),Math.cos(a));
return {throttle:0,turn:0,turretTurn:Math.max(-1,Math.min(1,e/(2.8*s.dt))),fire:Math.abs(e)<0.1};}};`);
console.log('Generated seven synthetic opponents. All code derives from our own bot or the supplied sparring bot.');
