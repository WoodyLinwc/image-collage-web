import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 相对路径，方便部署到 Vercel 或任意静态托管的子目录
  base: './',
});
