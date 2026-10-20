import { clamp } from './ids.ts';
import { DOCK_MODES, ED_ROW, ED_SEP, ED_VIEW, ED_CUT, FONT_IDS, FONTS, GRID_COLS, GRID_VISIBLE, MODES, PH_FULL, VALUE_NAMES } from './tables.ts';
import { availableFonts, collectionById, materialApplies, onHome, rotationMode, wallById } from './state.ts';
import type { AppId, AppsView, DetailGroup, DetailView, Display, EditorView, Layout, RemoteKey, SettingsGroup, State } from './types.ts';

export interface SettingsRow { id: SettingsGroup; label: string; value: string }
export function settingsRows(s: State): SettingsRow[] {
  const c = s.prefs, n = c.home.length;
  return [
    { id: 'background', label: 'Background', value: c.bg === 'photo' ? wallById(s.env, c.wall).name : VALUE_NAMES[c.bg] },
    { id: 'layout', label: 'Layout', value: VALUE_NAMES[c.layout] },
    { id: 'typography', label: 'Typography', value: FONTS[c.font].name },
    { id: 'focus', label: 'Focus', value: VALUE_NAMES[c.focus] + (materialApplies(c) ? ', ' + VALUE_NAMES[c.material] : '') },
    { id: 'editor', label: 'Apps on Home', value: n + (n === 1 ? ' app' : ' apps') },
    { id: 'atmosphere', label: 'Atmosphere', value: 'Dimming, transitions and greeting' },
    { id: 'samsung', label: 'Samsung', value: 'Home and TV settings' }
  ];
}

export type ChoiceAxis = 'bg' | 'layout' | 'apps' | 'controls' | 'font' | 'focus' | 'material' | 'mode' | 'cinema' | 'crossfade' | 'greeting' | 'collection';
export interface DetailItem {
  action: string;
  label: string;
  disabled: boolean;
  axis?: ChoiceAxis;
  value?: string;
  thumbnail?: boolean;
  description?: string;
}
export interface DetailSection { id: string; title: string; items: DetailItem[]; horizontal?: boolean; reason?: string }

const EXTRA_AXES: ChoiceAxis[] = ['cinema', 'crossfade', 'greeting', 'collection'];
export function isExtraAxis(axis: ChoiceAxis | undefined): axis is 'cinema' | 'crossfade' | 'greeting' | 'collection' {
  return !!axis && EXTRA_AXES.indexOf(axis) >= 0;
}

export function choice(s: State, axis: ChoiceAxis, value: string, disabled?: boolean): DetailItem {
  let label: string;
  if (axis === 'collection') label = (s.env.collections.filter(c => c.id === value)[0] || s.env.collections[0]).name;
  else if (isExtraAxis(axis)) label = value === 'on' ? 'On' : 'Off';
  else if (axis === 'font') label = FONTS[FONT_IDS.filter(id => id === value)[0]].name;
  else if (axis === 'mode') label = MODES.filter(m => m.id === value)[0].name;
  else label = value === 'both' ? 'Both' : VALUE_NAMES[value];
  return { action: axis === 'mode' ? 'rotation.' + value : 'choice.' + axis + '.' + value, axis, value, disabled: !!disabled, label };
}

