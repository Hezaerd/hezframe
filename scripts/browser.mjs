// Development only. A private preview and a fresh browser profile for each run.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const root = fileURLToPath(new URL('../', import.meta.url));

/** The TypeScript sources bundled into the widget, as root-relative paths. */
export const appSources = () =>
  readdirSync(root + 'src', { recursive: true })
    .map((f) => 'src/' + String(f).split('\\').join('/'))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test(-support)?\.ts$/.test(f))
    .toSorted();

export async function openPreview({ publicFonts = false } = {}) {
  const args = ['scripts/preview.py', '--port', '0'];
  if (publicFonts || process.env.CLEANFRAME_PUBLIC_FONTS === '1') args.push('--public-fonts');
  const server = spawn(process.platform === 'win32' ? 'python' : 'python3', args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  let diagnostics = '';
  server.stderr.on('data', (chunk) => {
    diagnostics = (diagnostics + chunk).slice(-4000);
  });
  try {
    const baseURL = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Preview startup timed out')), 10_000);
      server.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      server.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error('Preview exited: ' + code + ' ' + diagnostics));
      });
      server.stdout.on('data', (chunk) => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      });
    });
    browser = await chromium.launch({ headless: true });
    return {
      browser,
      baseURL,
      close: async () => {
        try {
          await browser.close();
        } finally {
          server.kill();
          await once(server, 'exit');
        }
      },
    };
  } catch (error) {
    server.kill();
    if (browser) await browser.close();
    throw error;
  }
}
