import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
} from 'react';
import type { Controllers } from '../controllers.ts';
import { fontRole, fontShift, photoSrc, px } from '../model/assets.ts';
import { clamp } from '../model/ids.ts';
import {
  homeFont,
  isSettingsDetail,
  isSheet,
  materialApplies,
  top,
  wallById,
} from '../model/state.ts';
import { FONTS } from '../model/tables.ts';
import type { Action, Palette, PaletteZone, PointZone, State } from '../model/types.ts';
import type { Store } from '../store.ts';
import { StoreContext } from './store.ts';
import { Appearance } from './Appearance.tsx';
import { Home, homeInput } from './Home.tsx';
import { useLastShown, useLatestWhen } from './hooks.ts';
import { Sheet } from './Sheet.tsx';
import { typeset } from './typeset.ts';

const ZONES: PointZone[] = [
  'util',
  'app',
  'grid',
  'head',
  'name',
  'remove',
  'other',
  'row',
  'detail',
  'act',
  'wall-back',
  'wall-retry',
  'wall-choice',
];

/** The pointer equivalent of OK on a control, read from its data-z, data-i and data-id. */
export function pointAction(el: Element): Action | null {
  const zone = ZONES.find((z) => z === el.getAttribute('data-z'));
  return zone
    ? {
        type: 'point',
        zone,
        index: Number(el.getAttribute('data-i')),
        id: el.getAttribute('data-id'),
      }
    : null;
}

const RUNGS = ['light', 'mist', 'mist-high', 'dark', 'dark-halo'];
const isVar = (name: string): name is `--${string}` => name.indexOf('--') === 0;
function adaptivePalette(
  s: State,
  palette: Palette | undefined,
): palette is Palette & { tl: PaletteZone; tr: PaletteZone; br: PaletteZone } {
  return (
    s.prefs.bg === 'photo' &&
    !!palette &&
    !palette.locked &&
    !!palette.light &&
    !!palette.tl &&
    !!palette.tr &&
    !!palette.br
  );
}

/** Stage classes and variables: every appearance axis, the shown photo's offline inks and the current view. */
function stage(s: State): { className: string; vars: CSSProperties } {
  const c = s.prefs,
    t = top(s),
    shown = wallById(s.env, s.look.shown ? s.look.shown.wall : c.wall),
    palette = s.env.palettes[shown.id],
    font = homeFont(s);
  const adaptive = adaptivePalette(s, palette) ? palette : null;
  const frost = [0.12, 0.2, 0.3, 0.36, 0.44].indexOf(shown.frostVeil);
  const vars: CSSProperties = {};
  for (const zone of ['tl', 'tr', 'br'] as const) {
    const r = adaptive ? adaptive[zone] : null;
    if (!r) continue;
    const values: Record<string, string | number | undefined> = {
      ink: r.ink,
      'clock-ink': r.clockInk || r.ink,
      'rest-ink': r.restInk,
      'peer-ink': r.peerInk,
      rest: r.restAlpha,
      peer: r.peerAlpha,
      under: r.halo,
      shadow: r.shadow,
    };
    for (const key of Object.keys(values)) {
      const name = '--' + zone + '-' + key,
        value = values[key];
      if (value !== undefined && isVar(name)) vars[name] = String(value);
    }
  }
  if (adaptive && adaptive.light) vars['--home-app-ink'] = adaptive.light;
  if (!adaptive && shown.clockInk) vars['--clock-ink'] = shown.clockInk;
  if (!adaptive && shown.dockClockInk) vars['--dock-clock-ink'] = shown.dockClockInk;
  const className =
    'stage bg-' +
    c.bg +
    ' l-' +
    c.layout +
    ' m-' +
    (materialApplies(c) ? c.material : 'none') +
    ' f-' +
    c.focus +
    ' a-' +
    c.apps +
    ' u-' +
    c.controls +
    ' tone-' +
    shown.tone +
    ' tr-' +
    (adaptive ? adaptive.tr.pol : shown.ut.tr) +
    ' br-' +
    (adaptive ? adaptive.br.pol : shown.ut.br) +
    (frost > 0 ? ' fv-' + (frost + 1) : '') +
    (shown.listColumn ? ' lc-' + shown.listColumn : '') +
    (shown.dockQuiet ? ' db-quiet' : '') +
    (shown.clockMist ? ' tl-mist' : '') +
    (adaptive
      ? (['tl', 'tr', 'br'] as const)
          .map((z) =>
            RUNGS.includes(adaptive[z].rung || '') ? ' ink-' + z + '-' + adaptive[z].rung : '',
          )
          .join('')
      : '') +
    ' at-' +
    t.kind +
    ' font-' +
    font +
    (font === 'manrope' ? '' : ' font-custom') +
    (s.look.fontSwitch ? ' is-font-switch' : '') +
    (adaptive ? ' has-adaptive-ink adaptive-tl-' + adaptive.tl.pol : '') +
    (!adaptive && shown.clockInk ? ' has-clock-ink' : '') +
    (!adaptive && shown.dockClockInk ? ' has-dock-clock-ink' : '') +
    (c.bg === 'photo' && c.material === 'soft' ? ' registered-material' : '') +
    (isSheet(t.kind) ? ' is-sheet' : '') +
    (s.look.reflow ? ' is-reflow' : '');
  return { className, vars };
}

