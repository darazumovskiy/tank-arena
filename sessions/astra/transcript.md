# GPT-6 Astra: сессия «Танки»

Codex CLI 0.157.0, модель GPT-6 Astra, effort max. Время `+чч:мм:сс` отсчитано от промпта (25.09.2026, 14:29:51 по местному времени, UTC−3). Скрытые рассуждения модели не публикуются, здесь только видимое. Команды оболочки и правки выполнялись внутри вызовов `exec`; результаты усечены до 15 строк, полностью они в `session.jsonl`.

## Промпт `+00:00:00`

````
Ты участвуешь в турнире танковых ботов против другой нейросети. Правила, API и песочница описаны в ARENA.md в этой папке.

Создай свой танк в папке tank/:

придумай ему имя и девиз;
нарисуй внешний вид (body.svg и turret.svg): танк будет крупно показан в видео, пусть его запомнят;
распредели 10 очков характеристик;
напиши ему искусственный интеллект.
Проверяй и улучшай танк в песочнице (node arena/cli.mjs) сколько считаешь нужным. Цель — победить соперника, о котором ты ничего не знаешь. Работай только внутри этой папки. Когда закончишь, коротко расскажи, какую стратегию выбрал и почему.
````

### `+00:00:03` Модель

Сначала прочитаю правила и API, затем соберу танк с узнаваемым обликом и проверю его тактику в боях песочницы.

#### `+00:00:05` Команда (код 1, 0 с)

````powershell
Get-Content -LiteralPath ARENA.md; rg --files -g AGENTS.md -g CONTEXT.md -g '!node_modules' -g '!vendor' -g '!dist' -g '!build' .
````

Результат:

