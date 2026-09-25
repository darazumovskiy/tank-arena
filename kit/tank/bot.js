// Стартовый шаблон. Замени всё: имя, девиз, характеристики и мозги.
// Правила и API — в ARENA.md.

export default {
  name: 'Безымянный',
  motto: 'Пока без девиза',
  // 10 очков на 4 характеристики, каждая 0..5
  stats: { armor: 3, engine: 3, gun: 2, reload: 2 },

  // Необязательно: вызывается в начале каждого раунда.
  init(info) {},

  // Вызывается 30 раз в секунду. Верни команды танку.
  tick(state) {
    const { me, enemy } = state;
    const want = Math.atan2(enemy.y - me.y, enemy.x - me.x);
    const diff = Math.atan2(Math.sin(want - me.turret), Math.cos(want - me.turret));
    return { throttle: 0, turn: 0, turretTurn: Math.max(-1, Math.min(1, diff * 4)), fire: Math.abs(diff) < 0.1 };
  },
};
