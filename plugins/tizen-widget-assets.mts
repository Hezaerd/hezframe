import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

export const TV_CHROME_MAJOR = 85;

export interface TizenWidgetAssetsOptions {
  projectRoot: string;
}

export function tizenWidgetAssets({ projectRoot }: TizenWidgetAssetsOptions): Plugin {
  let config: ResolvedConfig;

  return {
    name: 'tizen-widget-assets',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    handleHotUpdate(context) {
      if (/\.(tsx?|js)$/.test(context.file)) {
        context.server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
    writeBundle() {
      const source = config.root;
      const out = resolve(source, config.build.outDir);
      for (const file of ['assets', 'style.css', 'device.js', 'config.js', 'config.xml', 'icon.png']) {
        cpSync(resolve(source, file), resolve(out, file), { recursive: true });
      }

      mkdirSync(resolve(out, 'licenses'), { recursive: true });
      for (const name of ['react', 'react-dom', 'scheduler']) {
        cpSync(resolve(projectRoot, 'node_modules', name, 'LICENSE'), resolve(out, 'licenses', name + '.txt'));
      }

      const html = readFileSync(resolve(source, 'index.html'), 'utf8')
        .replace('<script type="module" src="../src/main.tsx"></script>', '<script src="hezframe.js"></script>');
      writeFileSync(resolve(out, 'index.html'), html);
    }
  };
}
