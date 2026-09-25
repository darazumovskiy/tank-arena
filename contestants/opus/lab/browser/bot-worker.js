// Воркер одного бота — как в браузерном просмотрщике: состояние приходит сообщением, ответ — команда.
let bot = null;
self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'load') {
    bot = (await import(m.url)).default;
    postMessage({ type: 'loaded', name: bot.name, stats: bot.stats, motto: bot.motto });
  } else if (m.type === 'init') {
    const t0 = performance.now();
    try { bot.init?.(m.info); } catch (err) { postMessage({ type: 'error', where: 'init', msg: String(err) }); }
    postMessage({ type: 'inited', dt: performance.now() - t0 });
  } else if (m.type === 'tick') {
    const t0 = performance.now();
    let a = null, err = null;
    try { a = bot.tick(m.state); } catch (ex) { err = String(ex && ex.stack || ex); }
    postMessage({ type: 'act', a, err, dt: performance.now() - t0, tick: m.state.tick });
  }
};
