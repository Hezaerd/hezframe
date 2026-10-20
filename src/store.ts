import { reduce, rendersAfter, settle, type Result } from './model/reducer.ts';
import type { Action, Effect, State } from './model/types.ts';

export interface Store {
  getState(): State;
  dispatch(action: Action): void;
  subscribe(listener: () => void): () => void;
}

function deepFreeze(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value) || value instanceof Map)
    return;
  Object.freeze(value);
  for (const v of Object.values(value)) deepFreeze(v);
}

/**
 * Runs the reducer synchronously. With `freeze`, each new state is frozen so an accidental
 * mutation of a previous state throws. Effects run in order as they are produced; any action they
 * dispatch at once (a storage result, the browser's device error) joins the same drain, so
 * listeners only ever see a state where the whole chain has been applied.
 */
export function createStore(
  start: Result,
  run: (effect: Effect, store: Store) => void,
  freeze = false,
): Store {
  let state = start.state,
    draining = false;
  const queue: Action[] = [],
    listeners = new Set<() => void>();
  const store: Store = {
    getState: () => state,
    dispatch(action) {
      queue.push(action);
      if (draining) return;
      draining = true;
      let rendered = false;
      try {
        let next: Action | undefined;
        while ((next = queue.shift())) {
          const r = reduce(state, next);
          state = r.state;
          if (rendersAfter(next)) rendered = true;
          for (const effect of r.effects) run(effect, store);
        }
        if (rendered) state = settle(state);
        if (freeze) deepFreeze(state);
      } finally {
        draining = false;
      }
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  draining = true;
  try {
    for (const effect of start.effects) run(effect, store);
  } finally {
    draining = false;
  }
  const pending = queue.splice(0);
  for (const action of pending) store.dispatch(action);
  return store;
}
