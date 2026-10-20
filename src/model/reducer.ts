import { clamp } from './ids.ts';
import {
  bundleLoaded,
  failWallpaper,
  fontResult,
  lookCommitted,
  lookSaveFailed,
  lookSettle,
  previewDue,
  setLook,
  wallpaperSaved,
} from './look.ts';
import {
  added,
  catalogLoaded,
  extraSaved,
  goScene,
  hoverUtil,
  message,
  moved,
  norm,
  point,
  press,
  release,
  removed,
  renderNorm,
  undone,
} from './navigation.ts';
import { cleanPrefs, loadSaved, primaryApps } from './prefs.ts';
import {
  app,
  collectionById,
  draft,
  ensureSel,
  finish,
  isSheet,
  nextRotationWall,
  rotationMode,
  top,
  wallById,
  write,
  type Draft,
} from './state.ts';
import { dockGeom, dockOffset, listFirst } from './views.ts';
import type { Action, CommitIntent, Effect, Env, Prefs, State } from './types.ts';

export type Result = { state: State; effects: Effect[] };

/** Reads saved preferences and asks to write the migrated form; the startup look follows the write. */
export function boot(env: Env, read: (key: string) => string | null): Result {
  const apps = primaryApps();
  const loaded = loadSaved(env, read);
  const prefs = cleanPrefs(env, loaded.saved, apps);
  const state: State = {
    env,
    prefs,
    apps,
    catalog: { loading: false, loaded: false, error: null, request: 0, revision: 0, ids: [] },
    stack: [{ kind: 'home', zone: 'apps', u: 0 }],
    session: {
      sel: prefs.lastApp,
      selIdx: prefs.home.indexOf(prefs.lastApp),
      lastUtil: 0,
      appsFocus: null,
      settingsFocus: 'background',
      appearanceFocus: 'bg',
      detailFocus: {},
      undo: [],
      removedAt: {},
      note: null,
      err: null,
      writes: 0,
      failed: 0,
      storageOk: loaded.storageOk,
      press: null,
      busy: 0,
      nextToken: 0,
    },
    look: {
      shown: null,
      pending: null,
      error: null,
      token: 0,
      flow: null,
      installed: null,
      backdrop: null,
      committedBundle: null,
      previewBundle: null,
      wallShown: null,
      wallPending: null,
      wallError: null,
      reflow: 0,
      fontSwitch: 0,
      crossfade: null,
    },
    fonts: { metrics: {}, unavailable: [], ready: false },
    scroll: { first: 0, off: 0, photo: 0, dockOff: 0 },
    hidden: false,
    veil: 'unset',
  };
  let initial: Prefs = { ...prefs };
  // "Each time Home opens" advances once per cold start, never on a warm return.
  if (loaded.saved && initial.mode === 'open')
    initial = { ...initial, wall: nextRotationWall(env, prefs.collection, initial.wall) };
  const d = draft(state);
  write(d, initial, { kind: 'startup' });
  return finish(d);
}

export function rotationActive(s: State): boolean {
  return (
    !s.hidden &&
    top(s).kind === 'home' &&
    s.prefs.bg === 'photo' &&
    !s.look.pending &&
    rotationMode(s.prefs).min > 0 &&
    collectionById(s.env, s.prefs.collection).wallpapers.length > 1
  );
}

export function cinemaAllowed(s: State): boolean {
  return s.prefs.cinema === 'on' && top(s).kind === 'home' && !s.hidden;
}

/** Actions the old controller handled without re-rendering, so render-time normalisation does not run. */
const VISUAL: Action['type'][] = [
  'reflowEnded',
  'fontSwitchEnded',
  'crossfadeEnded',
  'veil',
  'fontsChanged',
  'releaseTimeout',
];
export function rendersAfter(action: Action): boolean {
  return VISUAL.indexOf(action.type) < 0 && !(action.type === 'visibility' && action.hidden);
}

function writeLabel(d: Draft, intent: CommitIntent): string {
  switch (intent.kind) {
    case 'remove':
      return 'Remove ' + app(d, intent.id).name + ' from Home';
    case 'add':
      return 'Add ' + app(d, intent.id).name + ' to Home';
    case 'move':
      return 'Move ' + app(d, intent.id).name;
    case 'undo':
      return 'Undo ' + intent.entry.label;
    case 'lastApp':
      return 'Last app';
    case 'wallpaper':
      return 'Wallpaper ' + wallById(d.env, intent.wall).name;
    case 'rotation':
      return 'Wallpaper rotation';
    case 'extra':
      return 'Atmosphere';
    case 'look':
      return 'Appearance';
    case 'startup':
      return 'Startup';
    default: {
      const exhaustive: never = intent;
      return exhaustive;
    }
  }
}

