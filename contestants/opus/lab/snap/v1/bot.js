// Танк Claude Opus 5.5.
// Движение: планировщик на точной копии физики движка перебирает ~180 манёвров на 1.2 с вперёд,
// уворачивается от всех снарядов (и от своих рикошетов), держит дистанцию, берёт аптечки, не лезет в зону.
// Стрельба: моделирует набор возможных траекторий врага и выбирает угол (прямой или через рикошет),
// который накрывает их больше всего; не стреляет, если снаряд может вернуться в нас.

const W = 1600, H = 900, DT = 1 / 30;
const TR = 24, BR = 5, MUZ = 34, ACC = 420, REV = 0.6, TRATE = 2.8, BLIFE = 4;
const HITR = TR + BR, HITR2 = HITR * HITR;
const PI = Math.PI, TAU = 2 * PI;
const ZONE_R0 = Math.hypot(W / 2, H / 2) + 60;

// Настраиваемые параметры (стенд в lab/ может их менять).
const P = {
  prefDist: 420,   // желаемая дистанция боя
  hpW: 12,         // цена 1 HP в пикселях пути
  goalW: 1,        // вес расстояния до цели манёвра
  readyW: 90,      // штраф за позу, из которой не увернуться
  closeDist: 230,  // ближе этого к врагу — штраф
  closeW: 0.6,
  fireMin: 0.18,   // минимальная вероятность попадания для выстрела
  wCont: 0.4,      // вес прогноза «враг продолжит как едет»
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
function normA(a) {
  a = (a + PI) % TAU;
  if (a < 0) a += TAU;
  return a - PI;
}

// ---------- геометрия и физика: копия arena/engine.js ----------

const HIT = { nx: 0, ny: 0, depth: 0 };

function circleRect(cx, cy, r, w) {
  const px = cx < w.x ? w.x : cx > w.x2 ? w.x2 : cx;
  const py = cy < w.y ? w.y : cy > w.y2 ? w.y2 : cy;
  const dx = cx - px, dy = cy - py;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    HIT.nx = dx / d; HIT.ny = dy / d; HIT.depth = r - d;
    return true;
  }
  const left = cx - w.x, right = w.x2 - cx, top = cy - w.y, bottom = w.y2 - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) { HIT.nx = -1; HIT.ny = 0; HIT.depth = left + r; }
  else if (m === right) { HIT.nx = 1; HIT.ny = 0; HIT.depth = right + r; }
  else if (m === top) { HIT.nx = 0; HIT.ny = -1; HIT.depth = top + r; }
  else { HIT.nx = 0; HIT.ny = 1; HIT.depth = bottom + r; }
  return true;
}

function boundsHit(x, y, r) {
  if (x < r) { HIT.nx = 1; HIT.ny = 0; HIT.depth = r - x; return true; }
  if (x > W - r) { HIT.nx = -1; HIT.ny = 0; HIT.depth = x - (W - r); return true; }
  if (y < r) { HIT.nx = 0; HIT.ny = 1; HIT.depth = r - y; return true; }
  if (y > H - r) { HIT.nx = 0; HIT.ny = -1; HIT.depth = y - (H - r); return true; }
  return false;
}

function wallHit(x, y, r, walls) {
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (x + r <= w.x || x - r >= w.x2 || y + r <= w.y || y - r >= w.y2) continue;
    if (circleRect(x, y, r, w)) return true;
  }
  return false;
}

const ACC_DT = ACC * DT;

// Один тик движения танка: s = { x, y, h, v }, st = { maxSpeed, turnRate }.
function stepTank(s, thr, turn, st, walls) {
  s.h = normA(s.h + turn * st.turnRate * DT);
  const target = thr >= 0 ? thr * st.maxSpeed : thr * st.maxSpeed * REV;
  let dv = target - s.v;
  if (dv > ACC_DT) dv = ACC_DT; else if (dv < -ACC_DT) dv = -ACC_DT;
  s.v += dv;
  s.x += Math.cos(s.h) * s.v * DT;
  s.y += Math.sin(s.h) * s.v * DT;
  let bumped = false;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (s.x + TR <= w.x || s.x - TR >= w.x2 || s.y + TR <= w.y || s.y - TR >= w.y2) continue;
      if (circleRect(s.x, s.y, TR, w)) {
        s.x += HIT.nx * HIT.depth;
        s.y += HIT.ny * HIT.depth;
        bumped = true;
      }
    }
    const nx = clamp(s.x, TR, W - TR), ny = clamp(s.y, TR, H - TR);
    if (nx !== s.x || ny !== s.y) bumped = true;
    s.x = nx; s.y = ny;
  }
  if (bumped) s.v *= 0.6;
  return bumped;
}

