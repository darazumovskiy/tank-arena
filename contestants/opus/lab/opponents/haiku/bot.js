// Haiku: predictive targeting with smart positioning
// Stats: armor 3, engine 2, gun 3, reload 2 - survives long enough to win

const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Find the most dangerous incoming bullet
function findDangerousBullet(me, bullets) {
  let best = null;
  let bestScore = -Infinity;

  for (const b of bullets) {
    // Skip own bullets that can't bounce back yet
    if (b.mine && !b.canHitOwner) continue;

    const dx = me.x - b.x;
    const dy = me.y - b.y;
    const dist = Math.hypot(dx, dy);

    // Skip distant bullets
    if (dist > 400) continue;

    const speed = Math.hypot(b.vx, b.vy);
    if (speed < 1) continue;

    // Check if bullet is heading toward us
    const dotProduct = dx * b.vx + dy * b.vy;
    if (dotProduct <= 0) continue; // Moving away or parallel

    // Estimate time to closest approach
    const t = dotProduct / (speed * speed);
    if (t > 1.0) continue; // Too far in future

    // Estimate miss distance
    const closestX = b.x + b.vx * t;
    const closestY = b.y + b.vy * t;
    const miss = Math.hypot(closestX - me.x, closestY - me.y);

    if (miss > 70) continue; // Will miss safely

    // Score: urgent close misses are more dangerous
    const score = (100 - miss) * (1.0 - t * 0.5);
    if (score > bestScore) {
      bestScore = score;
      best = { b, t, miss };
    }
  }

  return best;
}

// Predict where enemy will be when our bullet arrives
function predictTarget(me, enemy) {
  const bulletSpeed = me.stats.bulletSpeed;
  let px = enemy.x;
  let py = enemy.y;

  // Simple iteration: where enemy will be when bullet reaches that point
  for (let i = 0; i < 2; i++) {
    const dist = Math.hypot(px - me.x, py - me.y);
    if (dist < 50) break; // Close enough
    const travelTime = dist / bulletSpeed;
    px = enemy.x + enemy.vx * travelTime;
    py = enemy.y + enemy.vy * travelTime;
  }

  return { x: px, y: py };
}

// Drive toward a waypoint
function driveTo(me, targetX, targetY) {
  const dx = targetX - me.x;
  const dy = targetY - me.y;
  const wantAngle = Math.atan2(dy, dx);
  const diff = norm(wantAngle - me.heading);

  // If we need to reverse, do it quickly
  if (Math.abs(diff) > 1.8) {
    return {
      throttle: -0.7,
      turn: clamp(diff * 2.0, -1, 1)
    };
  }

  // Otherwise move forward
  return {
    throttle: Math.cos(diff) > 0.2 ? 0.8 : 0.2,
    turn: clamp(diff * 2.5, -1, 1)
  };
}

// Dodge to the side of an incoming bullet
function dodge(me, bullet, arena) {
  // Calculate perpendicular direction to bullet path
  const bAngle = Math.atan2(bullet.b.vy, bullet.b.vx);
  const perpAngle = bAngle + Math.PI / 2;

  // Dodge in the perpendicular direction that takes us away
  const testLeft = me.x + Math.cos(perpAngle) * 100;
  const testRight = me.x - Math.cos(perpAngle) * 100;

  // Pick the direction that keeps us in bounds
  const leftDist = Math.hypot(testLeft - arena.width / 2, me.y - arena.height / 2);
  const rightDist = Math.hypot(testRight - arena.width / 2, me.y - arena.height / 2);

  const dodgeX = leftDist < rightDist ? testLeft : testRight;
  const dodgeY = me.y + Math.sin(perpAngle) * (leftDist < rightDist ? 100 : -100);

  return driveTo(me,
    clamp(dodgeX, 30, arena.width - 30),
    clamp(dodgeY, 30, arena.height - 30)
  );
}