export function detailSections(s: State, group: DetailGroup): DetailSection[] {
  const c = s.prefs, flat = c.bg !== 'photo', inactive = !materialApplies(c);
  const options = (axis: ChoiceAxis, values: readonly string[], disabled?: boolean) => values.map(v => choice(s, axis, v, disabled));
  if (group === 'background') return [
    { id: 'bg', title: 'Background type', items: options('bg', ['photo', 'light', 'dark']) },
    { id: 'wall', title: 'Wallpaper', items: [{ action: 'background.wallpaper', label: wallById(s.env, c.wall).name, thumbnail: true, disabled: flat }] },
    { id: 'collection', title: 'Collection', items: [{ action: 'background.collections', label: collectionById(s.env, c.collection).name, disabled: flat }] },
    { id: 'rotation', title: 'Rotation', items: [{ action: 'background.rotation', label: rotationMode(c).name, disabled: flat }], reason: flat ? 'Choose Photo to use wallpaper and rotation.' : '' }
  ];
  if (group === 'collections') return [{ id: 'collection', title: '', items: options('collection', s.env.collections.map(x => x.id)), reason: 'Rotation stays within this collection. Single-photo collections keep a fixed scene.' }];
  if (group === 'atmosphere') return [
    { id: 'cinema', title: 'Cinema dimming', horizontal: true, items: options('cinema', ['on', 'off']), reason: 'Dims Home after ' + s.env.cinemaSeconds + ' seconds. Any remote input wakes it.' },
    { id: 'crossfade', title: 'Wallpaper crossfade', horizontal: true, items: options('crossfade', ['on', 'off']) },
    { id: 'greeting', title: 'Personal greeting', horizontal: true, items: options('greeting', ['on', 'off']) }
  ];
  if (group === 'layout') return [
    { id: 'layout', title: 'Layout', horizontal: true, items: options('layout', ['list', 'dock']) },
    { id: 'apps', title: 'App display', horizontal: true, items: options('apps', ['text', 'icons', 'both']) },
    { id: 'controls', title: 'Home controls', horizontal: true, items: options('controls', ['text', 'icons', 'both']) }
  ];
  if (group === 'typography') return [{ id: 'font', title: '', items: options('font', availableFonts(s)) }];
  if (group === 'focus') return [
    { id: 'focus', title: 'Focus style', horizontal: true, items: options('focus', ['type', 'glass']) },
    { id: 'material', title: 'Material', horizontal: true, items: options('material', ['soft', 'frost', 'tint'], inactive),
      reason: inactive ? flat ? 'Materials are available with a Photo background.' : 'Choose Glass focus or the Dock layout to use materials.' : '' }
  ];
  if (group === 'rotation') return [{ id: 'mode', title: '', items: options('mode', MODES.map(m => m.id), flat),
    reason: flat ? 'Choose Photo in Background to use rotation.' : 'Timed changes pause while Settings or another panel is open.' }];
  return [{ id: 'samsung', title: '', items: [
    { action: 'samsung.home', label: 'Samsung Home', description: 'Open Samsung’s Home screen', disabled: false },
    { action: 'samsung.settings', label: 'TV settings', description: 'Picture, sound and network settings', disabled: false }
  ] }];
}

export function detailParent(group: DetailGroup): 'Background' | 'Settings' {
  return group === 'rotation' || group === 'collections' ? 'Background' : 'Settings';
}

/** Rows a remote can reach: enabled items only, one row per vertical item, one row per horizontal section. */
export function detailRows(s: State, group: DetailGroup): DetailItem[][] {
  const rows: DetailItem[][] = [[{ action: 'settings.back', label: detailParent(group), disabled: false }]];
  for (const section of detailSections(s, group)) {
    const enabled = section.items.filter(item => !item.disabled);
    if (section.horizontal && enabled.length) rows.push(enabled);
    else for (const item of enabled) rows.push([item]);
  }
  if (s.look.error) rows.push([{ action: 'settings.retry', label: 'Try again', disabled: false }]);
  return rows;
}

export function detailLocation(s: State, t: DetailView) {
  const rows = detailRows(s, t.group);
  let row = 0, column = 0;
  rows.forEach((items, r) => items.forEach((item, c) => { if (item.action === t.action) { row = r; column = c; } }));
  return { rows, row, column, item: rows[row][column] };
}

export const GROUP_AXIS: Partial<Record<DetailGroup, ChoiceAxis>> = { background: 'bg', layout: 'layout', typography: 'font', focus: 'focus', rotation: 'mode', collections: 'collection', atmosphere: 'cinema' };

export function otherGroups(s: State): { recent: AppId[]; rest: AppId[] } {
  const recent = s.prefs.recent.filter(id => !onHome(s, id) && s.apps.has(id));
  return { recent, rest: s.catalog.ids.filter(id => !onHome(s, id) && recent.indexOf(id) < 0) };
}
export function otherList(s: State): AppId[] {
  const o = otherGroups(s);
  return o.recent.concat(o.rest);
}
export function editorHomeY(i: number): number {
  return i * ED_ROW + (i >= ED_CUT ? 24 : 0);
}
export function editorOtherY(s: State, j: number): number {
  const o = otherGroups(s);
  return j * ED_ROW + (o.recent.length ? ED_SEP : 0) + (o.recent.length && j >= o.recent.length ? ED_SEP : 0);
}
export function nearestHome(s: State, t: EditorView, count: number): number {
  const target = editorOtherY(s, t.j) - t.top + 36;
  let best = 0, distance = Infinity;
  for (let i = 0; i < count; i++) {
    const d = Math.abs(editorHomeY(i) + 36 - target);
    if (d < distance) { best = i; distance = d; }
  }
  return best;
}

