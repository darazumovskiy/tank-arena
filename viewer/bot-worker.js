// Runs one bot in isolation. The bot never sees engine state or the other bot.
let bot = null;

const describe = (err) => String((err && err.stack) || err);

self.onmessage = async ({ data: m }) => {
  if (m.type === 'load') {
    try {
      const mod = await import(m.url);
      bot = mod.default ?? mod;
      self.postMessage({
        id: m.id,
        type: 'loaded',
        name: String(bot?.name ?? ''),
        motto: String(bot?.motto ?? ''),
        stats: bot?.stats ? { ...bot.stats } : null,
        hasTick: typeof bot?.tick === 'function',
      });
    } catch (err) {
      self.postMessage({ id: m.id, type: 'loaded', error: describe(err) });
    }
    return;
  }
  if (m.type === 'init') {
    try {
      bot?.init?.(m.info);
    } catch (err) {
      self.postMessage({ type: 'error', where: 'init', error: describe(err) });
    }
    self.postMessage({ id: m.id, type: 'ok' });
    return;
  }
  if (m.type === 'tick') {
    let action = null;
    try {
      action = bot.tick(m.view);
    } catch (err) {
      self.postMessage({ type: 'error', where: 'tick', error: describe(err) });
    }
    const safe = action && typeof action === 'object'
      ? { throttle: Number(action.throttle), turn: Number(action.turn), turretTurn: Number(action.turretTurn), fire: !!action.fire }
      : null;
    self.postMessage({ id: m.id, type: 'action', action: safe });
  }
};
