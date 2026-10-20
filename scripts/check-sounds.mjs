// Exercise the real decoder and remote events. No TV access or audible-quality claim.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openPreview } from './browser.mjs';

const preview = await openPreview({ publicFonts: true });
const config = readFileSync('app/config.js', 'utf8').replace('idleSeconds: 60', 'idleSeconds: 1');
const errors = [];

function traceAudio() {
  const RealContext = window.AudioContext;
  const trace = (window.__audio = { decoded: 0, starts: 0, contexts: 0 });
  window.AudioContext = class extends RealContext {
    constructor(...args) {
      super(...args);
      trace.contexts++;
      trace.context = this;
    }
    decodeAudioData(bytes) {
      return super.decodeAudioData(bytes).then((buffer) => {
        trace.decoded++;
        trace.duration = buffer.duration;
        return buffer;
      });
    }
    createGain() {
      const gain = super.createGain();
      trace.gain = gain;
      return gain;
    }
    createBufferSource() {
      const source = super.createBufferSource();
      const start = source.start.bind(source);
      source.start = (...args) => {
        trace.starts++;
        return start(...args);
      };
      return source;
    }
  };
}

async function open({ broken = false, unavailable = false } = {}) {
  const page = await preview.browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(traceAudio);
  if (unavailable)
    await page.addInitScript(() => {
      window.AudioContext = undefined;
    });
  if (broken)
    await page.route('**/ui-click.mp3', (route) =>
      route.fulfill({ body: 'invalid audio', contentType: 'audio/mpeg' }),
    );
  await page.route('**/config.js', (route) =>
    route.fulfill({ body: config, contentType: 'application/javascript' }),
  );
  await page.goto(preview.baseURL + '/home/');
  await page.waitForFunction(() => window.ShoreQA && ShoreQA.ready());
  return page;
}

try {
  const page = await open();
  await page.waitForFunction(() => window.__audio.decoded === 1);
  assert.ok(await page.evaluate(() => __audio.duration > 0 && __audio.duration < 0.2));
  assert.equal(await page.evaluate(() => __audio.gain.gain.value), Math.fround(0.2));
  assert.equal(await page.evaluate(() => __audio.starts), 0, 'startup is silent');
  await page.evaluate(() => ShoreQA.scene('settings'));
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => __audio.starts), 0, 'arrows are silent');
  await page.keyboard.down('Enter');
  await page.waitForFunction(() => __audio.starts === 1);
  await page.keyboard.down('Enter');
  assert.equal(await page.evaluate(() => __audio.starts), 1, 'held OK does not repeat');
  await page.keyboard.up('Enter');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => __audio.starts === 2);
  await page.evaluate(() => {
    ShoreQA.activate('settings.group.atmosphere');
    ShoreQA.activate('choice.sounds.off');
  });
  assert.equal(await page.evaluate(() => ShoreQA.state().sounds), 'off');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => __audio.starts), 2, 'disabled sound stays silent');
  await page.reload();
  await page.waitForFunction(() => window.ShoreQA && ShoreQA.ready());
  assert.equal(
    await page.evaluate(() => ShoreQA.state().sounds),
    'off',
    'preference survives reload',
  );
  assert.equal(
    await page.evaluate(() => __audio.contexts),
    0,
    'disabled sound does not load an audio context',
  );
  await page.evaluate(() => {
    ShoreQA.scene('settings');
    ShoreQA.activate('settings.group.atmosphere');
    ShoreQA.activate('choice.sounds.on');
  });
  await page.waitForFunction(() => __audio.decoded === 1);
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(
      (width) =>
        Math.abs(document.querySelector('#stage').getBoundingClientRect().width - width) < 1,
      viewport.width,
    );
    const bounds = await page.locator('[data-action="choice.sounds.off"]').boundingBox();
    assert.ok(
      bounds && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height,
      JSON.stringify({ viewport, bounds }),
    );
    const spacing = await page.evaluate(() => ({
      contentBottom: document.querySelector('#appearanceRows').getBoundingClientRect().bottom,
      hintTop: document.querySelector('#appearanceDesc').getBoundingClientRect().top,
    }));
    assert.ok(
      spacing.contentBottom < spacing.hintTop - 4,
      'four atmosphere rows must not overlap the remote hint',
    );
  }
  await page.evaluate(() => ShoreQA.scene('home'));
  await page.waitForFunction(() => ShoreQA.state().cinemaDimmed);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => __audio.starts), 0, 'waking a dimmed Home stays silent');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => __audio.starts), 0, 'hidden app stays silent');
  await page.evaluate(async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    const audio = __audio.context;
    await audio.suspend();
    const resume = audio.resume.bind(audio);
    audio.resume = () =>
      new Promise((resolve) => {
        window.__releaseAudio = () => resume().then(resolve);
      });
  });
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    await __releaseAudio();
  });
  assert.equal(
    await page.evaluate(() => __audio.starts),
    0,
    'a delayed resume cannot replay a stale click after returning',
  );
  await page.close();

  for (const options of [{ broken: true }, { unavailable: true }]) {
    const fallback = await open(options);
    await fallback.evaluate(() => ShoreQA.scene('settings'));
    await fallback.keyboard.press('Enter');
    await fallback.waitForFunction(() => ShoreQA.state().view === 'appearance');
    await fallback.keyboard.press('Escape');
    assert.equal(await fallback.evaluate(() => ShoreQA.state().view), 'settings');
    await fallback.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    'UI sounds: real MP3 decoding, volume, OK/Back, repeat guard, silent arrows, saved switch, viewport fit, dim/hidden silence and audio-failure navigation passed.',
  );
} finally {
  await preview.close();
}
