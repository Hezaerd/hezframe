import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tizenWidgetAssets } from './plugins/tizen-widget-assets.mts';
import { resolve } from 'node:path';

const root = process.cwd();
export default defineConfig(({ command }) => ({
  root: resolve(root, 'app'), base: './', publicDir: false,
  resolve: { alias: { '/src': resolve(root, 'src') } },
  plugins: [react(), tizenWidgetAssets({ projectRoot: root })],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: {
    outDir: resolve(root, 'dist/web'), emptyOutDir: true, target: 'chrome85',
    lib: { entry: resolve(root, 'src/main.tsx'), name: 'HezFrame', formats: ['iife'], fileName: () => 'hezframe.js' },
    sourcemap: false
  },
  define: { 'process.env.NODE_ENV': JSON.stringify(command === 'build' ? 'production' : 'development') }
}));
