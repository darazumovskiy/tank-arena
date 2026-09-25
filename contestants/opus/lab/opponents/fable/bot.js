// «Ртуть» — танк Fable. Самодостаточный ES-модуль без импортов.
//
// Идея: каждый тик перебираем ~40 коротких манёвров (0.9 с вперёд), для каждого
// честно моделируем корпус по формулам движка, стены, зону и все снаряды
// (включая «виртуальный» выстрел врага, если его пушка заряжена и наведена),
// и выбираем манёвр с наименьшей ожидаемой ценой. Навигация вокруг стен —
// через дистанционное поле (Дейкстра по сетке 20 px). Башня стреляет с
// упреждением по предсказанной траектории врага; без прямой видимости ищет
// рикошет от стен и границ поля.

const DT = 1 / 30;
const W = 1600, H = 900;
const R = 24;            // радиус танка
const BR = 5;            // радиус снаряда
const HIT = R + BR;      // дистанция попадания
const MUZ = 34;          // вылет снаряда от центра
const TR = 2.8;          // скорость башни
const ACC = 420;
const REV = 0.6;
const BULLET_LIFE = 4;
const ZONE_R0 = Math.hypot(W / 2, H / 2) + 60;
const ZONE_T0 = 60, ZONE_T1 = 100, ZONE_RF = 170, ZONE_DPS = 20;
const CX = W / 2, CY = H / 2;

const HZ = 27;           // горизонт выборки манёвров, тиков (0.9 с)
const CELL = 20, COLS = W / CELL, ROWS = H / CELL, NCELLS = COLS * ROWS;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
function norm(a) {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
}
const zoneR = (t) => (t <= ZONE_T0 ? ZONE_R0 : ZONE_R0 + (ZONE_RF - ZONE_R0) * clamp((t - ZONE_T0) / (ZONE_T1 - ZONE_T0), 0, 1));

// ---------- геометрия ----------

function circleRect(cx, cy, r, w) {
  const px = clamp(cx, w.x, w.x + w.w);
  const py = clamp(cy, w.y, w.y + w.h);
  const dx = cx - px, dy = cy - py;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  const left = cx - w.x, right = w.x + w.w - cx, top = cy - w.y, bottom = w.y + w.h - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { nx: -1, ny: 0, depth: left + r };
  if (m === right) return { nx: 1, ny: 0, depth: right + r };
  if (m === top) return { nx: 0, ny: -1, depth: top + r };
  return { nx: 0, ny: 1, depth: bottom + r };
}

function boundsHit(x, y, r) {
  if (x < r) return { nx: 1, ny: 0, depth: r - x };
  if (x > W - r) return { nx: -1, ny: 0, depth: x - (W - r) };
  if (y < r) return { nx: 0, ny: 1, depth: r - y };
  if (y > H - r) return { nx: 0, ny: -1, depth: y - (H - r) };
  return null;
}

function segHitsRect(x1, y1, x2, y2, r, pad) {
  const minX = r.x - pad, maxX = r.x + r.w + pad, minY = r.y - pad, maxY = r.y + r.h + pad;
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  return clip(-dx, x1 - minX) && clip(dx, maxX - x1) && clip(-dy, y1 - minY) && clip(dy, maxY - y1);
}

function clearPath(walls, x1, y1, x2, y2, pad) {
  for (let i = 0; i < walls.length; i++) if (segHitsRect(x1, y1, x2, y2, walls[i], pad)) return false;
  return true;
}

function distPointSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 1e-9 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function distToRect(x, y, w) {
  const dx = Math.max(w.x - x, 0, x - w.x - w.w);
  const dy = Math.max(w.y - y, 0, y - w.y - w.h);
  return Math.hypot(dx, dy);
}

// ---------- карта: сетка, проходимость, дистанционные поля ----------

let map = null;
const heapI = new Int32Array(NCELLS * 8);
const heapD = new Float32Array(NCELLS * 8);

function buildMap(arena) {
  const walls = arena.walls.map((w) => ({ ...w }));
  const free = new Uint8Array(NCELLS);
  const clear = new Float32Array(NCELLS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
      let d = Math.min(x, W - x, y, H - y);
      for (const w of walls) d = Math.min(d, distToRect(x, y, w));
      const i = r * COLS + c;
      clear[i] = d;
      free[i] = d >= R + 1 ? 1 : 0;
    }
  }
  const m = { name: arena.mapName, walls, free, clear, fields: new Map(), enemyField: null, enemyGoal: -1, enemyTick: -999 };
  return m;
}

const cellOf = (x, y) => clamp(Math.floor(y / CELL), 0, ROWS - 1) * COLS + clamp(Math.floor(x / CELL), 0, COLS - 1);

function nearestFree(m, idx) {
  if (m.free[idx]) return idx;
  const r0 = Math.floor(idx / COLS), c0 = idx % COLS;
  for (let rad = 1; rad < 8; rad++) {
    let best = -1, bestD = Infinity;
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const rr = r0 + dr, cc = c0 + dc;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
        const j = rr * COLS + cc;
        if (!m.free[j]) continue;
        const d = dr * dr + dc * dc;
        if (d < bestD) { bestD = d; best = j; }
      }
    }
    if (best >= 0) return best;
  }
  return idx;
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

