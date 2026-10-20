import { flushSync } from 'react-dom';
import type { Controllers } from './controllers.ts';
import { parseLookPatch } from './model/look.ts';
import { serialise } from './model/prefs.ts';
import { availableFonts, isSettingsDetail, isSheet, top } from './model/state.ts';
import { FONT_IDS, WALL_VISIBLE } from './model/tables.ts';
import type { Action, RemoteKey, State } from './model/types.ts';
import { detailLocation } from './model/views.ts';
import type { Store } from './store.ts';
import { pointAction } from './view/App.tsx';

declare global {
  interface Window {
    ShoreQA?: unknown;
  }
}

const NAV: Record<string, RemoteKey | undefined> = {
  left: 'left',
  right: 'right',
  up: 'up',
  down: 'down',
  ok: 'ok',
  enter: 'ok',
  back: 'back',
  escape: 'back',
};
const SCENES = ['home', 'apps', 'settings', 'appearance', 'editor'] as const;
const rendered = (el: Element) =>
  el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const byId = (id: string) => document.getElementById(id);

/** Test speed-up preset by the browser checks before the app loads. */
export function presetMinuteMs(): number {
  const preset = window.ShoreQA;
  return (
    (typeof preset === 'object' &&
      preset !== null &&
      'minuteMs' in preset &&
      Number(preset.minuteMs)) ||
    60000
  );
}

/**
 * `window.ShoreQA`, the hook the browser checks drive. It runs the real actions and reports
 * state in the shape those checks have always read. Focus is read from the rendered DOM so the
 * checks keep proving what is on screen.
 */
