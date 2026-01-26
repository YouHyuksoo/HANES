/**
 * @file vite.config.ts
 * @description Vite 빌드 설정 파일
 *
 * 초보자 가이드:
 * 1. **path alias**: @/ 로 src 폴더를 참조할 수 있음
 * 2. **proxy**: /api 요청은 백엔드 서버로 프록시됨
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
