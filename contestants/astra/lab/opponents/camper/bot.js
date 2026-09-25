export default {name:'Camper',stats:{armor:5,engine:0,gun:5,reload:0},tick(s){
const dx=s.enemy.x-s.me.x,dy=s.enemy.y-s.me.y,t=Math.hypot(dx,dy)/s.me.stats.bulletSpeed;
const a=Math.atan2(dy+s.enemy.vy*t,dx+s.enemy.vx*t)-s.me.turret;
const e=Math.atan2(Math.sin(a),Math.cos(a));
return {throttle:0,turn:0,turretTurn:Math.max(-1,Math.min(1,e/(2.8*s.dt))),fire:Math.abs(e)<0.1};}};