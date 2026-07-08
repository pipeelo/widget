import { defineConfig, loadEnv } from 'vite';

// Build do LOADER: script clássico (IIFE) que roda na página host do cliente.
// Sai em dist/v1/loader.js com nome fixo — a URL pública é estável e o cache
// HTTP curto (max-age=300) é o mecanismo de atualização.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    publicDir: false, // o build do painel já copiou public/
    define: {
      // Inlina a env como literal: nenhum `import.meta` pode sobrar num
      // script clássico (seria SyntaxError na página host).
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL ?? 'https://api.pipeelo.com/v1'
      ),
    },
    build: {
      outDir: 'dist/v1',
      emptyOutDir: false, // preserva o build do painel
      target: 'es2017',
      minify: 'esbuild',
      reportCompressedSize: true,
      lib: {
        // O entry NÃO exporta nada: o Rollup emite `(function(){...})();`
        // puro, sem criar o global `PipeeloLoader`.
        entry: 'src/loader/index.ts',
        name: 'PipeeloLoader',
        formats: ['iife'],
        fileName: () => 'loader.js',
      },
    },
  };
});
