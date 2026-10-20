import { clamp } from './ids.ts';
import { findWall, lookOf } from './prefs.ts';
import { BG_VALUES, DISPLAY_VALUES, FOCUS_VALUES, FONT_IDS, LAYOUT_VALUES, MATERIAL_VALUES, WALL_DELAY, WALL_VISIBLE } from './tables.ts';
import { detailFocus, materialApplies, next, pop, push, token, top, wallIndex, write, type Draft } from './state.ts';
import type { BundleKey, CommitIntent, Env, Look, LookFlow, LookOptions, LookPatch, Prefs, WallId, WallpaperView } from './types.ts';

const LOOK_KEYS: (keyof Look)[] = ['bg', 'wall', 'layout', 'apps', 'font', 'controls', 'focus', 'material'];

export function sameBundle(a: BundleKey | null, b: { wall: WallId; material: string }): boolean {
  return !!a && a.wall === b.wall && a.material === b.material;
}

/** Validates an appearance patch from outside the app (the QA hook), with the controller's messages. */
export function parseLookPatch(env: Env, raw: unknown): LookPatch {
  if (!raw || typeof raw !== 'object') throw new Error('look needs an appearance patch');
  const out: LookPatch = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'wall') { const w = findWall(env, v); if (!w) throw new Error('Unknown wallpaper: ' + v); out.wall = w; }
    else if (k === 'font') {
      const f = FONT_IDS.filter(id => id === v)[0];
      if (!f || f !== 'manrope' && env.privateFonts.indexOf(f) < 0) throw new Error('Unavailable font: ' + v);
      out.font = f;
    }
    else if (k === 'bg') out.bg = member(BG_VALUES, v, k);
    else if (k === 'layout') out.layout = member(LAYOUT_VALUES, v, k);
    else if (k === 'apps') out.apps = member(DISPLAY_VALUES, v, k);
    else if (k === 'controls') out.controls = member(DISPLAY_VALUES, v, k);
    else if (k === 'focus') out.focus = member(FOCUS_VALUES, v, k);
    else if (k === 'material') out.material = member(MATERIAL_VALUES, v, k);
    else throw new Error('Invalid appearance value: ' + k);
  }
  return out;
}
function member<T extends string>(list: readonly T[], v: unknown, k: string): T {
  for (const item of list) if (item === v) return item;
  throw new Error('Invalid appearance value: ' + k);
}

export function cancelLook(d: Draft): void {
  d.look.token++;
  d.look.flow = null;
  d.look.pending = null;
  d.look.wallPending = null;
  d.look.error = null;
}

/** Shows a look. A bundle swaps every photo layer at once; a preview keeps the committed Settings backdrop. */
export function installBundle(d: Draft, bundle: BundleKey | null, look: Look, previewOnly: boolean): void {
  const outgoing = !!bundle && !!d.look.shown && d.look.shown.wall !== look.wall && d.prefs.bg === 'photo' && top(d).kind === 'home' && !previewOnly && !d.env.reducedMotion && d.prefs.crossfade === 'on';
  if (bundle) {
    const leaving = d.look.installed ? d.look.installed.wall : null;
    d.look.crossfade = null;
    d.look.installed = bundle;
    if (!previewOnly) d.look.backdrop = bundle.wall;
    if (outgoing) {
      const t = token(d);
      d.look.crossfade = { token: t, wall: leaving };
      d.fx.push({ kind: 'after', ms: d.env.crossfadeMs + 80, action: { type: 'crossfadeEnded', token: t } });
    }
  }
  d.look.shown = { bg: look.bg, wall: look.wall, material: look.material, font: look.font };
  d.look.wallShown = look.wall;
  d.look.wallPending = null;
  d.look.wallError = null;
}

/**
 * Changes the appearance once its photo bundle and font are ready and storage accepts it.
 * Until then the committed look stays on screen; `cancelLook` makes late results inert.
 */
