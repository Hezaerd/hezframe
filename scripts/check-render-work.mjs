// Checks the amount and correctness of Dock geometry work using real keyboard events.
import assert from 'node:assert/strict';
import { openPreview } from './browser.mjs';

const preview = await openPreview({ publicFonts: true });
let checks = 0;
try {
  for (const width of [1920, 1280]) {
    const page = await preview.browser.newPage({ viewport: { width, height: (width * 9) / 16 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
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
    await page.goto(preview.baseURL + '/home/');
    await page.waitForFunction(() => window.ShoreQA && ShoreQA.ready());
    const settle = () => page.waitForTimeout(350);
    const keys = async (...names) => {
      for (const key of names) await page.keyboard.press('Arrow' + key);
    };
    const reset = () =>
      page.evaluate(() => {
        window.__shelfReads = 0;
      });
    const reads = () => page.evaluate(() => window.__shelfReads);
    for (const apps of ['both', 'icons', 'text']) {
      await page.evaluate((apps) => {
        ShoreQA.look({ layout: 'dock', focus: 'glass', apps, controls: 'icons' });
        ShoreQA.nav(new Array(9).fill('left'));
      }, apps);
      await page.waitForFunction(() => ShoreQA.ready());
      await settle();
      await reset();
      await keys('Right', 'Left', 'Right', 'Left');
      await settle();
      assert.equal(
        await reads(),
        0,
        width + ' ' + apps + ': stationary shelf does no geometry polling',
      );
      checks++;
      await keys('Up');
      await settle();
      await reset();
      await keys('Right', 'Left', 'Right', 'Left');
      await settle();
      assert.equal(await reads(), 0, width + ' ' + apps + ': utility focus does no shelf polling');
      checks++;
      await keys('Down');
      for (const focus of ['glass', 'type']) {
        await page.evaluate((focus) => ShoreQA.look({ focus }), focus);
        await page.waitForFunction(() => ShoreQA.ready());
        for (const direction of ['Right', 'Left']) {
          const before = await page.locator('#track').getAttribute('style');
          await reset();
          await keys(...new Array(9).fill(direction));
          await settle();
          const moved = before !== (await page.locator('#track').getAttribute('style'));
          if (moved || focus === 'type')
            assert.ok(
              (await reads()) > 0,
              width + ' ' + apps + ' ' + focus + ': changed geometry is measured',
            );
          else
            assert.equal(await reads(), 0, width + ' ' + apps + ': fitting icons need no polling');
          const mismatch = await page.evaluate(() => {
            const box = document.querySelector('#shelf').getBoundingClientRect();
            return [...document.querySelectorAll('#dock .tile')].flatMap((tile) => {
              const mark = tile.querySelector('.mark, .label-ink');
              const r = mark.getBoundingClientRect();
              const outside = r.right <= box.left || r.left >= box.right;
              return outside === tile.classList.contains('is-outside-icon')
                ? []
                : [tile.dataset.action];
            });
          });
          assert.deepEqual(
            mismatch,
            [],
            width + ' ' + apps + ' ' + focus + ': shelf edges match visible marks',
          );
          assert.equal((await page.evaluate(() => ShoreQA.where())).focusCount, 1);
          checks += 3;
        }
      }
    }
    assert.deepEqual(errors, []);
    checks++;
    await page.close();
  }
  console.log('Render work: ' + checks + ' checks passed at 1080p and 720p.');
} finally {
  await preview.close();
}