// Траектория снаряда по подшагам движка. flag: 0 — проверки танков нет,
// 1 — может попасть во врага стрелка, 2 — после рикошета, может попасть в кого угодно.
const MAXSTEPS = 4;
function makeRec(n) {
  return {
    n: 0, steps: 1, dmg: 0, mine: false,
    x: new Float64Array(n * MAXSTEPS), y: new Float64Array(n * MAXSTEPS), f: new Uint8Array(n * MAXSTEPS),
    ex: new Float64Array(n), ey: new Float64Array(n),
  };
}

function simBullet(rec, x, y, vx, vy, bl, bounced, age, N, walls) {
  const speed = Math.hypot(vx, vy);
  const steps = Math.max(1, Math.ceil((speed * DT) / 6));
  const sdt = DT / steps;
  rec.steps = steps;
  rec.n = 0;
  for (let k = 0; k < N; k++) {
    age += DT;
    if (age > BLIFE) break;
    let dead = false;
    const base = k * steps;
    for (let s = 0; s < steps; s++) {
      const i = base + s;
      if (dead) { rec.f[i] = 0; rec.x[i] = x; rec.y[i] = y; continue; }
      x += vx * sdt;
      y += vy * sdt;
      let c = boundsHit(x, y, BR);
      if (!c) c = wallHit(x, y, BR, walls);
      if (c) {
        if (bl > 0) {
          bl--;
          bounced = true;
          x += HIT.nx * HIT.depth;
          y += HIT.ny * HIT.depth;
          const dot = vx * HIT.nx + vy * HIT.ny;
          vx -= 2 * dot * HIT.nx;
          vy -= 2 * dot * HIT.ny;
        } else dead = true;
        rec.f[i] = 0;
      } else rec.f[i] = bounced ? 2 : 1;
      rec.x[i] = x;
      rec.y[i] = y;
    }
    rec.ex[k] = x;
    rec.ey[k] = y;
    rec.n = k + 1;
    if (dead) break;
  }
  return rec;
}

// ---------- сетка, поля расстояний, видимость ----------

const CELL = 20, GC = 80, GR = 45, GN = GC * GR;

function buildGrid(walls) {
  const free = new Uint8Array(GN), clear = new Float32Array(GN);
  for (let r = 0; r < GR; r++) {
    for (let c = 0; c < GC; c++) {
      const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
      let d = Math.min(x, W - x, y, H - y);
      for (const w of walls) {
        const dx = Math.max(w.x - x, 0, x - w.x2), dy = Math.max(w.y - y, 0, y - w.y2);
        d = Math.min(d, Math.sqrt(dx * dx + dy * dy));
      }
      clear[r * GC + c] = d;
      free[r * GC + c] = d > TR + 1 ? 1 : 0;
    }
  }
  return { free, clear };
}

const HEAP_I = new Int32Array(GN * 9), HEAP_D = new Float64Array(GN * 9);

function dijkstra(grid, sx, sy) {
  const D = new Float64Array(GN).fill(1e9);
  let hn = 0;
  const push = (i, d) => {
    let k = hn++;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (HEAP_D[p] <= d) break;
      HEAP_I[k] = HEAP_I[p]; HEAP_D[k] = HEAP_D[p]; k = p;
    }
    HEAP_I[k] = i; HEAP_D[k] = d;
  };
  const pop = () => {
    const top = HEAP_I[0];
    const li = HEAP_I[--hn], ld = HEAP_D[hn];
    let k = 0;
    for (;;) {
      let c = 2 * k + 1;
      if (c >= hn) break;
      if (c + 1 < hn && HEAP_D[c + 1] < HEAP_D[c]) c++;
      if (HEAP_D[c] >= ld) break;
      HEAP_I[k] = HEAP_I[c]; HEAP_D[k] = HEAP_D[c]; k = c;
    }
    HEAP_I[k] = li; HEAP_D[k] = ld;
    return top;
  };
  const c0 = Math.floor(sx / CELL), r0 = Math.floor(sy / CELL);
  for (let rad = 1; rad <= 4 && hn === 0; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || c < 0 || r >= GR || c >= GC) continue;
        const i = r * GC + c;
        if (!grid.free[i]) continue;
        const d = Math.hypot(c * CELL + CELL / 2 - sx, r * CELL + CELL / 2 - sy);
        if (d < D[i]) { D[i] = d; push(i, d); }
      }
    }
  }
  const DIAG = CELL * Math.SQRT2;
  while (hn > 0) {
    const dCur = HEAP_D[0];
    const i = pop();
    if (dCur > D[i]) continue;
    const r = (i / GC) | 0, c = i - r * GC;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= GR || cc >= GC) continue;
        const j = rr * GC + cc;
        if (!grid.free[j]) continue;
        if (dr && dc && (!grid.free[r * GC + cc] || !grid.free[rr * GC + c])) continue;
        const nd = dCur + (dr && dc ? DIAG : CELL);
        if (nd < D[j]) { D[j] = nd; push(j, nd); }
      }
    }
  }
  return D;
}