export function setLook(d: Draft, changes: LookPatch, opts: LookOptions): void {
  const target: Look = { ...lookOf(d.prefs), ...changes };
  const changed = LOOK_KEYS.some(k => target[k] !== d.prefs[k]);
  cancelLook(d);
  d.session.err = null;
  const needs = target.bg === 'photo' && !sameBundle(d.look.installed, target) && (!d.look.shown || d.look.shown.bg !== 'photo' || target.wall !== d.prefs.wall || materialApplies(target));
  const needsFont = !d.fonts.metrics[target.font];
  const flow: LookFlow = { kind: 'look', target, changes, opts, changed, imageDone: !needs, fontDone: !needsFont, failed: false, loaded: null };
  if (!needs && !needsFont) { finishLook(d, flow, null); return; }
  d.look.pending = { patch: changes, target, row: opts.row || (needsFont ? 'font' : d.session.appearanceFocus), transient: !!opts.transient, preview: false };
  d.look.flow = flow;
  if (needs) {
    d.look.wallPending = target.wall;
    d.fx.push({ kind: 'loadBundle', bundle: { wall: target.wall, material: target.material }, token: d.look.token });
  }
  if (needsFont) d.fx.push({ kind: 'ensureFont', font: target.font, token: d.look.token });
}

function finishLook(d: Draft, flow: Extract<LookFlow, { kind: 'look' }>, bundle: BundleKey | null): void {
  const c: Prefs = { ...next(d), ...flow.target };
  const fontChanged = flow.target.font !== d.prefs.font;
  const reflow = flow.target.apps !== d.prefs.apps || flow.target.controls !== d.prefs.controls || fontChanged;
  d.look.flow = null;
  d.look.pending = null;
  d.look.wallPending = null;
  const intent: CommitIntent = { kind: 'look', target: flow.target, changes: flow.changes, opts: flow.opts, bundle, fontChanged, reflow };
  if (!flow.opts.transient && flow.changed) { write(d, c, intent); return; }
  if (flow.opts.transient) d.prefs = c;
  lookCommitted(d, intent);
}

/** The rest of a look change once storage has accepted it (or no write was needed). */
export function lookCommitted(d: Draft, intent: Extract<CommitIntent, { kind: 'look' }>): void {
  if (intent.reflow) {
    d.look.reflow = token(d);
    d.fx.push({ kind: 'frames', count: 2, action: { type: 'reflowEnded', token: d.look.reflow } });
  }
  if (intent.fontChanged) {
    d.look.fontSwitch = token(d);
    d.fx.push({ kind: 'after', ms: d.env.reducedMotion ? 130 : 170, action: { type: 'fontSwitchEnded', token: d.look.fontSwitch } });
  }
  installBundle(d, intent.bundle, intent.target, false);
  if (intent.bundle) d.look.committedBundle = intent.bundle;
  d.look.error = null;
  d.look.previewBundle = null;
}

export function lookSaveFailed(d: Draft, intent: Extract<CommitIntent, { kind: 'look' }>): void {
  d.look.error = { type: 'save', patch: { ...intent.changes }, row: intent.opts.row || d.session.appearanceFocus, transient: false };
}

function failLook(d: Draft, flow: Extract<LookFlow, { kind: 'look' }>, type: 'load' | 'font', reason: string | null): void {
  if (flow.failed) return;
  d.look.flow = { ...flow, failed: true };
  d.look.pending = null;
  d.look.wallPending = null;
  if (type === 'load') d.look.wallError = flow.target.wall;
  d.look.error = { type, reason: reason || null, patch: flow.changes, row: flow.opts.row || (type === 'font' ? 'font' : d.session.appearanceFocus), transient: !!flow.opts.transient, wall: flow.target.wall, font: flow.target.font };
  if (type === 'font' && flow.opts.startup && flow.target.font !== 'manrope') setLook(d, { font: 'manrope' }, { transient: true });
}

function completeLook(d: Draft, flow: Extract<LookFlow, { kind: 'look' }>): void {
  if (!flow.imageDone || !flow.fontDone || flow.failed) return;
  d.fx.push({ kind: 'frames', count: 1, action: { type: 'lookSettle', token: d.look.token } });
}

