import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // relative asset paths, so dist/ also works opened from a subfolder
  base: './',
});
