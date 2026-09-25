// "Резонанс" — самостоятельный ES-модуль, без импортов.
// Стратегия: держать дистанцию, вести обстрел упреждением по замкнутой
// формуле, уклоняться от снарядов уходом вбок, обходить стены сеткой BFS,
// уважать сужающуюся зону и подбирать аптечки, когда это оправдано.

const TANK_R = 24; // радиус корпуса, совпадает с движком (ARENA.md)
const MUZZLE = 34; // точка вылета снаряда от центра
const CELL = 32; // размер клетки навигационной сетки
const PAD = TANK_R + 4; // отступ от стен при построении сетки

const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

// ---------- геометрия: отрезок против прямоугольника (Лиенг-Барски) ----------

function segHitsRect(x1, y1, x2, y2, r, pad) {
  const minX = r.x - pad, maxX = r.x + r.w + pad;
  const minY = r.y - pad, maxY = r.y + r.h + pad;
  const dx = x2 - x1, dy = y2 - y1;
  let tMin = 0, tMax = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) {
      if (q[i] < 0) return false;
      continue;
    }
    const t = q[i] / p[i];
    if (p[i] < 0) {
      if (t > tMax) return false;
      if (t > tMin) tMin = t;
    } else {
      if (t < tMin) return false;
      if (t < tMax) tMax = t;
    }
  }
  return true;
}

function segClear(walls, x1, y1, x2, y2, pad) {
  for (let i = 0; i < walls.length; i++) {
    if (segHitsRect(x1, y1, x2, y2, walls[i], pad)) return false;
  }
  return true;
}

function pointBlocked(x, y, w, h, walls, pad) {
  if (x < pad || x > w - pad || y < pad || y > h - pad) return true;
  for (let i = 0; i < walls.length; i++) {
    const r = walls[i];
    if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return true;
  }
  return false;
}

// ---------- навигационная сетка + BFS ----------

const gridCache = new Map();

function buildGrid(arena) {
  const cols = Math.ceil(arena.width / CELL);
  const rows = Math.ceil(arena.height / CELL);
  const free = new Uint8Array(cols * rows);
  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const x = cx * CELL + CELL / 2;
      const y = ry * CELL + CELL / 2;
      let ok = x > PAD && x < arena.width - PAD && y > PAD && y < arena.height - PAD;
      if (ok) {
        for (let i = 0; i < arena.walls.length; i++) {
          const wl = arena.walls[i];
          if (x > wl.x - PAD && x < wl.x + wl.w + PAD && y > wl.y - PAD && y < wl.y + wl.h + PAD) { ok = false; break; }
        }
      }
      free[ry * cols + cx] = ok ? 1 : 0;
    }
  }
  return { cols, rows, free };
}

function getGrid(arena) {
  let g = gridCache.get(arena.mapName);
  if (!g) { g = buildGrid(arena); gridCache.set(arena.mapName, g); }
  return g;
}

function nearestFreeIndex(g, x, y) {
  const c0 = clamp(Math.floor(x / CELL), 0, g.cols - 1);
  const r0 = clamp(Math.floor(y / CELL), 0, g.rows - 1);
  if (g.free[r0 * g.cols + c0]) return r0 * g.cols + c0;
  for (let rad = 1; rad <= 10; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const rr = r0 + dr, cc = c0 + dc;
        if (rr < 0 || rr >= g.rows || cc < 0 || cc >= g.cols) continue;
        if (g.free[rr * g.cols + cc]) return rr * g.cols + cc;
      }
    }
  }
  return r0 * g.cols + c0;
}

const NEI = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function bfsPath(g, fromIdx, toIdx) {
  if (fromIdx === toIdx) return [];
  const prev = new Int32Array(g.cols * g.rows).fill(-1);
  prev[fromIdx] = fromIdx;
  const queue = [fromIdx];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    if (cur === toIdx) break;
    const r = (cur / g.cols) | 0, c = cur % g.cols;
    for (let k = 0; k < 8; k++) {
      const dr = NEI[k][0], dc = NEI[k][1];
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= g.rows || cc < 0 || cc >= g.cols) continue;
      const n = rr * g.cols + cc;
      if (!g.free[n] || prev[n] !== -1) continue;
      if (dr !== 0 && dc !== 0 && (!g.free[r * g.cols + cc] || !g.free[rr * g.cols + c])) continue;
      prev[n] = cur;
      queue.push(n);
    }
  }
  if (prev[toIdx] === -1) return [];
  const out = [];
  let n = toIdx;
  while (n !== fromIdx) {
    const r = (n / g.cols) | 0, c = n % g.cols;
    out.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
    n = prev[n];
  }
  out.reverse();
  return out;
}

