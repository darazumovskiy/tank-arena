# Fable 5.1: подагент Opus в тесте «Танки»

Подагент Fable 5.1, запущен Opus 5.5 в фоне: «Write sparring tank bot (fable)». Время `+чч:мм:сс` отсчитано от промпта основной сессии Opus, чтобы совпадать с [transcript.md](../transcript.md). Скрытые рассуждения не публикуются.

## Задание от Opus `+00:46:17`

````
Ты участвуешь в турнире танковых ботов против другой нейросети. Правила, API и песочница описаны в файле C:\tank-arena\contestants\opus\ARENA.md — прочитай его, а также движок C:\tank-arena\contestants\opus\arena\engine.js (точные правила) и спарринг-ботов в C:\tank-arena\contestants\opus\arena\sparring\.

Создай свой танк в папке C:\tank-arena\contestants\opus\lab\opponents\fable\ (файлы bot.js, body.svg, turret.svg):
- придумай имя и девиз;
- нарисуй простой внешний вид (body.svg и turret.svg, viewBox 0 0 64 64, носом вправо);
- распредели 10 очков характеристик;
- напиши искусственный интеллект, цель — победить сильного неизвестного соперника.

Жёсткие ограничения:
- Пиши и меняй файлы ТОЛЬКО в папке lab\opponents\fable\. Не читай и не открывай папку C:\tank-arena\contestants\opus\tank\ и другие папки внутри lab\ — это чужие боты, твой должен быть независимым. Папку arena\ не меняй.
- bot.js должен быть самодостаточным ES-модулем без импортов (никаких import из других файлов).
- Проверяй бота в песочнице из папки C:\tank-arena\contestants\opus: `node arena/cli.mjs lab/opponents/fable` (против Охотника), `node arena/cli.mjs lab/opponents/fable --vs dummy`, `node arena/cli.mjs lab/opponents/fable --vs lab/opponents/fable` (зеркало). Следи, чтобы средний tick был меньше 5 мс.
- Работай разумное время (примерно 30–60 минут), улучши бота настолько, насколько получится, и остановись.

В конце коротко (5–8 строк) опиши выбранные характеристики и стратегию, и итог против Охотника.
````

### `+00:46:20` Модель

Начну с правил, движка и спарринг-ботов.

#### `+00:46:21` Вызов: **Read** `C:\tank-arena\contestants\opus\ARENA.md`

Результат:

`````
1	# Танковая арена — правила для участника
2	
3	Ты создаёшь танк для турнира один на один. Соперник — танк другого участника, его код тебе неизвестен. Бой показывают на видео: важен и результат, и то, как танк выглядит и ведёт себя.
4	
5	Работай только внутри этой папки. Твой танк — папка `tank/`: при подведении итогов из этой папки берутся `bot.js`, `body.svg` и `turret.svg`, остальное организуй как хочешь. Папку `arena/` не меняй: судья использует свою копию движка, правки в твоей копии на бой не влияют.
6	
7	## Что сдать
8	
9	`tank/bot.js` — ES-модуль:
10	
11	```js
12	export default {
13	  name: 'Имя танка',            // до 20 символов, покажется крупно на экране
14	  motto: 'Девиз',               // до 60 символов, для экрана представления
15	  stats: { armor: 3, engine: 3, gun: 2, reload: 2 },
… (ещё 74 строк)
`````

#### `+00:46:21` Вызов: **Read** `C:\tank-arena\contestants\opus\arena\engine.js`

#### `+00:46:22` Вызов: **Glob** `arena/**/*`

Результат:

````
arena\engine.js
arena\cli.mjs
arena\sparring\hunter\bot.js
arena\sparring\dummy\bot.js
arena\sparring\hunter\body.svg
arena\sparring\hunter\turret.svg
arena\sparring\dummy\body.svg
arena\sparring\dummy\turret.svg
````

Результат:

````
1	// Tank Arena engine. Pure, deterministic, no DOM and no Node APIs:
2	// the same file drives the CLI sandbox and the browser viewer.
3	
4	export const TICK_RATE = 30;
5	export const DT = 1 / TICK_RATE;
6	export const ARENA = { width: 1600, height: 900 };
7	export const ROUND_SECONDS = 120;
8	export const TANK_RADIUS = 24;
9	export const BULLET_RADIUS = 5;
10	export const BULLET_LIFETIME = 4;
11	export const BULLET_BOUNCES = 1;
12	export const MUZZLE_OFFSET = TANK_RADIUS + 10;
13	export const TURRET_RATE = 2.8;
14	export const ACCEL = 420;
15	export const REVERSE_FACTOR = 0.6;
… (ещё 518 строк)
````

#### `+00:46:24` Вызов: **Read** `C:\tank-arena\contestants\opus\arena\sparring\hunter\bot.js`

Результат:

````
1	// Sparring bot "Охотник": grid pathfinding, lead aiming, simple dodging,
2	// picks up repair kits and respects the zone. A fair baseline, not a champion.
3	
4	const CELL = 25;
5	const PAD = 26; // tank radius + margin
6	let grid = null;
7	let gridMap = null;
8	let path = [];
9	let pathTick = -999;
10	
11	const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
12	const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
13	
14	function segHitsRect(x1, y1, x2, y2, r, pad) {
15	  const minX = r.x - pad, maxX = r.x + r.w + pad, minY = r.y - pad, maxY = r.y + r.h + pad;
… (ещё 169 строк)
````

#### `+00:46:25` Вызов: **Read** `C:\tank-arena\contestants\opus\arena\sparring\dummy\bot.js`

Результат:

````
1	// Sparring bot "Манекен": drives in lazy circles and fires roughly at the enemy.
2	
3	export default {
4	  name: 'Манекен',
5	  motto: 'Катаюсь. Иногда стреляю.',
6	  stats: { armor: 4, engine: 2, gun: 2, reload: 2 },
7	
8	  tick(s) {
9	    const { me, enemy } = s;
10	    const want = Math.atan2(enemy.y - me.y, enemy.x - me.x);
11	    const diff = Math.atan2(Math.sin(want - me.turret), Math.cos(want - me.turret));
12	    return {
13	      throttle: 0.7,
14	      turn: Math.sin(s.time * 0.8) > 0 ? 0.6 : -0.4,
15	      turretTurn: Math.max(-1, Math.min(1, diff * 3)),
… (ещё 5 строк)
````

#### `+00:46:25` Вызов: **Read** `C:\tank-arena\contestants\opus\arena\cli.mjs`

Результат:

````
1	#!/usr/bin/env node
2	// Sandbox: run your tank against sparring bots without a browser.
3	//   node arena/cli.mjs                      -> tank/ vs hunter, 8 rounds (all maps, both sides)
4	//   node arena/cli.mjs --vs dummy --rounds 4
5	//   node arena/cli.mjs --vs tank            -> mirror match against yourself
6	//   node arena/cli.mjs --map Каньон --verbose
7	import { existsSync } from 'node:fs';
8	import { dirname, join, resolve } from 'node:path';
9	import { fileURLToPath, pathToFileURL } from 'node:url';
10	import { performance } from 'node:perf_hooks';
11	import {
12	  MAPS, STAT_POINTS, checkStats, createRound, stepRound, botView, roundPlan, DT,
13	} from './engine.js';
14	
15	const here = dirname(fileURLToPath(import.meta.url));
… (ещё 129 строк)
````

#### `+00:46:26` Вызов: **Read** `C:\tank-arena\contestants\opus\arena\sparring\hunter\body.svg`

Результат:

````
1	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
2	  <rect x="6" y="8" width="52" height="11" rx="3" fill="#2b2a22"/>
3	  <rect x="6" y="45" width="52" height="11" rx="3" fill="#2b2a22"/>
4	  <g stroke="#4a4838" stroke-width="2">
5	    <path d="M10 9v9M16 9v9M22 9v9M28 9v9M34 9v9M40 9v9M46 9v9M52 9v9"/>
6	    <path d="M10 46v9M16 46v9M22 46v9M28 46v9M34 46v9M40 46v9M46 46v9M52 46v9"/>
7	  </g>
8	  <path d="M10 17h40l6 6v18l-6 6H10z" fill="#6b6a3c" stroke="#3f3e22" stroke-width="2"/>
9	  <path d="M14 21h32l4 4v14l-4 4H14z" fill="#7d7c48"/>
10	  <rect x="12" y="29" width="6" height="6" fill="#3f3e22"/>
11	</svg>
12
````

#### `+00:46:27` Вызов: **Read** `C:\tank-arena\contestants\opus\arena\sparring\hunter\turret.svg`

Результат:

````
1	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
2	  <rect x="32" y="29" width="30" height="6" rx="1.5" fill="#4b4a2a" stroke="#2f2e18" stroke-width="1.5"/>
3	  <rect x="56" y="27.5" width="7" height="9" rx="1.5" fill="#3a3920"/>
4	  <circle cx="32" cy="32" r="12" fill="#5d5c32" stroke="#2f2e18" stroke-width="2"/>
5	  <circle cx="29" cy="29" r="4" fill="#7d7c48"/>
6	</svg>
7
````

#### `+00:46:28` Вызов: **Bash** (List lab folder and check Node version)

````bash
ls -la "C:/tank-arena/contestants/opus/lab" "C:/tank-arena/contestants/opus/lab/opponents" 2>&1; node --version
````

Результат:

````
C:/tank-arena/contestants/opus/lab:
total 40
drwxr-xr-x 1 user 197121     0 Sep 25 15:13 .
drwxr-xr-x 1 user 197121     0 Sep 25 14:45 ..
-rwxr-xr-x 1 user 197121  6621 Sep 25 15:01 analyze.mjs
-rwxr-xr-x 1 user 197121  5201 Sep 25 15:03 dodgecheck.mjs
drwxr-xr-x 1 user 197121     0 Sep 25 14:45 opponents
-rwxr-xr-x 1 user 197121 11572 Sep 25 15:04 run.mjs
drwxr-xr-x 1 user 197121     0 Sep 25 14:46 snap
-rw-r--r-- 1 user 197121  3474 Sep 25 15:13 trace.mjs

C:/tank-arena/contestants/opus/lab/opponents:
total 4
drwxr-xr-x 1 user 197121 0 Sep 25 14:45 .
drwxr-xr-x 1 user 197121 0 Sep 25 15:13 ..
… (ещё 1 строк)
````

_`+00:46:29` … `+00:55:40` пауза 9 мин 11 с: модель готовит следующий шаг, её скрытые рассуждения не публикуются_

#### `+00:57:54` Вызов: **Write** `C:\tank-arena\contestants\opus\lab\opponents\fable\bot.js` (720 строк)

Результат:

````
File created successfully at: C:\tank-arena\contestants\opus\lab\opponents\fable\bot.js (file state is current in your context — no need to Read it back)
````

### `+00:57:59` Модель

Теперь внешний вид и первый прогон.

#### `+00:58:07` Вызов: **Write** `C:\tank-arena\contestants\opus\lab\opponents\fable\body.svg` (16 строк)

#### `+00:58:11` Вызов: **Write** `C:\tank-arena\contestants\opus\lab\opponents\fable\turret.svg` (11 строк)

#### `+00:58:12` Вызов: **Bash** (Run the bot against Hunter)

````bash
node arena/cli.mjs lab/opponents/fable 2>&1 | tail -20
````

Результат:

````
File created successfully at: C:\tank-arena\contestants\opus\lab\opponents\fable\body.svg (file state is current in your context — no need to Read it back)
````

Результат:

````
File created successfully at: C:\tank-arena\contestants\opus\lab\opponents\fable\turret.svg (file state is current in your context — no need to Read it back)
````

Результат:

````
Ртуть  vs  Охотник   (8 раундов)

Раунд  1 · Полигон   · ты слева  · ПОБЕДА ·  10.0с уничтожение · HP 97/125 vs 0/175 · точность 67%
Раунд  2 · Лабиринт  · ты справа · ПОБЕДА ·   9.8с уничтожение · HP 125/125 vs 0/175 · точность 86%
Раунд  3 · Крепости  · ты слева  · ПОБЕДА ·  11.7с уничтожение · HP 97/125 vs 0/175 · точность 75%
Раунд  4 · Каньон    · ты справа · ПОБЕДА ·   8.6с уничтожение · HP 69/125 vs 0/175 · точность 75%
Раунд  5 · Полигон   · ты справа · ПОБЕДА ·  10.5с уничтожение · HP 97/125 vs 0/175 · точность 67%
Раунд  6 · Лабиринт  · ты слева  · ПОБЕДА ·  15.5с уничтожение · HP 97/125 vs 0/175 · точность 67%
Раунд  7 · Крепости  · ты справа · ПОБЕДА ·  20.8с уничтожение · HP 125/125 vs 0/175 · точность 44%
Раунд  8 · Каньон    · ты слева  · ПОБЕДА ·   8.6с уничтожение · HP 97/125 vs 0/175 · точность 75%

Итог: 8 побед, 0 поражений, 0 ничьих
Урон нанесён 1450, получен 252, точность 66%, урон себе 0
Ртуть: tick в среднем 0.184 мс, максимум 8.2 мс, ошибок 0
Охотник: tick в среднем 0.009 мс, максимум 3.1 мс, ошибок 0
… (ещё 1 строк)
````

> **СЧЁТ** песочница arena/cli.mjs: Ртуть 8:0 против Охотник

### `+00:58:23` Модель

Против Охотника 8:0 с первой попытки. Проверяю Манекен и зеркало.

#### `+00:58:24` Вызов: **Bash** (Run the bot against Dummy)

````bash
node arena/cli.mjs lab/opponents/fable --vs dummy 2>&1 | tail -14
````

#### `+00:58:26` Вызов: **Bash** (Run the mirror match)

````bash
node arena/cli.mjs lab/opponents/fable --vs lab/opponents/fable 2>&1 | tail -14
````

Результат:

````
Раунд  2 · Лабиринт  · ты справа · ПОБЕДА ·  12.3с уничтожение · HP 125/125 vs 0/200 · точность 75%
Раунд  3 · Крепости  · ты слева  · ПОБЕДА ·  13.3с уничтожение · HP 125/125 vs 0/200 · точность 100%
Раунд  4 · Каньон    · ты справа · ПОБЕДА ·  12.0с уничтожение · HP 125/125 vs 0/200 · точность 55%
Раунд  5 · Полигон   · ты справа · ПОБЕДА ·  12.4с уничтожение · HP 125/125 vs 0/200 · точность 60%
Раунд  6 · Лабиринт  · ты слева  · ПОБЕДА ·  11.6с уничтожение · HP 125/125 vs 0/200 · точность 50%
Раунд  7 · Крепости  · ты справа · ПОБЕДА ·  13.4с уничтожение · HP 125/125 vs 0/200 · точность 100%
Раунд  8 · Каньон    · ты слева  · ПОБЕДА ·  11.3с уничтожение · HP 125/125 vs 0/200 · точность 64%

Итог: 8 побед, 0 поражений, 0 ничьих
Урон нанесён 1066, получен 0, точность 67%, урон себе 0
Ртуть: tick в среднем 0.186 мс, максимум 7.2 мс, ошибок 0
Манекен: tick в среднем 0.000 мс, максимум 0.0 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)
````

> **СЧЁТ** песочница arena/cli.mjs: Ртуть 8:0 против Манекен

Результат:

````
Раунд  2 · Лабиринт  · ты справа · ПОБЕДА ·  20.9с уничтожение · HP 10/125 vs 0/125 · точность 46%
Раунд  3 · Крепости  · ты слева  · ПОРАЖ. ·  27.6с уничтожение · HP 0/125 vs 26/125 · точность 24%
Раунд  4 · Каньон    · ты справа · НИЧЬЯ  ·   7.6с уничтожение · HP 0/125 vs 0/125 · точность 57%
Раунд  5 · Полигон   · ты справа · ПОБЕДА ·  25.7с уничтожение · HP 10/125 vs 0/125 · точность 31%
Раунд  6 · Лабиринт  · ты слева  · ПОБЕДА ·  23.4с уничтожение · HP 43/125 vs 0/125 · точность 33%
Раунд  7 · Крепости  · ты справа · ПОРАЖ. ·  35.0с уничтожение · HP 0/125 vs 10/125 · точность 25%
Раунд  8 · Каньон    · ты слева  · ПОРАЖ. ·  24.4с уничтожение · HP 0/125 vs 10/125 · точность 22%

Итог: 4 побед, 3 поражений, 1 ничьих
Урон нанесён 1236, получен 1177, точность 30%, урон себе 0
Ртуть: tick в среднем 0.163 мс, максимум 6.5 мс, ошибок 0
Ртуть: tick в среднем 0.162 мс, максимум 7.2 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)
````

> **СЧЁТ** песочница arena/cli.mjs: Ртуть 4:3 против Ртуть, ничьих 1

#### `+00:59:10` Вызов: **Write** `C:\tank-arena\contestants\opus\lab\opponents\fable\dev\tourney.mjs` (80 строк)

Результат:

````
File created successfully at: C:\tank-arena\contestants\opus\lab\opponents\fable\dev\tourney.mjs (file state is current in your context — no need to Read it back)
````

#### `+00:59:14` Вызов: **Bash** (Round-robin of stat variants (set 1)) [в фоне]

````bash
node lab/opponents/fable/dev/tourney.mjs rr 1432,2332,0433,3322,0532,1342,2233,4222 8 2>&1 | tail -40
````

#### `+00:59:16` Вызов: **Bash** (Round-robin of stat variants (set 2)) [в фоне]

````bash
node lab/opponents/fable/dev/tourney.mjs rr 1432,1333,0343,1243,0244,2530,1441,2431 8 2>&1 | tail -40
````

#### `+00:59:17` Вызов: **Bash** (All variants against Hunter) [в фоне]

````bash
node lab/opponents/fable/dev/tourney.mjs vs hunter 1432,2332,0433,3322,0532,1342,2233,4222,1333,0343,1243,0244,2530,1441,2431 8 2>&1 | tail -20
````

Результат:

````
Command running in background with ID: btkoh9am8. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\btkoh9am8.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

Результат:

````
Command running in background with ID: btkm66ko2. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\btkm66ko2.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

Результат:

````
Command running in background with ID: b3p55lffj. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\b3p55lffj.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

#### `+01:00:12` Вызов: **Edit** `C:\tank-arena\contestants\opus\lab\opponents\fable\bot.js`

#### `+01:00:17` Вызов: **Edit** `C:\tank-arena\contestants\opus\lab\opponents\fable\bot.js`

Результат:

````
The file C:\tank-arena\contestants\opus\lab\opponents\fable\bot.js has been updated successfully. (file state is current in your context — no need to Read it back)
````

Результат:

````
The file C:\tank-arena\contestants\opus\lab\opponents\fable\bot.js has been updated successfully. (file state is current in your context — no need to Read it back)
````

#### `+01:00:10` Уведомление: Background command "All variants against Hunter" completed (exit code 0)

#### `+01:00:21` Вызов: **Bash** (Show variants-vs-Hunter results)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/b3p55lffj.output"
````

Результат:

````
1432 vs hunter: 8-0-0  hp 0.80 vs 0.00  avg 12s  tick 0.248ms
2332 vs hunter: 8-0-0  hp 0.74 vs 0.00  avg 11s  tick 0.207ms
0433 vs hunter: 8-0-0  hp 0.79 vs 0.00  avg 10s  tick 0.202ms
3322 vs hunter: 8-0-0  hp 0.64 vs 0.00  avg 14s  tick 0.198ms
0532 vs hunter: 8-0-0  hp 0.47 vs 0.00  avg 11s  tick 0.594ms
1342 vs hunter: 8-0-0  hp 0.75 vs 0.00  avg 11s  tick 4.332ms
2233 vs hunter: 8-0-0  hp 0.72 vs 0.00  avg 10s  tick 2.557ms
4222 vs hunter: 7-1-0  hp 0.72 vs 0.00  avg 14s  tick 2.646ms
1333 vs hunter: 8-0-0  hp 0.72 vs 0.00  avg 10s  tick 2.274ms
0343 vs hunter: 8-0-0  hp 0.65 vs 0.00  avg 9s  tick 1.011ms
1243 vs hunter: 8-0-0  hp 0.86 vs 0.00  avg 9s  tick 0.674ms
0244 vs hunter: 8-0-0  hp 0.69 vs 0.00  avg 8s  tick 0.614ms
2530 vs hunter: 8-0-0  hp 0.79 vs 0.00  avg 15s  tick 0.557ms
1441 vs hunter: 8-0-0  hp 0.78 vs 0.00  avg 11s  tick 0.677ms
2431 vs hunter: 8-0-0  hp 0.67 vs 0.00  avg 13s  tick 0.718ms
… (ещё 2 строк)
````

#### `+01:00:31` Вызов: **Bash** (Show interim round-robin results)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/btkoh9am8.output"; echo ----; cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/btkm66ko2.output"
````

Результат:

````
----
````

#### `+01:01:00` Вызов: **Bash** (Locate tunable lines in bot.js)

````bash
grep -n "rMin = 210\|let rMin\|const endgame\|virtual\|0.45)\|shotT <= 0.62" lab/opponents/fable/bot.js
````

Результат:

````
567:        tables.push(bulletTable(vb, walls, 0, 0.45));
618:    const endgame = s.timeLeft < 18;
620:    let rMin = 210, rMax = 340;
733:        fire = shotT <= 0.62 || closeIn || (enemySlow && shotT < 1.1) || (p >= 0.3 && shotT < 1.3) || (holdTicks > 24 && shotT < 1.2);
````

#### `+01:01:08` Вызов: **Bash** (Introduce TUNE object into bot.js)

````bash
python - <<'EOF'
import re,io
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
s=s.replace("const consumed = new Uint8Array(64);","const consumed = new Uint8Array(64);\n\n// настройки поведения (стенд может менять через export.tune)\nconst TUNE = { rMin: 210, rMax: 340, virtual: 0.45, fireT: 0.62, endgame: 18 };")
s=s.replace("tables.push(bulletTable(vb, walls, 0, 0.45));","tables.push(bulletTable(vb, walls, 0, TUNE.virtual));")
… (скрипт, ещё 8 строк)
````

Результат:

````
7
258:const TUNE = { rMin: 210, rMax: 340, virtual: 0.45, fireT: 0.62, endgame: 18 };
498:  tune: TUNE,
571:        tables.push(bulletTable(vb, walls, 0, TUNE.virtual));
622:    const endgame = s.timeLeft < TUNE.endgame;
624:    let rMin = TUNE.rMin, rMax = TUNE.rMax;
737:        fire = shotT <= TUNE.fireT || closeIn || (enemySlow && shotT < 1.1) || (p >= 0.3 && shotT < 1.3) || (holdTicks > 24 && shotT < 1.2);
````

#### `+01:01:20` Вызов: **Edit** `C:\tank-arena\contestants\opus\lab\opponents\fable\dev\tourney.mjs`

Результат:

````
The file C:\tank-arena\contestants\opus\lab\opponents\fable\dev\tourney.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
````

#### `+01:01:24` Вызов: **Bash** (Smoke test after edits, then personas round-robin) [в фоне]

````bash
node arena/cli.mjs lab/opponents/fable --rounds 4 2>&1 | tail -8 && node lab/opponents/fable/dev/tourney.mjs rr 1432,1432:brawler,1432:kiter,1432:nojink,1432:trigger,1432:mid 8 2>&1 | tail -25
````

Результат:

````
Command running in background with ID: b13rdsdhb. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\b13rdsdhb.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

#### `+01:01:40` Вызов: **Bash** (Check round-robin outputs)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/btkoh9am8.output"; echo ----; cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/btkm66ko2.output"
````

Результат:

````
----
1432 vs 1333: 4-4-0  hp 0.12 vs 0.32  avg 15s
1432 vs 0343: 0-8-0  hp 0.00 vs 0.30  avg 13s
1432 vs 1243: 5-3-0  hp 0.24 vs 0.14  avg 11s
1432 vs 0244: 2-6-0  hp 0.10 vs 0.13  avg 13s
1432 vs 2530: 4-4-0  hp 0.06 vs 0.17  avg 24s
1432 vs 1441: 1-7-0  hp 0.05 vs 0.36  avg 16s
1432 vs 2431: 2-6-0  hp 0.08 vs 0.27  avg 22s
1333 vs 0343: 1-7-0  hp 0.01 vs 0.38  avg 11s
1333 vs 1243: 3-4-1  hp 0.15 vs 0.10  avg 13s
1333 vs 0244: 2-6-0  hp 0.03 vs 0.34  avg 11s
1333 vs 2530: 2-6-0  hp 0.14 vs 0.23  avg 23s
1333 vs 1441: 5-3-0  hp 0.26 vs 0.13  avg 15s
1333 vs 2431: 4-4-0  hp 0.29 vs 0.07  avg 21s
0343 vs 1243: 4-3-1  hp 0.22 vs 0.07  avg 10s
… (ещё 26 строк)
````

#### `+01:01:30` Уведомление: Background command "Round-robin of stat variants (set 2)" completed (exit code 0)

#### `+01:02:01` Вызов: **Bash** (Wait and show set 1 and persona results)

````bash
sleep 60; cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/btkoh9am8.output"; echo ----; cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/b13rdsdhb.output"
````

Результат (ошибка):

````
<tool_use_error>Blocked: sleep 60 followed by: cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/btkoh9am8.output" echo ---- cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/b13rdsdhb.output". To wait for a condition, use Monitor with an until-loop (e.g. `until <check>; do sleep 2; do …
````

#### `+01:01:58` Уведомление: Background command "Round-robin of stat variants (set 1)" completed (exit code 0)

#### `+01:02:14` Вызов: **Bash** (Show persona round-robin results)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/b13rdsdhb.output"
````

Результат:

````
Раунд  4 · Каньон    · ты справа · ПОБЕДА ·   8.6с уничтожение · HP 69/125 vs 0/175 · точность 75%

Итог: 4 побед, 0 поражений, 0 ничьих
Урон нанесён 700, получен 112, точность 75%, урон себе 0
Ртуть: tick в среднем 0.224 мс, максимум 7.9 мс, ошибок 0
Охотник: tick в среднем 0.014 мс, максимум 3.8 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)
````

