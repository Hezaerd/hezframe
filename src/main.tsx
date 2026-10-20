import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createControllers } from './controllers.ts';
import { readEnv } from './env.ts';
import { serialise } from './model/prefs.ts';
import { boot } from './model/reducer.ts';
import type { BundleKey, Effect, State } from './model/types.ts';
import { loadCatalog, runDevice } from './platform/device.ts';
import { createFontService, initTextMeasure } from './platform/fonts.ts';
import { createImageLoader } from './platform/images.ts';
import { readStored, writeStored } from './platform/storage.ts';
import { installQA, presetMinuteMs } from './qa.ts';
import { createStore, type Store } from './store.ts';
import { App } from './view/App.tsx';

const container = document.getElementById('root');
if (!container) throw new Error('Missing HezFrame root');
initTextMeasure(document);

const env = readEnv(window, presetMinuteMs());
const fonts = createFontService(document),
  images = createImageLoader();
let wakeCinema = () => {};

function run(effect: Effect, store: Store): void {
  switch (effect.kind) {
    case 'persist': {
      const ok = writeStored(JSON.stringify(serialise(env, effect.prefs, store.getState().apps)));
      store.dispatch({ type: 'persisted', intent: effect.intent, prefs: effect.prefs, ok });
      return;
    }
    case 'device':
      runDevice(effect.op, (error) =>
        store.dispatch({ type: 'deviceDone', title: effect.title, error }),
      );
      return;
    case 'loadCatalog':
      loadCatalog((error, entries) =>
        store.dispatch({ type: 'catalogLoaded', request: effect.request, error, entries }),
      );
      return;
    case 'loadBundle':
      images.load(effect.bundle, (ok) =>
        store.dispatch({ type: 'bundleLoaded', token: effect.token, bundle: effect.bundle, ok }),
      );
      return;
    case 'ensureFont':
      fonts.ensureFont(
        effect.font,
        (ok, reason) => store.dispatch({ type: 'fontResult', token: effect.token, ok, reason }),
        (snapshot) => store.dispatch({ type: 'fontsChanged', ...snapshot }),
      );
      return;
    case 'after':
      window.setTimeout(() => store.dispatch(effect.action), effect.ms);
      return;
    case 'frames':
      requestAnimationFrame(() => {
        if (effect.count === 1) store.dispatch(effect.action);
        else requestAnimationFrame(() => store.dispatch(effect.action));
      });
      return;
    case 'wakeCinema':
      wakeCinema();
      return;
    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
}

/** Bundles the store can still show; the loader keeps their decoded images alive. */
function bundlesInUse(s: State): (BundleKey | null)[] {
  const flow = s.look.flow,
    retry = s.stack.map((v) => (v.kind === 'wallpaper' ? v.retryBundle : null));
  return [
    s.look.installed,
    s.look.committedBundle,
    s.look.previewBundle,
    flow && flow.kind === 'look' ? flow.loaded : null,
    ...retry,
  ];
}

const store = createStore(boot(env, readStored), run, import.meta.env.DEV);
store.subscribe(() => images.retain(bundlesInUse(store.getState())));
const controllers = createControllers(store);
wakeCinema = controllers.wake;
installQA(store, controllers);

createRoot(container).render(
  <StrictMode>
    <App store={store} controllers={controllers} />
  </StrictMode>,
);
