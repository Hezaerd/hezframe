import assert from 'node:assert/strict';
import { openPreview } from './browser.mjs';
const preview = await openPreview({ publicFonts: true });
const expected = ['stremio', 'youtube', 'netflix', 'disneyplus', 'primevideo', 'appletv'];
try {
  const page = await preview.browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(preview.baseURL + '/home/');
  await page.waitForFunction(() => window.ShoreQA && ShoreQA.state().shown);
  assert.deepEqual(await page.evaluate(() => ShoreQA.state().home), expected);
  await page.evaluate(() => localStorage.setItem('cleanframe.home.v1', JSON.stringify({ wallpaperConfigVersion: 1, home: ['stremio', 'primevideo', 'appletv'], look: { bg: 'photo', wall: 'forest', layout: 'list', apps: 'text', font: 'geist' } })));
  await page.reload();
  await page.waitForFunction(() => window.ShoreQA && ShoreQA.state().shown);
  let state = await page.evaluate(() => ShoreQA.state());
  assert.deepEqual(state.home, expected);
  assert.equal(state.wall, 'forest');
  assert.equal(state.font, 'geist');
  await page.evaluate(() => { const key = 'cleanframe.home.v1'; const saved = JSON.parse(localStorage.getItem(key)); saved.home = ['youtube', 'stremio']; localStorage.setItem(key, JSON.stringify(saved)); });
  await page.reload();
  await page.waitForFunction(() => window.ShoreQA && ShoreQA.state().shown);
  assert.deepEqual(await page.evaluate(() => ShoreQA.state().home), ['youtube', 'stremio']);
  console.log('HezFrame defaults, upgrade appearance preservation and one-time migration passed.');
} finally { await preview.close(); }