// Значение поля в произвольной точке: min по соседним свободным клеткам (D + расстояние до центра).
function fieldAt(D, grid, x, y) {
  const fx = x / CELL - 0.5, fy = y / CELL - 0.5;
  const c0 = Math.floor(fx), r0 = Math.floor(fy);
  let best = 1e9;
  for (let rad = 1; rad <= 3 && best >= 1e9; rad++) {
    for (let r = r0 - rad + 1; r <= r0 + rad; r++) {
      if (r < 0 || r >= GR) continue;
      for (let c = c0 - rad + 1; c <= c0 + rad; c++) {
        if (c < 0 || c >= GC) continue;
        const i = r * GC + c;
        if (!grid.free[i] || D[i] >= 1e9) continue;
        const dx = x - (c * CELL + CELL / 2), dy = y - (r * CELL + CELL / 2);
        const v = D[i] + Math.sqrt(dx * dx + dy * dy);
        if (v < best) best = v;
      }
    }
  }
  return best;
}

function segRect(x1, y1, x2, y2, minX, minY, maxX, maxY) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-12) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

function segClear(x1, y1, x2, y2, pad, walls) {
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (segRect(x1, y1, x2, y2, w.x - pad, w.y - pad, w.x2 + pad, w.y2 + pad)) return false;
  }
  return true;
}

// Для каждой клетки — точка, к которой ехать (прямая видимость до цели или 4 шага по градиенту).
function buildLook(D, grid, gx, gy, walls) {
  const lx = new Float32Array(GN), ly = new Float32Array(GN);
  for (let i = 0; i < GN; i++) {
    if (!grid.free[i] || D[i] >= 1e9) continue;
    const r = (i / GC) | 0, c = i - r * GC;
    const cx = c * CELL + CELL / 2, cy = r * CELL + CELL / 2;
    if (D[i] < 260 && segClear(cx, cy, gx, gy, TR - 2, walls)) { lx[i] = gx; ly[i] = gy; continue; }
    let cur = i;
    for (let step = 0; step < 4; step++) {
      const rr0 = (cur / GC) | 0, cc0 = cur - rr0 * GC;
      let bestJ = cur, bestD = D[cur];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = rr0 + dr, cc = cc0 + dc;
          if (rr < 0 || cc < 0 || rr >= GR || cc >= GC) continue;
          const j = rr * GC + cc;
          if (!grid.free[j]) continue;
          if (dr && dc && (!grid.free[rr0 * GC + cc] || !grid.free[rr * GC + cc0])) continue;
          if (D[j] < bestD) { bestD = D[j]; bestJ = j; }
        }
      }
      if (bestJ === cur) break;
      cur = bestJ;
    }
    if (cur === i) { lx[i] = gx; ly[i] = gy; }
    else {
      const rr = (cur / GC) | 0, cc = cur - rr * GC;
      lx[i] = cc * CELL + CELL / 2; ly[i] = rr * CELL + CELL / 2;
    }
  }
  return { lx, ly };
}

function cellIndex(grid, x, y) {
  let c = clamp(Math.floor(x / CELL), 0, GC - 1), r = clamp(Math.floor(y / CELL), 0, GR - 1);
  let i = r * GC + c;
  if (grid.free[i]) return i;
  let best = -1, bd = 1e9;
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= GR || cc >= GC) continue;
      const j = rr * GC + cc;
      if (!grid.free[j]) continue;
      const d = dr * dr + dc * dc;
      if (d < bd) { bd = d; best = j; }
    }
  }
  return best >= 0 ? best : i;
}

function zoneRadius(t) {
  if (t <= 60) return ZONE_R0;
  const k = clamp((t - 60) / 40, 0, 1);
  return ZONE_R0 + (170 - ZONE_R0) * k;
}

// ---------- память ----------

let RD = null; // состояние раунда
const MEM = { round: -1 };

function setupRound(state) {
  const walls = state.arena.walls.map((w) => ({ x: w.x, y: w.y, x2: w.x + w.w, y2: w.y + w.h }));
  const grid = buildGrid(walls);
  // Поверхности для рикошета: грани стен и края поля (линия, где центр снаряда отражается).
  const surf = [];
  for (const w of walls) {
    surf.push({ v: true, c: w.x - BR, lo: w.y, hi: w.y2, side: -1 });
    surf.push({ v: true, c: w.x2 + BR, lo: w.y, hi: w.y2, side: 1 });
    surf.push({ v: false, c: w.y - BR, lo: w.x, hi: w.x2, side: -1 });
    surf.push({ v: false, c: w.y2 + BR, lo: w.x, hi: w.x2, side: 1 });
  }
  surf.push({ v: true, c: BR, lo: 0, hi: H, side: 1 });
  surf.push({ v: true, c: W - BR, lo: 0, hi: H, side: -1 });
  surf.push({ v: false, c: BR, lo: 0, hi: W, side: 1 });
  surf.push({ v: false, c: H - BR, lo: 0, hi: W, side: -1 });
  RD = {
    map: state.arena.mapName,
    walls, grid, surf,
    lastTick: state.tick,
    ages: new Map(),
    prevE: null,
    est: { thr: 0, turn: 0 },
    goal: null, goalMode: 'engage', goalTick: -999,
    goalField: null, goalLook: null, goalFieldAt: null,
    meField: null, meFieldTick: -999,
    lastPlan: null,
  };
}

