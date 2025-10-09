// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // .env / Vercel の Environment Variables を読み込む
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
      extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    },
    build: {
      outDir: 'dist',
      target: 'es2019',
      sourcemap: true,
    },
    define: {
      // 一部ライブラリが参照する場合の対策
      'process.env': {},
      // 任意：アプリバージョンを埋め込む
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      // 任意：boolean系は文字列として注入
      'import.meta.env.VITE_AUTH_REQUIRED': JSON.stringify(env.VITE_AUTH_REQUIRED),
    },
    server: {
      port: 3000,
      open: false,
    },
  };
});