`````
# Танковая арена — правила для участника

Ты создаёшь танк для турнира один на один. Соперник — танк другого участника, его код тебе неизвестен. Бой показывают на видео: важен и результат, и то, как танк выглядит и ведёт себя.

Работай только внутри этой папки. Твой танк — папка `tank/`: при подведении итогов из этой папки берутся `bot.js`, `body.svg` и `turret.svg`, остальное организуй как хочешь. Папку `arena/` не меняй: судья использует свою копию движка, правки в твоей копии на бой не влияют.

## Что сдать

`tank/bot.js` — ES-модуль:

```js
export default {
  name: 'Имя танка',            // до 20 символов, покажется крупно на экране
  motto: 'Девиз',               // до 60 символов, для экрана представления
  stats: { armor: 3, engine: 3, gun: 2, reload: 2 },
… (ещё 73 строк)
`````

#### `+00:00:18` Команда (код 0, 0 с)

````powershell
rg --files -g '!node_modules' -g '!vendor' -g '!dist' -g '!build' .
````

Результат:

````
.\tank\turret.svg
.\tank\bot.js
.\tank\body.svg
.\contestant.json
.\ARENA.md
.\arena\sparring\hunter\turret.svg
.\arena\sparring\hunter\bot.js
.\arena\sparring\hunter\body.svg
.\arena\sparring\dummy\turret.svg
.\arena\sparring\dummy\bot.js
.\arena\sparring\dummy\body.svg
.\arena\engine.js
.\arena\cli.mjs
````

#### `+00:00:19` Команда (код 0, 0 с)

````powershell
Get-Content -LiteralPath arena/engine.js
````

Результат:

````
// Tank Arena engine. Pure, deterministic, no DOM and no Node APIs:
  stepBullets(round, events);
  stepKits(round, events);

  const prevRadius = round.zone.radius;
  round.zone.radius = zoneRadiusAt(round.time + DT);
  if (prevRadius === ZONE_START_RADIUS && round.zone.radius < prevRadius) events.push({ type: 'zoneStart' });
  for (const t of round.tanks) {
    if (!t.alive) continue;
    if (Math.hypot(t.x - round.zone.x, t.y - round.zone.y) > round.zone.radius) {
      const dmg = ZONE.damagePerSecond * DT;
      t.tally.zoneDamage += Math.min(t.hp, dmg);
      damageTank(round, t, dmg, events, { cause: 'zone', quiet: true });
    }
  }
… (ещё 19 строк)
````

#### `+00:00:19` Команда (код 0, 0 с)

````powershell
Get-Content -LiteralPath arena/cli.mjs; Get-ChildItem -LiteralPath arena/sparring; Get-Content -LiteralPath package.json -ErrorAction SilentlyContinue; node --version
````

Результат:

````
#!/usr/bin/env node
// Sandbox: run your tank against sparring bots without a browser.
//   node arena/cli.mjs                      -> tank/ vs hunter, 8 rounds (all maps, both sides)
//   node arena/cli.mjs --vs dummy --rounds 4
//   node arena/cli.mjs --vs tank            -> mirror match against yourself
//   node arena/cli.mjs --map Каньон --verbose
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  MAPS, STAT_POINTS, checkStats, createRound, stepRound, botView, roundPlan, DT,
} from './engine.js';

const here = dirname(fileURLToPath(import.meta.url));
… (ещё 136 строк)
````

#### `+00:00:25` Команда (код 0, 0 с)

````powershell
Get-Content -LiteralPath tank/bot.js, tank/body.svg, tank/turret.svg, arena/sparring/hunter/bot.js, arena/sparring/dummy/bot.js, contestant.json
````

Результат:

````
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
… (ещё 220 строк)
````

### `+00:00:45` Модель

В правилах есть два сильных рычага: скорострельность и возможность заранее видеть все снаряды. Строю «ПАРАЛЛАКС»: он будет рассчитывать уклонения, стрелять с упреждением и обходить укрытия. Раскладку очков выберу по серии боёв с разными противниками.

#### `+00:00:49` Команда (код 1, 0 с)

````powershell
Get-ChildItem -Force; Get-Command python, python3, magick, inkscape, chrome, msedge -ErrorAction SilentlyContinue | Select-Object Name, Source
````

Результат:

````

    Directory: C:\tank-arena\contestants\astra

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d--h-          25.09.2026    13:52                .git
d----          25.09.2026    13:48                arena
d----          25.09.2026    13:48                tank
-a---          25.09.2026    13:27           8023 ARENA.md
-a---          25.09.2026    13:48             51 contestant.json

Name   : python.exe
Source : ~\AppData\Local\Programs\Python\Python313\python.exe


… (ещё 2 строк)
````

_`+00:00:49` … `+00:05:44` пауза 4 мин 54 с: модель готовит следующий шаг, её скрытые рассуждения не публикуются_

### `+00:05:46` Модель

Для уклонений уже выбрана схема: танк сравнивает несколько будущих траекторий с полётом снарядов, включая рикошеты. Навигация отдельно учитывает ширину корпуса, чтобы не застревать в проходах. Следующий шаг — первый полный прогон по четырём картам.

_`+00:05:46` … `+00:11:19` пауза 5 мин 32 с: модель готовит следующий шаг, её скрытые рассуждения не публикуются_

#### `+00:11:19` Правка apply_patch: правит `C:\tank-arena\contestants\astra\tank\bot.js`

#### `+00:11:19` Команда (код 0, 0 с)

````powershell
node arena/cli.mjs --rounds 8
````

Результат:

````

ПАРАЛЛАКС  vs  Охотник   (8 раундов)

Раунд  1 · Полигон   · ты слева  · ПОБЕДА ·   9.1с уничтожение · HP 122/150 vs 0/175 · точность 47%
Раунд  2 · Лабиринт  · ты справа · ПОБЕДА ·  12.8с уничтожение · HP 94/150 vs 0/175 · точность 64%
Раунд  3 · Крепости  · ты слева  · ПОБЕДА ·   9.3с уничтожение · HP 150/150 vs 0/175 · точность 58%
Раунд  4 · Каньон    · ты справа · ПОБЕДА ·   8.4с уничтожение · HP 150/150 vs 0/175 · точность 44%
Раунд  5 · Полигон   · ты справа · ПОБЕДА ·   9.1с уничтожение · HP 122/150 vs 0/175 · точность 47%
Раунд  6 · Лабиринт  · ты слева  · ПОБЕДА ·  11.3с уничтожение · HP 94/150 vs 0/175 · точность 64%
Раунд  7 · Крепости  · ты справа · ПОБЕДА ·  15.8с уничтожение · HP 94/150 vs 0/175 · точность 39%
Раунд  8 · Каньон    · ты слева  · ПОБЕДА ·   9.1с уничтожение · HP 150/150 vs 0/175 · точность 41%

Итог: 8 побед, 0 поражений, 0 ничьих
Урон нанесён 1400, получен 224, точность 49%, урон себе 0
ПАРАЛЛАКС: tick в среднем 0.191 мс, максимум 3.1 мс, ошибок 0
… (ещё 2 строк)
````

> **СЧЁТ** песочница arena/cli.mjs: ПАРАЛЛАКС 8:0 против Охотник

#### `+00:11:42` Команда (код 0, 3 с)

````powershell
node arena/cli.mjs --vs dummy --rounds 8; node arena/cli.mjs --vs tank --rounds 8
````

Результат:

````

ПАРАЛЛАКС  vs  Манекен   (8 раундов)

Раунд  1 · Полигон   · ты слева  · ПОБЕДА ·  12.5с уничтожение · HP 150/150 vs 0/200 · точность 50%
Раунд  2 · Лабиринт  · ты справа · ПОБЕДА ·  12.4с уничтожение · HP 150/150 vs 0/200 · точность 50%
Раунд  3 · Крепости  · ты слева  · ПОБЕДА ·  11.4с уничтожение · HP 150/150 vs 0/200 · точность —
Раунд  4 · Каньон    · ты справа · ПОБЕДА ·   9.9с уничтожение · HP 150/150 vs 0/200 · точность 50%
Раунд  5 · Полигон   · ты справа · ПОБЕДА ·  12.5с уничтожение · HP 150/150 vs 0/200 · точность 50%
Раунд  6 · Лабиринт  · ты слева  · ПОБЕДА ·  13.3с уничтожение · HP 150/150 vs 0/200 · точность 50%
Раунд  7 · Крепости  · ты справа · ПОБЕДА ·  11.4с уничтожение · HP 150/150 vs 0/200 · точность —
Раунд  8 · Каньон    · ты слева  · ПОБЕДА ·   9.9с уничтожение · HP 150/150 vs 0/200 · точность 50%

Итог: 8 побед, 0 поражений, 0 ничьих
Урон нанесён 864, получен 0, точность 50%, урон себе 0
ПАРАЛЛАКС: tick в среднем 0.179 мс, максимум 3.6 мс, ошибок 0
… (ещё 20 строк)
````

> **СЧЁТ** песочница arena/cli.mjs: ПАРАЛЛАКС 8:0 против Манекен
> **СЧЁТ** песочница arena/cli.mjs: ПАРАЛЛАКС 4:4 против ПАРАЛЛАКС

#### `+00:11:45` Команда (код 0, 0 с)

````powershell
python -c "import importlib.util; print({m:bool(importlib.util.find_spec(m)) for m in ['cairosvg','PIL','playwright','reportlab']})"; git status --short
````

Результат:

````
{'cairosvg': False, 'PIL': True, 'playwright': False, 'reportlab': False}
 M tank/bot.js
````

### `+00:12:17` Модель

Первый результат: 8:0 против «Охотника» и 8:0 против «Манекена», без ошибок; расчёт хода занимает около 0,2 мс при лимите 50 мс. Зеркальные бои показали, что нужно улучшить поведение под плотным огнём. Теперь проверяю разные характеристики и более опасные варианты собственного бота.

#### `+00:13:04` Команда (код 0, 0 с)

````powershell
New-Item -ItemType Directory -Force -Path lab/reference-v1 | Out-Null; Copy-Item -LiteralPath tank/bot.js -Destination lab/reference-v1/bot.js
````

Результат:

````
(пусто)
````

#### `+00:13:04` Правка apply_patch: создаёт `C:\tank-arena\contestants\astra\lab\gauntlet.mjs`

#### `+00:13:05` Команда (код 0, 275 с)

````powershell
node lab/gauntlet.mjs --sweep
````

Результат:

````
{"config":[2,1,2,5],"w":42,"l":6,"d":0,"score":20.3,"self":140,"zone":0,"ms":0.205,"max":184.1,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:4-4-0","v1-mobile:7-1-0","v1-glass:8-0-0","v1-armored:7-1-0"]}
{"config":[1,2,2,5],"w":36,"l":12,"d":0,"score":14.79,"self":28,"zone":0,"ms":0.22,"max":22.8,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:2-6-0","v1-mobile:5-3-0","v1-glass:6-2-0","v1-armored:7-1-0"]}
{"config":[1,1,3,5],"w":34,"l":14,"d":0,"score":16.48,"self":0,"zone":0,"ms":0.187,"max":31.3,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:3-5-0","v1-mobile:8-0-0","v1-glass:1-7-0","v1-armored:6-2-0"]}
{"config":[2,0,3,5],"w":41,"l":7,"d":0,"score":19.58,"self":0,"zone":0,"ms":0.178,"max":3.3,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:7-1-0","v1-mobile:7-1-0","v1-glass:3-5-0","v1-armored:8-0-0"]}
{"config":[0,2,3,5],"w":31,"l":17,"d":0,"score":16.51,"self":66,"zone":0,"ms":0.183,"max":2.4,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:4-4-0","v1-mobile:5-3-0","v1-glass:4-4-0","v1-armored:2-6-0"]}
{"config":[0,3,2,5],"w":29,"l":19,"d":0,"score":11.71,"self":0,"zone":0,"ms":0.175,"max":8.6,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:4-4-0","v1-mobile:5-3-0","v1-glass:3-5-0","v1-armored:1-7-0"]}
{"config":[2,2,1,5],"w":30,"l":18,"d":0,"score":11.67,"self":20,"zone":0,"ms":0.175,"max":4.7,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:2-6-0","v1-mobile:5-3-0","v1-glass:3-5-0","v1-armored:4-4-0"]}
{"config":[3,0,2,5],"w":38,"l":10,"d":0,"score":11.8,"self":28,"zone":0,"ms":0.177,"max":2.6,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:6-2-0","v1-mobile:6-2-0","v1-glass:3-5-0","v1-armored:7-1-0"]}
{"config":[0,1,4,5],"w":38,"l":10,"d":0,"score":17.75,"self":76,"zone":53.3,"ms":0.179,"max":4.8,"opponents":["hunter:7-1-0","fast-hunter:8-0-0","v1-balanced:6-2-0","v1-mobile:6-2-0","v1-glass:5-3-0","v1-armored:6-2-0"]}
{"config":[1,0,4,5],"w":33,"l":15,"d":0,"score":15.57,"self":76,"zone":0,"ms":0.179,"max":6.9,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:4-4-0","v1-mobile:5-3-0","v1-glass:1-7-0","v1-armored:7-1-0"]}
{"config":[1,3,1,5],"w":22,"l":26,"d":0,"score":3.66,"self":0,"zone":0,"ms":0.178,"max":4,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:3-5-0","v1-mobile:2-6-0","v1-glass:0-8-0","v1-armored:1-7-0"]}
{"config":[2,1,3,4],"w":30,"l":17,"d":1,"score":12.48,"self":33,"zone":0,"ms":0.179,"max":8.9,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:3-4-1","v1-mobile:7-1-0","v1-glass:0-8-0","v1-armored:4-4-0"]}
{"config":[2,2,2,4],"w":28,"l":20,"d":0,"score":10.53,"self":0,"zone":0,"ms":0.177,"max":2.2,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:3-5-0","v1-mobile:5-3-0","v1-glass:3-5-0","v1-armored:1-7-0"]}
{"config":[3,1,2,4],"w":28,"l":20,"d":0,"score":3.65,"self":112,"zone":0,"ms":0.175,"max":5.1,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:2-6-0","v1-mobile:4-4-0","v1-glass:0-8-0","v1-armored:6-2-0"]}
{"config":[0,0,5,5],"w":30,"l":16,"d":2,"score":12.74,"self":86,"zone":0,"ms":0.186,"max":4.1,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:0-8-0","v1-mobile:5-3-0","v1-glass:3-3-2","v1-armored:6-2-0"]}
… (ещё 5 строк)
````

> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [2/1/2/5] 42:6
> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [1/2/2/5] 36:12
> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [1/1/3/5] 34:14
> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [2/0/3/5] 41:7
> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [0/2/3/5] 31:17
> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [0/3/2/5] 29:19
> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [2/2/1/5] 30:18
> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [3/0/2/5] 38:10
> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [0/1/4/5] 38:10
> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [1/0/4/5] 33:15
> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [1/3/1/5] 22:26
> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [2/1/3/4] 30:17, ничьих 1
> **СЧЁТ** … и ещё 8

#### `+00:14:33` Правка apply_patch: правит `C:\tank-arena\contestants\astra\tank\turret.svg`, правит `C:\tank-arena\contestants\astra\tank\body.svg`

#### `+00:14:34` Команда (код 0, 0 с)

````powershell
python -c "import importlib.util; print({m:bool(importlib.util.find_spec(m)) for m in ['fitz','svglib','cairo','resvg_py']})"
````

Результат:

````
{'fitz': False, 'svglib': False, 'cairo': False, 'resvg_py': False}
````

### `+00:15:15` Модель

Первые сравнения подтверждают пользу максимальной перезарядки: пока лучше всего держится раскладка 2/1/2/5. Облик тоже собран: светлая броня, бирюзовые гусеницы и коралловый глаз башни. Дополнительно проверю затяжные бои, сужение зоны и противников, которые активно сближаются.

#### `+00:15:18` Команда (код 0, 2 с)

````powershell
python -m pip install --disable-pip-version-check --no-warn-script-location --no-compile --target lab/vendor --cache-dir lab/pip-cache resvg-py
````

Результат:

````
Collecting resvg-py
  Downloading resvg_py-0.5.0-cp310-abi3-win_amd64.whl.metadata (1.9 kB)
Downloading resvg_py-0.5.0-cp310-abi3-win_amd64.whl (1.2 MB)
   ---------------------------------------- 1.2/1.2 MB 9.2 MB/s  0:00:00
Installing collected packages: resvg-py
Successfully installed resvg-py-0.5.0
````

#### `+00:15:40` Команда (код 0, 0 с)

````powershell
python -c "import sys; sys.path.insert(0,'lab/vendor'); import resvg_py; print(resvg_py.svg_to_bytes.__doc__)"
````

Результат:

````
Render an SVG to PNG bytes.

Accepts either ``svg_string`` or ``svg_path`` (not both required).
``svg_path`` also supports ``.svgz`` (gzip-compressed) files.

:param svg_string: SVG markup as a UTF-8 string.
:type svg_string: str | None
:param svg_path: File path to an SVG (or ``.svgz``) file.
:type svg_path: str | None
:param background: CSS color for the canvas background, e.g. ``"#ffffff"``.
:type background: str | None
:param skip_system_fonts: Skip loading system fonts. Pass font files/dirs manually if enabled.
:type skip_system_fonts: bool
:param log_information: Print resvg debug logs to stdout.
:type log_information: bool
… (ещё 41 строк)
````

#### `+00:15:40` Правка apply_patch: правит `C:\tank-arena\contestants\astra\tank\bot.js`

#### `+00:16:26` Правка apply_patch: создаёт `C:\tank-arena\contestants\astra\lab\render-preview.py`

#### `+00:16:27` Команда (код 0, 1 с)

````powershell
python lab/render-preview.py
````

Результат:

````
Rendered both SVG layers, independent rotation, and native 64 px preview: lab/preview.png
````

#### `+00:16:37` Смотрит картинку `C:/tank-arena/contestants/astra/lab/preview.png`

#### `+00:17:54` Правка apply_patch: создаёт `C:\tank-arena\contestants\astra\lab\stress.mjs`, создаёт `C:\tank-arena\contestants\astra\lab\make-opponents.mjs`

#### `+00:17:54` Команда (код 0, 18 с)

````powershell
node lab/make-opponents.mjs; node lab/stress.mjs
````

Результат:

````
Generated seven synthetic opponents. All code derives from our own bot or the supplied sparring bot.
{"name":"rush","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":5.4,"hp":150,"enemyHp":0,"tally":{"shots":7,"hits":6,"damageDealt":150,"damageTaken":0,"selfDamage":0,"ricochetHits":3,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":11.9,"hp":10,"enemyHp":0,"tally":{"shots":7,"hits":6,"damageDealt":150,"damageTaken":140,"selfDamage":0, …
{"name":"sniper","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":7.3,"hp":112,"enemyHp":0,"tally":{"shots":9,"hits":6,"damageDealt":150,"damageTaken":38,"selfDamage":0,"ricochetHits":5,"intercepts":2,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":11.133333333333333,"hp":74,"enemyHp":0,"tally":{"shots":10,"hits":6,"damageDealt":150,"damageTaken":7 …
{"name":"kite","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":9.5,"hp":94,"enemyHp":0,"tally":{"shots":15,"hits":5,"damageDealt":125,"damageTaken":56,"selfDamage":0,"ricochetHits":1,"intercepts":1,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":9.8,"hp":94,"enemyHp":0,"tally":{"shots":8,"hits":5,"damageDealt":125,"damageTaken":56,"selfDamage":0," …
{"name":"reckless","w":7,"l":1,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":20.5,"hp":38,"enemyHp":0,"tally":{"shots":36,"hits":6,"damageDealt":150,"damageTaken":112,"selfDamage":0,"ricochetHits":0,"intercepts":2,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":9.666666666666666,"hp":66,"enemyHp":0,"tally":{"shots":10,"hits":6,"damageDealt":150,"damageTaken …
{"name":"evasive","w":6,"l":2,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":61,"hp":82,"enemyHp":0,"tally":{"shots":87,"hits":7,"damageDealt":175,"damageTaken":168,"selfDamage":0,"ricochetHits":0,"intercepts":4,"kits":2,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":33.666666666666664,"hp":122,"enemyHp":0,"tally":{"shots":45,"hits":6,"damageDealt":153,"damageTaken" …
{"name":"pacifist","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":15.4,"hp":150,"enemyHp":0,"tally":{"shots":23,"hits":9,"damageDealt":225,"damageTaken":0,"selfDamage":0,"ricochetHits":0,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":18.066666666666666,"hp":150,"enemyHp":0,"tally":{"shots":19,"hits":9,"damageDealt":225,"damageTake …
{"name":"camper","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":7.666666666666667,"hp":150,"enemyHp":0,"tally":{"shots":10,"hits":7,"damageDealt":182,"damageTaken":0,"selfDamage":0,"ricochetHits":3,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":14.966666666666667,"hp":107,"enemyHp":0,"tally":{"shots":6,"hits":5,"damageDealt":139," …
````

> **СЧЁТ** стенд lab/stress.mjs: tank против rush 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против sniper 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против kite 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против reckless 7:1
> **СЧЁТ** стенд lab/stress.mjs: tank против evasive 6:2
> **СЧЁТ** стенд lab/stress.mjs: tank против pacifist 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против camper 8:0

#### `+00:18:27` Команда (код 0, 0 с)

````powershell
node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync('lab/stress-results.json'));for(const p of r)console.log(p.name,p.w,p.l,p.d,'zone',p.rounds.reduce((a,b)=>a+b.tally.zoneDamage,0),'self',p.rounds.reduce((a,b)=>a+b.tally.selfDamage,0),'maxT',Math.max(...p.rounds.map(r=>r.time)).toFixed(1));"
````

Результат:

````
rush 8 0 0 zone 0 self 0 maxT 11.9
sniper 8 0 0 zone 0 self 0 maxT 13.1
kite 8 0 0 zone 0 self 0 maxT 14.8
reckless 7 1 0 zone 0 self 0 maxT 20.5
evasive 6 2 0 zone 0 self 0 maxT 93.0
pacifist 8 0 0 zone 0 self 0 maxT 88.0
camper 8 0 0 zone 0 self 0 maxT 15.0
````

### `+00:19:04` Модель

Проверено 20 раскладок характеристик и семь дополнительных типов противника. Текущий вариант выиграл 53 из 56 дополнительных боёв; рикошеты действительно дают попадания из-за укрытий. Остались точечные улучшения прицеливания против быстрых уклонистов и выхода из тесных мест. SVG уже отрисованы и проверены в крупном виде и при размере 64×64.

#### `+00:19:37` Правка apply_patch: создаёт `C:\tank-arena\contestants\astra\lab\tune.mjs`

#### `+00:19:37` Команда (код 0, 194 с)

````powershell
node lab/tune.mjs
````

Результат:

````
{"name":"control","w":26,"l":14,"d":0,"score":4.798666666666666,"self":112,"damage":5138,"taken":5650,"zone":198.66666666666697,"pairs":[{"foe":"baseline","w":4,"l":4,"d":0},{"foe":"gunner","w":1,"l":7,"d":0},{"foe":"glass","w":8,"l":0,"d":0},{"foe":"evasive","w":6,"l":2,"d":0},{"foe":"brawler","w":7,"l":1,"d":0}]}
{"name":"exact-arrival","w":30,"l":10,"d":0,"score":7.382666666666666,"self":112,"damage":5873,"taken":5419,"zone":0,"pairs":[{"foe":"baseline","w":6,"l":2,"d":0},{"foe":"gunner","w":4,"l":4,"d":0},{"foe":"glass","w":7,"l":1,"d":0},{"foe":"evasive","w":6,"l":2,"d":0},{"foe":"brawler","w":7,"l":1,"d":0}]}
{"name":"short-turn","w":28,"l":12,"d":0,"score":7.819999999999999,"self":56,"damage":5150,"taken":4634,"zone":0,"pairs":[{"foe":"baseline","w":6,"l":2,"d":0},{"foe":"gunner","w":2,"l":6,"d":0},{"foe":"glass","w":5,"l":3,"d":0},{"foe":"evasive","w":8,"l":0,"d":0},{"foe":"brawler","w":7,"l":1,"d":0}]}
{"name":"long-turn","w":25,"l":13,"d":2,"score":3.785333333333334,"self":140,"damage":5268,"taken":5329,"zone":281.33333333333366,"pairs":[{"foe":"baseline","w":6,"l":2,"d":0},{"foe":"gunner","w":4,"l":4,"d":0},{"foe":"glass","w":4,"l":4,"d":0},{"foe":"evasive","w":7,"l":1,"d":0},{"foe":"brawler","w":4,"l":2,"d":2}]}
{"name":"straight-lead","w":24,"l":16,"d":0,"score":2.2866666666666666,"self":0,"damage":4880,"taken":5589,"zone":0,"pairs":[{"foe":"baseline","w":1,"l":7,"d":0},{"foe":"gunner","w":2,"l":6,"d":0},{"foe":"glass","w":5,"l":3,"d":0},{"foe":"evasive","w":8,"l":0,"d":0},{"foe":"brawler","w":8,"l":0,"d":0}]}
{"name":"careful","w":21,"l":19,"d":0,"score":-0.39600000000000035,"self":0,"damage":5375,"taken":6189,"zone":0,"pairs":[{"foe":"baseline","w":4,"l":4,"d":0},{"foe":"gunner","w":2,"l":6,"d":0},{"foe":"glass","w":2,"l":6,"d":0},{"foe":"evasive","w":7,"l":1,"d":0},{"foe":"brawler","w":6,"l":2,"d":0}]}
{"name":"assertive","w":21,"l":19,"d":0,"score":3.9800000000000018,"self":0,"damage":4992,"taken":5695,"zone":0,"pairs":[{"foe":"baseline","w":6,"l":2,"d":0},{"foe":"gunner","w":2,"l":6,"d":0},{"foe":"glass","w":3,"l":5,"d":0},{"foe":"evasive","w":8,"l":0,"d":0},{"foe":"brawler","w":2,"l":6,"d":0}]}
{"name":"close-range","w":24,"l":16,"d":0,"score":4.662666666666667,"self":84,"damage":4930,"taken":5328,"zone":198.66666666666697,"pairs":[{"foe":"baseline","w":4,"l":4,"d":0},{"foe":"gunner","w":0,"l":8,"d":0},{"foe":"glass","w":6,"l":2,"d":0},{"foe":"evasive","w":8,"l":0,"d":0},{"foe":"brawler","w":6,"l":2,"d":0}]}
{"name":"wall-clearance","w":30,"l":10,"d":0,"score":5.973333333333332,"self":112,"damage":5156,"taken":5532,"zone":0,"pairs":[{"foe":"baseline","w":4,"l":4,"d":0},{"foe":"gunner","w":2,"l":6,"d":0},{"foe":"glass","w":8,"l":0,"d":0},{"foe":"evasive","w":8,"l":0,"d":0},{"foe":"brawler","w":8,"l":0,"d":0}]}
````

> **СЧЁТ** стенд lab/tune.mjs: tank против baseline, gunner, glass, evasive, brawler [control] 26:14
> **СЧЁТ** стенд lab/tune.mjs: tank против baseline, gunner, glass, evasive, brawler [exact-arrival] 30:10
> **СЧЁТ** стенд lab/tune.mjs: tank против baseline, gunner, glass, evasive, brawler [short-turn] 28:12
> **СЧЁТ** стенд lab/tune.mjs: tank против baseline, gunner, glass, evasive, brawler [long-turn] 25:13, ничьих 2
> **СЧЁТ** стенд lab/tune.mjs: tank против baseline, gunner, glass, evasive, brawler [straight-lead] 24:16
> **СЧЁТ** стенд lab/tune.mjs: tank против baseline, gunner, glass, evasive, brawler [careful] 21:19
> **СЧЁТ** стенд lab/tune.mjs: tank против baseline, gunner, glass, evasive, brawler [assertive] 21:19
> **СЧЁТ** стенд lab/tune.mjs: tank против baseline, gunner, glass, evasive, brawler [close-range] 24:16
> **СЧЁТ** стенд lab/tune.mjs: tank против baseline, gunner, glass, evasive, brawler [wall-clearance] 30:10

#### `+00:20:16` Команда (код 0, 0 с)

````powershell
node -e "const fs=require('fs');for(const file of ['lab/trace-pacifist-2.json','lab/trace-evasive-5.json']){const r=JSON.parse(fs.readFileSync(file));console.log(file);for(const f of r.trace.filter((f,i)=>Math.abs(f.time%5)<0.01)){const m=f.tanks[r.side],e=f.tanks[1-r.side]; console.log(f.time.toFixed(0),[m.x,m.y,m.heading,m.hp,e.x,e.y,e.hp].map(n=>n.toFixed(1)).join(' '));}}"
````

Результат:

````
lab/trace-pacifist-2.json
5 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
10 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
15 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
20 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
25 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
30 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
35 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
40 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
45 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
50 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
55 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
60 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
65 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
70 302.1 260.2 0.1 150.0 1532.8 281.3 225.0
… (ещё 22 строк)
````

### `+00:21:11` Модель

Нашёл конкретный сбой в навигации: возле угла танк иногда считал промежуточную точку достигнутой, но снова выбирал её и останавливался. Это проявилось только в затяжных боях. Исправляю переход к следующему участку маршрута и проверю тот же сценарий повторно.

#### `+00:21:35` Правка apply_patch: правит `C:\tank-arena\contestants\astra\tank\bot.js`

#### `+00:21:36` Команда (код 0, 10 с)

````powershell
node lab/stress.mjs pacifist evasive reckless
````

Результат:

````
{"name":"pacifist","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":83.76666666666667,"hp":150,"enemyHp":0,"tally":{"shots":135,"hits":16,"damageDealt":425,"damageTaken":0,"selfDamage":0,"ricochetHits":1,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":18,"hp":150,"enemyHp":0,"tally":{"shots":14,"hits":9,"damageDealt":225,"damageTaken …
{"name":"evasive","w":7,"l":1,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":39.43333333333333,"hp":60,"enemyHp":0,"tally":{"shots":63,"hits":7,"damageDealt":175,"damageTaken":140,"selfDamage":0,"ricochetHits":0,"intercepts":5,"kits":1,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":27.733333333333334,"hp":66,"enemyHp":0,"tally":{"shots":36,"hits":5,"damageDealt":125 …
{"name":"reckless","w":6,"l":2,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"l","time":21.266666666666666,"hp":0,"enemyHp":60,"tally":{"shots":37,"hits":5,"damageDealt":140,"damageTaken":150,"selfDamage":0,"ricochetHits":0,"intercepts":2,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":15.433333333333334,"hp":32,"enemyHp":0,"tally":{"shots":16,"hits":6,"damageDealt":1 …
````

> **СЧЁТ** стенд lab/stress.mjs: tank против pacifist 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против evasive 7:1
> **СЧЁТ** стенд lab/stress.mjs: tank против reckless 6:2

#### `+00:21:59` Команда (код 0, 0 с)

````powershell
node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync('lab/trace-evasive-5.json'));for(const f of r.trace.filter(f=>Math.abs(f.time%10)<.01)){console.log(f.time,f.tanks.map(t=>[t.x,t.y,t.heading,t.hp].map(n=>n.toFixed(1))));}"
````

Результат:

````
10 [
  [ '325.6', '219.2', '-0.1', '150.0' ],
  [ '1369.7', '235.3', '-2.0', '125.0' ]
]
20 [
  [ '324.7', '222.1', '0.4', '150.0' ],
  [ '1369.7', '235.3', '-2.0', '125.0' ]
]
30 [
  [ '326.7', '221.7', '-1.7', '150.0' ],
  [ '1369.7', '235.3', '-2.0', '125.0' ]
]
40 [
  [ '321.4', '219.9', '3.1', '150.0' ],
  [ '1369.7', '235.3', '-2.0', '125.0' ]
… (ещё 21 строк)
````

#### `+00:22:20` Правка apply_patch: создаёт `C:\tank-arena\contestants\astra\lab\debug-navigation.mjs`

#### `+00:22:20` Команда (код 0, 0 с)

````powershell
node lab/debug-navigation.mjs
````

Результат:

````
{"t":0,"me":{"x":140,"y":450,"heading":0,"turret":0,"speed":0,"vx":0,"vy":0,"hp":150,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5}},"action":{"throttle":0.45,"turn":-1,"turretTurn":0.00025872824834952525,"fire":false},"target":{"kind":"hunt","point" …
{"t":3,"me":{"x":277.4969912525446,"y":204.8998387257268,"heading":0.2397682839262556,"turret":0.05691878828320718,"speed":132,"vx":128.22387973482745,"vy":31.347035996223052,"hp":150,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5}},"action":{"throttl …
{"t":6,"me":{"x":328.6210612255889,"y":212.67752302863963,"heading":-0.7195675707541107,"turret":0.02177248282459221,"speed":46.8,"vx":35.1978492554435,"vy":-30.8439849531651,"hp":150,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5}},"action":{"throttl …
{"t":9,"me":{"x":324.37324277596207,"y":218.8547601237623,"heading":-0.3421789915399298,"turret":0.015776795548194666,"speed":-10.600000000000001,"vx":-9.985473081973106,"vy":3.556729864523105,"hp":150,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5}}, …
{"t":12,"me":{"x":327.6361107915996,"y":221.78359303553236,"heading":0.2294596762547303,"turret":0.013016190406361261,"speed":17.4,"vx":16.943936160959602,"vy":3.9576542766297282,"hp":150,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5}},"action":{"thr …
{"t":15,"me":{"x":322.1931209414017,"y":221.58092517280878,"heading":0.2523767800787149,"turret":0.013142006418300767,"speed":-10.600000000000001,"vx":-10.264209603740198,"vy":-2.646885190273182,"hp":150,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5} …
{"t":18,"me":{"x":325.2413698324677,"y":222.61398904399266,"heading":0.2112541491962543,"turret":0.012191434418613145,"speed":-10.600000000000001,"vx":-10.364348281578774,"vy":-2.222675122039915,"hp":150,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5} …
{"t":21,"me":{"x":326.5769137916032,"y":222.77531502885034,"heading":0.3993084754294469,"turret":0.01205240925088491,"speed":-10.600000000000001,"vx":-9.766098700710966,"vy":-4.121081917163456,"hp":150,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5}}, …
````

#### `+00:22:57` Правка apply_patch: правит `C:\tank-arena\contestants\astra\tank\bot.js`

#### `+00:22:57` Команда (код 0, 0 с)

````powershell
node lab/debug-navigation.mjs
````

Результат:

````
{"t":0,"me":{"x":140,"y":450,"heading":0,"turret":0,"speed":0,"vx":0,"vy":0,"hp":150,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5}},"action":{"throttle":0.45,"turn":-1,"turretTurn":0.00025872824834952525,"fire":false},"target":{"kind":"hunt","point" …
{"t":3,"me":{"x":277.4969912525446,"y":204.8998387257268,"heading":0.2397682839262556,"turret":0.05691878828320718,"speed":132,"vx":128.22387973482745,"vy":31.347035996223052,"hp":150,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5}},"action":{"throttl …
{"t":6,"me":{"x":544.15943265447,"y":350.87632818339836,"heading":-0.2207102603994553,"turret":-0.13903790405873195,"speed":132,"vx":128.7979708394244,"vy":-28.89779762623399,"hp":150,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5}},"action":{"throttl …
{"t":9,"me":{"x":908.7107953021576,"y":319.3392128213193,"heading":0.23306706579221226,"turret":-0.18021694979231384,"speed":132,"vx":128.43106246790123,"vy":30.48708240166733,"hp":150,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5}},"action":{"thrott …
{"t":12,"me":{"x":1184.3671454191103,"y":357.1136744479521,"heading":-0.35434490514372197,"turret":-1.2627225196810827,"speed":87.4,"vx":81.97018692424717,"vy":-30.325706184753198,"hp":150,"maxHp":150,"reloadLeft":0.13333333333333341,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0 …
{"t":15,"me":{"x":1284.8574716246528,"y":126.70121966324639,"heading":-0.9819863587656577,"turret":0.570990616061049,"speed":-79.2,"vx":-43.985445231000426,"vy":65.86289249517259,"hp":94,"maxHp":150,"reloadLeft":0.06666666666666676,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5 …
{"t":18,"me":{"x":1308.982756109887,"y":158.91221478133758,"heading":-1.0004727818761543,"turret":0.7503226435565389,"speed":32.8,"vx":17.7088647551615,"vy":-27.608623817267652,"hp":66,"maxHp":150,"reloadLeft":0.2666666666666667,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5}}, …
{"t":21,"me":{"x":1346.8284899362552,"y":192.80020164846601,"heading":-1.0258855213171962,"turret":1.8352767164784218,"speed":0,"vx":0,"vy":0,"hp":66,"maxHp":150,"reloadLeft":0,"alive":true,"stats":{"armor":2,"engine":1,"gun":2,"reload":5,"maxHp":150,"maxSpeed":132,"turnRate":2.05,"turretRate":2.8,"damage":28,"bulletSpeed":550,"reloadTime":0.5}},"action":{"throttle":0,"turn":-1,"turretTurn":-1,"fi …
````

#### `+00:23:10` Правка apply_patch: правит `C:\tank-arena\contestants\astra\tank\bot.js`

#### `+00:23:10` Команда (код 0, 20 с)

````powershell
node lab/gauntlet.mjs
````

Результат:

````
{"config":[2,1,2,5],"w":39,"l":9,"d":0,"score":18.04,"self":28,"zone":0,"ms":0.275,"max":40.2,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:5-3-0","v1-mobile:8-0-0","v1-glass:4-4-0","v1-armored:6-2-0"]}
````

> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [2/1/2/5] 39:9

#### `+00:23:11` Команда (код 0, 13 с)

````powershell
node lab/stress.mjs
````

Результат:

````
{"name":"rush","w":7,"l":1,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":6.7,"hp":94,"enemyHp":0,"tally":{"shots":10,"hits":6,"damageDealt":150,"damageTaken":56,"selfDamage":0,"ricochetHits":5,"intercepts":1,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":11.533333333333333,"hp":10,"enemyHp":0,"tally":{"shots":6,"hits":6,"damageDealt":150,"damageTaken":140, …
{"name":"sniper","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":6.3,"hp":150,"enemyHp":0,"tally":{"shots":7,"hits":6,"damageDealt":150,"damageTaken":0,"selfDamage":0,"ricochetHits":5,"intercepts":1,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":9.233333333333333,"hp":36,"enemyHp":0,"tally":{"shots":7,"hits":6,"damageDealt":150,"damageTaken":114, …
{"name":"kite","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":8.266666666666666,"hp":122,"enemyHp":0,"tally":{"shots":14,"hits":5,"damageDealt":125,"damageTaken":28,"selfDamage":0,"ricochetHits":4,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":8.333333333333334,"hp":94,"enemyHp":0,"tally":{"shots":5,"hits":5,"damageDealt":125,"dam …
{"name":"reckless","w":7,"l":0,"d":1,"rounds":[{"map":"Полигон","side":0,"result":"w","time":33.833333333333336,"hp":66,"enemyHp":0,"tally":{"shots":57,"hits":8,"damageDealt":200,"damageTaken":84,"selfDamage":28,"ricochetHits":1,"intercepts":4,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":13.733333333333333,"hp":66,"enemyHp":0,"tally":{"shots":13,"hits":6,"damageDealt":1 …
{"name":"evasive","w":7,"l":1,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":37.166666666666664,"hp":88,"enemyHp":0,"tally":{"shots":60,"hits":5,"damageDealt":125,"damageTaken":112,"selfDamage":0,"ricochetHits":0,"intercepts":5,"kits":1,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":15.533333333333333,"hp":66,"enemyHp":0,"tally":{"shots":13,"hits":5,"damageDealt":12 …
{"name":"pacifist","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":33.86666666666667,"hp":150,"enemyHp":0,"tally":{"shots":51,"hits":10,"damageDealt":275,"damageTaken":0,"selfDamage":0,"ricochetHits":0,"intercepts":0,"kits":1,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":19.133333333333333,"hp":150,"enemyHp":0,"tally":{"shots":17,"hits":9,"damageDealt":2 …
{"name":"camper","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":7.1,"hp":150,"enemyHp":0,"tally":{"shots":9,"hits":7,"damageDealt":182,"damageTaken":0,"selfDamage":0,"ricochetHits":4,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":14.166666666666666,"hp":150,"enemyHp":0,"tally":{"shots":5,"hits":4,"damageDealt":96,"damageTaken":0," …
````

> **СЧЁТ** стенд lab/stress.mjs: tank против rush 7:1
> **СЧЁТ** стенд lab/stress.mjs: tank против sniper 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против kite 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против reckless 7:0, ничьих 1
> **СЧЁТ** стенд lab/stress.mjs: tank против evasive 7:1
> **СЧЁТ** стенд lab/stress.mjs: tank против pacifist 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против camper 8:0

#### `+00:24:00` Команда (код 0, 0 с)

````powershell
node -e "const fs=require('fs');for(const file of ['lab/trace-evasive-3.json','lab/trace-evasive-7.json']){const r=JSON.parse(fs.readFileSync(file));console.log(file);for(const f of r.trace.filter(f=>Math.abs(f.time%10)<.01)){console.log(f.time,f.tanks.map(t=>[t.x,t.y,t.heading,t.hp].map(n=>n.toFixed(1))));}}"
````

Результат:

````
lab/trace-evasive-3.json
10 [
  [ '269.1', '550.0', '-3.1', '125.0' ],
  [ '756.3', '284.2', '2.8', '150.0' ]
]
20 [
  [ '269.1', '550.0', '-3.1', '125.0' ],
  [ '756.3', '284.2', '2.8', '150.0' ]
]
30 [
  [ '269.1', '550.0', '-3.1', '125.0' ],
  [ '756.3', '284.2', '2.8', '150.0' ]
]
40 [
  [ '269.1', '550.0', '-3.1', '125.0' ],
… (ещё 55 строк)
````

#### `+00:24:53` Правка apply_patch: правит `C:\tank-arena\contestants\astra\tank\bot.js`

#### `+00:24:53` Команда (код 0, 10 с)

````powershell
node lab/gauntlet.mjs
````

Результат:

````
{"config":[2,1,2,5],"w":36,"l":12,"d":0,"score":14.73,"self":28,"zone":0,"ms":0.197,"max":4.7,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:3-5-0","v1-mobile:6-2-0","v1-glass:5-3-0","v1-armored:6-2-0"]}
````

> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [2/1/2/5] 36:12

#### `+00:24:53` Команда (код 0, 11 с)

````powershell
node lab/stress.mjs
````

Результат:

````
{"name":"rush","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":6.533333333333333,"hp":94,"enemyHp":0,"tally":{"shots":8,"hits":6,"damageDealt":150,"damageTaken":56,"selfDamage":0,"ricochetHits":4,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":11.733333333333333,"hp":10,"enemyHp":0,"tally":{"shots":7,"hits":6,"damageDealt":150,"dama …
{"name":"sniper","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":7.166666666666667,"hp":112,"enemyHp":0,"tally":{"shots":9,"hits":6,"damageDealt":150,"damageTaken":38,"selfDamage":0,"ricochetHits":5,"intercepts":1,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":10.3,"hp":74,"enemyHp":0,"tally":{"shots":7,"hits":6,"damageDealt":150,"damageTaken":76 …
{"name":"kite","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":6.433333333333334,"hp":94,"enemyHp":0,"tally":{"shots":11,"hits":5,"damageDealt":125,"damageTaken":56,"selfDamage":0,"ricochetHits":3,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":9.7,"hp":94,"enemyHp":0,"tally":{"shots":8,"hits":5,"damageDealt":125,"damageTaken":56,"s …
{"name":"reckless","w":3,"l":5,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"l","time":9.8,"hp":0,"enemyHp":10,"tally":{"shots":17,"hits":5,"damageDealt":140,"damageTaken":150,"selfDamage":0,"ricochetHits":0,"intercepts":2,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":22.833333333333332,"hp":66,"enemyHp":0,"tally":{"shots":29,"hits":6,"damageDealt":150,"damageTaken …
{"name":"evasive","w":5,"l":3,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":22.166666666666668,"hp":94,"enemyHp":0,"tally":{"shots":35,"hits":5,"damageDealt":125,"damageTaken":56,"selfDamage":0,"ricochetHits":0,"intercepts":5,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":19.7,"hp":94,"enemyHp":0,"tally":{"shots":18,"hits":5,"damageDealt":125,"damageTaken" …
{"name":"pacifist","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":30.266666666666666,"hp":150,"enemyHp":0,"tally":{"shots":53,"hits":10,"damageDealt":275,"damageTaken":0,"selfDamage":0,"ricochetHits":0,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":23.266666666666666,"hp":150,"enemyHp":0,"tally":{"shots":27,"hits":9,"damageDealt": …
{"name":"camper","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":6.8,"hp":150,"enemyHp":0,"tally":{"shots":9,"hits":7,"damageDealt":182,"damageTaken":0,"selfDamage":0,"ricochetHits":4,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":13.866666666666667,"hp":107,"enemyHp":0,"tally":{"shots":5,"hits":5,"damageDealt":139,"damageTaken":43 …
````

> **СЧЁТ** стенд lab/stress.mjs: tank против rush 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против sniper 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против kite 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против reckless 3:5
> **СЧЁТ** стенд lab/stress.mjs: tank против evasive 5:3
> **СЧЁТ** стенд lab/stress.mjs: tank против pacifist 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против camper 8:0

### `+00:25:55` Модель

Зависание у углов воспроизведено и устранено: расчёт пути теперь учитывает круглое тело танка и продолжает маршрут за промежуточной точкой. В проблемном «Лабиринте» танк проходит к сопернику за 12 секунд вместо ожидания сужения зоны. Делаю заключительный прогон боёв и проверку выживания до конца раунда.

#### `+00:26:23` Команда (код 0, 0 с)

````powershell
node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync('lab/stress-results.json'));console.log(r.map(p=>({name:p.name,w:p.w,l:p.l,d:p.d,zone:p.rounds.reduce((a,b)=>a+b.tally.zoneDamage,0)})));"
````

Результат:

````
[
  { name: 'rush', w: 8, l: 0, d: 0, zone: 0 },
  { name: 'sniper', w: 8, l: 0, d: 0, zone: 0 },
  { name: 'kite', w: 8, l: 0, d: 0, zone: 0 },
  { name: 'reckless', w: 3, l: 5, d: 0, zone: 0 },
  { name: 'evasive', w: 5, l: 3, d: 0, zone: 0 },
  { name: 'pacifist', w: 8, l: 0, d: 0, zone: 0 },
  { name: 'camper', w: 8, l: 0, d: 0, zone: 0 }
]
````

#### `+00:26:23` Правка apply_patch: создаёт `C:\tank-arena\contestants\astra\lab\verify.mjs`

#### `+00:26:23` Команда (код 0, 7 с)

````powershell
node lab/verify.mjs
````

Результат:

````
{"map":"Полигон","round":0,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Лабиринт","round":1,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Крепости","round":2,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Каньон","round":3,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Полигон","round":4,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Лабиринт","round":5,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Крепости","round":6,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Каньон","round":7,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"calls":57600,"p99":0.32850000000053114,"max":7.507200000000012}
````

#### `+00:27:49` Команда (код 0, 0 с)

````powershell
Copy-Item -LiteralPath lab/tune.mjs -Destination lab/tune-final.mjs; New-Item -ItemType Directory -Force -Path lab/reference-navigation | Out-Null; Copy-Item -LiteralPath tank/bot.js -Destination lab/reference-navigation/bot.js
````

Результат:

````
(пусто)
````

#### `+00:27:49` Правка apply_patch: правит `C:\tank-arena\contestants\astra\lab\tune-final.mjs`

#### `+00:27:50` Команда (код 0, 112 с)

````powershell
node lab/tune-final.mjs
````

Результат:

````
{"name":"control","w":18,"l":22,"d":0,"score":1.9439999999999997,"self":84,"damage":5107,"taken":5934,"zone":0,"pairs":[{"foe":"baseline","w":3,"l":5,"d":0},{"foe":"gunner","w":2,"l":6,"d":0},{"foe":"glass","w":5,"l":3,"d":0},{"foe":"evasive","w":5,"l":3,"d":0},{"foe":"brawler","w":3,"l":5,"d":0}]}
{"name":"fast-turn","w":21,"l":19,"d":0,"score":4.2,"self":84,"damage":5068,"taken":5576,"zone":0,"pairs":[{"foe":"baseline","w":3,"l":5,"d":0},{"foe":"gunner","w":2,"l":6,"d":0},{"foe":"glass","w":5,"l":3,"d":0},{"foe":"evasive","w":8,"l":0,"d":0},{"foe":"brawler","w":3,"l":5,"d":0}]}
{"name":"fast-linear","w":20,"l":20,"d":0,"score":2.8773333333333344,"self":112,"damage":4971,"taken":5446,"zone":0,"pairs":[{"foe":"baseline","w":3,"l":5,"d":0},{"foe":"gunner","w":2,"l":6,"d":0},{"foe":"glass","w":5,"l":3,"d":0},{"foe":"evasive","w":7,"l":1,"d":0},{"foe":"brawler","w":3,"l":5,"d":0}]}
{"name":"anticipate-12","w":28,"l":10,"d":2,"score":10.09,"self":28,"damage":6088,"taken":5211,"zone":0,"pairs":[{"foe":"baseline","w":6,"l":2,"d":0},{"foe":"gunner","w":4,"l":4,"d":0},{"foe":"glass","w":6,"l":2,"d":0},{"foe":"evasive","w":8,"l":0,"d":0},{"foe":"brawler","w":4,"l":2,"d":2}]}
{"name":"anticipate-30","w":26,"l":13,"d":1,"score":6.785333333333333,"self":56,"damage":5735,"taken":5218,"zone":0,"pairs":[{"foe":"baseline","w":5,"l":2,"d":1},{"foe":"gunner","w":5,"l":3,"d":0},{"foe":"glass","w":5,"l":3,"d":0},{"foe":"evasive","w":8,"l":0,"d":0},{"foe":"brawler","w":3,"l":5,"d":0}]}
{"name":"anticipate-fast","w":28,"l":10,"d":2,"score":10.423333333333334,"self":0,"damage":5904,"taken":5463,"zone":0,"pairs":[{"foe":"baseline","w":6,"l":2,"d":0},{"foe":"gunner","w":4,"l":4,"d":0},{"foe":"glass","w":6,"l":2,"d":0},{"foe":"evasive","w":8,"l":0,"d":0},{"foe":"brawler","w":4,"l":2,"d":2}]}
{"name":"gunner","w":19,"l":21,"d":0,"score":3.388,"self":99,"damage":5234,"taken":5260,"zone":0,"pairs":[{"foe":"baseline","w":3,"l":5,"d":0},{"foe":"gunner","w":4,"l":4,"d":0},{"foe":"glass","w":2,"l":6,"d":0},{"foe":"evasive","w":7,"l":1,"d":0},{"foe":"brawler","w":3,"l":5,"d":0}]}
{"name":"gunner-anticipate","w":27,"l":13,"d":0,"score":5.204000000000001,"self":66,"damage":5291,"taken":5248,"zone":38,"pairs":[{"foe":"baseline","w":6,"l":2,"d":0},{"foe":"gunner","w":3,"l":5,"d":0},{"foe":"glass","w":3,"l":5,"d":0},{"foe":"evasive","w":7,"l":1,"d":0},{"foe":"brawler","w":8,"l":0,"d":0}]}
````

> **СЧЁТ** стенд lab/tune-final.mjs: tank против baseline, gunner, glass, evasive, brawler [control] 18:22
> **СЧЁТ** стенд lab/tune-final.mjs: tank против baseline, gunner, glass, evasive, brawler [fast-turn] 21:19
> **СЧЁТ** стенд lab/tune-final.mjs: tank против baseline, gunner, glass, evasive, brawler [fast-linear] 20:20
> **СЧЁТ** стенд lab/tune-final.mjs: tank против baseline, gunner, glass, evasive, brawler [anticipate-12] 28:10, ничьих 2
> **СЧЁТ** стенд lab/tune-final.mjs: tank против baseline, gunner, glass, evasive, brawler [anticipate-30] 26:13, ничьих 1
> **СЧЁТ** стенд lab/tune-final.mjs: tank против baseline, gunner, glass, evasive, brawler [anticipate-fast] 28:10, ничьих 2
> **СЧЁТ** стенд lab/tune-final.mjs: tank против baseline, gunner, glass, evasive, brawler [gunner] 19:21
> **СЧЁТ** стенд lab/tune-final.mjs: tank против baseline, gunner, glass, evasive, brawler [gunner-anticipate] 27:13

#### `+00:28:56` Команда (код 0, 0 с)

````powershell
git diff --stat; git diff --check; Get-ChildItem -LiteralPath tank | Select-Object Name, Length
````

Результат:

````
warning: in the working copy of 'tank/body.svg', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tank/bot.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tank/turret.svg', LF will be replaced by CRLF the next time Git touches it
 tank/body.svg   |  32 ++++-
 tank/bot.js     | 414 +++++++++++++++++++++++++++++++++++++++++++++++++++++---
 tank/turret.svg |  28 +++-
 3 files changed, 451 insertions(+), 23 deletions(-)
warning: in the working copy of 'tank/body.svg', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tank/bot.js', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tank/turret.svg', LF will be replaced by CRLF the next time Git touches it

Name       Length
----       ------
body.svg     2188
bot.js      19473
… (ещё 1 строк)
````

### `+00:29:32` Модель

Проверка полного раунда пройдена: на всех картах танк переживает сужение зоны до 120-й секунды без урона от неё. Добавил упреждающее уклонение по направлению вражеской башни и таймеру перезарядки. В сложной контрольной серии это подняло результат с 18 до 28 побед из 40; сейчас выбираю окончательный вариант.

#### `+00:29:40` Правка apply_patch: создаёт `C:\tank-arena\contestants\astra\lab\.gitignore`

#### `+00:30:00` Команда (код 0, 0 с)

````powershell
git status --short; node --check tank/bot.js
````

Результат:

````
 M tank/body.svg
 M tank/bot.js
 M tank/turret.svg
?? lab/
````

#### `+00:30:33` Правка apply_patch: правит `C:\tank-arena\contestants\astra\tank\bot.js`

#### `+00:30:33` Команда (код 0, 24 с)

````powershell
node lab/gauntlet.mjs
````

Результат:

````
{"config":[2,1,2,5],"w":44,"l":4,"d":0,"score":27.45,"self":28,"zone":0,"ms":0.351,"max":62.9,"opponents":["hunter:8-0-0","fast-hunter:8-0-0","v1-balanced:6-2-0","v1-mobile:8-0-0","v1-glass:6-2-0","v1-armored:8-0-0"]}
````

> **СЧЁТ** стенд lab/gauntlet.mjs: tank против hunter, fast-hunter, v1-balanced, v1-mobile, v1-glass, v1-armored [2/1/2/5] 44:4

#### `+00:30:33` Команда (код 0, 20 с)

````powershell
node lab/stress.mjs
````

Результат:

````
{"name":"rush","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":5.8,"hp":150,"enemyHp":0,"tally":{"shots":8,"hits":6,"damageDealt":150,"damageTaken":0,"selfDamage":0,"ricochetHits":5,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":11.6,"hp":10,"enemyHp":0,"tally":{"shots":6,"hits":6,"damageDealt":150,"damageTaken":140,"selfDamage":0, …
{"name":"sniper","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":7.166666666666667,"hp":150,"enemyHp":0,"tally":{"shots":10,"hits":6,"damageDealt":150,"damageTaken":0,"selfDamage":0,"ricochetHits":6,"intercepts":2,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":9.6,"hp":36,"enemyHp":0,"tally":{"shots":6,"hits":6,"damageDealt":150,"damageTaken":114 …
{"name":"kite","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":11.166666666666666,"hp":122,"enemyHp":0,"tally":{"shots":18,"hits":5,"damageDealt":125,"damageTaken":28,"selfDamage":0,"ricochetHits":0,"intercepts":2,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":10.9,"hp":122,"enemyHp":0,"tally":{"shots":10,"hits":4,"damageDealt":97,"damageTaken":2 …
{"name":"reckless","w":4,"l":2,"d":2,"rounds":[{"map":"Полигон","side":0,"result":"l","time":9.366666666666667,"hp":0,"enemyHp":10,"tally":{"shots":16,"hits":5,"damageDealt":140,"damageTaken":150,"selfDamage":0,"ricochetHits":0,"intercepts":1,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":14.4,"hp":38,"enemyHp":0,"tally":{"shots":17,"hits":6,"damageDealt":150,"damageTaken …
{"name":"evasive","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":74.66666666666667,"hp":66,"enemyHp":0,"tally":{"shots":119,"hits":7,"damageDealt":175,"damageTaken":168,"selfDamage":0,"ricochetHits":0,"intercepts":7,"kits":2,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":37.9,"hp":122,"enemyHp":0,"tally":{"shots":56,"hits":5,"damageDealt":125,"damageTake …
{"name":"pacifist","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":43.06666666666666,"hp":150,"enemyHp":0,"tally":{"shots":76,"hits":9,"damageDealt":225,"damageTaken":0,"selfDamage":0,"ricochetHits":0,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":36.333333333333336,"hp":150,"enemyHp":0,"tally":{"shots":52,"hits":9,"damageDealt":22 …
{"name":"camper","w":8,"l":0,"d":0,"rounds":[{"map":"Полигон","side":0,"result":"w","time":7.366666666666666,"hp":150,"enemyHp":0,"tally":{"shots":10,"hits":7,"damageDealt":182,"damageTaken":0,"selfDamage":0,"ricochetHits":4,"intercepts":0,"kits":0,"zoneDamage":0}},{"map":"Лабиринт","side":1,"result":"w","time":13.866666666666667,"hp":107,"enemyHp":0,"tally":{"shots":5,"hits":5,"damageDealt":139," …
````

> **СЧЁТ** стенд lab/stress.mjs: tank против rush 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против sniper 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против kite 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против reckless 4:2, ничьих 2
> **СЧЁТ** стенд lab/stress.mjs: tank против evasive 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против pacifist 8:0
> **СЧЁТ** стенд lab/stress.mjs: tank против camper 8:0

#### `+00:30:33` Команда (код 0, 18 с)

````powershell
node lab/verify.mjs
````

Результат:

````
{"map":"Полигон","round":0,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Лабиринт","round":1,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Крепости","round":2,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Каньон","round":3,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Полигон","round":4,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Лабиринт","round":5,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Крепости","round":6,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"map":"Каньон","round":7,"seconds":120,"hp":[150,150],"zoneDamage":[0,0]}
{"calls":57600,"p99":1.6111000000000004,"max":48.0021999999999}
````

#### `+00:31:42` Команда (код 0, 6 с)

````powershell
node arena/cli.mjs --rounds 16 | Tee-Object -FilePath lab/final-hunter.txt; node arena/cli.mjs --vs dummy --rounds 8 | Tee-Object -FilePath lab/final-dummy.txt; node arena/cli.mjs --vs tank --rounds 8 | Tee-Object -FilePath lab/final-mirror.txt
````

Результат:

````

ПАРАЛЛАКС  vs  Охотник   (16 раундов)

Раунд  1 · Полигон   · ты слева  · ПОБЕДА ·  11.3с уничтожение · HP 66/150 vs 0/175 · точность 44%
Раунд  2 · Лабиринт  · ты справа · ПОБЕДА ·  12.3с уничтожение · HP 66/150 vs 0/175 · точность 64%
Раунд  3 · Крепости  · ты слева  · ПОБЕДА ·  12.2с уничтожение · HP 150/150 vs 0/175 · точность 39%
Раунд  4 · Каньон    · ты справа · ПОБЕДА ·  12.4с уничтожение · HP 150/150 vs 0/175 · точность 29%
Раунд  5 · Полигон   · ты справа · ПОБЕДА ·  11.3с уничтожение · HP 66/150 vs 0/175 · точность 44%
Раунд  6 · Лабиринт  · ты слева  · ПОБЕДА ·  15.2с уничтожение · HP 66/150 vs 0/175 · точность 44%
Раунд  7 · Крепости  · ты справа · ПОБЕДА ·  13.6с уничтожение · HP 94/150 vs 0/175 · точность 50%
Раунд  8 · Каньон    · ты слева  · ПОБЕДА ·   9.1с уничтожение · HP 150/150 vs 0/175 · точность 39%
Раунд  9 · Полигон   · ты слева  · ПОБЕДА ·  11.3с уничтожение · HP 66/150 vs 0/175 · точность 44%
Раунд 10 · Лабиринт  · ты справа · ПОБЕДА ·  12.3с уничтожение · HP 66/150 vs 0/175 · точность 64%
Раунд 11 · Крепости  · ты слева  · ПОБЕДА ·  12.2с уничтожение · HP 150/150 vs 0/175 · точность 39%
Раунд 12 · Каньон    · ты справа · ПОБЕДА ·  12.4с уничтожение · HP 150/150 vs 0/175 · точность 29%
… (ещё 46 строк)
````

> **СЧЁТ** песочница arena/cli.mjs: ПАРАЛЛАКС 16:0 против Охотник
> **СЧЁТ** песочница arena/cli.mjs: ПАРАЛЛАКС 8:0 против Манекен
> **СЧЁТ** песочница arena/cli.mjs: ПАРАЛЛАКС 4:4 против ПАРАЛЛАКС

### `+00:32:40` Модель

Окончательный вариант: броня 2, двигатель 1, пушка 2, перезарядка 5. Финальная проверка дала 16:0 против «Охотника», 8:0 против «Манекена» и 96 побед в 104 боях расширенной серии. В последовательном прогоне ход занимал в среднем 0,2–0,25 мс, ошибок не было. Сохраняю результаты и краткое описание стратегии.

#### `+00:33:39` Правка apply_patch: создаёт `C:\tank-arena\contestants\astra\lab\README.md`, создаёт `C:\tank-arena\contestants\astra\lab\finalize-report.mjs`, создаёт `C:\tank-arena\contestants\astra\tank\README.md`

#### `+00:33:40` Команда (код 0, 0 с)

````powershell
node lab/finalize-report.mjs; git diff --exit-code -- arena ARENA.md contestant.json; git diff --check
````

Результат:

````
{
  "hashes": {
    "bot.js": "6ffb7ca42af4ac0dfbb8f63c828dd1c8b80c56166972b0ef974c9ba089501505",
    "body.svg": "a334dbc3d83e27584839376975b3fa70f03cbe9a7f3f2d14d651734f2e3be719",
    "turret.svg": "6b8b936eb95b78e33be85d1136ef553e80d196a30db3ebc8b99608385b3212d2"
  },
  "stats": {
    "armor": 2,
    "engine": 1,
    "gun": 2,
    "reload": 5
  },
  "official": {
    "hunter": [
      16,
… (ещё 39 строк)
````

### `+00:34:03` финальный ответ

Создал **ПАРАЛЛАКС** — «Ты целишься в прошлое». Светлая броня, бирюзовые гусеницы и коралловый глаз: [посмотреть внешний вид](C:/tank-arena/contestants/astra/lab/preview.png).

Очки: **броня 2 · двигатель 1 · пушка 2 · перезарядка 5**.

Стратегия — давить частыми выстрелами с упреждением и заранее рассчитывать уклонения. Танк также стреляет рикошетами, ищет аптечки и учитывает сужение зоны. Такая комбинация оказалась устойчивее среди проверенных вариантов.

Финальные результаты: **16:0 против Охотника**, **8:0 против Манекена**; расширенная серия — **96 побед, 6 поражений, 2 ничьи**. Все файлы находятся в `tank/`.

---

_`+00:34:03` задача завершена: 34 мин 4 с по часам Codex_

