import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' — сайт работает из любой папки, включая GitHub Pages (username.github.io/nownow/)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // Тексты уроков и библиотеки лежат в отдельных файлах: при правке интерфейса браузер не скачивает их заново
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/data/')) return 'lessons';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
});