// ---------- прогноз врага ----------

const N_AIM = 54;
const E_ACT = [[0, 0], [1, -1], [1, 0], [1, 1], [0, -1], [0, 0], [0, 1], [-1, -1], [-1, 0], [-1, 1]];
const ESAMP = E_ACT.map(() => ({ w: 0, x: new Float64Array(N_AIM), y: new Float64Array(N_AIM) }));

function predictEnemy(e, walls) {
  const st = e.stats;
  const s = { x: 0, y: 0, h: 0, v: 0 };
  for (let j = 0; j < E_ACT.length; j++) {
    const thr = j === 0 ? RD.est.thr : E_ACT[j][0];
    const turn = j === 0 ? RD.est.turn : E_ACT[j][1];
    const smp = ESAMP[j];
    smp.w = j === 0 ? P.wCont : (1 - P.wCont) / (E_ACT.length - 1);
    s.x = e.x; s.y = e.y; s.h = e.heading; s.v = e.speed;
    for (let k = 0; k < N_AIM; k++) {
      stepTank(s, thr, turn, st, walls);
      smp.x[k] = s.x;
      smp.y[k] = s.y;
    }
  }
  return ESAMP;
}

function updateEstimate(e) {
  const pe = RD.prevE;
  if (pe) {
    const st = e.stats;
    RD.est.turn = clamp(normA(e.heading - pe.h) / (st.turnRate * DT), -1, 1);
    const dv = e.speed - pe.v;
    if (Math.abs(dv) < ACC_DT - 0.05) {
      RD.est.thr = e.speed >= 0 ? e.speed / st.maxSpeed : e.speed / (st.maxSpeed * REV);
    } else if (dv > 0) RD.est.thr = e.speed < -20 ? 0 : 1;
    else RD.est.thr = e.speed > 20 ? 0 : -1;
  }
  RD.prevE = { h: e.heading, v: e.speed };
}

// ---------- угрозы ----------

const N_PLAN = 36;
const N_THREAT = 40;
const THREAT_POOL = Array.from({ length: 40 }, () => makeRec(N_THREAT));

function prepareThreats(state) {
  const me = state.me;
  const out = [];
  const reach = me.stats.maxSpeed * N_PLAN * DT + HITR + 30;
  for (const b of state.bullets) {
    if (out.length >= THREAT_POOL.length) break;
    const age = RD.ages.get(b.id) || DT;
    const rec = THREAT_POOL[out.length];
    simBullet(rec, b.x, b.y, b.vx, b.vy, b.bouncesLeft, b.canHitOwner, age, N_THREAT, RD.walls);
    rec.dmg = b.damage;
    rec.mine = b.mine;
    // Отбрасываем снаряды, которые никогда не подлетят близко.
    let near = false;
    for (let k = 0; k < rec.n && !near; k++) {
      const dx = rec.ex[k] - me.x, dy = rec.ey[k] - me.y;
      if (dx * dx + dy * dy < reach * reach) near = true;
    }
    if (!near) continue;
    if (b.mine) {
      let armed = false;
      const S = rec.steps;
      for (let i = 0; i < rec.n * S; i++) if (rec.f[i] === 2) { armed = true; break; }
      if (!armed) continue;
    }
    out.push(rec);
  }
  return out;
}

// ---------- планировщик движения ----------

const A_THR = [1, 1, 1, 0, 0, 0, -1, -1, -1];
const A_TURN = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
const SPLITS = [5, 14];
const PX = new Float64Array(N_PLAN), PY = new Float64Array(N_PLAN), PH = new Float64Array(N_PLAN), PV = new Float64Array(N_PLAN);
const TT = new Float64Array(N_PLAN), TU = new Float64Array(N_PLAN);
const BEST = {
  cost: 0, x: new Float64Array(N_PLAN), y: new Float64Array(N_PLAN), h: new Float64Array(N_PLAN),
  thr: new Float64Array(N_PLAN), turn: new Float64Array(N_PLAN),
};

function steerTo(s, tx, ty, out) {
  const want = Math.atan2(ty - s.y, tx - s.x);
  const diff = normA(want - s.h);
  const ad = Math.abs(diff);
  if (ad > 2.0) {
    const back = normA(diff + PI);
    out[0] = -1; out[1] = clamp(back * 5, -1, 1);
  } else {
    out[0] = ad < 0.5 ? 1 : ad < 1.1 ? 0.5 : 0;
    out[1] = clamp(diff * 5, -1, 1);
  }
}

