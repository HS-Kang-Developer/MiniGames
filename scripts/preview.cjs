const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (!pathname.startsWith('/MiniGames/')) throw new Error('Not found');
    const relative = pathname.slice('/MiniGames/'.length);
    const isTest = relative.startsWith('tests/');
    const directory = path.join(root, isTest ? 'tests' : 'dist');
    const filePart = isTest ? relative.slice('tests/'.length) : relative;
    let file = path.resolve(directory, filePart);
    if (!file.startsWith(directory + path.sep)) throw new Error('Not found');
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(fs.readFileSync(file));
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
  console.log('Preview: http://127.0.0.1:' + server.address().port + '/MiniGames/');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
