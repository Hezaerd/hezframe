import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type RefObject,
} from 'react';
import { matSrc, px } from '../model/assets.ts';
import { clamp } from '../model/ids.ts';
import { homeFont, isSettingsDetail, top } from '../model/state.ts';
import { PH_HEIGHT, PH_PITCH, PH_TOP, SCRIM_Y, UTILS } from '../model/tables.ts';
import type { App, AppId, Display, Env, State } from '../model/types.ts';
import { dockGeom } from '../model/views.ts';
import { currentMinute, subscribeMinute } from '../platform/clock.ts';
import { useLastShown, useLatestWhen, useStableOrder } from './hooks.ts';
import { Icon } from './icons.tsx';
import { AppMark } from './marks.tsx';
import { BundleImage, LensPlates, PhotoPlates, type Placement } from './plates.tsx';
import { Rebuilt } from './rebuilt.tsx';
import { useStore } from './store.ts';
import { typeset, type TypesetInput } from './typeset.ts';

/**
 * Everything Home renders from. Keys inside Settings change the stage but not these fields,
 * so Home skips those renders entirely; on the remote-key path that is most of Home's cost.
 */
export interface HomeInput extends TypesetInput {
  env: Env;
  /** Home focus: on Home itself, remembered behind a Settings preview, or nowhere. */
  zone: 'apps' | 'util' | 'preview' | null;
  u: number;
  i: number;
  press: AppId | null;
  err: boolean;
  /** A failed write is reported on the focused Home control. */
  status: boolean;
  revision: number;
  first: number;
  photo: number;
  dockOff: number;
}

export function homeInput(s: State): HomeInput {
  const t = top(s),
    detail = isSettingsDetail(t.kind);
  return {
    env: s.env,
    prefs: s.prefs,
    apps: s.apps,
    metrics: s.fonts.metrics,
    font: homeFont(s),
    zone: detail ? 'preview' : t.kind === 'home' ? t.zone : null,
    u: t.kind === 'home' ? t.u : -1,
    i: Math.max(0, s.session.selIdx),
    press: s.session.press,
    err: !!s.session.err,
    status: !!s.session.err && !detail,
    revision: s.catalog.revision,
    first: s.scroll.first,
    photo: s.scroll.photo,
    dockOff: s.scroll.dockOff,
  };
}

const shallowEqual = (a: object, b: object) =>
  Object.keys(a).every((k) => Object.is(Reflect.get(a, k), Reflect.get(b, k)));
const nameOf = (h: HomeInput, id: AppId): App => {
  const a = h.apps.get(id);
  if (!a) throw new Error('Unknown app: ' + id);
  return a;
};

