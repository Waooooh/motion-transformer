import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`          → dist/ (multi-file, used by the offline renderer)
// `npm run build:single`   → dist-single/index.html (everything inlined, one file)
// `npm run build:artifact` → dist-artifact/ (one file, three.js from jsDelivr)
export default defineConfig(({ mode }) => {
  const single = mode === 'single' || mode === 'artifact';
  const artifact = mode === 'artifact';
  return {
    base: './',
    plugins: single ? [viteSingleFile()] : [],
    build: {
      outDir: artifact ? 'dist-artifact' : single ? 'dist-single' : 'dist',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 4000,
      rollupOptions: artifact ? { external: ['three'] } : {},
    },
    server: { host: true },
  };
});