> **СЧЁТ** песочница: 4:0

#### `+01:02:21` Вызов: **Bash** (Round-robin of gun-4/5 stat variants (set 3)) [в фоне]

````bash
node lab/opponents/fable/dev/tourney.mjs rr 1342,0343,1243,0352,0253,1351,2241,3340,0442,1252 8 2>&1 | tail -16
````

#### `+01:02:23` Вызов: **Bash** (Count kit pickups in verbose mirror match)

````bash
node arena/cli.mjs lab/opponents/fable --vs lab/opponents/fable --rounds 8 --verbose 2>&1 | grep -c "аптечк"; node arena/cli.mjs lab/opponents/fable --vs lab/opponents/fable --rounds 8 --verbose 2>&1 | grep "аптечк" | head -5
````

Результат:

````
Command running in background with ID: beudekphk. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\beudekphk.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

Результат:

````
14
  17.1с  Ртуть взял аптечку (+33)
  18.3с  Ртуть взял аптечку (+33)
  15.1с  Ртуть взял аптечку (+50)
  15.7с  Ртуть взял аптечку (+50)
  16.1с  Ртуть взял аптечку (+33)
````

#### `+01:02:55` Вызов: **Bash** (Show persona round-robin results)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/b13rdsdhb.output" | tail -24
````

Результат:

````
1432 vs 1432:kiter: 1-7-0  hp 0.06 vs 0.55  avg 37s
1432 vs 1432:nojink: 6-2-0  hp 0.37 vs 0.04  avg 23s
1432 vs 1432:trigger: 4-4-0  hp 0.17 vs 0.12  avg 23s
1432 vs 1432:mid: 2-6-0  hp 0.08 vs 0.50  avg 29s
1432:brawler vs 1432:kiter: 4-4-0  hp 0.10 vs 0.14  avg 22s
1432:brawler vs 1432:nojink: 2-6-0  hp 0.05 vs 0.12  avg 14s
1432:brawler vs 1432:trigger: 1-7-0  hp 0.03 vs 0.22  avg 14s
1432:brawler vs 1432:mid: 3-5-0  hp 0.11 vs 0.28  avg 18s
1432:kiter vs 1432:nojink: 7-1-0  hp 0.45 vs 0.04  avg 20s
1432:kiter vs 1432:trigger: 5-3-0  hp 0.31 vs 0.24  avg 33s
1432:kiter vs 1432:mid: 6-2-0  hp 0.39 vs 0.20  avg 48s
1432:nojink vs 1432:trigger: 1-7-0  hp 0.01 vs 0.36  avg 18s
1432:nojink vs 1432:mid: 4-4-0  hp 0.25 vs 0.27  avg 19s
1432:trigger vs 1432:mid: 2-6-0  hp 0.08 vs 0.39  avg 21s

… (ещё 9 строк)
````

#### `+01:02:49` Уведомление: Background command "Smoke test after edits, then personas round-robin" completed (exit code 0)

#### `+01:03:28` Вызов: **Bash** (Round-robin of kiting-range personas) [в фоне]

````bash
python - <<'EOF'
p='lab/opponents/fable/dev/tourney.mjs'
s=open(p,encoding='utf-8').read()
s=s.replace("  mid: { rMin: 260, rMax: 400 },","  mid: { rMin: 260, rMax: 400 },\n  k2: { rMin: 380, rMax: 520 },\n  k3: { rMin: 300, rMax: 420 },\n  k4: { rMin: 330, rMax: 460, fireT: 0.9 },\n  k5: { rMin: 450, rMax: 600 },\n  k6: { rMin: 380, rMax: 520, fireT: 0.9 },")
open(p,'w',encoding='utf-8').write(s)
EOF
… (скрипт, ещё 1 строк)
````

Результат:

````
Command running in background with ID: b9tf5zijm. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\b9tf5zijm.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

#### `+01:03:59` Вызов: **Bash** (Locate accuracy-tracking code lines)

````bash
grep -n "myShots\|prevEnemyHp\|const acc\|accBin\|holdTicks = 0;\|prevMyHp\|let rMin\|else if (myFrac < enFrac - 0.25)" lab/opponents/fable/bot.js
````

Результат:

````
230:let myShots = new Map();        // id снаряда -> { t: время полёта при выстреле }
234:let prevEnemyHp = null;
235:let holdTicks = 0;
237:const acc = [[1, 2], [1, 2], [1, 2], [1, 2]]; // [hits+1, shots+2] для t<0.35, <0.55, <0.8, >=0.8
238:const accBin = (t) => (t < 0.35 ? 0 : t < 0.55 ? 1 : t < 0.8 ? 2 : 3);
502:    myShots = new Map();
505:    prevEnemyHp = null;
506:    holdTicks = 0;
523:        if (b.mine && myShots.has(-1)) { myShots.set(b.id, myShots.get(-1)); myShots.delete(-1); }
526:    let enemyHpDrop = prevEnemyHp === null ? 0 : prevEnemyHp - en.hp;
530:      const shot = myShots.get(id);
532:        myShots.delete(id);
533:        const bin = accBin(shot.t);
538:    prevEnemyHp = en.hp;
624:    let rMin = TUNE.rMin, rMax = TUNE.rMax;
… (ещё 4 строк)
````

