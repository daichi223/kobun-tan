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
        'path': 'path-browserify',
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
    },
    server: {
      port: 3000,
      open: false,
    },
  };
});