export function installQA(store: Store, controllers: Controllers): void {
  const s = () => store.getState();
  const root = () => {
    const t = top(s());
    return isSettingsDetail(t.kind)
      ? byId('appearance')
      : isSheet(t.kind)
        ? byId('sheet')
        : byId('home');
  };
  const focusedAction = () => {
    const el = root(),
      found = el
        ? Array.from(el.querySelectorAll('.is-focus[data-action]')).filter(rendered)[0]
        : null;
    return found ? found.getAttribute('data-action') : null;
  };
  const run = (action: Action) => flushSync(() => store.dispatch(action));

  function state() {
    const st: State = s(),
      t = top(st),
      c = st.prefs,
      look = st.look,
      item = t.kind === 'appearance' ? detailLocation(st, t).item : null;
    const out: Record<string, unknown> = serialise(st.env, c, st.apps);
    out.committed = c;
    out.shown = look.shown;
    out.pending = look.pending;
    out.view = t.kind;
    out.selected = st.session.sel;
    out.focusAction = focusedAction();
    out.writes = st.session.writes;
    out.failedWrites = st.session.failed;
    out.error = st.session.err;
    out.catalog = {
      loading: st.catalog.loading,
      loaded: st.catalog.loaded,
      error: st.catalog.error,
      ids: st.catalog.ids.slice(),
    };
    const metrics = st.fonts.metrics;
    out.fonts = {
      available: availableFonts(st),
      loaded: Object.keys(metrics).filter((id) =>
        FONT_IDS.some((f) => f === id && !metrics[f]?.fallback),
      ),
      baselineFallback: !!(metrics.manrope && metrics.manrope.fallback),
      error: look.error && look.error.type === 'font' ? look.error : null,
    };
    out.cinemaDimmed = st.veil === 'dim';
    out.crossfading = !!look.crossfade;
    out.rotation = controllers.rotationInfo();
    out.draft =
      t.kind === 'editor' && t.lifted ? { id: t.lifted.id, order: t.lifted.order.slice() } : null;
    out.settingsGroup =
      t.kind === 'wallpaper' ? 'wallpaper' : t.kind === 'appearance' ? t.group : null;
    out.focusedChoice =
      item && item.axis
        ? { axis: item.axis, value: item.value, action: item.action, disabled: item.disabled }
        : null;
    out.candidate =
      out.focusedChoice && item
        ? {
            axis: item.axis,
            value: item.value,
            action: item.action,
            pending: !!look.pending,
            pendingTarget: look.pending ? look.pending.target : null,
          }
        : null;
    const backdrop = byId('sheetBg');
    out.wallpaperPicker =
      t.kind === 'wallpaper'
        ? {
            candidate: st.env.walls[t.i].id,
            applied: c.wall,
            shown: look.wallShown,
            pending: t.previewDue || look.wallPending,
            queuedApplying: !!t.applyPending,
            applyPending: t.applyPending,
            failed: t.failedId,
            zone: t.zone,
            top: t.top,
            visible: WALL_VISIBLE,
            backdrop: backdrop instanceof HTMLImageElement ? backdrop.src : '',
          }
        : null;
    out.undo = st.session.undo.map((u) => u.label);
    out.storageOk = st.session.storageOk;
    return JSON.parse(JSON.stringify(out));
  }

  function where() {
    const t = top(s()),
      action = focusedAction(),
      stage = byId('stage');
    let count = 0,
      name = '';
    for (const el of stage ? Array.from(stage.querySelectorAll('.is-focus[data-action]')) : []) {
      if (!rendered(el)) continue;
      count++;
      if (el.getAttribute('data-action') === action)
        name = el.getAttribute('aria-label') || (el.textContent || '').replace(/\s+/g, ' ').trim();
    }
    const zone =
      t.kind === 'home' || t.kind === 'apps' || t.kind === 'editor' || t.kind === 'wallpaper'
        ? t.zone
        : null;
    return {
      view: t.kind,
      settingsGroup:
        t.kind === 'wallpaper' ? 'wallpaper' : t.kind === 'appearance' ? t.group : null,
      focus: name,
      focusAction: action,
      focusCount: count,
      wallpaper: s().look.wallShown,
      zone,
    };
  }

  function activate(name: string) {
    const t = top(s()),
      el = root();
    let action = name;
    if (action === 'appearance.bg' && t.kind === 'appearance' && t.group === 'background')
      action = 'background.wallpaper';
    if (action === 'settings.appearance' && t.kind === 'settings')
      action = 'settings.group.background';
    const target = el
      ? Array.from(el.querySelectorAll('[data-action]')).filter(
          (e) => rendered(e) && e.getAttribute('data-action') === action,
        )[0]
      : null;
    if (!target) return null;
    const point = pointAction(target);
    controllers.wake();
    if (point) run(point);
    return state();
  }

  window.ShoreQA = {
    minuteMs: s().env.minuteMs,
    state,
    where,
    activate,
    ready: () => {
      const st = s(),
        shown = st.look.shown;
      return (
        st.fonts.ready &&
        !st.look.pending &&
        !!shown &&
        shown.bg === st.prefs.bg &&
        shown.wall === st.prefs.wall &&
        shown.font === st.prefs.font
      );
    },
    nav(...args: unknown[]) {
      const keys = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      for (const key of keys) {
        const k =
          typeof key === 'string' && Object.prototype.hasOwnProperty.call(NAV, key)
            ? NAV[key]
            : undefined;
        if (!k) throw new Error('Unknown key');
        controllers.wake();
        run({ type: 'key', key: k });
      }
      return state();
    },
    look(patch: unknown) {
      run({ type: 'look', patch: parseLookPatch(s().env, patch) });
      return state();
    },
    scene(name: unknown) {
      const scene = SCENES.filter((n) => n === name)[0];
      if (!scene) throw new Error('Unknown view');
      run({ type: 'scene', name: scene });
      return state();
    },
    actions: () => {
      const el = root();
      return el
        ? Array.from(el.querySelectorAll('[data-action]'))
            .filter(rendered)
            .map((e) => e.getAttribute('data-action'))
        : [];
    },
  };
}
