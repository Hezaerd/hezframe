import { clamp, pick } from './model/ids.ts';
import { MODE_IDS } from './model/tables.ts';
import type {
  Collection,
  CollectionId,
  Env,
  IconMetric,
  OnOff,
  Palette,
  PaletteZone,
  WallId,
  Wallpaper,
} from './model/types.ts';

declare global {
  interface Window {
    HezFrameConfig?: unknown;
    CleanFrameWallpapers?: unknown;
    CleanFrameAdaptiveInk?: unknown;
    FrameIconMetrics?: unknown;
    CleanFramePrivateFontIDs?: unknown;
  }
}

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const record = (v: unknown): Json => (isRecord(v) ? v : {});
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const scalar = (v: unknown): number | string | undefined =>
  typeof v === 'number' || typeof v === 'string' ? v : undefined;

function inGallery(v: unknown, gallery: ReadonlySet<string>): v is WallId {
  return typeof v === 'string' && gallery.has(v);
}
function isCollectionId(v: unknown, ids: ReadonlySet<string>): v is CollectionId {
  return typeof v === 'string' && ids.has(v);
}

const FALLBACK_WALL = {
  id: 'misty',
  name: 'Misty coast',
  tone: 'light',
  ut: { tr: 'mist', br: 'mist' },
  frostVeil: 0.2,
};

function parseWalls(raw: unknown): Wallpaper[] {
  const entries = (Array.isArray(raw) ? raw : [FALLBACK_WALL])
    .filter(isRecord)
    .filter((w) => typeof w.id === 'string');
  const gallery = new Set(entries.map((w) => String(w.id)));
  const walls: Wallpaper[] = [];
  for (const w of entries) {
    if (!inGallery(w.id, gallery)) continue;
    const ut = isRecord(w.ut) ? w.ut : null;
    walls.push({
      id: w.id,
      name: String(w.name),
      tone: String(w.tone),
      ut: ut ? { tr: String(ut.tr), br: String(ut.br) } : { tr: 'light', br: 'light' },
      frostVeil: Number(w.frostVeil) || 0.12,
      listColumn: Number(w.listColumn) || 0,
      dockQuiet: !!w.dockQuiet,
      clockMist: !!w.clockMist,
      clockInk: str(w.clockInk) || '',
      dockClockInk: str(w.dockClockInk) || '',
    });
  }
  return walls;
}

function parseZone(v: unknown): PaletteZone | undefined {
  if (!isRecord(v)) return undefined;
  return {
    pol: str(v.pol),
    ink: str(v.ink),
    clockInk: str(v.clockInk),
    restInk: str(v.restInk),
    peerInk: str(v.peerInk),
    restAlpha: scalar(v.restAlpha),
    peerAlpha: scalar(v.peerAlpha),
    halo: str(v.halo),
    shadow: str(v.shadow),
    rung: str(v.rung),
  };
}
function parsePalettes(raw: unknown): Record<string, Palette | undefined> {
  const out: Record<string, Palette | undefined> = Object.create(null);
  for (const [id, v] of Object.entries(record(raw))) {
    if (isRecord(v))
      out[id] = {
        locked: !!v.locked,
        light: str(v.light) || '',
        tl: parseZone(v.tl),
        tr: parseZone(v.tr),
        br: parseZone(v.br),
      };
  }
  return out;
}
function parseIconMetrics(raw: unknown): Record<string, IconMetric | undefined> {
  const out: Record<string, IconMetric | undefined> = Object.create(null);
  for (const [id, v] of Object.entries(record(raw))) {
    if (isRecord(v))
      out[id] = {
        n: Number(v.n),
        x: Number(v.x),
        y: Number(v.y),
        w: Number(v.w),
        h: Number(v.h),
        fill: Number(v.fill),
      };
  }
  return out;
}

/** The globals that `index.html` scripts define, plus the two browser capabilities read at startup. */
export interface RuntimeGlobals {
  HezFrameConfig?: unknown;
  CleanFrameWallpapers?: unknown;
  CleanFrameAdaptiveInk?: unknown;
  FrameIconMetrics?: unknown;
  CleanFramePrivateFontIDs?: unknown;
  matchMedia?: (query: string) => { matches: boolean };
  document: { documentElement: { style: object } };
}

/** Reads the owner-editable config and bundled catalogues once, with the defaults the controller used. */
export function readEnv(win: RuntimeGlobals, minuteMs: number): Env {
  const walls = parseWalls(win.CleanFrameWallpapers);
  const gallery = new Set(walls.map((w) => w.id));
  const config = record(win.HezFrameConfig),
    wallConfig = record(config.wallpapers);
  const rotation: WallId[] = [];
  for (const id of Array.isArray(wallConfig.playlist) ? wallConfig.playlist : [])
    if (inGallery(id, gallery) && rotation.indexOf(id) < 0) rotation.push(id);
  if (!rotation.length) for (const w of walls) rotation.push(w.id);

  const rawCollections: { id: string; name: string; wallpapers: WallId[] }[] = [
    { id: 'all', name: 'All nature', wallpapers: rotation.slice() },
  ];
  for (const c of Array.isArray(wallConfig.collections) ? wallConfig.collections : []) {
    if (
      !isRecord(c) ||
      typeof c.id !== 'string' ||
      !/^[a-z][a-z0-9-]*$/.test(c.id) ||
      rawCollections.some((v) => v.id === c.id)
    )
      continue;
    const ids: WallId[] = [];
    for (const id of Array.isArray(c.wallpapers) ? c.wallpapers : [])
      if (inGallery(id, gallery) && ids.indexOf(id) < 0) ids.push(id);
    if (ids.length)
      rawCollections.push({ id: c.id, name: String(c.name || c.id).slice(0, 32), wallpapers: ids });
  }
  const collectionIds = new Set(rawCollections.map((c) => c.id));
  const collections: Collection[] = [];
  for (const c of rawCollections)
    if (isCollectionId(c.id, collectionIds))
      collections.push({ id: c.id, name: c.name, wallpapers: c.wallpapers });

  const enabled = (key: string): OnOff => (record(config[key]).enabled === false ? 'off' : 'on');
  const docEl = win.document.documentElement.style;
  return {
    walls,
    collections,
    initialWall: inGallery(wallConfig.initial, gallery) ? wallConfig.initial : rotation[0],
    wallRevision: Math.max(1, Math.floor(Number(wallConfig.revision) || 1)),
    defaultCollection: pick(
      wallConfig.collection,
      collections.map((c) => c.id),
      collections[0].id,
    ),
    defaultRotation: pick(wallConfig.rotation, MODE_IDS, '5'),
    privateFonts: Array.isArray(win.CleanFramePrivateFontIDs)
      ? win.CleanFramePrivateFontIDs.filter((id): id is string => typeof id === 'string')
      : [],
    defaults: {
      cinema: enabled('cinema'),
      crossfade: enabled('crossfade'),
      greeting: enabled('greeting'),
    },
    cinemaSeconds: clamp(Number(record(config.cinema).idleSeconds) || 60, 1, 3600),
    dimAmount: clamp(Number(record(config.cinema).dimAmount) || 0.55, 0.1, 0.85),
    crossfadeMs: clamp(Number(record(config.crossfade).durationMs) || 900, 100, 3000),
    greetingName: String(record(config.greeting).name || '')
      .trim()
      .slice(0, 40),
    palettes: parsePalettes(win.CleanFrameAdaptiveInk),
    iconMetrics: parseIconMetrics(win.FrameIconMetrics),
    reducedMotion: !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches),
    maskSupport: 'webkitMaskImage' in docEl || 'maskImage' in docEl,
    minuteMs,
  };
}
