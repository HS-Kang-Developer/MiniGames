const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
if (!fs.existsSync(path.join(root, 'dist/sudoku-game/index.html'))) {
  throw new Error('Build Sudoku before assembling the shared dist directory.');
}
const target = path.join(root, 'dist/puzzle-arena');
fs.mkdirSync(target, { recursive: true });
for (const name of ['index.html', 'script.js', 'style.css']) {
  fs.copyFileSync(path.join(root, 'puzzle-arena', name), path.join(target, name));
}
console.log('Puzzle Arena copied to dist/puzzle-arena; Sudoku remains in dist/sudoku-game.');
