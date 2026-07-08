import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Build/dev do PAINEL (app Preact dentro do iframe).
// `base: '/v1/'` faz dev e produção convergirem: o painel vive em
// {origin}/v1/ nos dois ambientes, e o loader deriva essa URL do próprio src.
export default defineConfig({
  base: '/v1/',
  plugins: [preact()],
  build: {
    outDir: 'dist/v1',
    target: 'es2017',
    sourcemap: false,
  },
});
