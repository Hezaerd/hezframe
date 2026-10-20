import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saved, start } from './fixture.test-support.ts';
import { reduce } from './reducer.ts';
import { top } from './state.ts';
import type { Effect, State } from './types.ts';

const devices = (effects: Effect[]) =>
  effects.filter((e) => e.kind === 'device').map((e) => (e.kind === 'device' ? e.op : null));
const writes = (effects: Effect[]) => effects.filter((e) => e.kind === 'persist').length;
const focus = (s: State) => {
  const t = top(s);
  return t.kind === 'home' ? t.zone + ':' + (t.zone === 'util' ? t.u : s.session.sel) : t.kind;
};

test('Dock moves along the apps without wrapping and Up reaches the Home controls', () => {
  const app = start();
  app.keys('right');
  assert.equal(focus(app.state()), 'apps:disneyplus');
  app.keys('right', 'right', 'right', 'right', 'right', 'right', 'right', 'right');
  assert.equal(focus(app.state()), 'apps:applemusic');
  app.keys('up');
  assert.equal(focus(app.state()), 'util:0');
  app.keys('right', 'right');
  assert.equal(focus(app.state()), 'util:1');
  app.keys('down');
  assert.equal(focus(app.state()), 'apps:applemusic');
  app.keys('up');
  assert.equal(focus(app.state()), 'util:1', 'Up returns to the last control');
});

test('List moves with Up and Down and Right reaches the controls', () => {
  const app = start(saved({ theme: 'list', lastApp: 'stremio' }));
  app.keys('up');
  assert.equal(focus(app.state()), 'apps:stremio');
  app.keys('down', 'down');
  assert.equal(focus(app.state()), 'apps:disneyplus');
  app.keys('right', 'down');
  assert.equal(focus(app.state()), 'util:1');
  app.keys('left');
  assert.equal(focus(app.state()), 'apps:disneyplus');
});

test('focus never launches; OK launches once with the native id and remembers the app', () => {
  const app = start(),
    from = app.effects.length;
  app.keys('right', 'left', 'right');
  assert.equal(devices(app.newEffects(from)).length, 0);
  app.keys('ok', 'ok');
  assert.deepEqual(devices(app.newEffects(from)), [
    { op: 'launch', appId: 'MCmYXNxgcu.DisneyPlus' },
  ]);
  assert.equal(app.state().prefs.lastApp, 'disneyplus');
  app.dispatch({ type: 'deviceDone', title: 'Disney+', error: null });
  app.keys('ok');
  assert.equal(
    devices(app.newEffects(from)).length,
    2,
    'the next OK launches again once the TV has answered',
  );
});

test('a failed launch shows the TV error and Back returns Home', () => {
  const app = start();
  app.keys('ok');
  app.dispatch({ type: 'deviceDone', title: 'Netflix', error: { message: 'App unavailable' } });
  const t = top(app.state());
  assert.ok(
    t.kind === 'message' && t.content.title === 'Netflix' && t.content.line === 'App unavailable',
  );
  app.keys('back');
  assert.equal(top(app.state()).kind, 'home');
});

test('Back on Home asks before opening Samsung Home', () => {
  const app = start(),
    from = app.effects.length;
  app.keys('back');
  assert.equal(top(app.state()).kind, 'message');
  app.keys('ok');
  assert.equal(top(app.state()).kind, 'home', 'Stay is focused first');
  app.keys('back', 'right', 'ok');
  assert.deepEqual(devices(app.newEffects(from)), [{ op: 'home' }]);
});

test('Settings arrows browse without writing; OK applies the focused value once', () => {
  const app = start();
  app.keys('up', 'right', 'ok');
  assert.equal(top(app.state()).kind, 'settings');
  app.keys('down', 'ok');
  const t = top(app.state());
  assert.ok(t.kind === 'appearance' && t.group === 'layout');
  const before = app.state().prefs,
    from = app.effects.length;
  app.keys('right', 'left', 'down', 'right', 'up');
  assert.equal(writes(app.newEffects(from)), 0);
  assert.deepEqual(app.state().prefs, before);
  app.keys('left', 'ok');
  app.settle();
  assert.equal(app.state().prefs.layout, 'list');
  assert.equal(app.stored().theme, 'list');
  app.keys('ok');
  app.settle();
  assert.equal(writes(app.newEffects(from)), 1, 'OK on the applied value does not write again');
});