// Максимальное отклонение от прямолинейного прогноза за время T (разгон / торможение).
function devFwd(v, T, V) {
  const t1 = (V - v) / ACC;
  if (T <= t1) return 0.5 * ACC * T * T;
  return 0.5 * ACC * t1 * t1 + (V - v) * (T - t1);
}
function devBack(v, T, V) {
  const Vr = V * REV;
  const t2 = (v + Vr) / ACC;
  if (T <= t2) return 0.5 * ACC * T * T;
  return 0.5 * ACC * t2 * t2 + (v + Vr) * (T - t2);
}

function rayFree(x, y, dx, dy, maxD, walls) {
  // Сколько можно проехать по направлению (dx,dy), пока центр танка не упрётся в стену.
  let d = maxD;
  if (dx > 1e-9) d = Math.min(d, (W - TR - x) / dx); else if (dx < -1e-9) d = Math.min(d, (TR - x) / dx);
  if (dy > 1e-9) d = Math.min(d, (H - TR - y) / dy); else if (dy < -1e-9) d = Math.min(d, (TR - y) / dy);
  for (const w of walls) {
    const minX = w.x - TR, maxX = w.x2 + TR, minY = w.y - TR, maxY = w.y2 + TR;
    let t0 = 0, t1 = d;
    const p = [-dx, dx, -dy, dy], q = [x - minX, maxX - x, y - minY, maxY - y];
    let ok = true;
    for (let i = 0; i < 4 && ok; i++) {
      if (Math.abs(p[i]) < 1e-12) { if (q[i] < 0) ok = false; continue; }
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) ok = false; else if (t > t0) t0 = t; }
      else { if (t < t0) ok = false; else if (t < t1) t1 = t; }
    }
    if (ok && t0 < d) d = Math.max(0, t0);
  }
  return Math.max(0, d);
}

function planMove(ctx) {
  const { me, st, walls, threats } = ctx;
  const out = [0, 0];
  const s = { x: 0, y: 0, h: 0, v: 0 };
  let bestCost = Infinity;
  const lp = RD.lastPlan;
  const nCand = 9 * SPLITS.length * 10 + (lp ? 1 : 0);
  for (let ci = 0; ci < nCand; ci++) {
    let a1 = 0, k1 = 0, a2 = 0, cont = false;
    if (ci === 9 * SPLITS.length * 10) cont = true;
    else {
      a1 = (ci / (SPLITS.length * 10)) | 0;
      const rem = ci - a1 * SPLITS.length * 10;
      k1 = SPLITS[(rem / 10) | 0];
      a2 = rem % 10;
      if (a2 === a1 && k1 !== SPLITS[0]) continue;
    }
    s.x = me.x; s.y = me.y; s.h = me.heading; s.v = me.speed;
    let bumps = 0;
    for (let k = 0; k < N_PLAN; k++) {
      let thr, turn;
      if (cont) {
        const kk = Math.min(k + 1, N_PLAN - 1);
        thr = lp.thr[kk]; turn = lp.turn[kk];
      } else if (k < k1) { thr = A_THR[a1]; turn = A_TURN[a1]; }
      else if (a2 < 9) { thr = A_THR[a2]; turn = A_TURN[a2]; }
      else {
        const ci2 = cellIndex(RD.grid, s.x, s.y);
        steerTo(s, RD.goalLook.lx[ci2], RD.goalLook.ly[ci2], out);
        thr = out[0]; turn = out[1];
      }
      TT[k] = thr; TU[k] = turn;
      if (stepTank(s, thr, turn, st, walls)) bumps++;
      PX[k] = s.x; PY[k] = s.y; PH[k] = s.h; PV[k] = s.v;
    }
    let cost = evalPlan(ctx, bumps);
    if (cont) cost -= 8; // лёгкая инерция решения
    if (cost < bestCost) {
      bestCost = cost;
      BEST.cost = cost;
      BEST.x.set(PX); BEST.y.set(PY); BEST.h.set(PH);
      BEST.thr.set(TT); BEST.turn.set(TU);
    }
  }
  RD.lastPlan = { thr: Float64Array.from(BEST.thr), turn: Float64Array.from(BEST.turn) };
  return BEST;
}