function Caption({ h }: { h: HomeInput }) {
  const minute = useSyncExternalStore(subscribeMinute, currentMinute);
  const now = new Date(minute * 60_000),
    ts = typeset(h),
    c = h.prefs;
  const hours = now.getHours(),
    m = now.getMinutes(),
    time = (hours % 12 || 12) + ':' + (m < 10 ? '0' : '') + m;
  const metrics = h.metrics[h.font],
    digits = !!(metrics && metrics.digitCell);
  const id = c.home[h.i];
  const fullName =
    c.apps !== 'icons' &&
    id &&
    (c.layout === 'list'
      ? ts.photoLabel(id).size < 88 || ts.photoLabel(id).ellipsis
      : h.zone === 'apps' && ts.reducedDockLabel(id))
      ? nameOf(h, id).name
      : '';
  const greeting =
    c.greeting === 'on'
      ? (hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening') +
        (h.env.greetingName ? ', ' + h.env.greetingName : '')
      : '';
  return (
    <div className="caption" id="caption">
      <span className="clock">
        {digits
          ? [...time].map((char, index) =>
              /[0-9]/.test(char) ? (
                // oxlint-disable-next-line react/no-array-index-key -- Digits are fixed clock positions, not reorderable items.
                <span className="clock-digit" key={index}>
                  {char}
                </span>
              ) : (
                char
              ),
            )
          : time}
      </span>
      {greeting && <span className="greeting">{greeting}</span>}
      {fullName && <span className="cap-line full-name">{fullName}</span>}
    </div>
  );
}

interface LabelGeometry {
  key: string;
  text: string;
  width: number;
  left: number;
  top: number;
}

/** Icons-only Home controls name the focused control. A new name restarts its fade-in. */
function UtilFocusLabel({ geometry }: { geometry: LabelGeometry | null }) {
  const shown = useLastShown(geometry, JSON.stringify(geometry));
  const [armed, setArmed] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!geometry) {
      // oxlint-disable-next-line react/set-state-in-effect -- Reset the measured label crossfade before paint.
      if (armed !== null) setArmed(null);
      return;
    }
    if (armed === geometry.key) return;
    ref.current?.getBoundingClientRect();
    // oxlint-disable-next-line react/set-state-in-effect -- The style read above prepares this label's opacity transition.
    setArmed(geometry.key);
  }, [armed, geometry]);
  const on = !!geometry && armed === geometry.key;
  return (
    <div
      ref={ref}
      className={'util-focus-label' + (on ? ' is-on' : '')}
      id="utilFocusLabel"
      aria-hidden="true"
      style={
        shown
          ? { width: shown.width + 'px', left: shown.left + 'px', top: shown.top + 'px' }
          : undefined
      }
    >
      {shown ? shown.text : ''}
    </div>
  );
}

function AppFocusName({ h }: { h: HomeInput }) {
  const c = h.prefs,
    list = c.layout === 'list';
  let geometry: { text: string; width: number; left: number; top: number } | null = null;
  if (c.apps === 'icons' && h.zone === 'apps') {
    const ts = typeset(h),
      name = nameOf(h, c.home[h.i]).name,
      width = Math.min(
        list ? 1056 : 1640,
        Math.ceil(ts.width(name, list ? 40 : 36, 500, -0.6, 'primary') + 8),
      );
    let x: number, y: number;
    if (list) {
      x = 280;
      y = PH_TOP + 1 + (h.i - h.photo) * PH_PITCH + 134 / 2 - 24;
    } else {
      const n = c.home.length,
        g = dockGeom(c.apps, n),
        anchor = clamp(h.i, 0, n - 1);
      x = clamp(g.x + 16 + anchor * g.pitch - h.dockOff + g.tw / 2 - width / 2, 140, 1780 - width);
      y = 932;
    }
    geometry = { text: name, width, left: x, top: y + ts.shift('primary', list ? 40 : 36) };
  }
  const shown = useLastShown(geometry, JSON.stringify(geometry));
  return (
    <div
      className={'app-focus-name' + (geometry ? ' is-on' : '')}
      id="appFocusName"
      aria-hidden="true"
      style={
        shown
          ? { width: shown.width + 'px', left: shown.left + 'px', top: shown.top + 'px' }
          : undefined
      }
    >
      {shown ? shown.text : ''}
    </div>
  );
}