/** Applies a storage result: the committed prefs change only when the write succeeded. */
function persisted(d: Draft, intent: CommitIntent, prefs: Prefs, ok: boolean): void {
  if (intent.kind === 'startup') {
    if (ok) d.prefs = prefs;
    d.session.storageOk = ok;
    setLook(d, {}, { transient: true, startup: true });
    return;
  }
  d.session.storageOk = ok;
  if (ok) {
    d.prefs = prefs;
    d.session.writes++;
    d.session.err = null;
  } else {
    d.session.failed++;
    d.session.err = writeLabel(d, intent);
  }
  switch (intent.kind) {
    case 'remove':
      if (ok) removed(d, intent.id, intent.index, intent.before);
      return;
    case 'add':
      if (ok) added(d, intent.id, intent.before);
      return;
    case 'move':
      if (ok) moved(d, intent.id, intent.before);
      return;
    case 'undo':
      if (ok) undone(d, intent.entry.label);
      return;
    case 'lastApp':
      return;
    case 'wallpaper': {
      const t = top(d);
      if (ok) wallpaperSaved(d, intent.bundle);
      else if (t.kind === 'wallpaper') failWallpaper(d, t, intent.wall, true, intent.bundle);
      return;
    }
    case 'rotation':
      if (!ok)
        d.look.error = {
          type: 'save',
          patch: { mode: intent.mode },
          row: 'mode',
          transient: false,
        };
      return;
    case 'extra':
      if (ok) extraSaved(d, intent.axis, intent.value);
      else
        d.look.error = { type: 'save', patch: { [intent.axis]: intent.value }, row: intent.axis };
      return;
    case 'look':
      if (ok) lookCommitted(d, intent);
      else lookSaveFailed(d, intent);
      return;
    default: {
      const exhaustive: never = intent;
      return exhaustive;
    }
  }
}

function apply(d: Draft, a: Action): void {
  switch (a.type) {
    case 'key':
      press(d, a.key);
      return;
    case 'point':
      point(d, a.zone, a.index, a.id);
      return;
    case 'hoverUtil':
      hoverUtil(d, a.index);
      return;
    case 'look':
      setLook(d, a.patch, {});
      return;
    case 'scene':
      goScene(d, a.name);
      return;
    case 'resume':
      release(d);
      norm(d);
      return;
    case 'visibility':
      d.hidden = a.hidden;
      if (a.hidden) d.look.crossfade = null;
      else {
        release(d);
        norm(d);
      }
      return;
    case 'persisted':
      persisted(d, a.intent, a.prefs, a.ok);
      return;
    case 'deviceDone':
      release(d);
      if (a.error)
        message(
          d,
          a.title,
          a.error.message || 'The TV could not open this screen.',
          a.error.detail || '',
        );
      return;
    case 'releaseTimeout':
      if (d.session.busy === a.token) release(d);
      return;
    case 'catalogLoaded':
      catalogLoaded(d, a.request, a.error, a.entries);
      return;
    case 'bundleLoaded':
      bundleLoaded(d, a.token, a.bundle, a.ok);
      return;
    case 'fontResult':
      fontResult(d, a.token, a.ok, a.reason);
      return;
    case 'fontsChanged':
      d.fonts = { metrics: a.metrics, unavailable: a.unavailable, ready: a.ready };
      return;
    case 'lookSettle':
      lookSettle(d, a.token);
      return;
    case 'previewDue':
      previewDue(d, a.seq, a.wall);
      return;
    case 'rotate':
      if (rotationActive(d))
        setLook(
          d,
          { wall: nextRotationWall(d.env, d.prefs.collection, d.prefs.wall) },
          { row: 'bg' },
        );
      return;
    case 'reflowEnded':
      if (d.look.reflow === a.token) d.look.reflow = 0;
      return;
    case 'fontSwitchEnded':
      if (d.look.fontSwitch === a.token) d.look.fontSwitch = 0;
      return;
    case 'crossfadeEnded':
      if (d.look.crossfade && d.look.crossfade.token === a.token) d.look.crossfade = null;
      return;
    case 'veil':
      d.veil = a.dimmed ? 'dim' : 'clear';
      return;
    default: {
      const exhaustive: never = a;
      return exhaustive;
    }
  }
}

export function reduce(state: State, action: Action): Result {
  const d = draft(state);
  apply(d, action);
  return finish(d);
}

/**
 * Once per dispatch, after its actions: what the old renderer recomputed on each render.
 * Home keeps its scroll memory frozen while a sheet covers it, as it was never rendered then.
 */
export function settle(state: State): State {
  const d = draft(state);
  renderNorm(d);
  if (!isSheet(top(d).kind)) {
    const n = d.prefs.home.length,
      anchor = clamp(ensureSel(d), 0, n - 1);
    if (d.prefs.layout === 'dock') {
      const r = dockOffset(d.scroll, n, anchor, dockGeom(d.prefs.apps, n));
      d.scroll.dockOff = r.off;
      if (!d.look.reflow) {
        d.scroll.off = r.offTiles;
        d.scroll.first = r.first;
      }
    } else d.scroll.photo = listFirst(d.scroll.photo, n, anchor);
  }
  return finish(d).state;
}