function evalPlan(ctx, bumps) {
  const { me, threats, state, enemy } = ctx;
  let cost = 0;
  // Снаряды.
  for (let bi = 0; bi < threats.length; bi++) {
    const r = threats[bi];
    const S = r.steps;
    const nn = Math.min(r.n, N_PLAN);
    let hitK = -1, minD2 = 1e18;
    for (let k = 0; k < nn && hitK < 0; k++) {
      const ex = r.ex[k] - PX[k], ey = r.ey[k] - PY[k];
      if (ex * ex + ey * ey > 5000) continue; // (29+42)^2
      const base = k * S;
      for (let s = 0; s < S; s++) {
        const f = r.f[base + s];
        if (f === 0 || (r.mine && f !== 2)) continue;
        const dx = r.x[base + s] - PX[k], dy = r.y[base + s] - PY[k];
        const d2 = dx * dx + dy * dy;
        if (d2 < HITR2) { hitK = k; break; }
        if (d2 < minD2) minD2 = d2;
      }
    }
    if (hitK >= 0) cost += r.dmg * P.hpW * Math.pow(0.975, hitK);
    else if (minD2 < 39 * 39) cost += ((39 - Math.sqrt(minD2)) / 10) * r.dmg * P.hpW * 0.25;
  }
  // Зона.
  const z = state.zone;
  for (let k = 2; k < N_PLAN; k += 3) {
    const rz = zoneRadius(state.time + (k + 1) * DT);
    const dx = PX[k] - z.x, dy = PY[k] - z.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > rz) cost += 20 * DT * 3 * P.hpW * 1.3;
    else if (d > rz - 25) cost += (d - (rz - 25)) * 0.3;
  }
  // Аптечки по пути.
  for (const kit of state.repairKits) {
    if (!kit.active) continue;
    const heal = Math.min(50, me.maxHp - me.hp);
    for (let k = 0; k < N_PLAN; k += 2) {
      const dx = PX[k] - kit.x, dy = PY[k] - kit.y;
      if (dx * dx + dy * dy < 38 * 38) { cost -= (heal + 5) * P.hpW * 0.8; break; }
    }
  }
  cost += bumps * 4;
  const L = N_PLAN - 1;
  const x = PX[L], y = PY[L], h = PH[L], v = PV[L];
  // Цель манёвра.
  cost += fieldAt(RD.goalField, RD.grid, x, y) * P.goalW;
  // Враг: дистанция и готовность увернуться.
  if (enemy.alive) {
    const ex = ctx.eEndX, ey = ctx.eEndY;
    const dx = ex - x, dy = ey - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 60) cost += (60 - d) * 3;
    if (d < P.closeDist && ctx.mode !== 'kit') cost += (P.closeDist - d) * P.closeW;
    for (let k = 11; k < N_PLAN; k += 12) {
      const kx = PX[k], ky = PY[k];
      const edx = ctx.eEndX - kx, edy = ctx.eEndY - ky;
      const dd = Math.sqrt(edx * edx + edy * edy);
      if (!segClear(kx, ky, ctx.eEndX, ctx.eEndY, 4, RD.walls)) continue;
      const T = Math.max(0, (dd - 63) / enemy.stats.bulletSpeed - 2 * DT);
      const bearing = Math.atan2(edy, edx);
      const hh = PH[k];
      const lat = Math.abs(Math.sin(hh - bearing));
      const cs = Math.cos(hh), sn = Math.sin(hh);
      const fwdRoom = rayFree(kx, ky, cs, sn, 120, RD.walls);
      const backRoom = rayFree(kx, ky, -cs, -sn, 120, RD.walls);
      const vv = PV[k];
      const df = Math.min(devFwd(vv, T, me.stats.maxSpeed), Math.max(0, fwdRoom - vv * T));
      const db = Math.min(devBack(vv, T, me.stats.maxSpeed), Math.max(0, backRoom + vv * T));
      const cap = lat * Math.max(df, db);
      cost += (P.readyW / 3) * Math.max(0, 1 - cap / 42);
    }
  }
  return cost;
}

// ---------- выбор цели манёвра ----------