export function bundleLoaded(d: Draft, tok: number, bundle: BundleKey, ok: boolean): void {
  const flow = d.look.flow;
  if (tok !== d.look.token || !flow) return;
  if (flow.kind === 'preview') {
    d.look.pending = null;
    d.look.wallPending = null;
    d.look.flow = null;
    if (!ok) { d.look.wallError = flow.wall; previewLoaded(d, flow, false); return; }
    d.look.previewBundle = bundle;
    installBundle(d, bundle, flow.target, true);
    previewLoaded(d, flow, true);
    return;
  }
  if (!ok) { failLook(d, flow, 'load', null); return; }
  const done = { ...flow, imageDone: true, loaded: bundle };
  d.look.flow = done;
  completeLook(d, done);
}

export function fontResult(d: Draft, tok: number, ok: boolean, reason: string | null): void {
  const flow = d.look.flow;
  if (tok !== d.look.token || !flow || flow.kind !== 'look' || flow.failed) return;
  if (!ok) { failLook(d, flow, 'font', reason); return; }
  const done = { ...flow, fontDone: true };
  d.look.flow = done;
  completeLook(d, done);
}

export function lookSettle(d: Draft, tok: number): void {
  const flow = d.look.flow;
  if (tok === d.look.token && flow && flow.kind === 'look' && !flow.failed) finishLook(d, flow, flow.loaded);
}

/** Shows the committed look again after a preview or a failure. */
export function restoreLook(d: Draft): void {
  cancelLook(d);
  d.look.previewBundle = null;
  const c = d.prefs;
  if (c.bg === 'photo' && d.look.committedBundle && sameBundle(d.look.committedBundle, c)) installBundle(d, d.look.committedBundle, c, false);
  else if (c.bg !== 'photo' || sameBundle(d.look.installed, c)) installBundle(d, null, c, false);
  else setLook(d, {}, { transient: true });
}

/* ---------- Wallpaper picker: focus previews, OK applies ---------- */

export function openWallpaper(d: Draft): void {
  const i = wallIndex(d.env, d.prefs.wall);
  d.session.err = null;
  d.look.wallError = null;
  push(d, { kind: 'wallpaper', instance: token(d), i, top: clamp(i - 2, 0, Math.max(0, d.env.walls.length - WALL_VISIBLE)), zone: 'photo', previewDue: null, previewSeq: 0, applyPending: null, failedId: null, failedApply: false, retryBundle: null });
}

function showWall(d: Draft, id: WallId, picker: number): void {
  const target: Look = { ...lookOf(d.prefs), bg: 'photo', wall: id };
  cancelLook(d);
  d.look.wallError = null;
  d.look.pending = { patch: { wall: id }, target, row: 'bg', preview: true, transient: false };
  d.look.wallPending = id;
  d.look.flow = { kind: 'preview', target, picker, wall: id };
  d.fx.push({ kind: 'loadBundle', bundle: { wall: id, material: target.material }, token: d.look.token });
}

function loadWallpaperPreview(d: Draft, t: WallpaperView): void {
  t.previewDue = null;
  showWall(d, d.env.walls[t.i].id, t.instance);
}

function previewLoaded(d: Draft, flow: Extract<LookFlow, { kind: 'preview' }>, ok: boolean): void {
  const t = top(d);
  if (t.kind !== 'wallpaper' || t.instance !== flow.picker || d.env.walls[t.i].id !== flow.wall) return;
  if (!ok) failWallpaper(d, t, flow.wall, t.applyPending === flow.wall, null);
  else if (t.applyPending === flow.wall) applyWallpaper(d, t, null);
}

export function previewDue(d: Draft, seq: number, wall: WallId): void {
  const t = top(d);
  if (t.kind === 'wallpaper' && t.previewDue && t.previewSeq === seq && d.env.walls[t.i].id === wall) loadWallpaperPreview(d, t);
}

