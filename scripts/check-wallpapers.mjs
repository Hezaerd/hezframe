import assert from 'node:assert/strict';
import { openPreview } from './browser.mjs';
const preview = await openPreview({ publicFonts: true });
try {
  const page = await preview.browser.newPage();
  await page.addInitScript(() => {
    window.ShoreQA = { minuteMs: 150 };
  });
  await page.goto(preview.baseURL + '/home/');
  await page.waitForFunction(() => window.ShoreQA && ShoreQA.state().shown);
  assert.equal(await page.evaluate(() => ShoreQA.state().wall), 'forest');
  assert.equal(await page.evaluate(() => ShoreQA.state().mode), '5');
  await page.waitForFunction(() => ShoreQA.state().wall === 'peaks');
  await page.evaluate(() =>
    localStorage.setItem(
      'cleanframe.home.v1',
      JSON.stringify({
        hezframeVersion: 1,
        home: ['youtube'],
        mode: 'fixed',
        look: { wall: 'valley', bg: 'photo', font: 'geist', layout: 'dock' },
      }),
    ),
  );
  await page.reload();
  await page.waitForFunction(() => window.ShoreQA && ShoreQA.state().shown);
  const upgraded = await page.evaluate(() => ShoreQA.state());
  assert.equal(upgraded.wall, 'forest');
  assert.equal(upgraded.mode, '5');
  assert.deepEqual(upgraded.home, ['youtube']);
  assert.equal(upgraded.font, 'geist');
  assert.equal(upgraded.layout, 'dock');
  await page.evaluate(() => {
    const key = 'cleanframe.home.v1';
    const s = JSON.parse(localStorage.getItem(key));
    s.mode = 'fixed';
    s.look.wall = 'cove';
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForFunction(() => window.ShoreQA && ShoreQA.state().shown);
  assert.equal(await page.evaluate(() => ShoreQA.state().mode), 'fixed');
  assert.equal(await page.evaluate(() => ShoreQA.state().wall), 'cove');
  await page.route('**/config.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: "window.ShoreConfig={wallpapers:{revision:2,initial:'missing',rotation:'invalid',playlist:['missing','forest','forest','cove']}};",
    }),
  );
  await page.reload();
  await page.waitForFunction(() => window.ShoreQA && ShoreQA.state().shown);
  assert.equal(await page.evaluate(() => ShoreQA.state().wall), 'forest');
  assert.equal(await page.evaluate(() => ShoreQA.state().mode), '5');
  await page.waitForFunction(() => ShoreQA.state().wall === 'cove');
  console.log('Wallpaper playlist, rotation, invalid config recovery and one-time upgrade passed.');
} finally {
  await preview.close();
}
