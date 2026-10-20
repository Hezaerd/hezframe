import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
export default defineConfig(({ command }) => ({
  root: resolve(root, 'app'), base: './', publicDir: false,
  resolve: { alias: { '/src': resolve(root, 'src') } },
  plugins: [react(), {
    name: 'tizen-widget-assets',
    handleHotUpdate(context) {
      if (/\.(tsx?|js)$/.test(context.file)) { context.server.ws.send({ type: 'full-reload' }); return []; }
    },
    closeBundle() {
      const out = resolve(root, 'dist/web');
      for (const file of ['assets', 'style.css', 'device.js', 'config.js', 'config.xml', 'icon.png']) {
        cpSync(resolve(root, 'app', file), resolve(out, file), { recursive: true });
      }
      mkdirSync(resolve(out, 'licenses'), { recursive: true });
      for (const name of ['react', 'react-dom', 'scheduler']) cpSync(resolve(root, 'node_modules', name, 'LICENSE'), resolve(out, 'licenses', name + '.txt'));
      const html = readFileSync(resolve(root, 'app/index.html'), 'utf8')
        .replace('<script type="module" src="../src/main.tsx"></script>', '<script src="hezframe.js"></script>');
      writeFileSync(resolve(out, 'index.html'), html);
    }
  }],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: {
    outDir: resolve(root, 'dist/web'), emptyOutDir: true, target: 'chrome85',
    lib: { entry: resolve(root, 'src/main.tsx'), name: 'HezFrame', formats: ['iife'], fileName: () => 'hezframe.js' },
    sourcemap: false
  },
  define: { 'process.env.NODE_ENV': JSON.stringify(command === 'build' ? 'production' : 'development') }
}));