function chooseGoal(ctx) {
  const { me, enemy, state } = ctx;
  const grid = RD.grid;
  const st = me.stats;
  const t = state.time;
  if (state.tick - RD.meFieldTick >= 6 || !RD.meField) {
    RD.meField = dijkstra(grid, me.x, me.y);
    RD.meFieldTick = state.tick;
  }
  const meF = RD.meField;
  let goal = null, mode = 'engage';

  // Аптечки.
  let bestKit = null, bestKitScore = 0;
  const heal = Math.min(50, me.maxHp - me.hp);
  const eHeal = Math.min(50, enemy.maxHp - enemy.hp);
  for (const k of state.repairKits) {
    const myD = fieldAt(meF, grid, k.x, k.y);
    const myEta = myD / st.maxSpeed + 0.4;
    const eEta = enemy.alive ? (Math.hypot(enemy.x - k.x, enemy.y - k.y) * 1.15) / enemy.stats.maxSpeed + 0.4 : 1e9;
    if (!k.active && k.respawnIn > myEta + 3) continue;
    const arrive = Math.max(myEta, k.active ? 0 : k.respawnIn);
    if (Math.hypot(k.x - state.zone.x, k.y - state.zone.y) > zoneRadius(t + arrive) - 10) continue;
    let val = heal / me.maxHp + 0.5 * (eHeal / enemy.maxHp);
    if (eEta + 0.4 < arrive) val *= 0.35;
    if (heal < 20 && eHeal < 20) val = 0;
    const score = val / (arrive + 2);
    if (val >= 0.14 && score > bestKitScore) { bestKitScore = score; bestKit = k; }
  }
  if (bestKit) { goal = { x: bestKit.x, y: bestKit.y }; mode = 'kit'; }

  if (!goal) {
    // Точка боя: перебор по сетке 50 px.
    const pref = P.prefDist;
    let best = Infinity;
    const prev = RD.goal;
    for (let gy = 25; gy < H; gy += 50) {
      for (let gx = 25; gx < W; gx += 50) {
        const ci = clamp(Math.floor(gx / CELL), 0, GC - 1) + GC * clamp(Math.floor(gy / CELL), 0, GR - 1);
        if (!grid.free[ci]) continue;
        const clr = grid.clear[ci];
        const travel = fieldAt(meF, grid, gx, gy);
        if (travel >= 1e9) continue;
        const eta = travel / st.maxSpeed;
        const zr = zoneRadius(t + eta + 3) - 45;
        const zd = Math.hypot(gx - state.zone.x, gy - state.zone.y);
        let sc = travel * 0.35;
        if (zd > zr) sc += 400 + (zd - zr) * 4;
        if (clr < 75) sc += (75 - clr) * 2.5;
        if (enemy.alive) {
          const d = Math.hypot(gx - enemy.x, gy - enemy.y);
          sc += Math.abs(d - pref) * 0.8;
          if (!segClear(gx, gy, enemy.x, enemy.y, 6, RD.walls)) sc += 220;
        }
        if (prev) sc += Math.hypot(gx - prev.x, gy - prev.y) * 0.25;
        if (sc < best) { best = sc; goal = { x: gx, y: gy }; }
      }
    }
    if (!goal) goal = { x: state.zone.x, y: state.zone.y };
  }
  const moved = !RD.goal || Math.hypot(goal.x - RD.goal.x, goal.y - RD.goal.y) > 30 || !RD.goalField;
  RD.goal = goal;
  RD.goalMode = mode;
  if (moved || state.tick - RD.goalTick > 45) {
    RD.goalField = dijkstra(grid, goal.x, goal.y);
    RD.goalLook = buildLook(RD.goalField, grid, goal.x, goal.y, RD.walls);
    RD.goalTick = state.tick;
  }
}

// ---------- прицел ----------

const AIM_REC = makeRec(N_AIM);

function muzzleBlocked(x, y) {
  return boundsHit(x, y, BR) || wallHit(x, y, BR, RD.walls);
}

// Оценка выстрела под углом th из точки (cx,cy) в тик t+1.
const SHOT = { p: 0, self: 0, tHit: 0, blocked: false, ricochet: false };
const RESOLVED = new Int32Array(E_ACT.length);

function evalShot(cx, cy, th, vb, samples, plan) {
  SHOT.p = 0; SHOT.self = 0; SHOT.tHit = 0; SHOT.blocked = false; SHOT.ricochet = false;
  const mx = cx + Math.cos(th) * MUZ, my = cy + Math.sin(th) * MUZ;
  if (muzzleBlocked(mx, my)) { SHOT.blocked = true; return SHOT; }
  const rec = simBullet(AIM_REC, mx, my, Math.cos(th) * vb, Math.sin(th) * vb, 1, false, 0, N_AIM, RD.walls);
  const S = rec.steps;
  const ns = samples.length;
  RESOLVED.fill(-1);
  let open = ns;
  let selfK = -1;
  for (let k = 0; k < rec.n && open > 0; k++) {
    const base = k * S;
    const kp = Math.min(k, N_PLAN - 1);
    for (let s = 0; s < S && open > 0; s++) {
      const f = rec.f[base + s];
      if (f === 0) continue;
      const bx = rec.x[base + s], by = rec.y[base + s];
      if (f === 2 && selfK < 0) {
        const dx = bx - plan.x[kp], dy = by - plan.y[kp];
        if (dx * dx + dy * dy < (HITR + 6) * (HITR + 6)) selfK = k;
      }
      for (let j = 0; j < ns; j++) {
        if (RESOLVED[j] !== -1) continue;
        if (selfK >= 0) { RESOLVED[j] = -2; open--; continue; }
        const dx = bx - samples[j].x[k], dy = by - samples[j].y[k];
        if (dx * dx + dy * dy < HITR2) {
          RESOLVED[j] = k; open--;
          SHOT.p += samples[j].w;
          SHOT.tHit += samples[j].w * k;
          if (f === 2) SHOT.ricochet = true;
        }
      }
    }
  }
  if (selfK >= 0) {
    for (let j = 0; j < ns; j++) if (RESOLVED[j] === -1 || RESOLVED[j] === -2) SHOT.self += samples[j].w;
  }
  if (SHOT.p > 0) SHOT.tHit /= SHOT.p;
  return SHOT;
}