// ---------- прицеливание: точное упреждение по константной скорости цели ----------

function leadAim(me, enemy) {
  const s = me.stats.bulletSpeed;
  const rx = enemy.x - me.x, ry = enemy.y - me.y;
  const vx = enemy.vx, vy = enemy.vy;
  const a = vx * vx + vy * vy - s * s;
  const b = 2 * (rx * vx + ry * vy);
  const c = rx * rx + ry * ry;
  let t = 0;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) > 1e-6) t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b + sq) / (2 * a);
      const t2 = (-b - sq) / (2 * a);
      if (t1 > 0 && t2 > 0) t = Math.min(t1, t2);
      else if (t1 > 0) t = t1;
      else if (t2 > 0) t = t2;
    }
  }
  t = clamp(t, 0, 4);
  return { x: enemy.x + vx * t, y: enemy.y + vy * t };
}

// ---------- угроза от снарядов и уклонение ----------

function findThreat(me, bullets) {
  let worst = null;
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (b.mine && !b.canHitOwner) continue;
    const rx = me.x - b.x, ry = me.y - b.y;
    const v2 = b.vx * b.vx + b.vy * b.vy;
    if (v2 < 1) continue;
    const t = (rx * b.vx + ry * b.vy) / v2;
    if (t < 0 || t > 0.95) continue;
    const cx = b.x + b.vx * t, cy = b.y + b.vy * t;
    const miss = dist(cx, cy, me.x, me.y);
    if (miss < TANK_R + 16 && (!worst || t < worst.t)) worst = { b, t, cx, cy };
  }
  return worst;
}

// На прямой линии огня (оба танка на одной прямой с пулей) прогноз стороны
// уклонения вырождается в шум около нуля и может дёргаться каждый тик,
// гася сам себя. Поэтому сторону выбираем один раз на снаряд и держим её,
// пока не появится ясный (не шумовой) сигнал в пользу другой стороны.
function dodgeTarget(me, threat) {
  const b = threat.b;
  const speed = Math.hypot(b.vx, b.vy) || 1;
  const px = -b.vy / speed, py = b.vx / speed;
  const relX = me.x - threat.cx, relY = me.y - threat.cy;
  const proj = px * relX + py * relY;
  let side;
  if (b.id === dodgeBulletId) {
    side = Math.abs(proj) > 6 ? (proj >= 0 ? 1 : -1) : dodgeSide;
  } else {
    side = Math.abs(proj) > 1e-6 ? (proj >= 0 ? 1 : -1) : dodgeSide;
  }
  dodgeBulletId = b.id;
  dodgeSide = side;
  return { x: me.x + px * side * 100, y: me.y + py * side * 100 };
}

// ---------- рулевое управление ----------

function driveTo(me, tx, ty) {
  const want = Math.atan2(ty - me.y, tx - me.x);
  const diff = norm(want - me.heading);
  if (Math.abs(diff) > 2.35) {
    const back = norm(diff + Math.PI);
    return { throttle: -1, turn: clamp(-back * 3.2, -1, 1) };
  }
  const ad = Math.abs(diff);
  const throttle = ad < 0.5 ? 1 : ad < 1.25 ? 0.55 : 0.2;
  return { throttle, turn: clamp(diff * 3.2, -1, 1) };
}

// состояние модуля (сохраняется между тиками одного матча, сбрасывается в init)
let navPath = [];
let navGoalKey = '';
let navPathTick = -999;
let strafeSign = 1;
let strafeTimer = 2.5;
let stuckTicks = 0;
let unstickSign = 1;
let dodgeSide = 1;
let dodgeBulletId = -1;
let legTarget = null;
let legTick = -999;