function dijkstra(m, goalIdx) {
  const dist = new Float32Array(NCELLS).fill(Infinity);
  goalIdx = nearestFree(m, goalIdx);
  dist[goalIdx] = 0;
  let hn = 0;
  const push = (i, d) => {
    let k = hn++;
    heapI[k] = i; heapD[k] = d;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heapD[p] <= heapD[k]) break;
      const ti = heapI[p], td = heapD[p];
      heapI[p] = heapI[k]; heapD[p] = heapD[k];
      heapI[k] = ti; heapD[k] = td;
      k = p;
    }
  };
  push(goalIdx, 0);
  while (hn > 0) {
    const i = heapI[0], d = heapD[0];
    hn--;
    if (hn > 0) {
      heapI[0] = heapI[hn]; heapD[0] = heapD[hn];
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, rr = l + 1;
        let s = k;
        if (l < hn && heapD[l] < heapD[s]) s = l;
        if (rr < hn && heapD[rr] < heapD[s]) s = rr;
        if (s === k) break;
        const ti = heapI[s], td = heapD[s];
        heapI[s] = heapI[k]; heapD[s] = heapD[k];
        heapI[k] = ti; heapD[k] = td;
        k = s;
      }
    }
    if (d > dist[i]) continue;
    const r = Math.floor(i / COLS), c = i % COLS;
    for (let q = 0; q < 8; q++) {
      const dr = DIRS[q][0], dc = DIRS[q][1];
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
      const j = rr * COLS + cc;
      if (!m.free[j]) continue;
      if (dr && dc && (!m.free[r * COLS + cc] || !m.free[rr * COLS + c])) continue;
      // лёгкий штраф за узкие места: держимся подальше от стен
      const nd = d + DIRS[q][2] * CELL * (m.clear[j] < 40 ? 1.25 : 1);
      if (nd < dist[j]) { dist[j] = nd; push(j, nd); }
    }
  }
  return dist;
}

function staticField(m, x, y) {
  const key = cellOf(x, y);
  let f = m.fields.get(key);
  if (!f) { f = dijkstra(m, key); m.fields.set(key, f); }
  return f;
}

function fieldAt(f, x, y) {
  const i = cellOf(x, y);
  let v = f[i];
  if (v !== Infinity) return v;
  const r = Math.floor(i / COLS), c = i % COLS;
  let best = Infinity;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
      const u = f[rr * COLS + cc];
      if (u < best) best = u;
    }
  }
  return best === Infinity ? 6000 : best + CELL;
}

// единичный вектор спуска по полю вокруг точки (нулевой, если это минимум)
function descentDir(f, x, y) {
  let bx = 0, by = 0, bv = fieldAt(f, x, y);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const v = fieldAt(f, x + Math.cos(a) * 45, y + Math.sin(a) * 45);
    if (v < bv) { bv = v; bx = Math.cos(a); by = Math.sin(a); }
  }
  return { x: bx, y: by };
}

// путевая точка: спуск по полю на несколько клеток вперёд
function nextWaypoint(f, x, y, steps) {
  let i = cellOf(x, y);
  for (let sIdx = 0; sIdx < steps; sIdx++) {
    const r = Math.floor(i / COLS), c = i % COLS;
    let best = i, bv = f[i];
    for (let q = 0; q < 8; q++) {
      const rr = r + DIRS[q][0], cc = c + DIRS[q][1];
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
      const j = rr * COLS + cc;
      if (f[j] < bv) { bv = f[j]; best = j; }
    }
    if (best === i) break;
    i = best;
  }
  return { x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 };
}

// управление «ехать к точке»: поворот пропорционально, скорость ниже на крутых поворотах
function driveToward(x, y, hd, tx, ty) {
  const want = Math.atan2(ty - y, tx - x);
  const diff = norm(want - hd);
  if (Math.abs(diff) > 2.3) {
    const back = norm(diff + Math.PI);
    return { th: -1, tu: clamp(-back * 3, -1, 1) };
  }
  const a = Math.abs(diff);
  return { th: a < 0.35 ? 1 : a < 1.0 ? 0.45 : 0.15, tu: clamp(diff * 3, -1, 1) };
}

function clearanceAt(m, x, y) {
  return m.clear[cellOf(x, y)];
}

// ---------- состояние между тиками ----------

const bulletSeen = new Map();   // id -> тик первого появления
let myShots = new Map();        // id снаряда -> { t: время полёта при выстреле }
let enemyHist = [];             // последние состояния врага
let lastCand = -1;
let lastVel = { x: 0, y: 0 };
let zoneMode = false;
let rng = 1;
let prevEnemyHp = null;
let holdTicks = 0;
// накопленная статистика по попаданиям (переживает раунды): корзины по времени полёта
const acc = [[1, 2], [1, 2], [1, 2], [1, 2]]; // [hits+1, shots+2] для t<0.35, <0.55, <0.8, >=0.8
const enAcc = [[1, 2], [1, 2], [1, 2], [1, 2]]; // то же для попаданий врага по мне
const enShots = new Map();      // id вражеского снаряда -> корзина времени полёта
let prevMyHp = null;
let bandIdx = -1;
const BANDS = [[140, 250], [230, 340], [330, 460], [420, 560]];
const accBin = (t) => (t < 0.35 ? 0 : t < 0.55 ? 1 : t < 0.8 ? 2 : 3);

