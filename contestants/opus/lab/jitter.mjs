// Насколько дёргано ездит танк: смены знака газа и поворота в секунду.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const E = await import(pathToFileURL(join(root, 'arena', 'engine.js')).href);
const spec = process.argv[2] || 'lab/opponents/fable';
const inertia = process.argv[3] ? Number(process.argv[3]) : null;
const A = (await import(pathToFileURL(join(root, 'tank', 'bot.js')).href + '?x=a')).default;
const B0 = 0;
const B = (await import(pathToFileURL(join(root, spec, 'bot.js')).href + '?x=b')).default;
if (inertia !== null) A._P.inertia = inertia;
let flipsT = 0, flipsU = 0, ticks = 0, still = 0;
for (let i = 0; i < 8; i++) {
  const plan = E.roundPlan(i);
  const aSide = plan.swap ? 1 : 0;
  const bots = aSide === 0 ? [A, B] : [B, A];
  const round = E.createRound({ mapIndex: plan.mapIndex, tanks: bots.map((b) => ({ name: b.name, stats: b.stats })) });
  for (let s = 0; s < 2; s++) bots[s].init?.({ round: i, side: s, mapName: round.map.name, view: E.botView(round, s) });
  let pt = 0, pu = 0;
  while (!round.over) {
    const acts = [0, 1].map((s) => bots[s].tick(E.botView(round, s)));
    const a = acts[aSide];
    const st = Math.sign(a.throttle), su = Math.sign(a.turn);
    if (st && pt && st !== pt) flipsT++;
    if (su && pu && su !== pu) flipsU++;
    if (st) pt = st;
    if (su) pu = su;
    if (Math.abs(round.tanks[aSide].speed) < 5) still++;
    ticks++;
    E.stepRound(round, acts);
  }
}
const sec = ticks / 30;
console.log(`газ: ${(flipsT / sec).toFixed(2)} смен/с, поворот: ${(flipsU / sec).toFixed(2)} смен/с, стоит ${(100 * still / ticks).toFixed(0)}% времени, секунд ${sec.toFixed(0)}`);