export default {
  name: 'Хаику',
  motto: 'Мишень в движенье — выстрел не спешит',
  stats: { armor: 3, engine: 2, gun: 3, reload: 2 },

  tick(state) {
    const { me, enemy, arena, bullets, repairKits, zone, time } = state;

    // ===== AIMING =====
    // Predict enemy position and aim there
    const prediction = predictTarget(me, enemy);
    const aimAngle = Math.atan2(prediction.y - me.y, prediction.x - me.x);
    const turretDiff = norm(aimAngle - me.turret);

    // Smoothly rotate turret toward target
    const turretTurn = clamp(turretDiff * 6, -1, 1);

    // Fire when well-aimed
    const canFire = me.reloadLeft <= 0 && enemy.alive;
    const wellAimed = Math.abs(turretDiff) < 0.12;

    // Check muzzle isn't in a wall
    const mx = me.x + Math.cos(me.turret) * 34;
    const my = me.y + Math.sin(me.turret) * 34;
    let muzzleBlocked = false;
    for (const w of arena.walls) {
      if (mx > w.x - 15 && mx < w.x + w.w + 15 && my > w.y - 15 && my < w.y + w.h + 15) {
        muzzleBlocked = true;
        break;
      }
    }
    const fire = canFire && wellAimed && !muzzleBlocked;

    // ===== MOVEMENT =====
    let drive;

    // Priority 1: Emergency dodge from dangerous bullets
    const danger = findDangerousBullet(me, bullets);
    if (danger && danger.t < 0.3) {
      drive = dodge(me, danger, arena);
    } else {
      // Priority 2: Manage health and zone
      const distToZone = Math.hypot(me.x - zone.x, me.y - zone.y);
      const outsideZone = distToZone > zone.radius + 50;
      const lowHealth = me.hp < me.maxHp * 0.6;

      if (lowHealth) {
        // Try to find and go to repair kit
        const activeKit = repairKits.find((k) => k.active);
        if (activeKit) {
          drive = driveTo(me, activeKit.x, activeKit.y);
        } else if (outsideZone) {
          drive = driveTo(me, zone.x, zone.y);
        } else {
          // Orbit enemy at safe distance if we can't heal
          const orbitDist = 350;
          const orbitAngle = Math.atan2(me.y - enemy.y, me.x - enemy.x) + state.tick * 0.01;
          const orbitX = enemy.x + Math.cos(orbitAngle) * orbitDist;
          const orbitY = enemy.y + Math.sin(orbitAngle) * orbitDist;
          drive = driveTo(me, orbitX, orbitY);
        }
      } else if (outsideZone && time > 60) {
        // Respect the zone
        drive = driveTo(me, zone.x, zone.y);
      } else {
        // Priority 3: Hunt or position relative to enemy
        const distToEnemy = Math.hypot(enemy.x - me.x, enemy.y - me.y);

        if (distToEnemy < 140) {
          // Enemy is too close - back away slightly
          const backAngle = Math.atan2(me.y - enemy.y, me.x - enemy.x);
          drive = driveTo(me,
            me.x + Math.cos(backAngle) * 80,
            me.y + Math.sin(backAngle) * 80
          );
        } else if (distToEnemy > 420) {
          // Enemy is too far - chase aggressively
          drive = driveTo(me, enemy.x, enemy.y);
        } else {
          // Comfortable range - aggressive orbit to press the fight
          const preferredDist = 260;
          const orbitAngle = Math.atan2(me.y - enemy.y, me.x - enemy.x) + (state.tick * 0.014);
          const orbitX = enemy.x + Math.cos(orbitAngle) * preferredDist;
          const orbitY = enemy.y + Math.sin(orbitAngle) * preferredDist;
          drive = driveTo(me, orbitX, orbitY);
        }
      }
    }

    return {
      throttle: drive.throttle,
      turn: drive.turn,
      turretTurn,
      fire
    };
  }
};
