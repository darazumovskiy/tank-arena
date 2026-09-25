// Статический сервер для браузерной проверки: node lab/browser/server.mjs [порт]
// Отдаёт папку участника; POST /result сохраняет результат в lab/browser/result.json и завершает процесс.
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const port = Number(process.argv[2] || 8765);
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/result') {
    let body = '';
    for await (const chunk of req) body += chunk;
    await writeFile(join(here, 'result.json'), body);
    res.end('ok');
    console.log('result saved');
    setTimeout(() => process.exit(0), 100);
    return;
  }
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.startsWith(root)) { res.statusCode = 403; res.end(); return; }
  try {
    const data = await readFile(path);
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404; res.end('not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}/`));