export type EditorEntry = { key: string; y: number } & ({ sep: string; id?: undefined } | { id: AppId; sep?: undefined });
/** The Not on Home column and the scroll position that keeps the focused row in view. */
export function editorEntries(s: State, t: EditorView): { entries: EditorEntry[]; top: number; height: number } {
  const o = otherGroups(s), entries: EditorEntry[] = [], ys: number[] = [];
  let y = 0, top = t.top, maxTop = 0;
  if (o.recent.length) { entries.push({ key: 'sep-recent', sep: 'Recently removed', y }); y += ED_SEP; }
  for (const id of o.recent) { entries.push({ key: id, id, y }); ys.push(y); y += ED_ROW; }
  if (o.recent.length && o.rest.length) { entries.push({ key: 'sep-rest', sep: 'Other installed apps', y }); y += ED_SEP; }
  for (const id of o.rest) { entries.push({ key: id, id, y }); ys.push(y); y += ED_ROW; }
  if (t.zone === 'other' && ys.length) {
    const yf = ys[t.j] - (o.recent.length && (t.j === 0 || t.j === o.recent.length) ? ED_SEP : 0);
    if (yf < top) top = yf;
    if (ys[t.j] + 72 > top + ED_VIEW) {
      const minTop = ys[t.j] + 72 - ED_VIEW;
      entries.some(it => { if (it.y < minTop) return false; top = it.y; return true; });
    }
  }
  entries.some(it => { if (it.y < Math.max(0, y - ED_VIEW)) return false; maxTop = it.y; return true; });
  return { entries, top: clamp(top, 0, maxTop), height: y };
}

export function appsItems(s: State): AppId[] {
  return s.catalog.error ? [] : s.catalog.ids;
}
export function appsTop(s: State, t: AppsView): number {
  const n = appsItems(s).length, rows = Math.ceil(n / GRID_COLS), row = Math.floor(t.i / GRID_COLS);
  let top = t.top;
  if (t.zone === 'grid') { if (row < top) top = row; if (row > top + GRID_VISIBLE - 1) top = row - GRID_VISIBLE + 1; }
  return clamp(top, 0, Math.max(0, rows - GRID_VISIBLE));
}

/** prev/next run along the apps; out goes to the Home controls, inn comes back. */
export function axes(layout: Layout): { prev: RemoteKey; next: RemoteKey; out: RemoteKey; inn: RemoteKey } {
  const v = layout === 'list';
  return { prev: v ? 'up' : 'left', next: v ? 'down' : 'right', out: v ? 'right' : 'up', inn: v ? 'left' : 'down' };
}

export interface DockGeom { x: number; y: number; h: number; w: number; shelf: number; vis: number; broad: boolean; tw: number; th: number; pitch: number }
export function dockGeom(apps: Display, n: number): DockGeom {
  const m = DOCK_MODES[apps], vis = Math.min(5, n), broad = n > 5;
  let shelf = vis * m.pitch - 8, w = shelf + 32;
  if (broad) { w = 1728; shelf = 1696; }
  return { x: Math.round((1920 - w) / 2), y: 908 - m.th - 32, h: m.th + 32, w, shelf, vis, broad, tw: m.tw, th: m.th, pitch: m.pitch };
}

/**
 * Five centred: the window moves one tile when focus passes an edge. Broad: keep a
 * glimpse of the neighbour. Returns the pixel offset and the scroll memory to keep.
 */
export function dockOffset(memory: { first: number; off: number }, n: number, i: number, g: DockGeom): { off: number; first: number; offTiles: number } {
  const glimpse = g.tw / 2;
  if (g.broad) {
    let off = memory.off * g.pitch;
    const left = i * g.pitch;
    if (left - off < (i > 0 ? glimpse : 0)) off = left - (i > 0 ? glimpse : 0);
    if (left + g.tw - off > g.shelf - (i < n - 1 ? glimpse : 0)) off = left + g.tw - g.shelf + (i < n - 1 ? glimpse : 0);
    off = clamp(off, 0, Math.max(0, n * g.pitch - 8 - g.shelf));
    return { off, offTiles: off / g.pitch, first: Math.round(off / g.pitch) };
  }
  let first = clamp(memory.first, 0, Math.max(0, n - g.vis));
  if (i < first) first = i;
  if (i > first + g.vis - 1) first = i - g.vis + 1;
  return { off: first * g.pitch, first, offTiles: first };
}

export function listFirst(memory: number, n: number, anchor: number): number {
  return clamp(clamp(memory, anchor - 3, anchor - 1), 0, Math.max(0, n - PH_FULL));
}