/** The Home controls, with the measured focus label and glass lens that follow them. */
function HomeControls({
  h,
  sceneRef,
}: {
  h: HomeInput;
  sceneRef: RefObject<HTMLDivElement | null>;
}) {
  const store = useStore(),
    c = h.prefs;
  const firstButton = useRef<HTMLButtonElement>(null),
    secondButton = useRef<HTMLButtonElement>(null);
  const firstLabel = useRef<HTMLSpanElement>(null),
    secondLabel = useRef<HTMLSpanElement>(null);
  const buttons = [firstButton, secondButton],
    labels = [firstLabel, secondLabel];
  const [overlay, setOverlay] = useState<{
    label: LabelGeometry | null;
    lens: { key: string; placement: Placement } | null;
  }>({ label: null, lens: null });
  const iconsOnly = c.controls === 'icons',
    focused = h.zone === 'util' ? h.u : -1;
  useLayoutEffect(() => {
    const button = focused >= 0 ? (focused === 0 ? firstButton : secondButton).current : null,
      scene = sceneRef.current;
    let label: LabelGeometry | null = null,
      lens: { key: string; placement: Placement } | null = null;
    if (button && scene && (iconsOnly || c.focus === 'glass')) {
      const ts = typeset(h),
        sr = scene.getBoundingClientRect(),
        scale = sr.width / 1920 || 1,
        list = c.layout === 'list',
        r = button.getBoundingClientRect();
      if (iconsOnly) {
        const text = h.err ? 'Not saved. OK tries again.' : UTILS[focused].label,
          width = Math.ceil(ts.width(text, 28, 500, -0.2) + 8);
        const x = list ? 1730 - width : (r.left + r.width / 2 - sr.left) / scale - width / 2;
        label = {
          key: 'util.' + UTILS[focused].id + '|' + text + '|' + h.font,
          text,
          width,
          left: clamp(x, 112, 1808 - width),
          top: (list ? (r.top + r.height / 2 - sr.top) / scale - 19 : 140) + ts.shift('ui', 28),
        };
      }
      if (c.focus === 'glass') {
        const y = (r.top - sr.top) / scale + 2;
        let x: number, width: number;
        if (list) {
          const labelLeft = label
            ? sr.left + label.left * scale
            : ((focused === 0 ? firstLabel : secondLabel).current?.getBoundingClientRect().left ??
              r.left);
          x = (labelLeft - sr.left) / scale - 24;
          width = 1800 - x;
        } else {
          x = (r.left - sr.left) / scale;
          width = r.width / scale;
        }
        lens = {
          key: 'util.' + UTILS[focused].id + '|' + x + '|' + y + '|' + width,
          placement: { x, y, width, height: 60 },
        };
      }
    }
    // oxlint-disable-next-line react/set-state-in-effect -- Control bounds determine the glass lens and label position before paint.
    setOverlay((prev) =>
      JSON.stringify(prev) === JSON.stringify({ label, lens }) ? prev : { label, lens },
    );
  }, [
    h,
    focused,
    iconsOnly,
    sceneRef,
    c.focus,
    c.layout,
    firstButton,
    secondButton,
    firstLabel,
    secondLabel,
  ]);
  const hover = (ev: MouseEvent<HTMLElement>) => {
    const b = ev.target instanceof Element ? ev.target.closest('[data-z]') : null;
    if (
      !b ||
      !ev.currentTarget.contains(b) ||
      (ev.relatedTarget instanceof Node && b.contains(ev.relatedTarget))
    )
      return;
    if (b.getAttribute('data-z') === 'util')
      store.dispatch({ type: 'hoverUtil', index: Number(b.getAttribute('data-i')) });
  };
  return (
    <>
      <nav
        className={'utils quiet-utils is-' + c.controls + (h.zone === 'util' ? ' is-awake' : '')}
        id="utils"
        aria-label="Home controls"
        onMouseOver={hover}
      >
        {UTILS.map((u, i) => {
          const focus = focused === i;
          return (
            <button
              key={u.id}
              ref={buttons[i]}
              type="button"
              tabIndex={-1}
              className={
                'u' +
                (focus ? ' is-focus' : '') +
                (focus && h.status && !iconsOnly ? ' has-local-status' : '')
              }
              data-z="util"
              data-i={i}
              data-action={'util.' + u.id}
              aria-label={u.label}
            >
              <span className="u-content">
                <Icon name={u.icon} underlay />
                <span className="u-label" ref={labels[i]}>
                  {u.label}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
      <UtilFocusLabel geometry={overlay.label} />
      <AppFocusName h={h} />
      <LensPlates target={overlay.lens} />
    </>
  );
}

interface TileProps {
  env: Env;
  app: App;
  i: number;
  left: number;
  focus: boolean;
  sel: boolean;
  partial: boolean;
  press: boolean;
  outside: boolean;
  status: boolean;
  size: number;
  labelTop: number;
  apps: Display;
  bg: string;
  font: string;
  revision: number;
  register: (id: AppId, el: HTMLElement | null) => void;
}
/** One Dock app. Memoised so a key press re-renders only the tiles whose state changed. */
const DockTile = memo(function DockTile(p: TileProps) {
  const a = p.app;
  return (
    <div
      className={
        'tile k-app' +
        (p.focus ? ' is-focus' : '') +
        (p.sel ? ' is-sel' : '') +
        (p.partial ? ' is-partial' : '') +
        (a.mark ? '' : ' is-text') +
        (p.press ? ' is-press' : '') +
        (p.outside ? ' is-outside-icon' : '') +
        (p.focus && p.status ? ' has-local-status' : '')
      }
      style={{ transform: 'translate3d(' + p.left + 'px,0,0)' }}
      role="button"
      aria-label={a.name}
      data-z="app"
      data-i={p.i}
      data-action={'home.app.' + a.id}
    >
      <Rebuilt markup={[a.id, p.size, p.bg, p.apps, p.font, p.revision].join('|')}>
        <span className="tile-content">
          {p.apps !== 'text' && (
            <AppMark
              markRef={(el) => p.register(a.id, el)}
              env={p.env}
              app={a}
              light={p.bg === 'light'}
              w={p.apps === 'icons' ? 136 : 120}
              h={p.apps === 'icons' ? 88 : 72}
              size={p.apps === 'icons' ? 72 : 58}
            />
          )}
          {p.apps !== 'icons' && (
            <span className="label" style={{ fontSize: p.size + 'px', top: p.labelTop + 'px' }}>
              <span
                className="label-ink"
                ref={(el) => {
                  if (p.apps === 'text') p.register(a.id, el);
                }}
              >
                {a.name}
              </span>
            </span>
          )}
        </span>
      </Rebuilt>
    </div>
  );
});

const Dock = memo(function Dock({ h }: { h: HomeInput }) {
  const store = useStore(),
    c = h.prefs,
    active = c.layout === 'dock',
    ts = typeset(h);
  const n = c.home.length,
    g = dockGeom(c.apps, n),
    anchor = clamp(h.i, 0, n - 1),
    off = h.dockOff;
  const order = useStableOrder(active ? c.home : []);
  const shelf = useRef<HTMLDivElement>(null),
    contents = useRef(new Map<string, HTMLElement>());
  const register = useCallback((id: AppId, el: HTMLElement | null) => {
    if (el) contents.current.set(id, el);
  }, []);
  const [outside, setOutside] = useState('');
  // A wide label can reach the shelf edge before its icon. Watch the icon through the track's
  // transition, so the label and icon disappear together.
  useLayoutEffect(() => {
    if (!active || !shelf.current) return;
    const clip = shelf.current;
    const measure = () => {
      if (store.getState().prefs.layout !== 'dock') return;
      const box = clip.getBoundingClientRect(),
        ids: string[] = [];
      for (const id of order) {
        const el = contents.current.get(id),
          r = el && el.getBoundingClientRect();
        if (r && (r.right <= box.left || r.left >= box.right)) ids.push(id);
      }
      const next = ids.join('|');
      setOutside((prev) => (prev === next ? prev : next));
    };
    measure();
    if (!g.broad) return;
    const until = Date.now() + 220;
    let frame = requestAnimationFrame(function loop() {
      if (store.getState().prefs.layout !== 'dock') return;
      measure();
      if (Date.now() < until) frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  });
  const tileFocus = h.zone === 'apps',
    tileSel = h.zone === 'util' || h.zone === 'preview',
    out = outside.split('|');
  return (
    <>
      <div
        className="dock"
        id="dock"
        style={
          active
            ? {
                left: px(g.x),
                top: px(g.y),
                width: px(g.w),
                height: px(g.h),
                '--tile-w': px(g.tw),
                '--tile-h': px(g.th),
                '--dock-h': px(g.h),
              }
            : undefined
        }
      >
        <div className="mat" aria-hidden="true">
          <BundleImage
            className="mat-img"
            id="matImg"
            src={(b) => matSrc(b.wall, b.material)}
            style={
              active
                ? {
                    left: px(-g.x),
                    top: px(-g.y),
                    transformOrigin: '960px ' + (g.y + g.h / 2) + 'px',
                  }
                : undefined
            }
          />
          <div
            className="mat-scrim"
            id="matScrim"
            style={
              active
                ? {
                    left: px(-g.x),
                    top: px(SCRIM_Y - g.y),
                    transformOrigin: '960px ' + (g.y + g.h / 2 - SCRIM_Y) + 'px',
                  }
                : undefined
            }
          ></div>
          <div className="mat-veil"></div>
        </div>
        <div
          ref={shelf}
          className={
            'shelf' +
            (active && g.broad && off > 0 ? ' fade-l' : '') +
            (active && g.broad && off + g.shelf < n * g.pitch - 8 ? ' fade-r' : '')
          }
          id="shelf"
          style={active ? { width: px(g.shelf) } : undefined}
        >
          <div
            className="track"
            id="track"
            style={active ? { transform: 'translate3d(' + -off + 'px,0,0)' } : undefined}
          >
            <div
              className={
                'plate' +
                (active
                  ? h.zone === null
                    ? ''
                    : tileFocus
                      ? ' on-focus'
                      : tileSel
                        ? ' on-sel'
                        : ''
                  : '')
              }
              id="plate"
              style={
                active ? { transform: 'translate3d(' + anchor * g.pitch + 'px,0,0)' } : undefined
              }
            ></div>
            {order.map((id) => {
              const i = c.home.indexOf(id),
                left = i * g.pitch,
                size = ts.dockLabelSize(id);
              return (
                <DockTile
                  key={id}
                  env={h.env}
                  app={nameOf(h, id)}
                  i={i}
                  left={left}
                  focus={tileFocus && i === anchor}
                  sel={tileSel && i === anchor}
                  partial={g.broad && (left - off < -1 || left + g.tw - off > g.shelf + 1)}
                  press={h.press === id}
                  outside={out.includes(id)}
                  status={h.status}
                  size={size}
                  labelTop={(c.apps === 'text' ? 28 : 128) + ts.shift('primary', size)}
                  apps={c.apps}
                  bg={c.bg}
                  font={h.font}
                  revision={h.revision}
                  register={register}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div
        className={'cue' + (active && !g.broad && h.first > 0 ? ' is-on' : '')}
        id="cueL"
        aria-hidden="true"
        style={active ? { left: px(g.x - 72), top: px(g.y + g.h / 2 - 24) } : undefined}
      >
        <Icon name="left" />
      </div>
      <div
        className={'cue' + (active && !g.broad && h.first + g.vis < n ? ' is-on' : '')}
        id="cueR"
        aria-hidden="true"
        style={active ? { left: px(g.x + g.w + 24), top: px(g.y + g.h / 2 - 24) } : undefined}
      >
        <Icon name="right" />
      </div>
    </>
  );
});

interface RowProps {
  env: Env;
  app: App;
  i: number;
  focus: boolean;
  sel: boolean;
  press: boolean;
  status: boolean;
  size: number;
  top: number;
  apps: Display;
  bg: string;
  font: string;
  revision: number;
}
/** One List app. Memoised so a key press re-renders only the rows whose state changed. */
const PhotoRow = memo(function PhotoRow(p: RowProps) {
  const a = p.app;
  return (
    <div
      className={
        'ph-row k-app' +
        (p.focus ? ' is-focus' : '') +
        (p.sel ? ' is-sel' : '') +
        (p.press ? ' is-press' : '') +
        (p.focus && p.status ? ' has-local-status' : '')
      }
      style={{
        width: '1200px',
        height: PH_PITCH + 'px',
        transform: 'translate3d(0,' + p.i * PH_PITCH + 'px,0)',
      }}
      role="button"
      aria-label={a.name}
      data-z="app"
      data-i={p.i}
      data-action={'home.app.' + a.id}
    >
      <Rebuilt markup={[a.id, p.size, p.bg, p.apps, p.font, p.revision].join('|')}>
        <span className="ph-group">
          {p.apps !== 'text' && (
            <AppMark
              env={p.env}
              app={a}
              light={p.bg === 'light'}
              w={p.apps === 'icons' ? 88 : 84}
              h={p.apps === 'icons' ? 88 : 64}
              size={p.apps === 'icons' ? 72 : 54}
            />
          )}
          {p.apps !== 'icons' && (
            <span className="ph-name" style={{ fontSize: p.size + 'px', top: p.top + 'px' }}>
              {a.name}
            </span>
          )}
        </span>
      </Rebuilt>
    </div>
  );
});

const PhotoList = memo(function PhotoList({ h }: { h: HomeInput }) {
  const c = h.prefs,
    active = c.layout === 'list',
    ts = typeset(h);
  const n = c.home.length,
    anchor = clamp(h.i, 0, n - 1),
    slot = anchor - h.photo;
  const order = useStableOrder(active ? c.home : []);
  const rowFocus = h.zone === 'apps',
    remembered = h.zone === 'util' || h.zone === 'preview';
  let target: { key: string; placement: Placement; state: string } | null = null;
  if (active) {
    const width = ts.listPlateWidth(c.home[anchor]),
      y = PH_TOP + 1 + slot * PH_PITCH;
    target = {
      key: c.home[anchor] + '|' + width + '|134|' + y,
      placement: { x: 112, y, width, height: 134 },
      state:
        h.zone === null
          ? ''
          : c.focus === 'glass' && rowFocus
            ? 'on-focus'
            : c.focus === 'glass' && remembered
              ? 'on-sel'
              : '',
    };
  }
  return (
    <div className="ph-scene" id="phScene">
      <PhotoPlates target={target} />
      <div
        className="ph-list"
        id="phList"
        style={active ? { height: PH_HEIGHT + 'px' } : undefined}
      >
        <div
          className="ph-rows"
          id="phRows"
          style={
            active
              ? { top: '148px', transform: 'translate3d(0,' + -h.photo * PH_PITCH + 'px,0)' }
              : undefined
          }
        >
          {order.map((id) => {
            const i = c.home.indexOf(id),
              typography = ts.photoLabel(id);
            return (
              <PhotoRow
                key={id}
                env={h.env}
                app={nameOf(h, id)}
                i={i}
                focus={rowFocus && i === anchor}
                sel={remembered && i === anchor}
                press={h.press === id}
                status={h.status}
                size={typography.size}
                top={typography.top}
                apps={c.apps}
                bg={c.bg}
                font={h.font}
                revision={h.revision}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});

/**
 * Home is not re-rendered while a full-screen panel covers it, as before: on return its tiles
 * animate from where they were. Each layout keeps its last render while the other is in use.
 */
export const Home = memo(
  function Home({ h, sceneRef }: { h: HomeInput; sceneRef: RefObject<HTMLDivElement | null> }) {
    const dock = useLatestWhen(h, h.prefs.layout === 'dock'),
      list = useLatestWhen(h, h.prefs.layout === 'list');
    return (
      <>
        <Caption h={h} />
        <HomeControls h={h} sceneRef={sceneRef} />
        <Dock h={dock} />
        <PhotoList h={list} />
      </>
    );
  },
  (a, b) => a.sceneRef === b.sceneRef && shallowEqual(a.h, b.h),
);
