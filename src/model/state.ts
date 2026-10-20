import { MODES, PRIMARY_IDS } from './tables.ts';
import type {
  App,
  AppId,
  Collection,
  CollectionId,
  CommitIntent,
  DetailView,
  Effect,
  Env,
  FontId,
  Look,
  Overlay,
  Prefs,
  State,
  View,
  ViewKind,
  Wallpaper,
  WallId,
} from './types.ts';

/** A copy of the parts of State an action can change. Handlers mutate it; the input state is untouched. */
export interface Draft extends State {
  fx: Effect[];
}

function copyOverlay(v: Overlay): Overlay {
  if (v.kind === 'editor')
    return {
      ...v,
      lifted: v.lifted && { ...v.lifted, order: [...v.lifted.order] },
      otherReturn: { ...v.otherReturn },
    };
  return { ...v };
}

export function draft(s: State): Draft {
  const [home, ...rest] = s.stack;
  return {
    ...s,
    catalog: { ...s.catalog },
    stack: [{ ...home }, ...rest.map(copyOverlay)],
    session: {
      ...s.session,
      detailFocus: { ...s.session.detailFocus },
      undo: [...s.session.undo],
      removedAt: { ...s.session.removedAt },
    },
    look: { ...s.look },
    scroll: { ...s.scroll },
    fx: [],
  };
}

export function finish(d: Draft): { state: State; effects: Effect[] } {
  const { fx, ...state } = d;
  return { state, effects: fx };
}

export function top(s: State): View {
  return s.stack[s.stack.length - 1];
}
export function push(d: Draft, v: Overlay): void {
  d.stack.push(v);
}
export function pop(d: Draft): void {
  if (d.stack.length > 1) d.stack.pop();
}

export function app(s: State, id: AppId): App {
  const a = s.apps.get(id);
  if (!a) throw new Error('Unknown app: ' + id);
  return a;
}
export function wallById(env: Env, id: WallId): Wallpaper {
  for (const w of env.walls) if (w.id === id) return w;
  return env.walls[0];
}
export function wallIndex(env: Env, id: WallId | null): number {
  for (let i = 0; i < env.walls.length; i++) if (env.walls[i].id === id) return i;
  return 0;
}
export function collectionById(env: Env, id: CollectionId): Collection {
  for (const c of env.collections) if (c.id === id) return c;
  return env.collections[0];
}
export function nextRotationWall(env: Env, collection: CollectionId, id: WallId): WallId {
  const ids = collectionById(env, collection).wallpapers;
  return ids[(ids.indexOf(id) + 1) % ids.length];
}
export function rotationMode(c: Prefs) {
  for (const m of MODES) if (m.id === c.mode) return m;
  return MODES[0];
}
export function materialApplies(c: Look): boolean {
  return c.bg === 'photo' && (c.layout === 'dock' || c.focus === 'glass');
}
export function homeFont(s: State): FontId {
  return s.look.shown ? s.look.shown.font : 'manrope';
}
export function availableFonts(s: State): FontId[] {
  const out: FontId[] = ['manrope'];
  for (const id of ['montreal', 'mori', 'pangram', 'geist', 'newsreader'] as const) {
    if (s.env.privateFonts.includes(id) && !s.fonts.unavailable.includes(id)) out.push(id);
  }
  return out;
}
export function onHome(s: State, id: AppId): boolean {
  return s.prefs.home.includes(id);
}
export function isPrimary(id: AppId): boolean {
  return PRIMARY_IDS.includes(id);
}

/** Prefs carrying the given Home order; every other field keeps its committed value. */
export function next(
  d: State,
  home: AppId[] = [...d.prefs.home],
  recent: AppId[] = [...d.prefs.recent],
): Prefs {
  return { ...d.prefs, home, recent };
}
export function snap(d: State) {
  return { home: [...d.prefs.home], recent: [...d.prefs.recent] };
}

/** Requests a storage write. The runner answers with `persisted`, and the intent's continuation runs. */
export function write(d: Draft, prefs: Prefs, intent: CommitIntent): void {
  d.fx.push({ kind: 'persist', prefs, intent });
}

export function token(d: Draft): number {
  return ++d.session.nextToken;
}

export function ensureSel(d: Draft): number {
  const h = d.prefs.home;
  let i = d.session.sel ? h.indexOf(d.session.sel) : -1;
  if (i < 0) {
    i = Math.max(0, Math.min(d.session.selIdx, h.length - 1));
    d.session.sel = h[i];
  }
  d.session.selIdx = i;
  return i;
}
export function setSel(d: Draft, id: AppId): void {
  d.session.sel = id;
  d.session.selIdx = d.prefs.home.indexOf(id);
}

export function isSheet(kind: ViewKind): boolean {
  return kind === 'settings' || kind === 'apps' || kind === 'editor' || kind === 'message';
}
export function isSettingsDetail(kind: ViewKind): boolean {
  return kind === 'appearance' || kind === 'wallpaper';
}

export function detailFocus(
  d: Draft,
  t: DetailView,
  item: { action: string; axis?: string },
  column?: number,
): void {
  t.action = item.action;
  if (item.action !== 'settings.back') d.session.detailFocus[t.group] = item.action;
  if (column !== undefined) t.column = column;
  if (item.axis) d.session.appearanceFocus = item.axis;
}
