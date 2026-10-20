// Compare immutable production builds without including ShoreQA's DOM-reading state report in timings.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const builds = process.argv.slice(2);
if (builds.length !== 2)
  throw new Error('Usage: node scripts/compare-navigation.mjs <before-build> <after-build>');
const types = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
};
async function serve(build) {
  const dir = resolve(build);
  const server = createServer((req, res) => {
    const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(
      dir,
      '.' + (route === '/home/' ? '/index.html' : route.replace(/^\/home/, '')),
    );
    try {
      if (!file.startsWith(dir + sep) || !statSync(file).isFile()) throw new Error('Not found');
      res.writeHead(200, {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: 'http://127.0.0.1:' + server.address().port };
}
const cases = {
  dock: [
    { layout: 'dock', focus: 'glass', apps: 'both', controls: 'icons' },
    null,
    [39, 39, 39, 37, 37, 37],
  ],
  utilities: [{ layout: 'dock', focus: 'glass', apps: 'both', controls: 'icons' }, 'up', [39, 37]],
  list: [
    { layout: 'list', focus: 'glass', apps: 'both', controls: 'icons' },
    null,
    [40, 40, 40, 38, 38, 38],
  ],
};
const percentile = (values, p) => values.toSorted((a, b) => a - b)[Math.floor(values.length * p)];
const bundleHash = (dir) =>
  createHash('sha256')
    .update(readFileSync(resolve(dir, 'shore.js')))
    .digest('hex');
const report = {
  scope:
    'Local Chromium, 1920x1080, CPU throttled 4x. Native keyboard events to the next animation-frame callback, not presentation time or a TV benchmark. Dock samples keep the shelf stationary; scrolling correctness is covered by check:render-work.',
  builds: builds.map((dir) => ({ dir, hash: bundleHash(dir) })),
  samples: [],
  errors: [],
};
const servers = await Promise.all(builds.map(serve));
const browser = await chromium.launch({ headless: true });
try {
  report.browser = browser.version();
  for (let round = 0; round < 3; round++) {
    for (const version of round % 2 ? [1, 0] : [0, 1]) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      page.on('pageerror', (error) => report.errors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem(
          'cleanframe.home.v1',
          JSON.stringify({
            wallpaperConfigVersion: 1,
            hezframeVersion: 1,
            home: [
              'stremio',
              'netflix',
              'disneyplus',
              'youtube',
              'appletv',
              'primevideo',
              'abciview',
              'sbs',
              'applemusic',
            ],
            wallpaper: 'misty',
            mode: 'fixed',
            lastApp: 'netflix',
          }),
        );
        window.__shelfReads = 0;
        const rect = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function (...args) {
          if (this.id === 'shelf') window.__shelfReads++;
          return rect.apply(this, args);
        };
      });
      await page.goto(servers[version].url + '/home/');
      await page.waitForFunction(() => window.ShoreQA && ShoreQA.ready());
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Performance.enable');
      const metrics = async () =>
        Object.fromEntries(
          (await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]),
        );
      for (const [name, [look, prep, keys]] of Object.entries(cases)) {
        await page.evaluate((look) => {
          ShoreQA.scene('home');
          ShoreQA.look(look);
        }, look);
        await page.waitForFunction(() => ShoreQA.ready());
        if (prep) await page.evaluate((key) => ShoreQA.nav(key), prep);
        await page.waitForTimeout(500);
        const before = await metrics();
        const raw = await page.evaluate(async (keys) => {
          window.__shelfReads = 0;
          const times = [];
          for (let round = 0; round < 6; round++)
            for (const keyCode of keys) {
              const start = performance.now();
              document.dispatchEvent(new KeyboardEvent('keydown', { keyCode, bubbles: true }));
              document.dispatchEvent(new KeyboardEvent('keyup', { keyCode, bubbles: true }));
              await new Promise(requestAnimationFrame);
              times.push(performance.now() - start);
              await new Promise((resolve) => setTimeout(resolve, 55));
            }
          await new Promise((resolve) => setTimeout(resolve, 250));
          return { times, shelfReads: window.__shelfReads };
        }, keys);
        const after = await metrics();
        const result = {
          round,
          version,
          name,
          p50Ms: percentile(raw.times, 0.5),
          p95Ms: percentile(raw.times, 0.95),
          shelfReads: raw.shelfReads,
          scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
          layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
          recalcMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
          focus: await page.evaluate(() => ShoreQA.where()),
          raw: raw.times,
        };
        report.samples.push(result);
        console.log(
          round +
            ' ' +
            (version ? 'after ' : 'before ') +
            name +
            ': p50 ' +
            result.p50Ms.toFixed(1) +
            'ms, p95 ' +
            result.p95Ms.toFixed(1) +
            'ms, shelf reads ' +
            result.shelfReads,
        );
      }
      await page.close();
    }
  }
} finally {
  mkdirSync('.local/qa/navigation', { recursive: true });
  writeFileSync('.local/qa/navigation/comparison.json', JSON.stringify(report, null, 2));
  await browser.close();
  await Promise.all(servers.map(({ server }) => new Promise((resolve) => server.close(resolve))));
}
if (report.errors.length > 0) throw new Error(report.errors.join('\n'));
