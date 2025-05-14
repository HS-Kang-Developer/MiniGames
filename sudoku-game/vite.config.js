import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  base: '/MiniGames/sudoku-game/',
  build: {
    outDir: resolve(__dirname, '../dist/sudoku-game')
  },
  plugins: [react()],
});