#### `+01:04:03` Вызов: **Read** `C:\tank-arena\contestants\opus\lab\opponents\fable\bot.js` (с 515, 30 строк)

Результат:

````
515	    const time = s.time;
516	
517	    // --- учёт снарядов и своей точности ---
518	    const seenNow = new Set();
519	    for (const b of s.bullets) {
520	      seenNow.add(b.id);
521	      if (!bulletSeen.has(b.id)) {
522	        bulletSeen.set(b.id, s.tick);
523	        if (b.mine && myShots.has(-1)) { myShots.set(b.id, myShots.get(-1)); myShots.delete(-1); }
524	      }
525	    }
526	    let enemyHpDrop = prevEnemyHp === null ? 0 : prevEnemyHp - en.hp;
527	    for (const [id] of bulletSeen) {
528	      if (seenNow.has(id)) continue;
529	      bulletSeen.delete(id);
… (ещё 15 строк)
````

#### `+01:04:04` Вызов: **Read** `C:\tank-arena\contestants\opus\lab\opponents\fable\bot.js` (с 618, 14 строк)

Результат:

````
618	      goal = { x: bestKit.k.x, y: bestKit.k.y };
619	    }
620	
621	    // боевая дистанция
622	    const endgame = s.timeLeft < TUNE.endgame;
623	    const ahead = myFrac > enFrac + 0.04;
624	    let rMin = TUNE.rMin, rMax = TUNE.rMax;
625	    if (endgame && ahead) { rMin = 330; rMax = 900; }
626	    else if (endgame && !ahead) { rMin = 120; rMax = 220; }
627	    else if (myFrac < enFrac - 0.25) { rMin = 260; rMax = 400; }
628	
629	    if (mode === 'combat') {
630	      if (!los || dist > rMax + 60) {
631	        // подходим по полю к врагу (обновляем поле при смене клетки)
````

#### `+01:04:38` Вызов: **Bash** (Add enemy-hit tracking and adaptive range band)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()

# 1. module state
s=s.replace("""const acc = [[1, 2], [1, 2], [1, 2], [1, 2]]; // [hits+1, shots+2] для t<0.35, <0.55, <0.8, >=0.8
… (скрипт, ещё 88 строк)
````

Результат:

````
ok
Урон нанесён 340, получен 0, точность 61%, урон себе 0
Ртуть: tick в среднем 0.232 мс, максимум 6.3 мс, ошибок 0
Охотник: tick в среднем 0.016 мс, максимум 3.2 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)
````

#### `+01:04:47` Вызов: **Bash** (Show set 3 and kiting-range results)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/beudekphk.output"; echo -----; cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/b9tf5zijm.output"
````

#### `+01:04:53` Вызов: **Bash** (Add personas and accuracy printout to the harness)

````bash
python - <<'EOF'
p='lab/opponents/fable/dev/tourney.mjs'
s=open(p,encoding='utf-8').read()
s=s.replace("  k6: { rMin: 380, rMax: 520, fireT: 0.9 },","  k6: { rMin: 380, rMax: 520, fireT: 0.9 },\n  noadapt: { adapt: false },\n  close: { rMin: 210, rMax: 340, adapt: false },\n  closeadapt: { rMin: 210, rMax: 340 },")
s=s.replace("""      console.log(`${codes[i]} vs ${codes[j]}: ${r.aw}-${r.bw}-${r.draw}  hp ${(r.aHp / rounds).toFixed(2)} vs ${(r.bHp / rounds).toFixed(2)}  avg ${(r.time / rounds).toFixed(0)}s`);""",
"""      const fmt = (a) => a.map((b) => `${((b[0] - 1) / Math.max(1, b[1] - 2) * 100).toFixed(0)}%/${b[1] - 2}`).join(' ');
… (скрипт, ещё 4 строк)
````

Результат:

````
2241 vs 1252: 2-6-0  hp 0.11 vs 0.26  avg 13s
3340 vs 0442: 5-3-0  hp 0.35 vs 0.14  avg 12s
3340 vs 1252: 3-5-0  hp 0.04 vs 0.09  avg 11s
0442 vs 1252: 4-4-0  hp 0.08 vs 0.12  avg 13s

Итог:
0253: +45 -26 =1
1252: +41 -30 =1
1351: +41 -31 =0
3340: +39 -33 =0
1342: +38 -34 =0
0343: +37 -34 =1
0352: +37 -34 =1
1243: +35 -35 =2
0442: +29 -43 =0
… (ещё 4 строк)
````

Результат:

````
done
````

#### `+01:04:49` Уведомление: Background command "Round-robin of gun-4/5 stat variants (set 3)" completed (exit code 0)

#### `+01:05:06` Вызов: **Bash** (Mirror match with the kiting default)

````bash
node arena/cli.mjs lab/opponents/fable --vs lab/opponents/fable --rounds 8 2>&1 | tail -14
````

Результат:

````
Раунд  2 · Лабиринт  · ты справа · ПОРАЖ. ·  30.9с уничтожение · HP 0/125 vs 26/125 · точность 19%
Раунд  3 · Крепости  · ты слева  · ПОБЕДА ·  24.1с уничтожение · HP 76/125 vs 0/125 · точность 42%
Раунд  4 · Каньон    · ты справа · НИЧЬЯ  ·   7.7с уничтожение · HP 0/125 vs 0/125 · точность 67%
Раунд  5 · Полигон   · ты справа · ПОРАЖ. ·   8.6с уничтожение · HP 0/125 vs 26/125 · точность 60%
Раунд  6 · Лабиринт  · ты слева  · ПОРАЖ. ·   9.2с уничтожение · HP 0/125 vs 26/125 · точность 75%
Раунд  7 · Крепости  · ты справа · ПОБЕДА ·  16.6с уничтожение · HP 43/125 vs 0/125 · точность 57%
Раунд  8 · Каньон    · ты слева  · НИЧЬЯ  ·  12.2с уничтожение · HP 0/125 vs 0/125 · точность 50%

Итог: 3 побед, 3 поражений, 2 ничьих
Урон нанесён 1021, получен 1038, точность 34%, урон себе 0
Ртуть: tick в среднем 0.176 мс, максимум 6.9 мс, ошибок 0
Ртуть: tick в среднем 0.173 мс, максимум 6.5 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)
````

> **СЧЁТ** песочница arena/cli.mjs: Ртуть 3:3 против Ртуть, ничьих 2

#### `+01:05:36` Вызов: **Write** `C:\tank-arena\contestants\opus\lab\opponents\fable\dev\trace.mjs` (42 строк)

Результат:

````
File created successfully at: C:\tank-arena\contestants\opus\lab\opponents\fable\dev\trace.mjs (file state is current in your context — no need to Read it back)
````

#### `+01:05:39` Вызов: **Bash** (Trace one mirror round on Polygon)

````bash
node lab/opponents/fable/dev/trace.mjs 0 1432 1432 2>&1 | head -80
````

#### `+01:05:41` Вызов: **Bash** (Check kiting-range RR output)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/b9tf5zijm.output"
````

Результат:

````
  t=0s dist=1319 A(140,450) B(1460,450) hp=125/125
  t=1s dist=1011 A(295,450) B(1305,450) hp=125/125
1.33s shot by 0 dist=880 speeds=198/198
1.33s shot by 1 dist=880 speeds=198/198
  t=2s dist=623 A(490,480) B(1110,420) hp=125/125
  t=3s dist=331 A(673,556) B(927,344) hp=125/125
  t=4s dist=198 A(807,549) B(793,351) hp=125/125
  t=5s dist=196 A(801,554) B(780,359) hp=125/125
5.67s shot by 0 dist=194 speeds=8/-109
  t=6s dist=203 A(847,527) B(816,327) hp=125/125
6.10s shot by 1 dist=208 speeds=50/-119
6.30s HIT on 0 -33 dist=221 hp=92/125
6.67s shot by 0 dist=250 speeds=198/-119
  t=7s dist=292 A(981,463) B(822,218) hp=92/125
7.03s HIT on 1 -33 dist=297 hp=92/92
… (ещё 65 строк)
````

Результат:

````
(Bash completed with no output)
````

#### `+01:06:32` Вызов: **Bash** (Show positional functions)

````bash
grep -n "positional = (x, y, hd, sp) =>" lab/opponents/fable/bot.js && sed -n 672,712p lab/opponents/fable/bot.js
````

Результат:

````
685:      positional = (x, y, hd, sp) => {
702:      positional = (x, y, hd, sp) => {
      }
    }

    const zonePen = (x, y) => {
      if (time < 45) return 0;
      const d = Math.hypot(x - CX, y - CY);
      return 0.12 * Math.max(0, d - (zoneR(time + 3.5) - 60));
    };
    const hideBonus = endgame && ahead;
    const enEndX = pred.px[HZ], enEndY = pred.py[HZ];

    let positional;
    if (mode === 'combat') {
… (ещё 28 строк)
````

#### `+01:06:45` Вызов: **Bash** (Add closing-speed projection and re-trace)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
old_combat="""      positional = (x, y, hd, sp) => {
        const d = Math.hypot(x - enEndX, y - enEndY);
        let c = 0;
… (скрипт, ещё 35 строк)
````

Результат:

````
ok
1.33s shot by 0 dist=880 speeds=198/198
1.33s shot by 1 dist=880 speeds=198/198
3.13s shot by 0 dist=403 speeds=198/198
3.13s shot by 1 dist=403 speeds=198/198
5.67s shot by 0 dist=536 speeds=143/143
5.67s shot by 1 dist=536 speeds=143/143
9.20s shot by 1 dist=193 speeds=-114/8
9.70s shot by 0 dist=215 speeds=-119/119
9.93s HIT on 1 -33 dist=235 hp=125/92
10.20s shot by 1 dist=264 speeds=-119/198
10.70s shot by 0 dist=322 speeds=-119/198
11.20s shot by 1 dist=371 speeds=-119/198
12.00s shot by 0 dist=430 speeds=-91/170
12.20s shot by 1 dist=423 speeds=-119/86
… (ещё 16 строк)
````

#### `+01:06:52` Вызов: **Bash** (Show trace timeline for the first 12 seconds)

````bash
node lab/opponents/fable/dev/trace.mjs 0 1432 1432 2>&1 | sed -n 1,40p
````

Результат:

````
  t=0s dist=1319 A(140,450) B(1460,450) hp=125/125
  t=1s dist=1011 A(295,450) B(1305,450) hp=125/125
1.33s shot by 0 dist=880 speeds=198/198
1.33s shot by 1 dist=880 speeds=198/198
  t=2s dist=653 A(479,511) B(1121,389) hp=125/125
  t=3s dist=416 A(656,600) B(944,300) hp=125/125
3.13s shot by 0 dist=403 speeds=198/198
3.13s shot by 1 dist=403 speeds=198/198
  t=4s dist=433 A(792,666) B(808,234) hp=125/125
  t=5s dist=545 A(967,665) B(633,235) hp=125/125
5.67s shot by 0 dist=536 speeds=143/143
5.67s shot by 1 dist=536 speeds=143/143
  t=6s dist=478 A(1026,526) B(574,374) hp=125/125
  t=7s dist=276 A(920,381) B(680,519) hp=125/125
  t=8s dist=181 A(776,362) B(826,536) hp=125/125
… (ещё 25 строк)
````

#### `+01:07:18` Вызов: **Bash** (Unify combat/approach positional scoring and re-trace)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
start=s.index("    let positional;\n    if (mode === 'combat') {")
end=s.index("    const ctx = { walls, bullets: tables, positional };")
new="""    let positional;
… (скрипт, ещё 40 строк)
````

Результат:

````
ok
  t=0s dist=1319 A(140,450) B(1460,450) hp=125/125
  t=1s dist=1011 A(295,450) B(1305,450) hp=125/125
  t=2s dist=619 A(491,462) B(1109,438) hp=125/125
  t=3s dist=312 A(668,534) B(932,366) hp=125/125
  t=4s dist=346 A(827,620) B(771,279) hp=125/125
  t=5s dist=342 A(767,568) B(677,238) hp=125/125
  t=6s dist=322 A(657,553) B(612,234) hp=125/125
  t=7s dist=337 A(595,554) B(556,219) hp=125/125
  t=8s dist=410 A(694,535) B(472,191) hp=125/125
  t=9s dist=393 A(688,612) B(505,264) hp=125/125
  t=10s dist=390 A(720,590) B(485,278) hp=125/125
  t=11s dist=364 A(632,505) B(530,155) hp=125/125
  t=12s dist=422 A(555,467) B(592,47) hp=125/125
  t=13s dist=396 A(458,323) B(727,32) hp=125/125
… (ещё 24 строк)
````

#### `+01:07:40` Вызов: **Bash** (Strengthen wall-clearance preference and smoke test)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
old="""        const cl = clearanceAt(map, x, y);
        if (cl < 70) c += 0.06 * (70 - cl);
        c -= 0.012 * Math.abs(sp);"""
… (скрипт, ещё 10 строк)
````

Результат:

````
ok
Ртуть: tick в среднем 0.226 мс, максимум 7.2 мс, ошибок 0
Охотник: tick в среднем 0.017 мс, максимум 3.0 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)
````

#### `+01:07:47` Вызов: **Bash** (Stat round-robin A on the new behavior) [в фоне]

````bash
node lab/opponents/fable/dev/tourney.mjs rr 1432,1342,0343,2332,1351,0352,2341,3331 8 2>&1 | tail -10
````

#### `+01:07:49` Вызов: **Bash** (Stat round-robin B on the new behavior) [в фоне]

````bash
node lab/opponents/fable/dev/tourney.mjs rr 1342,0253,1252,2350,1441,0442,3322,2242 8 2>&1 | tail -10
````

#### `+01:07:51` Вызов: **Bash** (Persona round-robin on the new behavior) [в фоне]

````bash
node lab/opponents/fable/dev/tourney.mjs rr 1342,1342:close,1342:brawler,1342:trigger,1342:noadapt,1342:k5 8 2>&1 | tail -22
````

#### `+01:07:52` Вызов: **Bash** (CLI checks against Hunter and Dummy) [в фоне]

````bash
node arena/cli.mjs lab/opponents/fable 2>&1 | tail -6; node arena/cli.mjs lab/opponents/fable --vs dummy 2>&1 | tail -5
````

Результат:

````
Command running in background with ID: bni140w90. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\bni140w90.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

Результат:

````
Command running in background with ID: bzzssshks. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\bzzssshks.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

Результат:

````
Command running in background with ID: bxcv9eddh. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\bxcv9eddh.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

Результат:

````
Command running in background with ID: br8r9yivt. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\br8r9yivt.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

#### `+01:07:49` Уведомление: Background command "Round-robin of kiting-range personas" completed (exit code 0)

#### `+01:08:02` Вызов: **Bash** (Trace a mirror round on Labyrinth)

````bash
node lab/opponents/fable/dev/trace.mjs 1 1342 1342 2>&1 | grep -E "HIT|winner|kit|t=[0-9]*[05]s" | head -60
````

Результат:

````
  t=0s dist=1319 A(140,450) B(1460,450) hp=125/125
  t=5s dist=383 A(641,528) B(982,352) hp=125/125
9.83s HIT on 0 -38 dist=327 hp=87/125
  t=10s dist=334 A(630,410) B(910,227) hp=87/125
  t=15s dist=365 A(755,760) B(907,428) hp=87/125
15.33s kit by 0 +38
  t=20s dist=359 A(602,671) B(925,514) hp=125/125
22.60s HIT on 1 -38 dist=314 hp=125/87
  t=25s dist=376 A(719,522) B(895,189) hp=125/87
26.37s kit by 1 +38
27.87s HIT on 0 -38 dist=255 hp=87/125
28.60s HIT on 1 -38 dist=280 hp=87/87
28.97s HIT on 0 -38 dist=301 hp=49/87
  t=30s dist=339 A(593,345) B(919,251) hp=49/87
  t=35s dist=348 A(683,579) B(878,290) hp=49/87
… (ещё 8 строк)
````

#### `+01:07:56` Уведомление: Background command "CLI checks against Hunter and Dummy" completed (exit code 0)

#### `+01:08:07` Вызов: **Bash** (Show Hunter and Dummy results)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/br8r9yivt.output"
````

Результат:

````
Итог: 8 побед, 0 поражений, 0 ничьих
Урон нанесён 1362, получен 448, точность 70%, урон себе 0
Ртуть: tick в среднем 0.225 мс, максимум 10.0 мс, ошибок 0
Охотник: tick в среднем 0.012 мс, максимум 4.8 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)

Урон нанесён 868, получен 0, точность 63%, урон себе 0
Ртуть: tick в среднем 0.205 мс, максимум 8.4 мс, ошибок 0
Манекен: tick в среднем 0.001 мс, максимум 0.1 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)


