import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static SPA for GitHub Pages at rotorvitals.fasl-work.com (custom domain → base '/').
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: { target: 'es2022', outDir: 'dist', sourcemap: false },
});
