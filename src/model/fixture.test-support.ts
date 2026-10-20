import { readEnv } from '../env.ts';
import { createStore } from '../store.ts';
import { serialise } from './prefs.ts';
import { boot } from './reducer.ts';
import { STORAGE_KEY } from './tables.ts';
import type { Action, Effect, FaceMetrics, RemoteKey } from './types.ts';

const wall = (id: string, name: string) => ({
  id,
  name,
  tone: 'dark',
  ut: { tr: 'light', br: 'light' },
  frostVeil: 0.12,
});

/** A gallery and config shaped like the bundled ones, small enough to reason about in a test. */
export const env = readEnv(
  {
    CleanFrameWallpapers: [
      wall('misty', 'Misty coast'),
      wall('cove', 'Quiet cove'),
      wall('forest', 'Forest mist'),
      wall('peaks', 'High peaks'),
      wall('night', 'Desert stars'),
    ],
    CleanFramePrivateFontIDs: ['geist', 'newsreader'],
    HezFrameConfig: {
      wallpapers: {
        revision: 1,
        initial: 'forest',
        rotation: '5',
        playlist: ['misty', 'cove', 'forest', 'peaks'],
        collections: [{ id: 'coasts', name: 'Coastlines', wallpapers: ['misty', 'cove'] }],
      },
    },
    document: { documentElement: { style: { webkitMaskImage: '' } } },
  },
  60_000,
);

export const saved = (patch: Record<string, unknown> = {}) => ({
  wallpaperConfigVersion: 1,
  hezframeVersion: 1,
  dock: [
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
  theme: 'shore',
  ...patch,
});

const face: FaceMetrics = {
  roles: { display: {}, clock: {}, primary: {}, ui: {} },
  digits: [],
  digitCell: 0,
};

/**
 * The real store with the browser edges replaced: storage is a map that can refuse writes,
 * and pending loads, fonts, frames and timers resolve only when a test asks.
 */
export function start(
  stored: Record<string, unknown> | null = saved(),
  options: { refuseWrites?: boolean } = {},
) {
  const storage = new Map<string, string>();
  if (stored) storage.set(STORAGE_KEY, JSON.stringify(stored));
  let refuse = !!options.refuseWrites;
  const effects: Effect[] = [],
    waiting: Effect[] = [];
  const store = createStore(
    boot(env, (key) => storage.get(key) ?? null),
    (e, st) => {
      effects.push(e);
      if (e.kind === 'persist') {
        if (!refuse)
          storage.set(STORAGE_KEY, JSON.stringify(serialise(env, e.prefs, st.getState().apps)));
        st.dispatch({ type: 'persisted', intent: e.intent, prefs: e.prefs, ok: !refuse });
      } else waiting.push(e);
    },
    true,
  );
  const dispatch = (a: Action) => store.dispatch(a);
  /** Completes every pending image, font and frame, as a fast device would. */
  function settle(ok = true): void {
    for (let guard = 0; guard < 20; guard++) {
      const e = waiting.findIndex(
        (x) => x.kind === 'loadBundle' || x.kind === 'ensureFont' || x.kind === 'frames',
      );
      if (e === -1) return;
      const [effect] = waiting.splice(e, 1);
      if (effect.kind === 'loadBundle')
        dispatch({ type: 'bundleLoaded', token: effect.token, bundle: effect.bundle, ok });
      else if (effect.kind === 'ensureFont') {
        dispatch({
          type: 'fontsChanged',
          metrics: { ...store.getState().fonts.metrics, manrope: face, [effect.font]: face },
          unavailable: [],
          ready: true,
        });
        dispatch({ type: 'fontResult', token: effect.token, ok: true, reason: null });
      } else if (effect.kind === 'frames') dispatch(effect.action);
    }
  }
  /** Fires the timers that are due, such as the wallpaper preview delay. */
  function timers(): void {
    for (let i = waiting.length - 1; i >= 0; i--) {
      const e = waiting[i];
      if (e.kind !== 'after') continue;
      waiting.splice(i, 1);
      dispatch(e.action);
    }
  }
  settle();
  return {
    store,
    effects,
    waiting,
    settle,
    timers,
    dispatch,
    state: () => store.getState(),
    keys: (...keys: RemoteKey[]) => {
      for (const key of keys) dispatch({ type: 'key', key });
    },
    stored: () => JSON.parse(storage.get(STORAGE_KEY) || 'null'),
    refuseWrites: (v: boolean) => {
      refuse = v;
    },
    newEffects: (from: number) => effects.slice(from),
  };
}
