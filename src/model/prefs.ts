import { isAppId, pick, safeIcon } from './ids.ts';
import {
  BG_VALUES,
  CAP,
  DEFAULT_HOME,
  DISPLAY_VALUES,
  EXTRA_BRANDS,
  FOCUS_VALUES,
  FONT_IDS,
  LAYOUT_VALUES,
  LEGACY_STORAGE_KEY,
  MATERIAL_VALUES,
  MODE_IDS,
  ON_OFF,
  PRIMARY_APPS,
  PRIMARY_IDS,
  STORAGE_KEY,
} from './tables.ts';
import type { App, AppId, Env, FontId, Look, Prefs, WallId } from './types.ts';

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function primaryApps(): Map<AppId, App> {
  return new Map(
    PRIMARY_APPS.map((a) => [
      a.id,
      { id: a.id, appId: a.appId, name: a.name, brand: '', mark: true, icon: '' },
    ]),
  );
}

/** Fonts that may be saved: Manrope plus the faces this build ships. Availability is checked later. */
export function configuredFonts(env: Env): FontId[] {
  return FONT_IDS.filter((id) => id === 'manrope' || env.privateFonts.includes(id));
}

export function findWall(env: Env, id: unknown): WallId | null {
  for (const w of env.walls) if (w.id === id) return w.id;
  return null;
}

export function lookOf(c: Look): Look {
  return {
    bg: c.bg,
    wall: c.wall,
    layout: c.layout,
    apps: c.apps,
    font: c.font,
    controls: c.controls,
    focus: c.focus,
    material: c.material,
  };
}

export interface Loaded {
  saved: Json | null;
  storageOk: boolean;
}

/**
 * Reads the current key, then the 0.5 key. A version-less save predates the HezFrame migration and resets the
 * Home apps; a save from another wallpaper revision takes the configured photo and rotation.
 */
export function loadSaved(env: Env, read: (key: string) => string | null): Loaded {
  let storageOk = true;
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const raw = read(key);
      if (!raw) continue;
      const saved: unknown = JSON.parse(raw);
      if (!saved) continue;
      // The controller assigned properties to the parsed value; that threw for strings, numbers and true.
      if (typeof saved !== 'object') throw new TypeError('Saved preferences are not an object');
      if (Array.isArray(saved)) continue;
      const out: Json = { ...saved };
      if (!out.hezframeVersion) {
        out.home = [...DEFAULT_HOME];
        out.recent = [];
      }
      if (out.wallpaperConfigVersion !== env.wallRevision) {
        out.wall = env.initialWall;
        out.wallpaper = env.initialWall;
        out.mode = env.defaultRotation;
        if (isRecord(out.look)) out.look = { ...out.look, wall: env.initialWall, bg: 'photo' };
        else out.bg = 'photo';
      }
      return { saved: out, storageOk };
    } catch {
      storageOk = false;
    }
  }
  return { saved: null, storageOk };
}

/** Turns any saved object into valid preferences, registering saved native apps. */
export function cleanPrefs(env: Env, saved: Json | null, registry: Map<AppId, App>): Prefs {
  const s: Json = saved || {},
    modern = isRecord(s.look) ? s.look : s;
  const legacyList = s.theme === 'list',
    themed = !!s.theme && !legacyList;
  const records = Array.isArray(s.appRecords) ? s.appRecords : [];
  for (const a of records.slice(0, 256)) {
    if (
      !isRecord(a) ||
      !isAppId(a.id) ||
      !isAppId(a.appId) ||
      typeof a.name !== 'string' ||
      !a.name.trim() ||
      registry.has(a.id)
    )
      continue;
    const brand = typeof a.brand === 'string' && EXTRA_BRANDS.includes(a.brand) ? a.brand : '';
    registry.set(a.id, {
      id: a.id,
      appId: a.appId,
      name: a.name.slice(0, 160),
      brand,
      mark: !!brand,
      icon: safeIcon(a.icon),
    });
  }
  let home: AppId[] = [];
  for (const id of Array.isArray(s.home) ? s.home : Array.isArray(s.dock) ? s.dock : []) {
    if (!isAppId(id) || home.includes(id) || home.length >= CAP) continue;
    if (!registry.has(id) && id.indexOf('.') > 0)
      registry.set(id, {
        id,
        appId: id,
        name: id.split('.').pop() ?? '',
        brand: '',
        mark: false,
        icon: '',
      });
    if (registry.has(id)) home.push(id);
  }
  if (home.length === 0) home = [...DEFAULT_HOME];
  const recent: AppId[] = [];
  for (const id of Array.isArray(s.recent) ? s.recent : []) {
    if (
      isAppId(id) &&
      registry.has(id) &&
      !home.includes(id) &&
      !recent.includes(id) &&
      recent.length < 5
    )
      recent.push(id);
  }
  const savedWall = findWall(env, modern.wall || s.wallpaper);
  const collections = env.collections.map((c) => c.id);
  return {
    bg: pick(modern.bg, BG_VALUES, legacyList ? 'dark' : 'photo'),
    wall: savedWall || env.initialWall,
    layout: pick(modern.layout, LAYOUT_VALUES, themed ? 'dock' : 'list'),
    apps: pick(modern.apps, DISPLAY_VALUES, themed ? 'both' : 'text'),
    font: pick(modern.font, configuredFonts(env), 'manrope'),
    controls: pick(modern.controls, DISPLAY_VALUES, 'both'),
    focus: pick(modern.focus, FOCUS_VALUES, themed ? 'glass' : 'type'),
    material: pick(modern.material, MATERIAL_VALUES, 'soft'),
    home,
    recent,
    lastApp: isAppId(s.lastApp) && home.includes(s.lastApp) ? s.lastApp : home[0],
    mode: pick(s.mode, MODE_IDS, env.defaultRotation),
    cinema: pick(s.cinema, ON_OFF, env.defaults.cinema),
    crossfade: pick(s.crossfade, ON_OFF, env.defaults.crossfade),
    greeting: pick(s.greeting, ON_OFF, env.defaults.greeting),
    sounds: pick(s.sounds, ON_OFF, env.defaults.sounds),
    collection: pick(s.collection, collections, env.defaultCollection),
  };
}

/** The stored object. Old keys stay alongside the current ones so earlier builds can still read it. */
export function serialise(env: Env, c: Prefs, apps: ReadonlyMap<AppId, App>): Json {
  const out: Json = {
    ...c,
    wallpaperConfigVersion: env.wallRevision,
    hezframeVersion: 1,
    version: 2,
    look: lookOf(c),
    dock: [...c.home],
    wallpaper: c.wall,
    theme: c.layout === 'list' ? 'list' : 'shore',
  };
  const appRecords: Json[] = [];
  for (const key of [...c.home, ...c.recent]) {
    const a = apps.get(key);
    if (a && !PRIMARY_IDS.includes(key) && !appRecords.some((r) => r.id === key))
      appRecords.push({
        id: a.id,
        appId: a.appId,
        name: a.name,
        brand: a.brand || '',
        icon: a.icon || '',
      });
  }
  out.appRecords = appRecords;
  return out;
}