[exited with code 0]
````

> **СЧЁТ** песочница: 8:0

### `+01:08:46` Модель

Пока турниры идут, проверю поведение в зоне: добавлю тестовый флаг «не стрелять», чтобы раунд дошёл до 120 с.

#### `+01:08:51` Вызов: **Bash** (Trace a no-fire round to check zone behavior)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
old="    if (ready && !fire) holdTicks++; else holdTicks = 0;"
new="    if (TUNE.noFire) fire = false;\n    if (ready && !fire) holdTicks++; else holdTicks = 0;"
assert old in s
… (скрипт, ещё 8 строк)
````

Результат:

````
  t=55s dist=1373 A(113,448) B(1487,452) hp=125/125
  t=58s dist=1376 A(112,472) B(1488,428) hp=125/125
  t=61s dist=1382 A(109,451) B(1491,449) hp=125/125
  t=64s dist=1384 A(108,457) B(1492,443) hp=125/125
  t=67s dist=1394 A(104,479) B(1496,421) hp=125/125
  t=70s dist=1365 A(135,372) B(1500,399) hp=125/125
  t=73s dist=1326 A(170,384) B(1496,387) hp=125/125
  t=76s dist=1249 A(178,383) B(1427,378) hp=125/125
  t=79s dist=1209 A(195,366) B(1398,494) hp=113/120
  t=82s dist=1221 A(195,366) B(1416,384) hp=53/60
winner 1 kill 84.7
````

#### `+01:09:32` Вызов: **Bash** (Debug mode and field values on Fortresses)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
old="    lastCand = best;\n    const move = CANDS[best];"
new="    lastCand = best;\n    const move = CANDS[best];\n    if (TUNE.debug) TUNE.last = { mode, best, bestCost, field: field ? fieldAt(field, me.x, me.y) : null, cell: cellOf(me.x, me.y), free: map.free[cellOf(me.x, me.y)] };"
assert old in s
… (скрипт, ещё 20 строк)
````

Результат:

````
0 {"mode":"approach","best":26,"bestCost":247.95677484486916,"field":2083.67578125,"cell":1767,"free":1} {"throttle":-1,"turn":-0.5,"turretTurn":-0.00017664114271763258,"fire":false} 140 450 0.00
10 {"mode":"approach","best":1,"bestCost":253.7562723946069,"field":2058.822998046875,"cell":1765,"free":1} {"throttle":1,"turn":-0.5,"turretTurn":-0.0541854646689956,"fire":false} 117 458 -0.47
20 {"mode":"approach","best":6,"bestCost":248.76481936796193,"field":2058.822998046875,"cell":1845,"free":1} {"throttle":0.6,"turn":-0.5,"turretTurn":-0.09177864219398957,"fire":false} 103 468 -0.84
30 {"mode":"approach","best":30,"bestCost":249.60680224811838,"field":2058.822998046875,"cell":1765,"free":1} {"throttle":1,"turn":-1,"turretTurn":0.07696296835521137,"fire":false} 108 454 -1.40
40 {"mode":"approach","best":27,"bestCost":246.76226285199894,"field":2058.822998046875,"cell":1685,"free":1} {"throttle":-1,"turn":0,"turretTurn":-0.10333350823853926,"fire":false} 107 425 -1.63
50 {"mode":"approach","best":33,"bestCost":249.56406496166667,"field":2058.822998046875,"cell":1685,"free":1} {"throttle":-1,"turn":1,"turretTurn":-0.11709512727920662,"fire":false} 107 439 -1.54
60 {"mode":"approach","best":7,"bestCost":249.1486301775443,"field":2058.822998046875,"cell":1765,"free":1} {"throttle":0.6,"turn":0,"turretTurn":0.1259771814418688,"fire":false} 105 457 -1.54
70 {"mode":"approach","best":7,"bestCost":247.27406634399162,"field":2058.822998046875,"cell":1845,"free":1} {"throttle":0.6,"turn":0,"turretTurn":0.1259037271298835,"fire":false} 105 462 -1.54
80 {"mode":"approach","best":7,"bestCost":247.37736287614817,"field":2058.822998046875,"cell":1845,"free":1} {"throttle":0.6,"turn":0,"turretTurn":0.1111758503673526,"fire":false} 105 464 -1.54
````

#### `+01:09:56` Вызов: **Bash** (Dump the enemy distance field around the left fortress)

````bash
cat > lab/opponents/fable/dev/field.mjs <<'EOF'
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createRound, botView } from '../../../../arena/engine.js';
const botPath = pathToFileURL(resolve('.', 'lab/opponents/fable/bot.js')).href;
const a = (await import(`${botPath}?i=a`)).default; a.tune.debug = true; a.tune.noFire = true;
… (скрипт, ещё 24 строк)
````

Результат:

````
 250    #18791854183418141794177417541734171416941674165416341614159415741554
 270    #188718621859   #   #   #   #   #   #   #   #   #   #1611158615661546
 290    #18981882   #   #   #   #   #   #   #   #   #   #   #   #157715571537
 310    #19181902   #   #   #   #   #   #   #   #   #   #   #   #156915491529
 330    #19381922   #   #   #   #   #   #   #   #   #   #   #   #156115411521
 350    #195819421967   #   #   #   #   #   #   #   #   #   #   #155315331513
 370    #197819621971199120112031205120712091   #   #   #   #   #154415241504
 390    #199819821991199920192039205920792099   #   #   #   #   #153615161496
 410    #201820022011201920272047206720872107   #   #   #   #   #154415241504
 430    #203820222031203920472055207520952115   #   #   #   #   #155315331513
 450    #205820422051205920672075208421042124   #   #   #   #   #156115411521
 470    #203820222031203920472055207520952115   #   #   #   #   #155315331513
 490    #201820022011201920272047206720872107   #   #   #   #   #154415241504
 510    #199819821991199920192039205920792099   #   #   #   #   #153615161496
 530    #197819621971199120112031205120712091   #   #   #   #   #154415241504
… (ещё 6 строк)
````

#### `+01:10:52` Вызов: **Bash** (Add descent-direction reward and re-test Fortresses)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()

# helper
old="function clearanceAt(m, x, y) {"
… (скрипт, ещё 49 строк)
````

Результат:

