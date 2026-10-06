import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' — сайт работает из любой папки, включая GitHub Pages (username.github.io/nownow/)
export default defineConfig({
  base: './',
  plugins: [react()],
});