// какая дистанция выгоднее по накопленной статистике обмена уроном
function chooseBand(me, en) {
  const st = me.stats, es = en.stats;
  let best = -1, bestV = -Infinity;
  for (let i = 0; i < BANDS.length; i++) {
    const mid = (BANDS[i][0] + BANDS[i][1]) / 2;
    const mb = accBin(mid / st.bulletSpeed), eb = accBin(mid / es.bulletSpeed);
    if (acc[mb][1] < 9 || enAcc[eb][1] < 9) continue;
    const v = (st.damage * acc[mb][0]) / acc[mb][1] / st.reloadTime - (es.damage * enAcc[eb][0]) / enAcc[eb][1] / es.reloadTime;
    if (v > bestV) { bestV = v; best = i; }
  }
  return best;
}

function rand() {
  rng = (rng * 1664525 + 1013904223) >>> 0;
  return rng / 4294967296;
}

// ---------- манёвры ----------

const CANDS = [];
for (const th of [1, 0.6, 0.25, 0, -0.6, -1]) {
  for (const tu of [-1, -0.5, 0, 0.5, 1]) CANDS.push({ th, tu, n: 99, th2: th, tu2: tu });
}
for (const th of [1, -1]) for (const tu of [-1, 1]) CANDS.push({ th, tu, n: 8, th2: th, tu2: 0 });
for (const th of [1, -1]) for (const tu of [-1, 1]) CANDS.push({ th, tu, n: 14, th2: -th, tu2: 0 });
// особый кандидат: следование за дистанционным полем к цели (узкие проходы)
const FOLLOW = { th: 0, tu: 0, n: 99, th2: 0, tu2: 0, follow: null };
CANDS.push(FOLLOW);
const consumed = new Uint8Array(64);

// настройки поведения (стенд может менять через export.tune)
const TUNE = { rMin: 330, rMax: 460, virtual: 0.45, fireT: 0.62, endgame: 18, adapt: false, acc, enAcc };

// таблица положений снаряда на HZ тиков вперёд (с рикошетом)
function bulletTable(b, walls, ageTicks, weight) {
  const n = HZ + 1;
  const px = new Float64Array(n), py = new Float64Array(n);
  const alive = new Uint8Array(n), harm = new Uint8Array(n);
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy, bl = b.bouncesLeft, bounced = b.canHitOwner;
  const speed = Math.hypot(vx, vy);
  const steps = Math.max(1, Math.ceil((speed * DT) / 6));
  const sdt = DT / steps;
  px[0] = x; py[0] = y; alive[0] = 1; harm[0] = !b.mine || bounced ? 1 : 0;
  let dead = false;
  for (let k = 1; k < n; k++) {
    if (dead || (ageTicks + k) * DT > BULLET_LIFE) {
      dead = true;
      px[k] = x; py[k] = y; alive[k] = 0; harm[k] = 0;
      continue;
    }
    let dying = false;
    for (let s = 0; s < steps; s++) {
      x += vx * sdt; y += vy * sdt;
      let c = boundsHit(x, y, BR);
      if (!c) for (let i = 0; i < walls.length; i++) { c = circleRect(x, y, BR, walls[i]); if (c) break; }
      if (c) {
        if (bl > 0) {
          bl--; bounced = true;
          x += c.nx * c.depth; y += c.ny * c.depth;
          const dot = vx * c.nx + vy * c.ny;
          vx -= 2 * dot * c.nx; vy -= 2 * dot * c.ny;
        } else { dying = true; break; }
      }
    }
    px[k] = x; py[k] = y; alive[k] = 1; harm[k] = !b.mine || bounced ? 1 : 0;
    if (dying) dead = true;
  }
  return { px, py, alive, harm, dmg: b.damage, weight };
}

