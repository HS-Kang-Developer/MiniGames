const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let server;
let origin;
before(async () => {
  server = spawn(process.execPath, [path.join(root, 'scripts/preview.cjs')], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
  origin = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Preview server did not start')), 10000);
    server.on('error', reject);
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
});
after(async () => {
  if (server && server.exitCode === null) {
    await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
  }
});
test('Sudoku keeps its public URL and every built asset resolves under that URL', async () => {
  const response = await fetch(origin + '/MiniGames/sudoku-game/');
  assert.equal(response.status, 200);
  const html = await response.text();
  const assets = Array.from(html.matchAll(/(?:src|href)="(\/MiniGames\/sudoku-game\/assets\/[^"]+)"/g), match => match[1]);
  assert.ok(assets.length >= 2);
  for (const asset of assets) assert.equal((await fetch(origin + asset)).status, 200, asset);
});
test('Puzzle Arena is assembled beside Sudoku with working relative assets and a blog return link', async () => {
  const base = origin + '/MiniGames/puzzle-arena/';
  const response = await fetch(base);
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const file of ['script.js', 'style.css']) assert.equal((await fetch(new URL(file, base))).status, 200);
  const back = html.match(/id="back-blog" href="([^"]+)"/)?.[1];
  assert.equal(new URL(back, base).href, origin + '/#/');
});
test('generated dist files are ignored and none are tracked', () => {
  const ignored = execFileSync('git', ['check-ignore', 'dist/sudoku-game/index.html', 'dist/puzzle-arena/index.html'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/);
  assert.equal(ignored.length, 2);
  assert.equal(execFileSync('git', ['ls-files', '--', 'dist'], { cwd: root, encoding: 'utf8' }).trim(), '');
});
