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
          // полные версии уроков остаются отдельными файлами и скачиваются по требованию
          if (id.includes('/src/data/full/')) return undefined;
          if (id.includes('/src/data/trainers')) return 'trainers';
          if (id.includes('/src/data/legal')) return undefined;
          // тексты языковых треков скачиваются, когда человек открывает раздел «Языки»
          if (id.includes('/src/data/lang/') && !id.endsWith('meta.js')) return undefined;
          if (id.includes('/src/data/')) return 'lessons';
          // библиотека Supabase нужна только тем, кто входит в учётную запись: отдельный файл, который скачивается по требованию
          if (id.includes('node_modules/@supabase/') || id.includes('node_modules/iceberg-js/')) return 'cloud';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
});