function simulateCandidate(s, ctx, cand) {
  const me = s.me, st = me.stats, walls = ctx.walls;
  let x = me.x, y = me.y, hd = me.heading, sp = me.speed;
  let cost = 0, bumps = 0;
  const nb = ctx.bullets.length;
  for (let i = 0; i < nb; i++) consumed[i] = 0;
  const ex0 = s.enemy.x, ey0 = s.enemy.y, evx = s.enemy.vx, evy = s.enemy.vy;
  const enemyAlive = s.enemy.alive;
  let wp = null;
  for (let k = 1; k <= HZ; k++) {
    let th, tu;
    if (cand.follow) {
      if (!wp || Math.hypot(wp.x - x, wp.y - y) < 22) wp = nextWaypoint(cand.follow, x, y, 3);
      const u = driveToward(x, y, hd, wp.x, wp.y);
      th = u.th; tu = u.tu;
      if (k === 1) { cand.th = th; cand.tu = tu; }
    } else {
      th = k <= cand.n ? cand.th : cand.th2;
      tu = k <= cand.n ? cand.tu : cand.tu2;
    }
    hd += tu * st.turnRate * DT;
    const target = th >= 0 ? th * st.maxSpeed : th * st.maxSpeed * REV;
    sp += clamp(target - sp, -ACC * DT, ACC * DT);
    x += Math.cos(hd) * sp * DT;
    y += Math.sin(hd) * sp * DT;
    let bumped = false;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < walls.length; i++) {
        const c = circleRect(x, y, R, walls[i]);
        if (c) { x += c.nx * c.depth; y += c.ny * c.depth; bumped = true; }
      }
      const nx = clamp(x, R, W - R), ny = clamp(y, R, H - R);
      if (nx !== x || ny !== y) bumped = true;
      x = nx; y = ny;
    }
    if (bumped) { sp *= 0.6; bumps++; }
    if (enemyAlive) {
      const ex = ex0 + evx * k * DT, ey = ey0 + evy * k * DT;
      const ddx = x - ex, ddy = y - ey;
      const d = Math.hypot(ddx, ddy);
      if (d < 2 * R && d > 1e-6) {
        const push = 2 * R - d;
        x += (ddx / d) * push; y += (ddy / d) * push;
        cost += 1.5;
      }
    }
    for (let i = 0; i < nb; i++) {
      if (consumed[i]) continue;
      const B = ctx.bullets[i];
      if (!B.alive[k] || !B.harm[k]) continue;
      if (distPointSeg(x, y, B.px[k - 1], B.py[k - 1], B.px[k], B.py[k]) < HIT + 3) {
        consumed[i] = 1;
        cost += B.dmg * B.weight;
      }
    }
    const t = s.time + k * DT;
    if (t > ZONE_T0 && Math.hypot(x - CX, y - CY) > zoneR(t)) cost += ZONE_DPS * DT;
  }
  cost += bumps * 0.8;
  // инерция направления движения: не метаться между равноценными путями
  const lv = Math.hypot(lastVel.x, lastVel.y);
  if (lv > 50 && Math.abs(sp) > 20) {
    const vx = Math.cos(hd) * sp, vy = Math.sin(hd) * sp;
    cost += 2.5 * (1 - (vx * lastVel.x + vy * lastVel.y) / (lv * Math.abs(sp)));
  }
  ctx.endVel = { x: Math.cos(hd) * sp, y: Math.sin(hd) * sp };
  const pc = ctx.positional(x, y, hd, sp);
  cost += pc;
  return cost;
}

// ---------- предсказание врага ----------

function enemyPrediction(s, walls) {
  const e = s.enemy;
  const n = 34;
  const px = new Float64Array(n), py = new Float64Array(n);
  let omega = 0;
  if (enemyHist.length >= 2) {
    let sum = 0, cnt = 0;
    for (let i = enemyHist.length - 1; i > 0 && cnt < 3; i--, cnt++) sum += norm(enemyHist[i].heading - enemyHist[i - 1].heading) / DT;
    omega = sum / cnt;
  }
  let x = e.x, y = e.y, hd = e.heading, sp = e.speed;
  px[0] = x; py[0] = y;
  for (let k = 1; k < n; k++) {
    const damp = Math.max(0, 1 - k / 22);
    hd += omega * damp * DT;
    x += Math.cos(hd) * sp * DT;
    y += Math.sin(hd) * sp * DT;
    let bumped = false;
    for (let i = 0; i < walls.length; i++) {
      const c = circleRect(x, y, R, walls[i]);
      if (c) { x += c.nx * c.depth; y += c.ny * c.depth; bumped = true; }
    }
    const nx = clamp(x, R, W - R), ny = clamp(y, R, H - R);
    if (nx !== x || ny !== y) bumped = true;
    x = nx; y = ny;
    if (bumped) sp *= 0.6;
    px[k] = x; py[k] = y;
  }
  return { px, py, n, at(t) {
    const f = clamp(t / DT, 0, n - 1.001);
    const i = Math.floor(f), u = f - i;
    return { x: px[i] + (px[i + 1] - px[i]) * u, y: py[i] + (py[i + 1] - py[i]) * u };
  } };
}

// прямой выстрел: угол башни и время полёта
function solveDirect(px, py, bs, pred) {
  let t = Math.max(0, (Math.hypot(pred.px[0] - px, pred.py[0] - py) - MUZ) / bs);
  let tx = pred.px[0], ty = pred.py[0];
  for (let i = 0; i < 8; i++) {
    const p = pred.at(t);
    tx = p.x; ty = p.y;
    const t2 = Math.max(0, (Math.hypot(tx - px, ty - py) - MUZ) / bs);
    if (Math.abs(t2 - t) < 1e-4) { t = t2; break; }
    t = t2;
  }
  return { t, tx, ty, angle: Math.atan2(ty - py, tx - px) };
}

