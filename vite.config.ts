import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/v1/',
  plugins: [preact()],
  build: {
    outDir: 'dist/v1',
    target: 'es2017',
    sourcemap: false,
  },
});
