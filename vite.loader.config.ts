import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    publicDir: false,
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL ?? 'https://api.pipeelo.com/v1'
      ),
    },
    build: {
      outDir: 'dist/v1',
      emptyOutDir: false,
      target: 'es2017',
      minify: 'esbuild',
      reportCompressedSize: true,
      lib: {
        entry: 'src/loader/index.ts',
        name: 'PipeeloLoader',
        formats: ['iife'],
        fileName: () => 'loader.js',
      },
    },
  };
});