````
ok
0 {"mode":"approach","best":33,"bestCost":240.15217726356377,"field":2083.67578125,"cell":1767,"free":1} {"throttle":-1,"turn":1,"turretTurn
10 {"mode":"approach","best":39,"bestCost":239.96779125651273,"field":2075.3916015625,"cell":1766,"free":1} {"throttle":1,"turn":0,"turretTu
20 {"mode":"approach","best":39,"bestCost":238.05709064677237,"field":2075.3916015625,"cell":1766,"free":1} {"throttle":1,"turn":0,"turretTu
30 {"mode":"approach","best":39,"bestCost":242.30399835544907,"field":2075.3916015625,"cell":1766,"free":1} {"throttle":1,"turn":0,"turretTu
40 {"mode":"approach","best":39,"bestCost":241.93358143896955,"field":2075.3916015625,"cell":1766,"free":1} {"throttle":1,"turn":0,"turretTu
50 {"mode":"approach","best":27,"bestCost":239.173678966817,"field":2075.3916015625,"cell":1766,"free":1} {"throttle":-1,"turn":0,"turretTur
60 {"mode":"approach","best":39,"bestCost":238.28320218090454,"field":2075.3916015625,"cell":1766,"free":1} {"throttle":1,"turn":0,"turretTu
70 {"mode":"approach","best":39,"bestCost":242.32101911699675,"field":2075.3916015625,"cell":1766,"free":1} {"throttle":1,"turn":0,"turretTu
80 {"mode":"approach","best":39,"bestCost":242.11064141600636,"field":2075.3916015625,"cell":1766,"free":1} {"throttle":1,"turn":0,"turretTu
  t=5s dist=1324 A(138,453) B(1462,447) hp=125/125
  t=10s dist=1325 A(138,453) B(1462,447) hp=125/125
  t=20s dist=1325 A(138,453) B(1462,447) hp=125/125
  t=40s dist=1325 A(138,453) B(1462,447) hp=125/125
  t=60s dist=1325 A(138,453) B(1462,447) hp=125/125
… (ещё 3 строк)
````

#### `+01:10:14` Уведомление: Background command "Persona round-robin on the new behavior" completed (exit code 0)

#### `+01:10:32` Уведомление: Background command "Stat round-robin B on the new behavior" completed (exit code 0)

#### `+01:11:28` Вызов: **Bash** (Dump per-candidate costs at tick 30 on Fortresses)

````bash
cat > lab/opponents/fable/dev/dbg2.mjs <<'EOF'
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createRound, stepRound, botView } from '../../../../arena/engine.js';
const botPath = pathToFileURL(resolve('.', 'lab/opponents/fable/bot.js')).href;
const a = (await import(`${botPath}?i=a`)).default; a.tune.debug = true; a.tune.noFire = true; a.tune.dumpCosts = true;
… (скрипт, ещё 34 строк)
````

Результат:

````
0 1 -1 99 246.8 198 367 -1.77 198 bumps 0 pre 0.0 pos 246.8
1 1 -0.5 99 264.6 206 451 -0.51 24 bumps 8 pre 6.4 pos 258.2
2 1 0 99 256.9 206 526 0.75 42 bumps 4 pre 3.2 pos 253.7
3 1 0.5 99 253.4 139 546 2.01 42 bumps 4 pre 3.2 pos 250.2
4 1 1 99 251.5 58 518 3.27 198 bumps 0 pre 0.0 pos 251.5
5 0.6 -1 99 251.1 184 399 -1.77 119 bumps 0 pre 0.0 pos 251.1
6 0.6 -0.5 99 261.5 206 449 -0.51 39 bumps 3 pre 2.4 pos 259.1
7 0.6 0 99 257.5 198 507 0.75 119 bumps 0 pre 0.0 pos 257.5
8 0.6 0.5 99 246.1 139 530 2.01 119 bumps 0 pre 0.0 pos 246.1
9 0.6 1 99 244.6 89 502 3.27 119 bumps 0 pre 0.0 pos 244.6
10 0.25 -1 99 248.8 160 429 -1.77 50 bumps 0 pre 0.0 pos 248.8
11 0.25 -0.5 99 257.6 173 451 -0.51 50 bumps 0 pre 0.0 pos 257.6
12 0.25 0 99 254.3 165 476 0.75 50 bumps 0 pre 0.0 pos 254.3
13 0.25 0.5 99 247.2 139 487 2.01 50 bumps 0 pre 0.0 pos 247.2
14 0.25 1 99 249.3 117 475 3.27 50 bumps 0 pre 0.0 pos 249.3
… (ещё 25 строк)
````

#### `+01:11:05` Уведомление: Background command "Stat round-robin A on the new behavior" completed (exit code 0)

#### `+01:11:54` Вызов: **Bash** (Remove Euclidean far-penalty in approach mode and re-test)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
old="""        if (d < rMin) c += 0.12 * (rMin - d);
        else if (d > rMax) c += 0.08 * (d - rMax);
        // проекция дистанции с учётом скорости сближения: не влетать в упор"""
… (скрипт, ещё 8 строк)
````

Результат:

````
  t=3s dist=1369 A(116,481) B(1484,419) hp=125/125
  t=5s dist=1372 A(115,482) B(1485,418) hp=125/125
  t=8s dist=1376 A(113,492) B(1487,408) hp=125/125
  t=10s dist=1376 A(113,481) B(1487,419) hp=125/125
  t=20s dist=1388 A(107,483) B(1493,417) hp=125/125
  t=40s dist=1378 A(111,423) B(1489,477) hp=125/125
  t=60s dist=1378 A(111,423) B(1489,477) hp=125/125
  t=70s dist=1375 A(114,438) B(1489,477) hp=125/125
  t=80s dist=1379 A(67,340) B(1442,450) hp=102/103
winner 0 kill 85.2
````

#### `+01:12:00` Вызов: **Bash** (Dump cheapest candidates at tick 30 on Fortresses)

````bash
node lab/opponents/fable/dev/dbg2.mjs | sort -t' ' -k5 -n | head -8
````

#### `+01:12:03` Вызов: **Bash** (Show the three round-robin results)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/bni140w90.output"; echo ----; cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/bzzssshks.output"; echo ----; cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/bxcv9eddh.output" | tail -8
````

Результат:

````
3 1 0.5 99 162.1 100 540 2.19 198 bumps 0 pre 0.0 pos 162.1
27 -1 0 99 166.4 65 357 0.93 -119 bumps 0 pre 0.0 pos 166.4
39 1 0 5 166.8 85 384 0.93 -119 bumps 0 pre 0.0 pos 166.8
8 0.6 0.5 99 168.7 111 510 2.19 119 bumps 0 pre 0.0 pos 168.7
25 -1 -1 99 169.5 54 472 -1.59 -119 bumps 0 pre 0.0 pos 169.5
22 -0.6 0 99 170.7 89 389 0.93 -71 bumps 0 pre 0.0 pos 170.7
31 1 1 8 175.2 114 546 1.68 198 bumps 0 pre 0.0 pos 175.2
20 -0.6 -1 99 175.3 82 458 -1.59 -71 bumps 0 pre 0.0 pos 175.3
````

Результат:

````
Итог:
3331: +40 -16 =0
2341: +37 -19 =0
2332: +29 -27 =0
1342: +28 -27 =1
1351: +28 -28 =0
1432: +21 -34 =1
0343: +20 -36 =0
0352: +20 -36 =0

[exited with code 0]
----

Итог:
2350: +38 -18 =0
… (ещё 18 строк)
````

#### `+01:12:54` Вызов: **Bash** (Add movement momentum, re-test Fortresses, show adapt-vs-noadapt lines)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
# momentum state
old="let lastCand = -1;"
new="let lastCand = -1;\nlet lastVel = { x: 0, y: 0 };"
… (скрипт, ещё 40 строк)
````

Результат:

````
ok
  t=3s dist=1364 A(118,442) B(1482,458) hp=125/125
  t=5s dist=1358 A(122,425) B(1478,475) hp=125/125
  t=8s dist=1357 A(122,423) B(1478,477) hp=125/125
  t=10s dist=1357 A(122,422) B(1478,478) hp=125/125
  t=15s dist=1357 A(122,422) B(1478,478) hp=125/125
  t=20s dist=1357 A(122,423) B(1478,477) hp=125/125
  t=40s dist=1357 A(122,422) B(1478,478) hp=125/125
  t=60s dist=1357 A(122,422) B(1478,478) hp=125/125
  t=70s dist=1355 A(119,426) B(1472,504) hp=125/125
  t=80s dist=1212 A(203,427) B(1411,537) hp=104/83
winner 0 kill 84.2
1342 vs 1342:noadapt: 2-6-0  hp 0.13 vs 0.50  avg 33s  acc[84%/38 31%/70 2%/47 0%/26] en[78%/51 26%/91 6%/18 0%/23]
1342:noadapt vs 1342:k5: 7-1-0  hp 0.42 vs 0.01  avg 33s  acc[71%/65 35%/137 5%/41 0%/28] en[81%/42 7%/164 3%/37 7%/29]
````

#### `+01:13:03` Вызов: **Bash** (Dump cheapest candidates at tick 200 on Fortresses)

````bash
sed -i 's/for (let k = 0; k < 31; k++) {/const K = Number(process.argv[2] || 30); for (let k = 0; k <= K; k++) {/; s/if (k === 30) console.log/if (k === K) console.log/' lab/opponents/fable/dev/dbg2.mjs && node lab/opponents/fable/dev/dbg2.mjs 200 | sort -t' ' -k5 -n | head -12
````

Результат:

````
38 -1 0 5 161.2 101 477 1.68 198 bumps 0 pre 0.0 pos 161.2
7 0.6 0 99 163.3 98 508 1.68 119 bumps 0 pre -0.0 pos 163.3
2 1 0 99 164.6 93 546 1.68 119 bumps 1 pre 0.8 pos 163.8
32 -1 -1 8 167.8 57 341 0.93 -119 bumps 0 pre 4.3 pos 163.5
26 -1 -0.5 99 170.1 57 346 0.42 -119 bumps 0 pre 3.3 pos 166.8
21 -0.6 -0.5 99 172.5 77 369 0.42 -71 bumps 0 pre 3.3 pos 169.2
12 0.25 0 99 172.9 103 457 1.68 50 bumps 0 pre 0.0 pos 172.9
8 0.6 0.5 99 173.0 42 474 2.94 119 bumps 0 pre 1.7 pos 171.3
31 1 1 8 173.4 24 501 2.43 42 bumps 4 pre 3.2 pos 170.2
14 0.25 1 99 174.1 75 418 4.20 50 bumps 0 pre 0.0 pos 174.1
13 0.25 0.5 99 175.3 79 443 2.94 50 bumps 0 pre 0.0 pos 175.3
9 0.6 1 99 175.9 33 415 4.20 119 bumps 0 pre 4.5 pos 171.4
````

#### `+01:13:44` Вызов: **Bash** (Fix corridor traversal terms and re-test all maps with pacifists)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
old="""          if (fv > rMin + 40) {
            const dd = descentDir(f, x, y);
            c -= 0.07 * (Math.cos(hd) * sp * dd.x + Math.sin(hd) * sp * dd.y);
… (скрипт, ещё 25 строк)
````

Результат:

````
ok
map 2
  t=3s dist=1476 A(70,555) B(1531,344) hp=125/125
  t=6s dist=1474 A(71,550) B(1531,345) hp=125/125
  t=10s dist=1474 A(71,550) B(1531,344) hp=125/125
  t=20s dist=1473 A(72,548) B(1531,345) hp=125/125
  t=60s dist=1475 A(71,551) B(1531,344) hp=125/125
  t=80s dist=1294 A(141,387) B(1435,371) hp=103/96
winner 0 kill 84.8
map 0
  t=3s dist=449 A(552,278) B(999,322) hp=125/125
  t=6s dist=408 A(158,139) B(566,122) hp=125/125
  t=10s dist=365 A(101,194) B(452,92) hp=125/125
  t=20s dist=372 A(88,137) B(459,118) hp=125/125
  t=60s dist=437 A(28,213) B(449,94) hp=125/125
… (ещё 24 строк)
````

#### `+01:14:05` Вызов: **Bash** (Dump cheapest candidates at tick 300 on Fortresses)

````bash
node lab/opponents/fable/dev/dbg2.mjs 300 | sort -t' ' -k5 -n | head -6; node lab/opponents/fable/dev/dbg.mjs 2 2>&1 | tail -2 | cut -c1-200
````

Результат:

````
38 -1 0 5 152.5 43 609 2.05 198 bumps 1 pre 0.8 pos 151.7
12 0.25 0 99 156.9 50 594 2.05 50 bumps 1 pre 0.8 pos 156.1
7 0.6 0 99 158.9 28 637 2.05 119 bumps 1 pre 0.8 pos 158.1
13 0.25 0.5 99 162.3 33 572 3.31 50 bumps 0 pre 0.0 pos 162.3
14 0.25 1 99 163.9 38 547 4.57 50 bumps 0 pre 0.0 pos 163.9
2 1 0 99 164.1 24 657 2.05 29 bumps 7 pre 5.6 pos 158.5
70 {"mode":"approach","best":38,"bestCost":151.45665468112514,"field":1903.822998046875,"cell":2163,"free":1} {"throttle":-1,"turn":0,"turretTurn":-0.03944485747792477,"fire":false} 71 555 2.05
80 {"mode":"approach","best":7,"bestCost":152.51097397933887,"field":1903.822998046875,"cell":2163,"free":1} {"throttle":0.6,"turn":0,"turretTurn":-0.04495303448503225,"fire":false} 72 553 2.05
````

#### `+01:14:21` Вызов: **Bash** (Show the rest of the candidate ranking at tick 300)

````bash
node lab/opponents/fable/dev/dbg2.mjs 300 | sort -t' ' -k5 -n | sed -n 7,20p
````

Результат:

````
32 -1 -1 8 164.2 50 471 1.31 -119 bumps 0 pre 4.3 pos 159.9
15 0 -1 99 165.2 71 555 -0.47 0 bumps 0 pre 0.0 pos 165.2
16 0 -0.5 99 165.2 71 555 0.79 0 bumps 0 pre 0.0 pos 165.2
17 0 0 99 165.2 71 555 2.05 0 bumps 0 pre 0.0 pos 165.2
18 0 0.5 99 165.2 71 555 3.31 0 bumps 0 pre 0.0 pos 165.2
19 0 1 99 165.2 71 555 4.57 0 bumps 0 pre 0.0 pos 165.2
35 1 1 14 165.3 46 570 3.36 -119 bumps 4 pre 6.4 pos 159.0
8 0.6 0.5 99 168.1 24 589 3.31 22 bumps 10 pre 8.0 pos 160.1
20 -0.6 -1 99 168.8 33 530 -0.47 -71 bumps 0 pre 0.5 pos 168.3
36 -1 -1 14 169.4 50 518 0.75 63 bumps 0 pre 1.8 pos 167.5
3 1 0.5 99 170.1 24 595 3.31 21 bumps 13 pre 10.4 pos 159.7
31 1 1 8 171.4 24 586 2.80 21 bumps 14 pre 11.2 pos 160.2
21 -0.6 -0.5 99 171.6 58 503 0.79 -71 bumps 0 pre 3.3 pos 168.4
37 -1 1 14 173.5 49 540 3.36 164 bumps 11 pre 10.6 pos 162.8
````

#### `+01:14:30` Вызов: **Bash** (Show the counter-clockwise turning candidates at tick 300)

````bash
node lab/opponents/fable/dev/dbg2.mjs 300 | awk '$1==0||$1==1||$1==6||$1==11||$1==5||$1==10'
````

Результат:

````
0 1 -1 99 180.9 66 570 -0.47 21 bumps 26 pre 20.8 pos 160.1
1 1 -0.5 99 177.0 66 584 0.79 21 bumps 26 pre 20.8 pos 156.2
5 0.6 -1 99 180.9 66 570 -0.47 21 bumps 26 pre 20.8 pos 160.1
6 0.6 -0.5 99 177.0 66 584 0.79 21 bumps 26 pre 20.8 pos 156.2
10 0.25 -1 99 180.9 66 570 -0.47 21 bumps 26 pre 20.8 pos 160.1
11 0.25 -0.5 99 177.0 66 584 0.79 21 bumps 26 pre 20.8 pos 156.2
````

#### `+01:15:22` Вызов: **Bash** (Add field-following candidate and re-test all maps)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()

# 1. waypoint helper after descentDir
old="function clearanceAt(m, x, y) {"
… (скрипт, ещё 81 строк)
````

Результат:

````
ok
map 2
  t=3s dist=1440 A(112,646) B(1493,239) hp=125/125
  t=6s dist=479 A(598,502) B(1072,435) hp=125/125
  t=10s dist=424 A(559,432) B(889,697) hp=125/125
  t=20s dist=486 A(591,387) B(836,807) hp=125/125
  t=60s dist=483 A(597,374) B(822,802) hp=125/125
  t=80s dist=470 A(590,382) B(812,797) hp=125/125
  t=100s dist=164 A(715,410) B(867,350) hp=125/125
  t=119s dist=110 A(888,367) B(956,453) hp=125/125
winner null time 120.0
map 0
  t=3s dist=474 A(604,587) B(1077,617) hp=125/125
  t=6s dist=412 A(616,727) B(1028,744) hp=125/125
  t=10s dist=467 A(574,648) B(1026,761) hp=125/125
… (ещё 25 строк)
````

#### `+01:15:56` Вызов: **Bash** (Debug zone-phase behaviour on Polygon)

````bash
cat > lab/opponents/fable/dev/dbg3.mjs <<'EOF'
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createRound, stepRound, botView } from '../../../../arena/engine.js';
const botPath = pathToFileURL(resolve('.', 'lab/opponents/fable/bot.js')).href;
const a = (await import(`${botPath}?i=a`)).default; a.tune.debug = true; a.tune.noFire = true;
… (скрипт, ещё 13 строк)
````

Результат:

````
2550 85.0s {"mode":"combat","best":26,"bestCost":-0.6518443668897624,"field":null,"cell":842,"free":1} {"throttle":-1,"turn":-0.5,"turretTurn":-0.25243427090847165,"fire":false} 846 204 hd -1.70 sp 44 zd 250 zr 473 hp 125
2565 85.5s {"mode":"combat","best":32,"bestCost":-1.001876457625453,"field":null,"cell":762,"free":1} {"throttle":-1,"turn":-1,"turretTurn":0.23017038491318167,"fire":false} 845 197 hd -1.89 sp 2 zd 257 zr 463 hp 125
2580 86.0s {"mode":"combat","best":9,"bestCost":-0.5009197001430995,"field":null,"cell":762,"free":1} {"throttle":0.6,"turn":1,"turretTurn":-0.23782644316284426,"fire":false} 846 200 hd -1.98 sp -12 zd 254 zr 453 hp 125
2595 86.5s {"mode":"combat","best":21,"bestCost":0.05644522775369959,"field":null,"cell":842,"free":1} {"throttle":-0.6,"turn":-0.5,"turretTurn":0.23095505252500595,"fire":false} 847 202 hd -1.89 sp 2 zd 252 zr 443 hp 125
2610 87.0s {"mode":"combat","best":24,"bestCost":4.335355943262802,"field":null,"cell":762,"free":1} {"throttle":-0.6,"turn":1,"turretTurn":-0.23684644346635106,"fire":false} 844 197 hd -2.17 sp 16 zd 257 zr 433 hp 125
2625 87.5s {"mode":"combat","best":21,"bestCost":-0.30177335667619465,"field":null,"cell":762,"free":1} {"throttle":-0.6,"turn":-0.5,"turretTurn":0.2298680955966034,"fire":false} 846 199 hd -2.03 sp 2 zd 255 zr 422 hp 125
2640 88.0s {"mode":"combat","best":7,"bestCost":3.2519284723898014,"field":null,"cell":762,"free":1} {"throttle":0.6,"turn":0,"turretTurn":1,"fire":false} 843 195 hd -2.31 sp 16 zd 259 zr 412 hp 125
2655 88.5s {"mode":"approach","best":39,"bestCost":4.820925984452764,"field":369.70562744140625,"cell":761,"free":1} {"throttle":1,"turn":0,"turretTurn":-1,"fire":false} 840 190 hd -2.54 sp 2 zd 263 zr 402 hp 125
2670 89.0s {"mode":"combat","best":27,"bestCost":26.12739695134403,"field":null,"cell":843,"free":1} {"throttle":-1,"turn":0,"turretTurn":-0.019302195299085247,"fire":false} 864 207 hd -2.54 sp -119 zd 252 zr 392 hp 125
2685 89.5s {"mode":"combat","best":27,"bestCost":20.280030196359206,"field":null,"cell":1005,"free":1} {"throttle":-1,"turn":0,"turretTurn":0.09731118875445803,"fire":false} 910 244 hd -2.45 sp -119 zd 233 zr 382 hp 125
2700 90.0s {"mode":"combat","best":27,"bestCost":21.905310451080243,"field":null,"cell":1167,"free":1} {"throttle":-1,"turn":0,"turretTurn":0.3254982888127946,"fire":false} 955 282 hd -2.45 sp -119 zd 229 zr 372 hp 125
2715 90.5s {"mode":"zone","best":0,"bestCost":18.36437496059414,"field":169.70562744140625,"cell":1329,"free":1} {"throttle":1,"turn":-1,"turretTurn":-0.29234008468143535,"fire":false} 996 324 hd -2.17 sp -105 zd 233 zr 362 hp 125
2730 91.0s {"mode":"zone","best":40,"bestCost":13.937978024757943,"field":169.70562744140625,"cell":1329,"free":1} {"throttle":1,"turn":-0.939286880628484,"turretTurn":0.25634783507451714,"fire":false} 990 335 hd 2.71 sp 89 zd 223 zr 352 hp 125
2745 91.5s {"mode":"combat","best":30,"bestCost":8.536511561036157,"field":null,"cell":1648,"free":1} {"throttle":1,"turn":-1,"turretTurn":0.18524292673737233,"fire":false} 962 410 hd 1.37 sp 198 zd 167 zr 342 hp 125
2760 92.0s {"mode":"zone","best":26,"bestCost":22.628673945410487,"field":156.56854248046875,"cell":1970,"free":1} {"throttle":-1,"turn":-0.5,"turretTurn":0.10532457864725264,"fire":false} 1015 485 hd 0.99 sp 142 zd 218 zr 332 hp 125
… (ещё 15 строк)
````

#### `+01:16:43` Вызов: **Bash** (Add zone hysteresis and distance term; re-test pacifists on all maps)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
old="let lastCand = -1;\nlet lastVel = { x: 0, y: 0 };"
new="let lastCand = -1;\nlet lastVel = { x: 0, y: 0 };\nlet zoneMode = false;"
assert old in s; s=s.replace(old,new,1)
… (скрипт, ещё 47 строк)
````

Результат:

````
Traceback (most recent call last):
  File "<stdin>", line 37, in <module>
AssertionError
map 0
  t=6s dist=412 A(616,727) B(1028,744) hp=125/125
  t=20s dist=473 A(565,632) B(1020,763) hp=125/125
  t=100s dist=357 A(1004,530) B(788,246) hp=0/88
winner 1 kill 100.0
map 1
  t=6s dist=350 A(630,678) B(935,506) hp=125/125
  t=20s dist=353 A(600,646) B(945,573) hp=125/125
  t=100s dist=230 A(747,606) B(887,423) hp=74/125
  t=119s dist=229 A(748,605) B(887,424) hp=74/125
winner 1 time 120.0
map 2
… (ещё 11 строк)
````

#### `+01:17:03` Вызов: **Bash** (Inspect nav positional block and zone-related lines)

````bash
grep -n "let c = 0.1 \* fieldAt(f, x, y);" -A 8 lab/opponents/fable/bot.js | head -12; grep -n "zoneMode\|const zonePen" lab/opponents/fable/bot.js | head
````

Результат:

````
783:        let c = 0.1 * fieldAt(f, x, y);
784-        const dd = descentDir(f, x, y);
785-        c -= 0.07 * ((x - me.x) * dd.x + (y - me.y) * dd.y) / (HZ * DT);
786-        const cl = clearanceAt(map, x, y);
787-        if (cl < 45) c += 0.04 * (45 - cl);
788-        c += zonePen(x, y);
789-        return c;
790-      };
791-    }
739:    const zonePen = (x, y) => {
````

#### `+01:17:19` Вызов: **Bash** (Apply zone hysteresis and distance term; re-test pacifists on all maps)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
old="let lastCand = -1;\nlet lastVel = { x: 0, y: 0 };"
new="let lastCand = -1;\nlet lastVel = { x: 0, y: 0 };\nlet zoneMode = false;"
assert old in s; s=s.replace(old,new,1)
… (скрипт, ещё 37 строк)
````

Результат:

````
ok
map 0
  t=6s dist=412 A(616,727) B(1028,744) hp=125/125
  t=20s dist=473 A(565,632) B(1020,763) hp=125/125
  t=100s dist=69 A(876,491) B(879,422) hp=100/125
  t=119s dist=60 A(871,495) B(884,436) hp=100/125
winner 1 time 120.0
map 1
  t=6s dist=350 A(630,678) B(935,506) hp=125/125
  t=20s dist=353 A(600,646) B(945,573) hp=125/125
  t=100s dist=200 A(744,605) B(868,448) hp=106/125
  t=119s dist=198 A(747,604) B(868,448) hp=106/125
winner 1 time 120.0
map 2
  t=6s dist=479 A(598,502) B(1072,435) hp=125/125
… (ещё 9 строк)
````

#### `+01:17:51` Вызов: **Bash** (Debug the Canyon zone death)

````bash
node lab/opponents/fable/dev/dbg3.mjs 3 2940 3150 | cut -c1-250
````

Результат:

````
2940 98.0s {"mode":"combat","best":7,"bestCost":28.904703826885658,"field":null,"cell":1877,"free":1} {"throttle":0.6,"turn":0,"turretTurn":-0.00514934091613295,"fire":false} 743 464 hd -2.99 sp 105 zd 59 zr 210 hp 125
2955 98.5s {"mode":"zone","best":32,"bestCost":29.21112019264936,"field":120,"cell":1794,"free":1} {"throttle":-1,"turn":-1,"turretTurn":0.02270404188511163,"fire":false} 689 443 hd -2.61 sp 63 zd 111 zr 200 hp 125
2970 99.0s {"mode":"zone","best":22,"bestCost":24.84838653184869,"field":120,"cell":1794,"free":1} {"throttle":-0.6,"turn":0,"turretTurn":-0.08766957849163688,"fire":false} 695 442 hd -3.08 sp -7 zd 105 zr 190 hp 125
2985 99.5s {"mode":"zone","best":40,"bestCost":26.707750111030208,"field":80,"cell":1796,"free":1} {"throttle":-1,"turn":-0.4083816427359461,"turretTurn":0.209233264491669,"fire":false} 732 443 hd 3.12 sp -119 zd 69 zr 180 hp 125
3000 100.0s {"mode":"combat","best":2,"bestCost":43.573638035958005,"field":null,"cell":1718,"free":1} {"throttle":1,"turn":0,"turretTurn":-0.02916231042570423,"fire":false} 769 434 hd 2.97 sp 7 zd 35 zr 170 hp 125
3015 100.5s {"mode":"combat","best":7,"bestCost":18.873894974010557,"field":null,"cell":1797,"free":1} {"throttle":0.6,"turn":0,"turretTurn":-0.42651678847662433,"fire":false} 754 442 hd 2.41 sp -7 zd 47 zr 170 hp 125
3030 101.0s {"mode":"combat","best":25,"bestCost":30.722439787574952,"field":null,"cell":1876,"free":1} {"throttle":-1,"turn":-1,"turretTurn":0.20118558220504507,"fire":false} 723 471 hd 2.31 sp 105 zd 80 zr 170 hp 125
3045 101.5s {"mode":"combat","best":8,"bestCost":28.050165766710705,"field":null,"cell":1875,"free":1} {"throttle":0.6,"turn":0.5,"turretTurn":-0.0685477632296919,"fire":false} 714 470 hd 1.19 sp -43 zd 88 zr 170 hp 125
3060 102.0s {"mode":"combat","best":8,"bestCost":30.83136051501715,"field":null,"cell":1875,"free":1} {"throttle":0.6,"turn":0.5,"turretTurn":-0.20071447020474367,"fire":false} 711 461 hd 1.33 sp -1 zd 90 zr 170 hp 125
3075 102.5s {"mode":"combat","best":29,"bestCost":11.607926531280764,"field":null,"cell":1875,"free":1} {"throttle":-1,"turn":1,"turretTurn":0.25880785256386457,"fire":false} 716 464 hd 2.22 sp -77 zd 85 zr 170 hp 125
3090 103.0s {"mode":"combat","best":2,"bestCost":12.222751926728725,"field":null,"cell":1717,"free":1} {"throttle":1,"turn":0,"turretTurn":0.36493637765916415,"fire":false} 754 430 hd 2.31 sp -119 zd 50 zr 170 hp 125
3105 103.5s {"mode":"combat","best":38,"bestCost":12.322663398177713,"field":null,"cell":1638,"free":1} {"throttle":-1,"turn":0,"turretTurn":-0.009248388707013992,"fire":false} 771 411 hd 2.31 sp -21 zd 48 zr 170 hp 125
3120 104.0s {"mode":"combat","best":8,"bestCost":15.674958642862352,"field":null,"cell":1638,"free":1} {"throttle":0.6,"turn":0.5,"turretTurn":0.25619378662319336,"fire":false} 771 411 hd 2.22 sp 49 zd 48 zr 170 hp 125
3135 104.5s {"mode":"combat","best":37,"bestCost":13.069064155537053,"field":null,"cell":1877,"free":1} {"throttle":-1,"turn":1,"turretTurn":-0.27771422583872585,"fire":false} 750 478 hd 1.71 sp 156 zd 57 zr 170 hp 125
````

#### `+01:18:09` Вызов: **Bash** (Debug the Canyon zone death with 1342 stats)

````bash
sed -i 's/const a = (await import(`${botPath}?i=a`)).default; a.tune.debug = true; a.tune.noFire = true;/const a = (await import(`${botPath}?i=a`)).default; a.tune.debug = true; a.tune.noFire = true; a.stats = { armor: 1, engine: 3, gun: 4, reload: 2 };/; s/const b = (await import(`${botPath}?i=b`)).default; b.tune.noFire = true;/const b = (await import(`${botPath}?i=b`)).default; b.tune.noFire = true; b.stats = { armor: 1, engine: 3, gun: 4, reload: 2 };/' lab/opponents/fable/dev/dbg3.mjs && node lab/opponents/fable/dev/dbg3.mjs 3 2940 3150 | cut -c1-250
````

Результат:

````
2940 98.0s {"mode":"zone","best":0,"bestCost":9.209520200626718,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":1,"turn":-1,"turretTurn":0.20282771830778537,"fire":false} 720 630 hd 0.43 sp -6 zd 197 zr 210 hp 125
2955 98.5s {"mode":"zone","best":40,"bestCost":24.08275130450703,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":0.15,"turn":-1,"turretTurn":0.16634890750156944,"fire":false} 723 630 hd 0.34 sp 8 zd 196 zr 200 hp 125
2970 99.0s {"mode":"zone","best":28,"bestCost":33.15484421503693,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":-1,"turn":0.5,"turretTurn":-0.13949112493730606,"fire":false} 729 632 hd 0.43 sp -6 zd 195 zr 190 hp 119
2985 99.5s {"mode":"zone","best":29,"bestCost":39.99841221692707,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":-1,"turn":1,"turretTurn":0.191419194996039,"fire":false} 732 633 hd 0.30 sp 8 zd 195 zr 180 hp 109
3000 100.0s {"mode":"zone","best":0,"bestCost":32.375557075246405,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":1,"turn":-1,"turretTurn":0.20200687017013816,"fire":false} 730 631 hd 0.34 sp -6 zd 194 zr 170 hp 99
3015 100.5s {"mode":"zone","best":29,"bestCost":24.9712190482478,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":-1,"turn":1,"turretTurn":-0.2056631029674984,"fire":false} 731 631 hd 0.26 sp 8 zd 194 zr 170 hp 89
3030 101.0s {"mode":"zone","best":40,"bestCost":38.08253392040532,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":0.15,"turn":-1,"turretTurn":0.20202998696478808,"fire":false} 731 631 hd 0.34 sp -6 zd 194 zr 170 hp 79
3045 101.5s {"mode":"zone","best":29,"bestCost":26.72500925335475,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":-1,"turn":1,"turretTurn":-0.20564546486200797,"fire":false} 731 631 hd 0.26 sp 8 zd 193 zr 170 hp 69
3060 102.0s {"mode":"zone","best":40,"bestCost":37.38214672785983,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":0.15,"turn":-1,"turretTurn":0.20200493922578136,"fire":false} 731 631 hd 0.34 sp -6 zd 193 zr 170 hp 59
3075 102.5s {"mode":"zone","best":29,"bestCost":25.873764572971684,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":-1,"turn":1,"turretTurn":-0.20562774280973942,"fire":false} 731 630 hd 0.26 sp 8 zd 193 zr 170 hp 49
3090 103.0s {"mode":"zone","best":40,"bestCost":35.897464540437404,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":0.15,"turn":-1,"turretTurn":0.20124806718890356,"fire":false} 731 630 hd 0.34 sp -6 zd 193 zr 170 hp 39
3105 103.5s {"mode":"zone","best":0,"bestCost":16.279713353660647,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":1,"turn":-1,"turretTurn":-0.20560993623739424,"fire":false} 731 630 hd 0.43 sp -20 zd 193 zr 170 hp 29
3120 104.0s {"mode":"zone","best":40,"bestCost":36.06876850803497,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":0.15,"turn":-1,"turretTurn":0.20200129582618032,"fire":false} 732 630 hd 0.34 sp -6 zd 193 zr 170 hp 19
3135 104.5s {"mode":"zone","best":29,"bestCost":24.184200986820414,"field":213.1370849609375,"cell":2516,"free":1} {"throttle":-1,"turn":1,"turretTurn":-0.2055920445666112,"fire":false} 732 630 hd 0.26 sp 8 zd 192 zr 170 hp 9
````

#### `+01:18:44` Вызов: **Bash** (Lower momentum speed threshold; re-test pacifists on all maps)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
old="  if (lv > 50 && Math.abs(sp) > 50) {"
new="  if (lv > 50 && Math.abs(sp) > 20) {"
assert old in s; s=s.replace(old,new,1)
… (скрипт, ещё 4 строк)
````

Результат:

````
ok
map 0
  t=6s dist=412 A(616,727) B(1028,743) hp=125/125
  t=20s dist=357 A(703,649) B(1036,780) hp=125/125
  t=100s dist=147 A(957,484) B(874,363) hp=125/125
  t=119s dist=147 A(957,484) B(874,363) hp=125/125
winner null time 120.0
map 1
  t=6s dist=311 A(627,654) B(918,545) hp=125/125
  t=20s dist=325 A(610,633) B(931,580) hp=125/125
  t=100s dist=73 A(864,475) B(844,405) hp=125/125
  t=119s dist=60 A(876,480) B(862,421) hp=125/125
winner null time 120.0
map 2
  t=6s dist=479 A(598,502) B(1072,435) hp=125/125
… (ещё 9 строк)
````

#### `+01:19:27` Вызов: **Bash** (Add heading-alignment reward in navigation modes; re-test pacifists)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
# goal direction computed once per tick, before positional definitions
old="""    let positional;
    if (mode === 'combat' || mode === 'approach') {"""
… (скрипт, ещё 35 строк)
````

Результат:

````
ok
map 0
  t=6s dist=345 A(664,560) B(964,732) hp=125/125
  t=20s dist=352 A(662,544) B(963,726) hp=125/125
  t=100s dist=65 A(862,474) B(890,415) hp=125/125
  t=119s dist=67 A(855,490) B(888,432) hp=125/125
winner null time 120.0
map 1
  t=6s dist=394 A(653,740) B(962,495) hp=125/125
  t=20s dist=314 A(651,624) B(962,581) hp=125/125
  t=100s dist=54 A(893,504) B(855,466) hp=83/125
  t=119s dist=54 A(893,504) B(855,466) hp=83/125
winner 1 time 120.0
map 2
  t=6s dist=755 A(425,105) B(1179,99) hp=125/125
… (ещё 9 строк)
````

#### `+01:19:45` Вызов: **Bash** (Debug Canyon zone phase 80-92 s with 1342 stats)

````bash
node lab/opponents/fable/dev/dbg3.mjs 3 2400 2760 | awk 'NR%2==1' | cut -c1-230
````

#### `+01:19:48` Вызов: **Bash** (Dump cheapest candidates at 95 s on Canyon)

````bash
sed -i 's/const round = createRound({ mapIndex: 2, tanks/const round = createRound({ mapIndex: Number(process.argv[3] || 2), tanks/; s/const K = Number(process.argv\[2\] || 30);/const K = Number(process.argv[2] || 30); a.stats = { armor: 1, engine: 3, gun: 4, reload: 2 }; b.stats = a.stats;/' lab/opponents/fable/dev/dbg2.mjs && node lab/opponents/fable/dev/dbg2.mjs 2850 3 | sort -t' ' -k5 -n | head -8
````

Результат:

````
2400 80.0s {"mode":"combat","best":6,"bestCost":0.5130842445946198,"field":null,"cell":2431,"free":1} {"throttle":0.6,"turn":-0.5,"turretTurn":-0.20397651947107823,"fire":false} 630 610 hd 0.95 sp -6 zd 233 zr 574 hp 125
2430 81.0s {"mode":"combat","best":29,"bestCost":-0.2254437885880197,"field":null,"cell":2431,"free":1} {"throttle":-1,"turn":1,"turretTurn":-0.2364559225605475,"fire":false} 632 611 hd 0.90 sp 22 zd 233 zr 554 hp 125
2460 82.0s {"mode":"combat","best":6,"bestCost":0.4037592164401557,"field":null,"cell":2431,"free":1} {"throttle":0.6,"turn":-0.5,"turretTurn":-0.26950632372129457,"fire":false} 633 611 hd 0.95 sp 22 zd 232 zr 534 hp 125
2490 83.0s {"mode":"combat","best":5,"bestCost":0.8282698778206984,"field":null,"cell":2431,"free":1} {"throttle":0.6,"turn":-1,"turretTurn":0.23291047324214437,"fire":false} 628 603 hd 0.95 sp -34 zd 230 zr 513 hp 125
2520 84.0s {"mode":"combat","best":5,"bestCost":0.9900935031655493,"field":null,"cell":2351,"free":1} {"throttle":0.6,"turn":-1,"turretTurn":0.22916831713985114,"fire":false} 621 594 hd 1.03 sp -34 zd 230 zr 493 hp 125
2550 85.0s {"mode":"combat","best":6,"bestCost":0.65180113665898,"field":null,"cell":2431,"free":1} {"throttle":0.6,"turn":-0.5,"turretTurn":-0.15689999483715475,"fire":false} 634 602 hd 1.16 sp -6 zd 225 zr 473 hp 125
2580 86.0s {"mode":"combat","best":33,"bestCost":0.4448271809330759,"field":null,"cell":2432,"free":1} {"throttle":-1,"turn":1,"turretTurn":-0.24820142903190395,"fire":false} 642 619 hd 1.07 sp 22 zd 231 zr 453 hp 125
2610 87.0s {"mode":"combat","best":33,"bestCost":0.5142919882691637,"field":null,"cell":2512,"free":1} {"throttle":-1,"turn":1,"turretTurn":-0.23595680512826792,"fire":false} 646 624 hd 0.99 sp 22 zd 233 zr 433 hp 125
2640 88.0s {"mode":"combat","best":33,"bestCost":0.4050773117739497,"field":null,"cell":2512,"free":1} {"throttle":-1,"turn":1,"turretTurn":-0.25145357334766927,"fire":false} 648 628 hd 0.95 sp 22 zd 234 zr 412 hp 125
2670 89.0s {"mode":"combat","best":6,"bestCost":1.4836194102427676,"field":null,"cell":2512,"free":1} {"throttle":0.6,"turn":-0.5,"turretTurn":-0.15586421942591952,"fire":false} 649 629 hd 1.03 sp -6 zd 234 zr 392 hp 125
2700 90.0s {"mode":"combat","best":10,"bestCost":1.1900772536864088,"field":null,"cell":2512,"free":1} {"throttle":0.25,"turn":-1,"turretTurn":0.24954990213288084,"fire":false} 647 626 hd 0.86 sp -34 zd 233 zr 372 hp 125
2730 91.0s {"mode":"zone","best":34,"bestCost":13.933654323445277,"field":246.274169921875,"cell":2512,"free":1} {"throttle":1,"turn":-1,"turretTurn":0.18336652205615298,"fire":false} 656 628 hd 0.73 sp 22 zd 229 zr 352 hp 125
````

Результат:

````
0 1 -1 99 26.5 773 472 -1.36 198 bumps 0 pre 14.9 pos 11.6
5 0.6 -1 99 31.9 738 494 -1.36 119 bumps 0 pre 14.9 pos 17.1
34 1 -1 14 32.5 759 523 -0.15 16 bumps 0 pre 14.8 pos 17.7
27 -1 0 99 33.3 630 435 1.16 -119 bumps 0 pre 0.6 pos 32.6
40 0.15 -1 99 33.7 712 484 -1.02 187 bumps 0 pre 14.9 pos 18.8
11 0.25 -0.5 99 36.0 700 534 -0.10 50 bumps 0 pre 16.4 pos 19.6
29 -1 1 99 37.3 728 484 3.68 -119 bumps 0 pre 17.9 pos 19.4
33 -1 1 8 37.5 690 432 1.91 -119 bumps 0 pre 14.9 pos 22.6
````

#### `+01:20:14` Вызов: **Bash** (Debug Canyon zone phase 92-103 s)

````bash
node lab/opponents/fable/dev/dbg3.mjs 3 2760 3100 | awk 'NR%2==1' | cut -c1-250
````

Результат:

````
2760 92.0s {"mode":"zone","best":0,"bestCost":10.700340029062199,"field":257.9898986816406,"cell":2593,"free":1} {"throttle":1,"turn":-1,"turretTurn":-0.24597617707323402,"fire":false} 674 643 hd 0.73 sp 22 zd 230 zr 332 hp 125
2790 93.0s {"mode":"zone","best":29,"bestCost":17.99629129206102,"field":249.70562744140625,"cell":2594,"free":1} {"throttle":-1,"turn":1,"turretTurn":0.1921775392186092,"fire":false} 689 655 hd 0.61 sp 22 zd 233 zr 311 hp 125
2820 94.0s {"mode":"zone","best":29,"bestCost":19.157340426129128,"field":269.70562744140625,"cell":2674,"free":1} {"throttle":-1,"turn":1,"turretTurn":0.17689070523247657,"fire":false} 700 661 hd 0.48 sp 22 zd 234 zr 291 hp 125
2850 95.0s {"mode":"zone","best":0,"bestCost":17.557924363391933,"field":261.4213562011719,"cell":2675,"free":1} {"throttle":1,"turn":-1,"turretTurn":-0.23230603706418307,"fire":false} 702 662 hd 0.48 sp -6 zd 234 zr 271 hp 125
2880 96.0s {"mode":"zone","best":0,"bestCost":20.000152261892556,"field":261.4213562011719,"cell":2675,"free":1} {"throttle":1,"turn":-1,"turretTurn":0.20549475201173198,"fire":false} 703 662 hd 0.48 sp -6 zd 233 zr 251 hp 125
2910 97.0s {"mode":"zone","best":5,"bestCost":29.113431709200366,"field":261.4213562011719,"cell":2675,"free":1} {"throttle":0.6,"turn":-1,"turretTurn":0.20545442114965817,"fire":false} 704 662 hd 0.48 sp -6 zd 233 zr 231 hp 122
2940 98.0s {"mode":"zone","best":0,"bestCost":36.43793960563909,"field":261.4213562011719,"cell":2675,"free":1} {"throttle":1,"turn":-1,"turretTurn":0.20545676107585384,"fire":false} 705 662 hd 0.48 sp -6 zd 233 zr 210 hp 102
2970 99.0s {"mode":"zone","best":5,"bestCost":44.2617557459626,"field":261.4213562011719,"cell":2675,"free":1} {"throttle":0.6,"turn":-1,"turretTurn":0.20545542333721492,"fire":false} 706 663 hd 0.48 sp -6 zd 232 zr 190 hp 82
3000 100.0s {"mode":"zone","best":5,"bestCost":44.878123554722706,"field":261.4213562011719,"cell":2675,"free":1} {"throttle":0.6,"turn":-1,"turretTurn":0.20545038305315813,"fire":false} 707 663 hd 0.48 sp -6 zd 232 zr 170 hp 62
3030 101.0s {"mode":"zone","best":5,"bestCost":44.86517163763091,"field":261.4213562011719,"cell":2675,"free":1} {"throttle":0.6,"turn":-1,"turretTurn":0.20544161578478018,"fire":false} 708 663 hd 0.48 sp -6 zd 232 zr 170 hp 42
3060 102.0s {"mode":"zone","best":29,"bestCost":51.59002077731602,"field":261.4213562011719,"cell":2675,"free":1} {"throttle":-1,"turn":1,"turretTurn":0.17931912866311195,"fire":false} 718 666 hd 0.31 sp 22 zd 231 zr 170 hp 22
3090 103.0s {"mode":"zone","best":2,"bestCost":19.247242601574765,"field":214.85281372070312,"cell":2517,"free":1} {"throttle":1,"turn":0,"turretTurn":0.016898942889308013,"fire":false} 756 627 hd -1.14 sp 106 zd 183 zr 170 hp 2
````

#### `+01:20:40` Вызов: **Bash** (Dump top candidates on consecutive ticks at 96 s on Canyon)

````bash
for k in 2880 2881 2882; do echo "tick $k"; node lab/opponents/fable/dev/dbg2.mjs $k 3 | sort -t' ' -k5 -n | head -4; done
````

Результат:

````
tick 2880
12 0.25 0 99 30.7 785 493 -0.61 50 bumps 0 pre 14.8 pos 15.8
11 0.25 -0.5 99 32.3 761 479 -1.87 50 bumps 0 pre 14.8 pos 17.5
17 0 0 99 34.1 751 517 -0.61 0 bumps 0 pre 14.8 pos 19.3
16 0 -0.5 99 35.1 751 517 -1.87 0 bumps 0 pre 14.8 pos 20.3
tick 2881
12 0.25 0 99 29.6 787 492 -0.61 50 bumps 0 pre 14.8 pos 14.8
11 0.25 -0.5 99 32.6 763 478 -1.87 50 bumps 0 pre 14.8 pos 17.8
17 0 0 99 34.4 752 516 -0.61 0 bumps 0 pre 14.8 pos 19.6
16 0 -0.5 99 35.5 752 516 -1.87 0 bumps 0 pre 14.8 pos 20.6
tick 2882
12 0.25 0 99 29.9 788 491 -0.61 50 bumps 0 pre 14.8 pos 15.1
11 0.25 -0.5 99 32.8 764 477 -1.87 50 bumps 0 pre 14.8 pos 18.0
17 0 0 99 34.7 753 515 -0.61 0 bumps 0 pre 14.8 pos 19.9
16 0 -0.5 99 35.8 753 515 -1.87 0 bumps 0 pre 14.8 pos 20.9
````

#### `+01:21:23` Вызов: **Bash** (Strengthen low-speed hysteresis, drop flip-flop candidates, run zone check on all maps)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
old="""CANDS.push({ th: -1, tu: 0, n: 5, th2: 1, tu2: 0 });
CANDS.push({ th: 1, tu: 0, n: 5, th2: -1, tu2: 0 });
"""
… (скрипт, ещё 34 строк)
````

Результат:

````
ok
1342 Полигон zone dmg 0 / 0 time 120
1342 Лабиринт zone dmg 0 / 0 time 120
1342 Крепости zone dmg 0 / 0 time 120
1342 Каньон zone dmg 51 / 60 time 120
3331 Полигон zone dmg 0 / 0 time 120
3331 Лабиринт zone dmg 0 / 0 time 120
3331 Крепости zone dmg 0 / 0 time 120
3331 Каньон zone dmg 7 / 0 time 120
2350 Полигон zone dmg 0 / 0 time 120
2350 Лабиринт zone dmg 0 / 0 time 120
2350 Крепости zone dmg 0 / 0 time 120
2350 Каньон zone dmg 14 / 53 time 120
````

#### `+01:22:33` Вызов: **Bash** (Tighten kit-vs-zone rule, remove debug hooks, re-check Canyon zone damage)

````bash
python - <<'EOF'
p='lab/opponents/fable/bot.js'
s=open(p,encoding='utf-8').read()
old="      if (Math.hypot(k.x - CX, k.y - CY) > zoneAtArrival + 30) continue; // аптечка уже вне зоны"
new="      if (Math.hypot(k.x - CX, k.y - CY) > zoneAtArrival - (time > 55 ? 15 : -30)) continue; // аптечка уже вне зоны"
assert old in s; s=s.replace(old,new,1)
… (скрипт, ещё 18 строк)
````

Результат:

````
ok
1342 Каньон zone dmg 51 / 60 time 120
3331 Каньон zone dmg 7 / 0 time 120
2350 Каньон zone dmg 14 / 53 time 120
````

#### `+01:23:12` Вызов: **Bash** (Final stat round-robin, 16 rounds per pair) [в фоне]

````bash
node lab/opponents/fable/dev/tourney.mjs rr 3331,2341,2350,3322,2332,1342 16 2>&1 | tail -8
````

#### `+01:23:14` Вызов: **Bash** (Adaptive vs fixed range check, 16 rounds) [в фоне]

````bash
node lab/opponents/fable/dev/tourney.mjs rr 2341,2341:noadapt,2341:trigger 16 2>&1 | tail -6
````

#### `+01:23:16` Вызов: **Bash** (CLI sanity runs: Hunter, Dummy, mirror) [в фоне]

````bash
node arena/cli.mjs lab/opponents/fable 2>&1 | tail -6; node arena/cli.mjs lab/opponents/fable --vs dummy 2>&1 | tail -5; node arena/cli.mjs lab/opponents/fable --vs lab/opponents/fable 2>&1 | tail -5
````

Результат:

````
Command running in background with ID: borsi6qdg. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\borsi6qdg.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

Результат:

````
Command running in background with ID: br5owf8p1. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\br5owf8p1.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

Результат:

````
Command running in background with ID: baz2eao3n. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\baz2eao3n.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

#### `+01:23:23` Вызов: **Bash** (Check module exports and TUNE usages)

````bash
wc -l lab/opponents/fable/bot.js && grep -n "TUNE\.\|tune:" lab/opponents/fable/bot.js && node -e "import('./lab/opponents/fable/bot.js').then(m=>console.log(Object.keys(m.default), JSON.stringify(m.default.stats)))"
````

Результат:

````
874 lab/opponents/fable/bot.js
578:  tune: TUNE,
664:        tables.push(bulletTable(vb, walls, 0, TUNE.virtual));
717:    const endgame = s.timeLeft < TUNE.endgame;
719:    let rMin = TUNE.rMin, rMax = TUNE.rMax;
720:    if (TUNE.adapt && s.tick % 30 === 0) bandIdx = chooseBand(me, en);
721:    if (TUNE.adapt && bandIdx >= 0) { rMin = BANDS[bandIdx][0]; rMax = BANDS[bandIdx][1]; }
864:        fire = shotT <= TUNE.fireT || closeIn || (enemySlow && shotT < 1.1) || (p >= 0.3 && shotT < 1.1) || (holdTicks > 24 && shotT < 1.2);
868:    if (TUNE.noFire) fire = false;
[ 'name', 'motto', 'stats', 'tune', 'init', 'tick' ] {"armor":1,"engine":4,"gun":3,"reload":2}
````

#### `+01:23:21` Уведомление: Background command "CLI sanity runs: Hunter, Dummy, mirror" completed (exit code 0)

#### `+01:23:29` Вызов: **Bash** (Show CLI sanity results)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/baz2eao3n.output"
````

Результат:

````
Итог: 6 побед, 2 поражений, 0 ничьих
Урон нанесён 1347, получен 418, точность 68%, урон себе 0
Ртуть: tick в среднем 0.215 мс, максимум 9.4 мс, ошибок 0
Охотник: tick в среднем 0.009 мс, максимум 3.2 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)

Урон нанесён 1180, получен 0, точность 71%, урон себе 0
Ртуть: tick в среднем 0.179 мс, максимум 7.8 мс, ошибок 0
Манекен: tick в среднем 0.000 мс, максимум 0.0 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)

Урон нанесён 1074, получен 554, точность 25%, урон себе 0
Ртуть: tick в среднем 0.164 мс, максимум 7.7 мс, ошибок 0
Ртуть: tick в среднем 0.164 мс, максимум 6.2 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)
… (ещё 3 строк)
````

> **СЧЁТ** песочница: 6:2

#### `+01:23:29` Уведомление: Background command "Adaptive vs fixed range check, 16 rounds" completed (exit code 0)

#### `+01:23:36` Вызов: **Bash** (Show adapt check and per-round results against Hunter)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/br5owf8p1.output"; cd /c/tank-arena/contestants/opus && node arena/cli.mjs lab/opponents/fable 2>&1 | grep "Раунд"
````

Результат:

````
2341:noadapt vs 2341:trigger: 15-1-0  hp 0.54 vs 0.01  avg 13s  acc[78%/72 14%/365 2%/251 1%/75] en[60%/63 6%/456 2%/170 2%/49]

Итог:
2341:noadapt: +24 -8 =0
2341:trigger: +15 -17 =0
2341: +9 -23 =0

[exited with code 0]
Раунд  1 · Полигон   · ты слева  · ПОБЕДА ·  12.4с уничтожение · HP 125/125 vs 0/175 · точность 55%
Раунд  2 · Лабиринт  · ты справа · ПОБЕДА ·  10.7с уничтожение · HP 97/125 vs 0/175 · точность 75%
Раунд  3 · Крепости  · ты слева  · ПОБЕДА ·  11.8с уничтожение · HP 97/125 vs 0/175 · точность 75%
Раунд  4 · Каньон    · ты справа · ПОБЕДА ·   7.5с уничтожение · HP 97/125 vs 0/175 · точность 86%
Раунд  5 · Полигон   · ты справа · ПОБЕДА ·  10.0с уничтожение · HP 125/125 vs 0/175 · точность 67%
Раунд  6 · Лабиринт  · ты слева  · ПОРАЖ. ·  14.8с уничтожение · HP 0/125 vs 43/175 · точность 44%
Раунд  7 · Крепости  · ты справа · ПОРАЖ. ·  10.5с уничтожение · HP 0/125 vs 10/175 · точность 71%
… (ещё 1 строк)
````

#### `+01:24:01` Вызов: **Bash** (Disable adaptive range band)

````bash
sed -i 's/endgame: 18, adapt: true, acc, enAcc };/endgame: 18, adapt: false, acc, enAcc };/' lab/opponents/fable/bot.js && grep -n "adapt: false" lab/opponents/fable/bot.js
````

Результат:

````
321:const TUNE = { rMin: 330, rMax: 460, virtual: 0.45, fireT: 0.62, endgame: 18, adapt: false, acc, enAcc };
````

#### `+01:23:53` Уведомление: Background command "Final stat round-robin, 16 rounds per pair" completed (exit code 0)

#### `+01:24:06` Вызов: **Bash** (Show final RR (adapt on) results)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/borsi6qdg.output"
````

#### `+01:24:08` Вызов: **Bash** (Final stat round-robin with adaptation off) [в фоне]

````bash
node lab/opponents/fable/dev/tourney.mjs rr 3331,2341,2350,3322,2332,1342 12 2>&1 | tail -8
````

#### `+01:24:10` Вызов: **Bash** (CLI runs with adaptation off: Hunter, Dummy, mirror) [в фоне]

````bash
node arena/cli.mjs lab/opponents/fable 2>&1 | tail -13; node arena/cli.mjs lab/opponents/fable --vs dummy 2>&1 | tail -4; node arena/cli.mjs lab/opponents/fable --vs lab/opponents/fable 2>&1 | tail -5
````

Результат:

````
Итог:
3322: +53 -26 =1
2350: +53 -27 =0
2341: +51 -29 =0
3331: +45 -35 =0
2332: +24 -55 =1
1342: +13 -67 =0

[exited with code 0]
````

Результат:

````
Command running in background with ID: blhxpsmvn. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\blhxpsmvn.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

Результат:

````
Command running in background with ID: bbg1co9oo. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\bbg1co9oo.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

### `+01:24:26` Модель

Ожидаю два фоновых прогона (турнир без адаптации и CLI-проверки); другой независимой работы не осталось.

#### `+01:24:26` Вызов: **ToolSearch** `select:Monitor`

Результат:

````
(пусто)
````

#### `+01:24:22` Уведомление: Background command "CLI runs with adaptation off: Hunter, Dummy, mirror" completed (exit code 0)

#### `+01:24:29` Вызов: **Bash** (Show CLI results with adaptation off)

````bash
cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/bbg1co9oo.output"
````

Результат:

````
Раунд  3 · Крепости  · ты слева  · ПОБЕДА ·  13.4с уничтожение · HP 97/125 vs 0/175 · точность 75%
Раунд  4 · Каньон    · ты справа · ПОБЕДА ·  10.7с уничтожение · HP 125/125 vs 0/175 · точность 60%
Раунд  5 · Полигон   · ты справа · ПОБЕДА ·  11.6с уничтожение · HP 125/125 vs 0/175 · точность 50%
Раунд  6 · Лабиринт  · ты слева  · ПОБЕДА ·  11.1с уничтожение · HP 125/125 vs 0/175 · точность 86%
Раунд  7 · Крепости  · ты справа · ПОБЕДА ·  13.0с уничтожение · HP 125/125 vs 0/175 · точность 56%
Раунд  8 · Каньон    · ты слева  · ПОБЕДА ·   7.7с уничтожение · HP 125/125 vs 0/175 · точность 71%

Итог: 8 побед, 0 поражений, 0 ничьих
Урон нанесён 1316, получен 56, точность 64%, урон себе 0
Ртуть: tick в среднем 0.196 мс, максимум 7.5 мс, ошибок 0
Охотник: tick в среднем 0.008 мс, максимум 3.9 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)

Ртуть: tick в среднем 0.180 мс, максимум 6.7 мс, ошибок 0
Манекен: tick в среднем 0.000 мс, максимум 0.0 мс, ошибок 0
… (ещё 9 строк)
````

> **СЧЁТ** песочница: 8:0

#### `+01:24:40` Вызов: **Bash** (Wait for the adaptation-off stat round-robin and print it) [в фоне]

````bash
until grep -q "exited with code" "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/blhxpsmvn.output" 2>/dev/null; do sleep 2; done; cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/blhxpsmvn.output"
````

Результат:

````
Command running in background with ID: b3hf8a08c. Output is being written to: ~\AppData\Local\Temp\claude\C--tank-arena-contestants-opus\b768e948-2494-46bf-a3c5-14fa64e13397\tasks\b3hf8a08c.output. You will be notified when it completes. To check interim output, use Read on that file path.
````

#### `+01:24:50` Вызов: **Bash** (Wait for the round-robin waiter to finish and print its output)

````bash
until grep -q "exited with code" "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/b3hf8a08c.output" 2>/dev/null; do sleep 3; done; cat "~/AppData/Local/Temp/claude/C--tank-arena-contestants-opus/b768e948-2494-46bf-a3c5-14fa64e13397/tasks/b3hf8a08c.output"
````

Результат:

````
Итог:
2350: +51 -8 =1
1342: +35 -24 =1
2341: +35 -25 =0
3331: +25 -35 =0
2332: +18 -42 =0
3322: +15 -45 =0

[exited with code 0]

[exited with code 0]
````

#### `+01:27:42` Уведомление: Background command "Final stat round-robin with adaptation off" completed (exit code 0)

#### `+01:27:43` Уведомление: Background command "Wait for the adaptation-off stat round-robin and print it" completed (exit code 0)

#### `+01:27:55` Вызов: **Bash** (Set final stats 2/3/5/0)

````bash
sed -i 's/  stats: { armor: 1, engine: 4, gun: 3, reload: 2 },/  stats: { armor: 2, engine: 3, gun: 5, reload: 0 },/' lab/opponents/fable/bot.js && grep -n "stats: {" lab/opponents/fable/bot.js
````

Результат:

````
577:  stats: { armor: 2, engine: 3, gun: 5, reload: 0 },
````

#### `+01:28:00` Вызов: **Bash** (Final check against Hunter)

````bash
node arena/cli.mjs lab/opponents/fable 2>&1 | tail -14
````

#### `+01:28:02` Вызов: **Bash** (Final check against Dummy)

````bash
node arena/cli.mjs lab/opponents/fable --vs dummy 2>&1 | tail -6
````

#### `+01:28:03` Вызов: **Bash** (Final mirror check)

````bash
node arena/cli.mjs lab/opponents/fable --vs lab/opponents/fable 2>&1 | tail -14
````

Результат:

````
Раунд  2 · Лабиринт  · ты справа · ПОБЕДА ·   9.8с уничтожение · HP 150/150 vs 0/175 · точность 83%
Раунд  3 · Крепости  · ты слева  · ПОБЕДА ·  15.6с уничтожение · HP 150/150 vs 0/175 · точность 63%
Раунд  4 · Каньон    · ты справа · ПОБЕДА ·  13.5с уничтожение · HP 150/150 vs 0/175 · точность 50%
Раунд  5 · Полигон   · ты справа · ПОБЕДА ·  11.2с уничтожение · HP 150/150 vs 0/175 · точность 63%
Раунд  6 · Лабиринт  · ты слева  · ПОБЕДА ·   9.3с уничтожение · HP 150/150 vs 0/175 · точность 75%
Раунд  7 · Крепости  · ты справа · ПОБЕДА ·  12.8с уничтожение · HP 150/150 vs 0/175 · точность 57%
Раунд  8 · Каньон    · ты слева  · ПОБЕДА ·  12.1с уничтожение · HP 150/150 vs 0/175 · точность 44%

Итог: 8 побед, 0 поражений, 0 ничьих
Урон нанесён 1298, получен 0, точность 61%, урон себе 0
Ртуть: tick в среднем 0.265 мс, максимум 13.3 мс, ошибок 0
Охотник: tick в среднем 0.011 мс, максимум 4.0 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)
````

> **СЧЁТ** песочница arena/cli.mjs: Ртуть 8:0 против Охотник

Результат:

````
Итог: 8 побед, 0 поражений, 0 ничьих
Урон нанесён 1180, получен 0, точность 74%, урон себе 0
Ртуть: tick в среднем 0.267 мс, максимум 12.5 мс, ошибок 0
Манекен: tick в среднем 0.000 мс, максимум 0.0 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)
````

> **СЧЁТ** песочница arena/cli.mjs: Ртуть 8:0 против Манекен

Результат:

````
Раунд  2 · Лабиринт  · ты справа · ПОБЕДА ·  83.0с уничтожение · HP 64/150 vs 0/150 · точность 13% · урон себе 43
Раунд  3 · Крепости  · ты слева  · ПОРАЖ. ·  57.5с уничтожение · HP 0/150 vs 150/150 · точность 3%
Раунд  4 · Каньон    · ты справа · ПОБЕДА ·  93.0с уничтожение · HP 107/150 vs 0/150 · точность 7%
Раунд  5 · Полигон   · ты справа · ПОРАЖ. ·  57.5с уничтожение · HP 0/150 vs 150/150 · точность 3%
Раунд  6 · Лабиринт  · ты слева  · ПОБЕДА ·  55.9с уничтожение · HP 150/150 vs 0/150 · точность 15%
Раунд  7 · Крепости  · ты справа · ПОБЕДА ·  93.1с уничтожение · HP 150/150 vs 0/150 · точность 13%
Раунд  8 · Каньон    · ты слева  · ПОРАЖ. ·  96.8с уничтожение · HP 0/150 vs 64/150 · точность 10%

Итог: 4 побед, 4 поражений, 0 ничьих
Урон нанесён 1610, получен 1345, точность 9%, урон себе 43
Ртуть: tick в среднем 0.204 мс, максимум 20.6 мс, ошибок 0
Ртуть: tick в среднем 0.197 мс, максимум 23.0 мс, ошибок 0
(один тик = 33.3 мс игрового времени; лимит на ход в браузере — 50 мс)
````

> **СЧЁТ** песочница arena/cli.mjs: Ртуть 4:4 против Ртуть

#### `+01:28:40` Вызов: **Bash** (Trace a 2350 mirror round on Polygon to see the 57 s kill)

````bash
node lab/opponents/fable/dev/trace.mjs 0 2350 2350 2>&1 | grep -E "HIT|kit|winner|t=(40|45|50|55)s" | head -30
````

Результат:

````
16.10s HIT on 1 -43 dist=319 hp=150/107
16.33s HIT on 0 -43 dist=342 hp=107/107
18.30s kit by 1 +43
20.73s kit by 0 +43
36.63s HIT on 1 -43 dist=364 hp=150/107
37.90s HIT on 1 -43 dist=367 hp=150/64
39.23s HIT on 1 -43 dist=386 hp=150/21
  t=40s dist=358 A(1094,232) B(744,155) hp=150/21
40.77s kit by 1 +50
  t=45s dist=353 A(865,751) B(1118,504) hp=150/71
45.37s kit by 0 +0
  t=50s dist=467 A(483,407) B(779,769) hp=150/71
  t=55s dist=375 A(872,209) B(516,327) hp=150/71
57.60s HIT on 0 -43 dist=392 hp=107/71
60.03s HIT on 0 -43 dist=227 hp=64/71
… (ещё 5 строк)
````

#### `+01:28:52` Вызов: **Bash** (Remove dev harness, list final files, confirm module loads without imports)

````bash
rm -rf lab/opponents/fable/dev && ls -la lab/opponents/fable && node -e "import('./lab/opponents/fable/bot.js').then(m=>console.log(m.default.name, '|', m.default.motto, '|', JSON.stringify(m.default.stats)))" && grep -c "import " lab/opponents/fable/bot.js
````

Результат:

````
total 44
drwxr-xr-x 1 user 197121     0 Sep 25 15:58 .
drwxr-xr-x 1 user 197121     0 Sep 25 15:27 ..
-rw-r--r-- 1 user 197121   974 Sep 25 15:28 body.svg
-rw-r--r-- 1 user 197121 36267 Sep 25 15:57 bot.js
-rw-r--r-- 1 user 197121   625 Sep 25 15:28 turret.svg
Ртуть | Бей туда, где меня уже нет. | {"armor":2,"engine":3,"gun":5,"reload":0}
0
````

#### `+01:29:14` Вызов: **SubagentHandback** (итоговый отчёт подагента для Opus)

Готово: танк «Ртуть» (девиз «Бей туда, где меня уже нет.») в C:\tank-arena\contestants\opus\lab\opponents\fable\ — bot.js (самодостаточный ES-модуль без импортов, ~870 строк), body.svg, turret.svg (серебристый клин с бирюзовыми вставками, носом вправо).

Характеристики: armor 2, engine 3, gun 5, reload 0 → 150 HP, 176 px/с, снаряд 700 px/с по 43 урона, перезарядка 1.3 с. Выбраны по круговым турнирам вариантов с одним и тем же ИИ (лучший: +51 −8 из 60 раундов против 2341/3331/3322/2332/1342): при кайтинге решает скорость снаряда (700 сложнее увернуться), а 43 урона за попадание почти обнуляют аптечку.

Стратегия: каждый тик перебираются ~39 манёвров на 0.9 с вперёд с точной моделью корпуса/стен/зоны и всех снарядов (включая рикошеты и «виртуальный» выстрел врага, когда его пушка заряжена и наведена — это заставляет менять скорость до выстрела); навигация вокруг стен по дистанционному полю (Дейкстра, сетка 20 px) плюс кандидат-«следование за полем» для узких проходов (выход из Крепостей); держит дистанцию 330–460 px (на ней уклоняется почти от всего), не влетает в упор (проекция скорости сближения), берёт и отнимает аптечки по гонке расстояний, уходит в зону с гистерезисом; стрельба с упреждением по предсказанной дуге, рикошет от стен/границ без прямой видимости, проверка «свой рикошет в себя», дальность стрельбы по накопленной статистике попаданий. Адаптивный выбор дистанции реализован, но выключен (в тестах проигрывал фиксированной 24:8).

Итог: против Охотника 8:0 (получено 0 урона за 8 раундов, точность 61%), против Манекена 8:0 без урона, зеркало 4:4 (долгие бои, решаются в зоне). Средний tick 0.2–0.27 мс, максимум ~13 мс на первом тике (построение карты). Непроверенное: на Каньоне в тестах без стрельбы танк иногда терял 10–60 HP в зоне у её края — на трёх других картах 0; временные файлы стенда (dev/) удалены.

Результат:

````
{"success":true,"message":"Report delivered to your caller."}
````

### `+01:29:19` Модель

Отчёт передан. Работа завершена: танк «Ртуть» лежит в `lab\opponents\fable\` (bot.js, body.svg, turret.svg), характеристики 2/3/5/0, против Охотника 8:0 без полученного урона, средний tick ~0.25 мс, временные файлы стенда удалены.

