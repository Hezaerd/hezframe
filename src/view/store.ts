import { createContext, useContext, useSyncExternalStore } from 'react';
import type { State } from '../model/types.ts';
import type { Store } from '../store.ts';

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreContext is missing');
  return store;
}

/** Subscribes a component to one slice. The selector must return a stable value for an unchanged slice. */
export function useSelect<T>(select: (s: State) => T): T {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, () => select(store.getState()));
}