/** The selected face applies to Home text only; these variables carry its family, weights and cap-height shifts. */
function homeFontVars(s: State): CSSProperties {
  const id = homeFont(s),
    f = FONTS[id],
    primary = fontRole(id, 'primary'),
    ui = fontRole(id, 'ui'),
    metrics = s.fonts.metrics[id];
  const shift = (role: 'clock' | 'ui' | 'primary', size: number) =>
    px(fontShift(s.fonts.metrics, id, role, size));
  return {
    '--font-display-family': '"' + f.family + '"',
    '--font-ui-family': '"' + ui.family + '"',
    '--font-primary-family': '"' + primary.family + '"',
    '--font-display-weight': String(f.display),
    '--font-ui-weight': String(ui.weight),
    '--font-primary-weight': String(primary.weight),
    '--font-clock-weight': String(f.clock),
    '--font-clock-shift': shift('clock', 48),
    '--font-utility-shift': shift('ui', 28),
    '--font-action-shift': shift('ui', 30),
    '--font-heading-shift': shift('ui', 48),
    '--font-full-name-shift': shift('primary', 30),
    '--font-clock-digit': px(metrics ? metrics.digitCell : 0),
  };
}

/** The outgoing photo fades over the new one; it is removed when the store ends the crossfade. */
function OutgoingPhoto({ src, ms }: { src: string | undefined; ms: number }) {
  const [fading, setFading] = useState(false);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setFading(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  return (
    <img
      className="photo wallpaper-outgoing"
      alt=""
      src={src}
      style={{ opacity: fading ? '0' : '1', transition: 'opacity ' + ms + 'ms ease-in-out' }}
    />
  );
}

function useStageFit(): CSSProperties {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const resize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const scale = Math.min(size.w / 1920, size.h / 1080);
  return {
    transform: 'scale(' + scale + ')',
    left: (size.w - 1920 * scale) / 2 + 'px',
    top: (size.h - 1080 * scale) / 2 + 'px',
  };
}

const rendered = (el: Element) =>
  el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/**
 * A failed write keeps its retry message on the focused control. The line sits under that
 * control, so it is placed from the control's measured box.
 */
function FocusStatus({
  s,
  stageRef,
  homeRef,
  sheetRef,
}: {
  s: State;
  stageRef: RefObject<HTMLElement | null>;
  homeRef: RefObject<HTMLDivElement | null>;
  sheetRef: RefObject<HTMLDivElement | null>;
}) {
  const t = top(s),
    text = s.session.err ? 'Not saved. OK tries again.' : '';
  const [g, setG] = useState<{
    left: number;
    top: number;
    width: number;
    solid: boolean;
    photo: boolean;
    text: string;
  } | null>(null);
  useLayoutEffect(() => {
    let next: typeof g = null;
    const root = isSheet(t.kind) ? sheetRef.current : homeRef.current,
      stageEl = stageRef.current;
    if (!isSettingsDetail(t.kind) && text && root && stageEl) {
      const target = [...root.querySelectorAll('.is-focus[data-action]')].find(rendered);
      const parent = target && target.parentElement;
      if (target && parent && !(parent.id === 'utils' && parent.classList.contains('is-icons'))) {
        const photo = s.prefs.layout === 'list' && target.classList.contains('ph-row');
        const r = target.getBoundingClientRect(),
          sr = stageEl.getBoundingClientRect(),
          scale = sr.width / 1920 || 1;
        let x = (r.left - sr.left) / scale,
          y = (r.top - sr.top) / scale,
          w = r.width / scale;
        if (photo) {
          const ts = typeset(homeInput(s));
          x =
            112 +
            ts.listPlateWidth(s.prefs.home[clamp(s.session.selIdx, 0, s.prefs.home.length - 1)]) +
            24;
          y += (r.height / scale - 28) / 2;
          w = 400;
        } else
          y += (target.getAttribute('data-action') || '').indexOf('home.app.') === 0 ? 171 : 40;
        const solid =
          /(?:^|\s)(?:u|btn|er-rm)(?:\s|$)/.test(target.className) &&
          parent.id !== 'utils' &&
          !parent.classList.contains('s-head');
        next = {
          left: clamp(x + 8, 112, 1808 - Math.min(w - 16, 800)),
          top: clamp(y, 72, 988),
          width: Math.min(w - 16, 800),
          solid,
          photo,
          text,
        };
      }
    }
    // oxlint-disable-next-line react/set-state-in-effect -- This layout measurement positions the retry line before paint.
    setG((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [s, t.kind, text, homeRef, sheetRef, stageRef]);
  const shown = useLastShown(g, JSON.stringify(g));
  return (
    <div
      className={
        'focus-status' +
        (g ? ' is-on' + (g.solid ? ' dark-ink' : '') + (g.photo ? ' photo-status' : '') : '')
      }
      id="focusStatus"
      aria-live="polite"
      style={
        shown
          ? { left: shown.left + 'px', top: shown.top + 'px', width: shown.width + 'px' }
          : undefined
      }
    >
      {shown ? shown.text : ''}
    </div>
  );
}

export function App({ store, controllers }: { store: Store; controllers: Controllers }) {
  const s = useSyncExternalStore(store.subscribe, store.getState);
  const stageRef = useRef<HTMLElement>(null),
    sceneRef = useRef<HTMLDivElement>(null),
    homeRef = useRef<HTMLDivElement>(null),
    sheetRef = useRef<HTMLDivElement>(null),
    appearanceRef = useRef<HTMLElement>(null);
  const fit = useStageFit(),
    t = top(s),
    sheet = isSheet(t.kind),
    detail = isSettingsDetail(t.kind);
  const homeState = useLatestWhen(s, !sheet);
  useEffect(() => {
    if (stageRef.current) return controllers.start(stageRef.current);
  }, [controllers]);
  const { className, vars } = stage(s),
    fade = s.look.crossfade;
  const click = (ev: MouseEvent<HTMLElement>) => {
    const el = ev.target instanceof Element ? ev.target.closest('[data-z]') : null;
    controllers.focusStage();
    if (!el || !ev.currentTarget.contains(el)) return;
    const action = pointAction(el);
    controllers.wake();
    if (action) store.dispatch(action);
  };
  return (
    <StoreContext.Provider value={store}>
      <main
        ref={stageRef}
        className={className}
        id="stage"
        tabIndex={0}
        style={{ ...vars, ...fit }}
        onClick={click}
        aria-label="TV stage, 1920 by 1080. Click it, then use the arrow keys, Enter for OK and Escape for Back."
      >
        <div
          ref={sceneRef}
          className="scene"
          id="scene"
          aria-hidden={sheet || detail ? 'true' : 'false'}
        >
          <div className="bg" id="bg" aria-hidden="true">
            <img
              className="photo"
              id="photo"
              alt=""
              src={s.look.installed ? photoSrc(s.look.installed.wall) : undefined}
            />
            {fade && (
              <OutgoingPhoto
                key={fade.token}
                src={fade.wall ? photoSrc(fade.wall) : undefined}
                ms={s.env.crossfadeMs}
              />
            )}
            <div className="scrim"></div>
            <div className="shade"></div>
            <div className="ph-dim"></div>
            <div className="ph-scrim"></div>
            <div className="ph-col"></div>
            <div className="ut-dim ut-tr"></div>
            <div className="ut-dim ut-br"></div>
          </div>
          <div ref={homeRef} className="home" id="home" style={homeFontVars(s)}>
            <Home h={homeInput(homeState)} sceneRef={sceneRef} />
          </div>
        </div>
        <div
          id="cinemaVeil"
          className="cinema-veil"
          aria-hidden="true"
          style={
            s.veil === 'unset'
              ? undefined
              : { opacity: s.veil === 'dim' ? String(s.env.dimAmount) : '0' }
          }
        ></div>
        <Appearance s={s} appearanceRef={appearanceRef} />
        <Sheet s={s} sheetRef={sheetRef} />
        <FocusStatus s={s} stageRef={stageRef} homeRef={homeRef} sheetRef={sheetRef} />
      </main>
    </StoreContext.Provider>
  );
}