function goTo(me, gx, gy, g, walls, tickNo) {
  if (segClear(walls, me.x, me.y, gx, gy, TANK_R)) {
    navPath = [];
    return driveTo(me, gx, gy);
  }
  const key = `${Math.round(gx / 40)}_${Math.round(gy / 40)}`;
  if (navPath.length === 0 || tickNo - navPathTick > 12 || navGoalKey !== key) {
    const from = nearestFreeIndex(g, me.x, me.y);
    const to = nearestFreeIndex(g, gx, gy);
    navPath = bfsPath(g, from, to);
    navPathTick = tickNo;
    navGoalKey = key;
  }
  while (navPath.length > 1 && segClear(walls, me.x, me.y, navPath[1].x, navPath[1].y, TANK_R)) navPath.shift();
  let wp = navPath[0];
  if (wp && dist(wp.x, wp.y, me.x, me.y) < 18) { navPath.shift(); wp = navPath[0]; }
  if (!wp) wp = { x: gx, y: gy };
  return driveTo(me, wp.x, wp.y);
}

function pickBestKit(kits, me) {
  let best = null, bestD = Infinity;
  for (let i = 0; i < kits.length; i++) {
    const k = kits[i];
    if (!k.active) continue;
    const d = dist(me.x, me.y, k.x, k.y);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

function orbitPoint(me, enemy, sign, radius) {
  const base = Math.atan2(me.y - enemy.y, me.x - enemy.x);
  const angle = base + sign * 0.55;
  return { x: enemy.x + Math.cos(angle) * radius, y: enemy.y + Math.sin(angle) * radius };
}

// Точка захода по дуге вместо "в лоб": вращаем вокруг СВОЕЙ позиции на
// фиксированный угол от пеленга на врага. В отличие от orbitPoint (вращение
// вокруг врага на фиксированном радиусе) это даёт заметное боковое смещение
// и с большой дистанции, а не только вблизи цели — иначе на длинной прямой
// (например, простреливаемый насквозь коридор) бот идёт почти по прямой на
// линии огня противника.
function approachPoint(me, enemy, sign, curveAngle) {
  const dirAngle = Math.atan2(enemy.y - me.y, enemy.x - me.x);
  const angle = dirAngle + sign * curveAngle;
  const d = dist(me.x, me.y, enemy.x, enemy.y);
  return { x: me.x + Math.cos(angle) * d, y: me.y + Math.sin(angle) * d };
}

export default {
  name: 'Резонанс',
  motto: 'Ловит ритм боя и бьёт без пауз.',
  stats: { armor: 3, engine: 2, gun: 2, reload: 3 },

  init() {
    navPath = [];
    navGoalKey = '';
    navPathTick = -999;
    strafeSign = 1;
    strafeTimer = 2.5;
    stuckTicks = 0;
    unstickSign = 1;
    dodgeSide = 1;
    dodgeBulletId = -1;
    legTarget = null;
    legTick = -999;
  },

  tick(state) {
    const { me, enemy, arena, bullets, zone, repairKits, dt, tick: tickNo } = state;
    if (!me.alive) return { throttle: 0, turn: 0, turretTurn: 0, fire: false };

    const walls = arena.walls;
    const g = getGrid(arena);

    // ---- башня: прицел с упреждением, стрельба при чистой линии ----
    let turretTurn = 0;
    let fire = false;
    if (enemy.alive) {
      const aim = leadAim(me, enemy);
      const aimAngle = Math.atan2(aim.y - me.y, aim.x - me.x);
      const turretDiff = norm(aimAngle - me.turret);
      turretTurn = clamp(turretDiff * 9, -1, 1);

      const mx = me.x + Math.cos(me.turret) * MUZZLE;
      const my = me.y + Math.sin(me.turret) * MUZZLE;
      const range = dist(me.x, me.y, enemy.x, enemy.y);
      const aimTol = clamp(Math.atan2(20, Math.max(range, 40)), 0.02, 0.6);
      if (
        Math.abs(turretDiff) < aimTol &&
        !pointBlocked(mx, my, arena.width, arena.height, walls, 5) &&
        segClear(walls, mx, my, aim.x, aim.y, 6)
      ) {
        fire = true;
      }
    }

    if (!enemy.alive) {
      return { throttle: 0, turn: 0, turretTurn: 0, fire: false };
    }

    // ---- корпус: уклонение > зона > аптечка > бой ----
    const threat = findThreat(me, bullets);
    let action;

    if (threat) {
      const dp = dodgeTarget(me, threat);
      let tx = dp.x, ty = dp.y;
      if (!segClear(walls, me.x, me.y, tx, ty, TANK_R)) {
        const altX = 2 * me.x - dp.x, altY = 2 * me.y - dp.y;
        if (segClear(walls, me.x, me.y, altX, altY, TANK_R)) { tx = altX; ty = altY; }
      }
      action = driveTo(me, tx, ty);
    } else {
      const zoneMargin = zone.radius - 60;
      const zoneDist = dist(me.x, me.y, zone.x, zone.y);
      const kit = pickBestKit(repairKits, me);
      const kitSafe = kit && dist(kit.x, kit.y, zone.x, zone.y) < zone.radius - 20;
      const wantKit = kitSafe && (me.hp < me.maxHp * 0.55 ||
        (me.hp < me.maxHp * 0.85 && dist(me.x, me.y, kit.x, kit.y) < 220));

      if (zoneDist > zoneMargin) {
        action = goTo(me, zone.x, zone.y, g, walls, tickNo);
      } else if (wantKit) {
        action = goTo(me, kit.x, kit.y, g, walls, tickNo);
      } else {
        const losToEnemy = segClear(walls, me.x, me.y, enemy.x, enemy.y, 6);

        if (losToEnemy) {
          strafeTimer -= dt;
          const flip = strafeTimer <= 0;
          if (flip) { strafeSign = -strafeSign; strafeTimer = 2.2 + Math.random() * 1.6; }

          const hpRatio = me.hp / me.maxHp;
          const enemyHpRatio = enemy.hp / enemy.maxHp;
          let orbitRadius = 300;
          if (hpRatio < enemyHpRatio - 0.15) orbitRadius = 400;
          else if (hpRatio > enemyHpRatio + 0.15) orbitRadius = 230;

          const distToEnemy = dist(me.x, me.y, enemy.x, enemy.y);
          let target;
          if (distToEnemy > orbitRadius * 1.4) {
            // Далеко: заходим по прямой ноге под углом к пеленгу, а не
            // напрямик — иначе на длинной прямой (простреливаемый насквозь
            // коридор) уклонение вырождается в шум, и бот идёт точно по
            // линии огня. Угол считаем один раз и держим ногу, пока не
            // дойдём, не наткнёмся на стену или не истечёт таймер смены
            // стороны — иначе непрерывный пересчёт от текущего пеленга
            // гасит боковое смещение (цель постоянно "доворачивается").
            const stale = !legTarget || tickNo - legTick > 60 ||
              dist(me.x, me.y, legTarget.x, legTarget.y) < 50;
            if (flip || stale) {
              // Враг только что выстрелил и перезаряжается — угол уже,
              // идём быстрее; вот-вот сможет выстрелить — угол шире.
              const curveAngle = enemy.reloadLeft > 0.15 ? 0.3 : 0.5;
              legTarget = approachPoint(me, enemy, strafeSign, curveAngle);
              legTick = tickNo;
            }
            target = legTarget;
          } else {
            legTarget = null;
            target = orbitPoint(me, enemy, strafeSign, orbitRadius);
          }
          if (!segClear(walls, me.x, me.y, target.x, target.y, TANK_R)) {
            strafeSign = -strafeSign;
            if (distToEnemy > orbitRadius * 1.4) {
              legTarget = approachPoint(me, enemy, strafeSign, 0.4);
              legTick = tickNo;
              target = legTarget;
            } else {
              target = orbitPoint(me, enemy, strafeSign, orbitRadius);
            }
          }
          navPath = [];
          action = driveTo(me, target.x, target.y);
        } else {
          legTarget = null;
          action = goTo(me, enemy.x, enemy.y, g, walls, tickNo);
        }
      }
    }

    // ---- защита от застревания в углах ----
    if (Math.abs(action.throttle) > 0.35 && Math.abs(me.speed) < 12) {
      stuckTicks++;
    } else {
      stuckTicks = 0;
    }
    if (stuckTicks > 12) {
      action = { throttle: -1, turn: unstickSign };
      if (stuckTicks > 26) { unstickSign = -unstickSign; stuckTicks = 12; }
    }

    return { throttle: action.throttle, turn: action.turn, turretTurn, fire };
  },
};
