import { cinemaAllowed, rotationActive } from './model/reducer.ts';
import { rotationMode } from './model/state.ts';
import type { RemoteKey } from './model/types.ts';
import { createUISounds } from './platform/sounds.ts';
import type { Store } from './store.ts';

const KEYS: Record<number, RemoteKey | undefined> = {
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  13: 'ok',
  27: 'back',
  8: 'back',
  10_009: 'back',
  461: 'back',
};

/** Dims Home after an idle period. Any input wakes it; panels and a hidden app keep it clear. */
function createCinema(store: Store) {
  let timer = 0,
    running = false;
  const allowed = () => cinemaAllowed(store.getState());
  const set = (dimmed: boolean) => {
    const veil = store.getState().veil;
    if (dimmed ? veil !== 'dim' : veil !== 'clear') store.dispatch({ type: 'veil', dimmed });
  };
  function sync(): void {
    if (!running) return;
    if (!allowed()) {
      clearTimeout(timer);
      timer = 0;
      set(false);
      return;
    }
    if (!timer && store.getState().veil !== 'dim') {
      timer = window.setTimeout(() => {
        timer = 0;
        if (allowed()) set(true);
      }, store.getState().env.cinemaSeconds * 1000);
    }
  }
  function wake(): void {
    if (!running) return;
    clearTimeout(timer);
    timer = 0;
    set(false);
    sync();
  }
  return {
    wake,
    sync,
    start() {
      running = true;
      sync();
    },
    stop() {
      running = false;
      clearTimeout(timer);
      timer = 0;
    },
  };
}

/** Counts visible photo Home time only; a new photo, mode or collection starts a new interval. */
function createRotation(store: Store) {
  let timer = 0,
    activeSince = 0,
    activeMs = 0,
    key = '',
    running = false;
  function pause(): void {
    if (activeSince) {
      activeMs += Date.now() - activeSince;
      activeSince = 0;
    }
    clearTimeout(timer);
    timer = 0;
  }
  function sync(): void {
    const s = store.getState(),
      k = s.prefs.wall + '|' + s.prefs.mode + '|' + s.prefs.collection;
    pause();
    if (k !== key) {
      activeMs = 0;
      key = k;
    }
    if (!running || !rotationActive(s)) return;
    activeSince = Date.now();
    timer = window.setTimeout(
      () => {
        pause();
        activeMs = 0;
        store.dispatch({ type: 'rotate' });
      },
      Math.max(10, rotationMode(s.prefs).min * s.env.minuteMs - activeMs),
    );
  }
  return {
    sync,
    info: () => ({
      activeMs: activeMs + (activeSince ? Date.now() - activeSince : 0),
      active: !!activeSince,
    }),
    start() {
      running = true;
      sync();
    },
    stop() {
      running = false;
      pause();
    },
  };
}

export type Controllers = ReturnType<typeof createControllers>;

export function createControllers(store: Store) {
  const cinema = createCinema(store),
    rotation = createRotation(store);
  const sounds = createUISounds(store.getState().env.soundVolume);
  const audible = () => {
    const s = store.getState();
    return s.prefs.sounds === 'on' && !s.hidden && !document.hidden && s.veil !== 'dim';
  };
  const click = () => sounds.play(audible);
  let stage: HTMLElement | null = null;
  const focusStage = () => {
    if (stage) stage.focus({ preventScroll: true });
  };

  function start(el: HTMLElement): () => void {
    stage = el;
    let held: Record<number, boolean> = {};
    const keydown = (ev: KeyboardEvent) => {
      const wasDimmed = store.getState().veil === 'dim';
      cinema.wake();
      const code = ev.keyCode,
        k = KEYS[code];
      if (code === 9) {
        ev.preventDefault();
        return;
      }
      if (!k || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      ev.preventDefault();
      // Held OK and Back act once until the key is released.
      if (k === 'ok' || k === 'back') {
        if (ev.repeat || held[code]) return;
        held[code] = true;
        if (!wasDimmed) click();
      }
      store.dispatch({ type: 'key', key: k });
    };
    const keyup = (ev: KeyboardEvent) => {
      delete held[ev.keyCode];
    };
    const blur = () => {
      held = {};
    };
    const focus = () => {
      cinema.wake();
      store.dispatch({ type: 'resume' });
      focusStage();
    };
    const visibility = () => {
      held = {};
      cinema.wake();
      store.dispatch({ type: 'visibility', hidden: document.hidden });
      if (document.hidden) sounds.silence();
      else focusStage();
    };
    const wake = () => cinema.wake();
    document.addEventListener('mousemove', wake);
    document.addEventListener('touchstart', wake);
    document.addEventListener('click', wake);
    document.addEventListener('keydown', keydown);
    document.addEventListener('keyup', keyup);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    const unsubscribe = store.subscribe(() => {
      cinema.sync();
      rotation.sync();
      if (audible()) sounds.preload();
      else sounds.silence();
    });
    cinema.start();
    rotation.start();
    if (audible()) sounds.preload();
    focusStage();
    return () => {
      unsubscribe();
      cinema.stop();
      rotation.stop();
      sounds.stop();
      document.removeEventListener('mousemove', wake);
      document.removeEventListener('touchstart', wake);
      document.removeEventListener('click', wake);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('keyup', keyup);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      stage = null;
    };
  }

  return { start, click, wake: cinema.wake, focusStage, rotationInfo: rotation.info };
}
