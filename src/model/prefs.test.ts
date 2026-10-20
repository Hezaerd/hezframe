import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readEnv } from '../env.ts';
import { env, saved, start } from './fixture.test-support.ts';
import { cleanPrefs, loadSaved, primaryApps, serialise } from './prefs.ts';
import { boot } from './reducer.ts';
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from './tables.ts';

const read = (values: Record<string, string>) => (key: string) => values[key] ?? null;

test('legacy List becomes Dark, List and Type, keeping order, wallpaper, rotation and last app', () => {
  const { prefs } = start(
    saved({
      theme: 'list',
      dock: ['youtube', 'netflix'],
      wallpaper: 'cove',
      mode: '15',
      lastApp: 'youtube',
    }),
  ).state();
  assert.deepEqual([prefs.bg, prefs.layout, prefs.focus], ['dark', 'list', 'type']);
  assert.deepEqual(prefs.home, ['youtube', 'netflix']);
  assert.deepEqual([prefs.wall, prefs.mode, prefs.lastApp], ['cove', '15', 'youtube']);
});

test('Glass Dock and Glass Grid become Photo, Dock and Glass', () => {
  for (const theme of ['shore', 'grid']) {
    const { prefs } = start(saved({ theme })).state();
    assert.deepEqual([prefs.bg, prefs.layout, prefs.focus], ['photo', 'dock', 'glass'], theme);
  }
});

test('a malformed current key falls back to the 0.5 key and reports storage trouble', () => {
  const loaded = loadSaved(
    env,
    read({
      [STORAGE_KEY]: '{broken',
      [LEGACY_STORAGE_KEY]: JSON.stringify(saved({ dock: ['netflix'] })),
    }),
  );
  assert.equal(loaded.storageOk, false);
  assert.deepEqual(cleanPrefs(env, loaded.saved, primaryApps()).home, ['netflix']);
});

test('a save from another wallpaper revision takes the configured photo and rotation', () => {
  const { prefs } = start(
    saved({ wallpaperConfigVersion: 0, wallpaper: 'cove', mode: 'fixed', theme: 'list' }),
  ).state();
  assert.deepEqual([prefs.wall, prefs.mode, prefs.bg], ['forest', '5', 'photo']);
});

test('a save from before HezFrame resets Home to the six default apps', () => {
  const { prefs } = start(saved({ hezframeVersion: undefined, dock: ['netflix'] })).state();
  assert.deepEqual(prefs.home, [
    'stremio',
    'youtube',
    'netflix',
    'disneyplus',
    'primevideo',
    'appletv',
  ]);
});

test('saved native apps keep their id and name, unsafe ids are dropped and Home holds nine', () => {
  const apps = primaryApps();
  const prefs = cleanPrefs(
    env,
    saved({
      dock: [
        'AbCdEf1234.FamilyApp',
        '__proto__',
        'netflix',
        'stremio',
        'youtube',
        'appletv',
        'primevideo',
        'abciview',
        'sbs',
        'applemusic',
        'disneyplus',
      ],
      appRecords: [
        { id: 'AbCdEf1234.FamilyApp', appId: 'AbCdEf1234.FamilyApp', name: 'Family <b>TV</b>' },
        { id: 'bad id', appId: 'x', name: 'Bad' },
      ],
    }),
    apps,
  );
  assert.equal(prefs.home.length, 9);
  assert.equal(prefs.home[0], 'AbCdEf1234.FamilyApp');
  assert.equal(apps.get(prefs.home[0])?.name, 'Family <b>TV</b>');
  assert.ok(!prefs.home.some((id) => id === '__proto__'));
});

test('stored preferences read back to the same committed values, with the old keys alongside', () => {
  const app = start(
    saved({
      theme: 'list',
      dock: ['netflix', 'AbCdEf1234.FamilyApp'],
      appRecords: [{ id: 'AbCdEf1234.FamilyApp', appId: 'AbCdEf1234.FamilyApp', name: 'Family' }],
    }),
  );
  const out = serialise(env, app.state().prefs, app.state().apps);
  assert.deepEqual(
    [out.dock, out.wallpaper, out.theme],
    [app.state().prefs.home, app.state().prefs.wall, 'list'],
  );
  const again = cleanPrefs(
    env,
    loadSaved(env, read({ [STORAGE_KEY]: JSON.stringify(out) })).saved,
    primaryApps(),
  );
  assert.deepEqual(again, app.state().prefs);
});

test('Each time Home opens advances the photo once per cold start, not for a first run', () => {
  assert.equal(start(saved({ mode: 'open', wallpaper: 'misty' })).state().prefs.wall, 'cove');
  assert.equal(start(saved({ mode: 'open', wallpaper: 'peaks' })).state().prefs.wall, 'misty');
  const openByDefault = readEnv(
    {
      CleanFrameWallpapers: env.walls,
      HezFrameConfig: { wallpapers: { initial: 'cove', rotation: 'open' } },
      document: { documentElement: { style: {} } },
    },
    60000,
  );
  const first = boot(openByDefault, () => null).effects[0];
  assert.ok(first.kind === 'persist' && first.prefs.mode === 'open' && first.prefs.wall === 'cove');
});

test('a refused startup write keeps the saved photo for open rotation', () => {
  const app = start(saved({ mode: 'open', wallpaper: 'misty' }), { refuseWrites: true });
  assert.equal(app.state().prefs.wall, 'misty');
  assert.equal(app.state().session.storageOk, false);
  assert.equal(app.stored().wallpaper, 'misty');
});