// рикошет: отражаем цель относительно граней стен и границ поля
function solveRicochet(px, py, bs, pred, walls, meX, meY) {
  const faces = [];
  // границы поля (внутренняя сторона, снаряд отражается на расстоянии BR)
  faces.push({ ax: BR, ay: BR, bx: BR, by: H - BR, nx: 1, ny: 0 });
  faces.push({ ax: W - BR, ay: BR, bx: W - BR, by: H - BR, nx: -1, ny: 0 });
  faces.push({ ax: BR, ay: BR, bx: W - BR, by: BR, nx: 0, ny: 1 });
  faces.push({ ax: BR, ay: H - BR, bx: W - BR, by: H - BR, nx: 0, ny: -1 });
  for (const w of walls) {
    faces.push({ ax: w.x - BR, ay: w.y, bx: w.x - BR, by: w.y + w.h, nx: -1, ny: 0 });
    faces.push({ ax: w.x + w.w + BR, ay: w.y, bx: w.x + w.w + BR, by: w.y + w.h, nx: 1, ny: 0 });
    faces.push({ ax: w.x, ay: w.y - BR, bx: w.x + w.w, by: w.y - BR, nx: 0, ny: -1 });
    faces.push({ ax: w.x, ay: w.y + w.h + BR, bx: w.x + w.w, by: w.y + w.h + BR, nx: 0, ny: 1 });
  }
  let best = null;
  for (const f of faces) {
    // сторона: стрелок должен быть с внешней стороны грани
    const sideP = (px - f.ax) * f.nx + (py - f.ay) * f.ny;
    if (sideP <= 2) continue;
    let t = 0, tx = pred.px[0], ty = pred.py[0], ok = false, bxp = 0, byp = 0;
    for (let it = 0; it < 5; it++) {
      const p = pred.at(t);
      tx = p.x; ty = p.y;
      const sideT = (tx - f.ax) * f.nx + (ty - f.ay) * f.ny;
      if (sideT <= 2) { ok = false; break; }
      // зеркало цели
      const mx = tx - 2 * sideT * f.nx, my = ty - 2 * sideT * f.ny;
      // пересечение луча px,py -> mx,my с прямой грани
      const dx = mx - px, dy = my - py;
      const denom = dx * f.nx + dy * f.ny;
      if (Math.abs(denom) < 1e-9) { ok = false; break; }
      const u = -sideP / denom;
      if (u <= 0 || u >= 1) { ok = false; break; }
      bxp = px + dx * u; byp = py + dy * u;
      // точка отскока в пределах грани (с запасом)
      const along = f.nx !== 0 ? (byp - f.ay) / (f.by - f.ay) : (bxp - f.ax) / (f.bx - f.ax);
      const len = f.nx !== 0 ? f.by - f.ay : f.bx - f.ax;
      const margin = Math.min(0.45, 8 / len);
      if (along < margin || along > 1 - margin) { ok = false; break; }
      const l1 = Math.hypot(bxp - px, byp - py) - MUZ;
      const l2 = Math.hypot(tx - bxp, ty - byp);
      if (l1 < 20) { ok = false; break; }
      const t2 = (l1 + l2) / bs;
      ok = true;
      if (Math.abs(t2 - t) < 1e-3) { t = t2; break; }
      t = t2;
    }
    if (!ok || t > 1.6) continue;
    if (best && t >= best.t) continue;
    // путь до отскока и после отскока свободен (грань собственной стены не мешает: сегмент к ней подходит снаружи)
    const dirx = bxp - px, diry = byp - py;
    const L = Math.hypot(dirx, diry);
    const mxz = px + (dirx / L) * MUZ, myz = py + (diry / L) * MUZ;
    // укорачиваем сегменты на 1 px, чтобы не цеплять саму грань
    const sx = bxp + f.nx * 1.5, sy = byp + f.ny * 1.5;
    if (!clearPath(walls, mxz, myz, sx, sy, BR + 0.5)) continue;
    if (!clearPath(walls, sx, sy, tx, ty, BR + 0.5)) continue;
    // после отскока снаряд не должен пройти рядом со мной
    if (distPointSeg(meX, meY, sx, sy, tx, ty) < HIT + 30) continue;
    best = { t, tx, ty, angle: Math.atan2(diry, dirx), bx: bxp, by: byp };
  }
  return best;
}

// вернётся ли мой снаряд после рикошета в меня (если не попадёт во врага раньше)
function selfRicochet(mx, my, angle, bs, pred, walls, meX, meY) {
  let x = mx, y = my, vx = Math.cos(angle) * bs, vy = Math.sin(angle) * bs;
  const steps = Math.max(1, Math.ceil((bs * DT) / 6));
  const sdt = DT / steps;
  let bounced = false;
  for (let k = 1; k <= 40; k++) {
    const e = pred.at(k * DT);
    for (let s = 0; s < steps; s++) {
      x += vx * sdt; y += vy * sdt;
      let c = boundsHit(x, y, BR);
      if (!c) for (let i = 0; i < walls.length; i++) { c = circleRect(x, y, BR, walls[i]); if (c) break; }
      if (c) {
        if (bounced) return false;
        bounced = true;
        x += c.nx * c.depth; y += c.ny * c.depth;
        const dot = vx * c.nx + vy * c.ny;
        vx -= 2 * dot * c.nx; vy -= 2 * dot * c.ny;
      }
      if (Math.hypot(e.x - x, e.y - y) < HIT) return false; // попал во врага
      if (bounced && Math.hypot(meX - x, meY - y) < HIT + 22) return true;
    }
  }
  return false;
}