export function failWallpaper(d: Draft, t: WallpaperView, id: WallId, apply: boolean, bundle: BundleKey | null): void {
  t.applyPending = null;
  t.failedId = id;
  t.failedApply = apply;
  t.retryBundle = bundle;
  restoreLook(d);
  if (!bundle) d.look.wallError = id;
}

export function applyWallpaper(d: Draft, t: WallpaperView, prepared: BundleKey | null): void {
  const w = d.env.walls[t.i], bundle = prepared || d.look.previewBundle;
  if (!prepared && (d.look.wallPending || t.previewDue || d.look.wallShown !== w.id || d.look.wallError)) {
    t.applyPending = w.id;
    if (t.previewDue || d.look.wallPending !== w.id) loadWallpaperPreview(d, t);
    return;
  }
  t.applyPending = null;
  if (w.id === d.prefs.wall) { d.session.err = null; t.failedId = null; t.failedApply = false; t.retryBundle = null; return; }
  if (!bundle || !sameBundle(bundle, { wall: w.id, material: d.prefs.material })) { t.applyPending = w.id; loadWallpaperPreview(d, t); return; }
  write(d, { ...next(d), wall: w.id }, { kind: 'wallpaper', wall: w.id, bundle });
}

export function wallpaperSaved(d: Draft, bundle: BundleKey): void {
  installBundle(d, bundle, d.prefs, false);
  d.look.committedBundle = bundle;
  d.look.previewBundle = null;
  const t = top(d);
  if (t.kind === 'wallpaper') { t.failedId = null; t.failedApply = false; t.retryBundle = null; }
}

export function previewWallpaper(d: Draft, t: WallpaperView, index: number, apply: boolean, immediate: boolean): void {
  t.previewDue = null;
  cancelLook(d);
  t.i = index;
  t.zone = 'photo';
  const id = d.env.walls[index].id;
  t.applyPending = apply ? id : null;
  t.failedId = null;
  t.failedApply = false;
  t.retryBundle = null;
  d.session.err = null;
  d.look.wallError = null;
  if (id === d.prefs.wall && d.look.committedBundle) {
    installBundle(d, d.look.committedBundle, d.prefs, true);
    d.look.previewBundle = null;
    if (apply) applyWallpaper(d, t, null);
    return;
  }
  if (d.look.wallShown === id && d.look.previewBundle && sameBundle(d.look.previewBundle, { wall: id, material: d.prefs.material })) {
    if (apply) applyWallpaper(d, t, null);
    return;
  }
  if (apply || immediate) { loadWallpaperPreview(d, t); return; }
  d.look.pending = { patch: { wall: id }, target: { ...lookOf(d.prefs), wall: id }, row: 'bg', preview: true, transient: false, deferred: true };
  t.previewDue = id;
  t.previewSeq = token(d);
  d.fx.push({ kind: 'after', ms: WALL_DELAY, action: { type: 'previewDue', seq: t.previewSeq, wall: id } });
}

export function retryWallpaper(d: Draft, t: WallpaperView): void {
  const apply = t.failedApply, bundle = t.retryBundle;
  t.zone = 'photo';
  if (bundle && apply) applyWallpaper(d, t, bundle);
  else previewWallpaper(d, t, t.i, apply, true);
}

export function closeWallpaper(d: Draft, t: WallpaperView): void {
  t.previewDue = null;
  t.applyPending = null;
  d.session.err = null;
  pop(d);
  restoreLook(d);
  const p = top(d);
  if (p.kind === 'appearance' && p.group === 'background') detailFocus(d, p, { action: 'background.wallpaper' }, 0);
}

export function normWallpaper(d: Draft, t: WallpaperView): void {
  const n = d.env.walls.length;
  t.i = clamp(t.i, 0, n - 1);
  if (t.zone === 'retry' && !t.failedId) t.zone = 'photo';
  if (t.i < t.top) t.top = t.i;
  if (t.i >= t.top + WALL_VISIBLE) t.top = t.i - WALL_VISIBLE + 1;
  t.top = clamp(t.top, 0, Math.max(0, n - WALL_VISIBLE));
}