test('a refused write keeps the committed Home and storage, and OK retries the same change', () => {
  const app = start();
  app.dispatch({ type: 'scene', name: 'editor' });
  app.dispatch({
    type: 'catalogLoaded',
    request: app.state().catalog.request,
    error: null,
    entries: [],
  });
  const before = app.stored();
  app.refuseWrites(true);
  app.keys('right', 'ok');
  assert.deepEqual(app.state().prefs.home, before.dock);
  assert.deepEqual(app.stored(), before);
  assert.ok(app.state().session.err);
  app.refuseWrites(false);
  app.keys('ok');
  assert.ok(!app.stored().dock.includes('netflix'));
  assert.deepEqual(app.state().prefs.recent.slice(0, 1), ['netflix']);
});

test('Apps on Home: removal, undo, the nine-app cap and the last app', () => {
  const app = start();
  app.dispatch({ type: 'scene', name: 'editor' });
  app.dispatch({
    type: 'catalogLoaded',
    request: app.state().catalog.request,
    error: null,
    entries: [{ appId: 'AbCdEf1234.FamilyApp', name: 'Family', brand: '', icon: '' }],
  });
  const full = app.state().prefs.home.slice();
  app.keys('down', 'right', 'right');
  app.keys('ok');
  assert.equal(app.state().session.note, 'Home holds nine apps. Remove one first.');
  assert.deepEqual(app.state().prefs.home, full);
  app.keys('left', 'right', 'ok');
  assert.equal(app.state().prefs.home.length, 8);
  app.keys('up', 'up', 'up', 'up', 'left', 'ok');
  assert.deepEqual(app.state().prefs.home, full, 'Undo restores the order');
  for (let i = 0; i < 9; i++) {
    app.dispatch({ type: 'scene', name: 'editor' });
    app.keys('right', 'ok');
  }
  assert.equal(app.state().prefs.home.length, 1);
  assert.equal(app.state().session.note, 'Home needs one app');
});

test('wallpaper browsing waits for focus to settle, never saves, and OK applies the photo', () => {
  const app = start();
  app.dispatch({ type: 'scene', name: 'appearance' });
  app.dispatch({ type: 'point', zone: 'detail', index: 0, id: 'background.wallpaper' });
  assert.equal(top(app.state()).kind, 'wallpaper');
  const from = app.effects.length;
  app.keys('down', 'down');
  assert.equal(
    app.newEffects(from).filter((e) => e.kind === 'loadBundle').length,
    0,
    'no photo loads while focus moves',
  );
  app.timers();
  app.settle();
  assert.equal(app.state().look.shown?.wall, 'forest');
  assert.equal(app.state().prefs.wall, 'misty');
  assert.equal(writes(app.newEffects(from)), 0);
  app.keys('ok');
  assert.equal(app.state().prefs.wall, 'forest');
  assert.equal(top(app.state()).kind, 'wallpaper', 'OK stays in the picker');
  app.keys('down');
  app.timers();
  app.settle();
  app.keys('back');
  assert.equal(app.state().look.shown?.wall, 'forest', 'Back restores the latest applied photo');
});

test('Back cancels a pending appearance change and a late load cannot apply it', () => {
  const app = start();
  app.dispatch({ type: 'scene', name: 'settings' });
  app.dispatch({ type: 'point', zone: 'row', index: 0, id: 'focus' });
  const before = app.state().prefs;
  app.dispatch({ type: 'point', zone: 'detail', index: 0, id: 'choice.material.frost' });
  assert.ok(app.state().look.pending, 'the frost material is loading');
  app.keys('back');
  assert.equal(top(app.state()).kind, 'settings');
  assert.equal(app.state().look.pending, null);
  app.settle();
  assert.deepEqual(app.state().prefs, before);
  assert.equal(app.state().look.shown?.material, 'soft');
});

test('an older load that finishes after a newer change cannot apply the older choice', () => {
  const app = start();
  app.dispatch({ type: 'look', patch: { material: 'frost' } });
  const older = app.waiting.find((e) => e.kind === 'loadBundle');
  app.dispatch({ type: 'look', patch: { material: 'tint' } });
  assert.ok(older && older.kind === 'loadBundle');
  app.waiting.splice(app.waiting.indexOf(older), 1);
  app.dispatch({ type: 'bundleLoaded', token: older.token, bundle: older.bundle, ok: true });
  for (const e of app.waiting.filter((x) => x.kind === 'frames'))
    if (e.kind === 'frames') app.dispatch(e.action);
  app.settle();
  assert.equal(app.state().prefs.material, 'tint');
  assert.deepEqual(
    app.state().look.installed,
    { wall: 'misty', material: 'tint' },
    'the photo layers show the tint material',
  );
});

test('reducing never changes the state it was given', () => {
  const app = start(),
    s = app.state();
  const frozen = JSON.stringify({ ...s, apps: [...s.apps] });
  reduce(s, { type: 'key', key: 'right' });
  reduce(s, { type: 'scene', name: 'editor' });
  assert.equal(JSON.stringify({ ...s, apps: [...s.apps] }), frozen);
});