function interceptAngle(cx, cy, xs, ys, vb) {
  for (let k = 0; k < N_AIM; k++) {
    const dx = xs[k] - cx, dy = ys[k] - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (MUZ + vb * DT * (k + 1) >= d) return Math.atan2(dy, dx);
  }
  return null;
}

function bankAngles(cx, cy, xs, ys, vb, out) {
  for (const sf of RD.surf) {
    const sc = sf.v ? cx : cy;
    if ((sc - sf.c) * sf.side <= 0) continue; // стрелок не с той стороны
    for (let k = 0; k < N_AIM; k += 1) {
      const tx = xs[k], ty = ys[k];
      const tc = sf.v ? tx : ty;
      if ((tc - sf.c) * sf.side <= 0) break;
      const mx = sf.v ? 2 * sf.c - tx : tx, my = sf.v ? ty : 2 * sf.c - ty;
      const dx = mx - cx, dy = my - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (MUZ + vb * DT * (k + 1) >= d) {
        // точка отражения должна лежать на грани
        let rr;
        if (sf.v) { const tt = (sf.c - cx) / (mx - cx); rr = cy + tt * (my - cy); }
        else { const tt = (sf.c - cy) / (my - cy); rr = cx + tt * (mx - cx); }
        if (rr > sf.lo + 3 && rr < sf.hi - 3) out.push(Math.atan2(dy, dx));
        break;
      }
    }
  }
}

function aim(ctx, plan) {
  const { me, enemy, samples } = ctx;
  const vb = me.stats.bulletSpeed;
  const cx = plan.x[0], cy = plan.y[0];
  const cands = [];
  for (let j = 0; j < samples.length; j++) {
    const a = interceptAngle(cx, cy, samples[j].x, samples[j].y, vb);
    if (a !== null) cands.push(a);
  }
  const direct0 = cands.length ? cands[0] : Math.atan2(enemy.y - cy, enemy.x - cx);
  bankAngles(cx, cy, samples[0].x, samples[0].y, vb, cands);
  // Уточнение вокруг прямого прогноза.
  for (const off of [-0.03, 0.03, -0.06, 0.06]) cands.push(direct0 + off);
  let bestA = direct0, bestV = -1, bestP = 0;
  const tur = me.turret;
  const tRate = TRATE * DT;
  for (const a of cands) {
    const r = evalShot(cx, cy, a, vb, samples, plan);
    if (r.blocked) continue;
    const rot = Math.abs(normA(a - tur)) / tRate;
    const v = (r.p - 3 * r.self) * Math.pow(0.97, Math.max(0, rot - me.reloadLeft / DT));
    if (v > bestV) { bestV = v; bestA = a; bestP = r.p; }
  }
  if (bestV <= 0) bestA = direct0;
  const diff = normA(bestA - tur);
  const turretTurn = clamp(diff / tRate, -1, 1);
  const next = normA(tur + turretTurn * tRate);
  let fire = false;
  if (me.reloadLeft <= DT + 1e-6 && enemy.alive) {
    const r = evalShot(cx, cy, next, vb, samples, plan);
    if (!r.blocked && r.self < 0.02 && r.p >= P.fireMin) fire = true;
  }
  return { turretTurn, fire, bestP };
}

// ---------- главный цикл ----------

function think(state) {
  if (!RD || RD.map !== state.arena.mapName || state.tick < RD.lastTick || state.tick === 0) setupRound(state);
  RD.lastTick = state.tick;
  const me = state.me, enemy = state.enemy;
  // Возраст снарядов.
  const ages = new Map();
  for (const b of state.bullets) ages.set(b.id, (RD.ages.get(b.id) || 0) + DT);
  RD.ages = ages;
  if (!me.alive) return { throttle: 0, turn: 0, turretTurn: 0, fire: false };
  updateEstimate(enemy);

  const samples = predictEnemy(enemy, RD.walls);
  const ctx = {
    state, me, enemy, st: me.stats, walls: RD.walls,
    threats: prepareThreats(state),
    samples,
    eEndX: samples[0].x[N_PLAN - 1], eEndY: samples[0].y[N_PLAN - 1],
    mode: RD.goalMode,
  };
  if (state.tick % 6 === 0 || !RD.goalField) chooseGoal(ctx);
  ctx.mode = RD.goalMode;
  const plan = planMove(ctx);
  const a = aim(ctx, plan);
  return { throttle: plan.thr[0], turn: plan.turn[0], turretTurn: a.turretTurn, fire: a.fire };
}

const bot = {
  name: 'Опус',
  motto: 'Вижу каждую пулю',
  stats: { armor: 2, engine: 1, gun: 2, reload: 5 },
  _P: P,

  init(info) {
    MEM.round = info.round;
    setupRound(info.view);
  },

  tick(state) {
    return think(state);
  },
};

export default bot;