// ---------- бот ----------

export default {
  name: 'Ртуть',
  motto: 'Бей туда, где меня уже нет.',
  stats: { armor: 2, engine: 3, gun: 5, reload: 0 },
  tune: TUNE,

  init(info) {
    bulletSeen.clear();
    myShots = new Map();
    enemyHist = [];
    lastCand = -1;
    lastVel = { x: 0, y: 0 };
    zoneMode = false;
    prevEnemyHp = null;
    prevMyHp = null;
    enShots.clear();
    holdTicks = 0;
    rng = (info && info.round != null ? info.round * 7919 + 17 : 17) >>> 0;
    if (map && info && info.mapName !== map.name) map = null;
  },

  tick(s) {
    const me = s.me, en = s.enemy, st = me.stats;
    if (!map || map.name !== s.arena.mapName) map = buildMap(s.arena);
    const walls = map.walls;
    const time = s.time;

    // --- учёт снарядов и своей точности ---
    const seenNow = new Set();
    for (const b of s.bullets) {
      seenNow.add(b.id);
      if (!bulletSeen.has(b.id)) {
        bulletSeen.set(b.id, s.tick);
        if (b.mine && myShots.has(-1)) { myShots.set(b.id, myShots.get(-1)); myShots.delete(-1); }
        if (!b.mine) enShots.set(b.id, accBin(Math.hypot(me.x - b.x, me.y - b.y) / (Math.hypot(b.vx, b.vy) || 1)));
      }
    }
    let enemyHpDrop = prevEnemyHp === null ? 0 : prevEnemyHp - en.hp;
    let myHpDrop = prevMyHp === null ? 0 : prevMyHp - me.hp;
    for (const [id] of bulletSeen) {
      if (seenNow.has(id)) continue;
      bulletSeen.delete(id);
      const shot = myShots.get(id);
      if (shot) {
        myShots.delete(id);
        const bin = accBin(shot.t);
        acc[bin][1]++;
        if (enemyHpDrop >= st.damage - 1) { acc[bin][0]++; enemyHpDrop -= st.damage; }
      }
      const eb = enShots.get(id);
      if (eb !== undefined) {
        enShots.delete(id);
        enAcc[eb][1]++;
        if (myHpDrop >= en.stats.damage - 1) { enAcc[eb][0]++; myHpDrop -= en.stats.damage; }
      }
    }
    prevEnemyHp = en.hp;
    prevMyHp = me.hp;
    enemyHist.push({ x: en.x, y: en.y, heading: en.heading, speed: en.speed });
    if (enemyHist.length > 6) enemyHist.shift();

    if (!en.alive) return { throttle: 0, turn: 0, turretTurn: 0, fire: false };

    const dist = Math.hypot(en.x - me.x, en.y - me.y);
    const los = clearPath(walls, me.x, me.y, en.x, en.y, BR + 1);
    const pred = enemyPrediction(s, walls);

    // --- таблицы снарядов, включая виртуальный выстрел врага ---
    const tables = [];
    for (const b of s.bullets) {
      if (b.mine && !b.canHitOwner && b.bouncesLeft === 0) continue;
      const age = s.tick - (bulletSeen.get(b.id) ?? s.tick) + 1;
      // быстрая отсечка: снаряд летит от меня и далеко
      const rx = me.x - b.x, ry = me.y - b.y;
      const dd = Math.hypot(rx, ry);
      const closing = (rx * b.vx + ry * b.vy) / (dd + 1e-9);
      if (b.bouncesLeft === 0 && closing < -50 && dd > 120) continue;
      if (dd > 900 && b.bouncesLeft === 0) continue;
      tables.push(bulletTable(b, walls, age, 1));
    }
    if (en.reloadLeft <= DT * 2.01 && los) {
      // враг может выстрелить в ближайший тик: считаем, что он доворачивает башню на мою точку упреждения
      const myPred = { px: [me.x], py: [me.y], at: (t) => ({ x: me.x + me.vx * t, y: me.y + me.vy * t }) };
      const sol = solveDirect(en.x + en.vx * DT, en.y + en.vy * DT, en.stats.bulletSpeed, myPred);
      const diff = norm(sol.angle - en.turret);
      const tur = en.turret + clamp(diff, -TR * DT, TR * DT);
      const toMe = Math.atan2(me.y - en.y, me.x - en.x);
      if (Math.abs(norm(tur - toMe)) < 0.35) {
        const ex = en.x + en.vx * DT + Math.cos(tur) * MUZ, ey = en.y + en.vy * DT + Math.sin(tur) * MUZ;
        const vb = { x: ex, y: ey, vx: Math.cos(tur) * en.stats.bulletSpeed, vy: Math.sin(tur) * en.stats.bulletSpeed, mine: false, bouncesLeft: 1, canHitOwner: false, damage: en.stats.damage };
        tables.push(bulletTable(vb, walls, 0, TUNE.virtual));
      }
    }

    // --- стратегия: режим и позиционная функция ---
    const myFrac = me.hp / me.maxHp, enFrac = en.hp / en.maxHp;
    const myDeficit = me.maxHp - me.hp, enDeficit = en.maxHp - en.hp;
    const zoneNow = zoneR(time);
    const zoneSoon = zoneR(time + 3);
    const myZoneDist = Math.hypot(me.x - CX, me.y - CY);

    let mode = 'combat';
    let field = null;
    let goal = null;

    // аптечки
    let bestKit = null, bestKitScore = -Infinity;
    for (let i = 0; i < s.repairKits.length; i++) {
      const k = s.repairKits[i];
      if (!k.active && k.respawnIn > 3) continue;
      const f = staticField(map, k.x, k.y);
      const myD = fieldAt(f, me.x, me.y), enD = fieldAt(f, en.x, en.y);
      const myT = Math.max(myD / st.maxSpeed, k.respawnIn), enT = enD / en.stats.maxSpeed;
      const zoneAtArrival = zoneR(time + myT + 0.5);
      if (Math.hypot(k.x - CX, k.y - CY) > zoneAtArrival - (time > 55 ? 15 : -30)) continue; // аптечка уже вне зоны
      let value = 0;
      if (myDeficit >= 45) value = 1;
      else if (myDeficit >= 25) value = 0.5;
      const deny = enDeficit >= 40 && enT < 6 ? 0.55 : 0;
      value = Math.max(value, deny);
      if (value === 0) continue;
      // успеваю раньше врага (или он не рвётся)
      const lead = enT - myT;
      if (lead < -0.4 && value < 1) continue;
      if (lead < -1.5) continue;
      if (myD > 700) continue;
      const score = value * 100 - myD * 0.08 + Math.min(lead, 2) * 6;
      if (score > bestKitScore) { bestKitScore = score; bestKit = { k, f, myD, myT }; }
    }

    if (time > 50 && myZoneDist > zoneSoon - (zoneMode ? 120 : 70)) zoneMode = true;
    else zoneMode = false;
    if (zoneMode) {
      mode = 'zone';
      field = staticField(map, CX, CY);
      goal = { x: CX, y: CY };
    } else if (bestKit && bestKitScore > 20) {
      mode = 'kit';
      field = bestKit.f;
      goal = { x: bestKit.k.x, y: bestKit.k.y };
    }

    // боевая дистанция
    const endgame = s.timeLeft < TUNE.endgame;
    const ahead = myFrac > enFrac + 0.04;
    let rMin = TUNE.rMin, rMax = TUNE.rMax;
    if (TUNE.adapt && s.tick % 30 === 0) bandIdx = chooseBand(me, en);
    if (TUNE.adapt && bandIdx >= 0) { rMin = BANDS[bandIdx][0]; rMax = BANDS[bandIdx][1]; }
    if (endgame && ahead) { rMin = 330; rMax = 900; }
    else if (endgame && !ahead) { rMin = 120; rMax = 220; }

    if (mode === 'combat') {
      if (!los || dist > rMax + 60) {
        // подходим по полю к врагу (обновляем поле при смене клетки)
        const gcell = cellOf(en.x, en.y);
        if (map.enemyGoal !== gcell || s.tick - map.enemyTick > 6) {
          map.enemyField = dijkstra(map, gcell);
          map.enemyGoal = gcell;
          map.enemyTick = s.tick;
        }
        field = map.enemyField;
        goal = { x: en.x, y: en.y };
        mode = 'approach';
      }
    }

    const zonePen = (x, y) => {
      if (time < 45) return 0;
      const d = Math.hypot(x - CX, y - CY);
      return 0.12 * Math.max(0, d - (zoneR(time + 3.5) - 60)) + 0.25 * Math.max(0, d - (zoneR(time + 1.5) - 20));
    };
    const hideBonus = endgame && ahead;
    const enEndX = pred.px[HZ], enEndY = pred.py[HZ];

    // направление спуска по полю из текущей точки: награда за доворот корпуса к нему
    let goalAng = null;
    if (field) {
      const dd0 = descentDir(field, me.x, me.y);
      if (dd0.x !== 0 || dd0.y !== 0) goalAng = Math.atan2(dd0.y, dd0.x);
    }
    const headingTerm = (hd) => (goalAng === null ? 0 : 2.0 * (1 - Math.cos(hd - goalAng)));

    let positional;
    if (mode === 'combat' || mode === 'approach') {
      const f = field;
      positional = (x, y, hd, sp) => {
        const dx = enEndX - x, dy = enEndY - y;
        const d = Math.hypot(dx, dy) || 1;
        let c = 0;
        if (mode === 'approach') {
          const fv = fieldAt(f, x, y);
          c += 0.1 * Math.max(0, fv - rMin - 40);
          if (fv > rMin + 40) {
            const dd = descentDir(f, x, y);
            c -= 0.07 * ((x - me.x) * dd.x + (y - me.y) * dd.y) / (HZ * DT);
            c += headingTerm(hd);
          }
        }
        if (d < rMin) c += 0.12 * (rMin - d);
        else if (d > rMax && mode === 'combat') c += 0.08 * (d - rMax);
        // проекция дистанции с учётом скорости сближения: не влетать в упор
        const closing = ((Math.cos(hd) * sp - en.vx) * dx + (Math.sin(hd) * sp - en.vy) * dy) / d;
        const dp = d - closing * 0.8;
        if (dp < rMin) c += 0.08 * (rMin - dp);
        const l = clearPath(walls, x, y, enEndX, enEndY, BR + 1);
        if (hideBonus) { if (l) c += 10; }
        else if (!l) c += 8;
        const cl = clearanceAt(map, x, y);
        if (mode === 'combat') { if (cl < 130) c += 0.05 * (130 - cl); }
        else if (cl < 45) c += 0.05 * (45 - cl);
        c += 0.004 * Math.hypot(x - CX, y - CY);
        c -= 0.012 * Math.abs(sp);
        c -= 0.012 * Math.hypot(x - me.x, y - me.y);
        c += zonePen(x, y);
        return c;
      };
    } else {
      const f = field;
      positional = (x, y, hd, sp) => {
        let c = 0.1 * fieldAt(f, x, y);
        const dd = descentDir(f, x, y);
        c -= 0.07 * ((x - me.x) * dd.x + (y - me.y) * dd.y) / (HZ * DT);
        c += headingTerm(hd);
        const cl = clearanceAt(map, x, y);
        if (cl < 45) c += 0.04 * (45 - cl);
        // и в зоне, и по пути к аптечке не подходить к врагу вплотную
        const d = Math.hypot(x - enEndX, y - enEndY);
        if (d < rMin) c += (mode === 'zone' ? 0.05 : 0.08) * (rMin - d);
        c += zonePen(x, y);
        return c;
      };
    }

    const ctx = { walls, bullets: tables, positional };
    FOLLOW.follow = field;
    let best = -1, bestCost = Infinity;
    let bestVel = lastVel;
    for (let i = 0; i < CANDS.length; i++) {
      if (CANDS[i] === FOLLOW && !field) continue;
      let c = simulateCandidate(s, ctx, CANDS[i]);
      if (i === lastCand) c -= Math.abs(me.speed) < 40 ? 5 : 1.2;
      c += rand() * 0.3;
      if (c < bestCost) { bestCost = c; best = i; bestVel = ctx.endVel; }
    }
    lastCand = best;
    lastVel = bestVel;
    const move = CANDS[best];

    // --- башня и выстрел ---
    // моё положение после этого хода
    const hd1 = me.heading + move.tu * st.turnRate * DT;
    const tgt = move.th >= 0 ? move.th * st.maxSpeed : move.th * st.maxSpeed * REV;
    const sp1 = me.speed + clamp(tgt - me.speed, -ACC * DT, ACC * DT);
    const px = me.x + Math.cos(hd1) * sp1 * DT, py = me.y + Math.sin(hd1) * sp1 * DT;

    const direct = solveDirect(px, py, st.bulletSpeed, pred);
    let aimAngle = direct.angle;
    let fire = false;
    const ready = me.reloadLeft <= DT + 1e-6;

    const muzzleOk = (ang) => {
      const mx = px + Math.cos(ang) * MUZ, my = py + Math.sin(ang) * MUZ;
      if (boundsHit(mx, my, BR)) return false;
      for (let i = 0; i < walls.length; i++) if (circleRect(mx, my, BR, walls[i])) return false;
      return true;
    };

    const mxD = px + Math.cos(direct.angle) * MUZ, myD = py + Math.sin(direct.angle) * MUZ;
    const directClear = clearPath(walls, mxD, myD, direct.tx, direct.ty, BR + 0.5) && muzzleOk(direct.angle);
    let shotT = direct.t;
    let useRico = null;
    if (!directClear && ready) {
      useRico = solveRicochet(px, py, st.bulletSpeed, pred, walls, me.x, me.y);
      if (useRico) { aimAngle = useRico.angle; shotT = useRico.t; }
    }

    const diff = norm(aimAngle - me.turret);
    const turretTurn = clamp(diff / (TR * DT), -1, 1);
    const residual = Math.max(0, Math.abs(diff) - TR * DT);
    const range = Math.max(40, shotT * st.bulletSpeed + MUZ);
    const angTol = 0.5 * Math.asin(Math.min(1, HIT / range));

    if (ready && residual <= angTol) {
      if (useRico) {
        fire = shotT < 1.4;
      } else if (directClear) {
        const bin = accBin(shotT);
        const p = acc[bin][0] / acc[bin][1];
        const enemySlow = en.speed < 50;
        const closeIn = dist < 260;
        fire = shotT <= TUNE.fireT || closeIn || (enemySlow && shotT < 1.1) || (p >= 0.3 && shotT < 1.1) || (holdTicks > 24 && shotT < 1.2);
        if (fire && selfRicochet(mxD, myD, direct.angle, st.bulletSpeed, pred, walls, px, py)) fire = false;
      }
    }
    if (TUNE.noFire) fire = false;
    if (ready && !fire) holdTicks++; else holdTicks = 0;
    if (fire) myShots.set(-1, { t: shotT });

    return { throttle: move.th, turn: move.tu, turretTurn, fire };
  },
};
