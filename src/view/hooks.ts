import { useState } from 'react';

/** The latest value while `active`; otherwise the value from the last render where it was active. */
export function useLatestWhen<T>(value: T, active: boolean): T {
  const [kept, setKept] = useState(value);
  if (active && kept !== value) setKept(value);
  return active ? value : kept;
}

/**
 * Keys in first-seen order. Rows are absolutely positioned, so DOM order never needs to follow
 * the list; keeping it fixed means React never moves a row node, which would cancel its transition.
 */
export function useStableOrder<K extends string>(keys: readonly K[]): K[] {
  const [order, setOrder] = useState<K[]>(() => keys.slice());
  const present = new Set(keys), kept = order.filter(k => present.has(k)), seen = new Set(kept);
  const added = keys.filter(k => !seen.has(k));
  const next = !added.length && kept.length === order.length ? order : kept.concat(added);
  if (next !== order) setOrder(next);
  return next;
}

/** The current value, or the last one shown, so an element fading out keeps its text and place. */
export function useLastShown<T>(value: T | null, signature: string): T | null {
  const [last, setLast] = useState<{ value: T; signature: string } | null>(null);
  if (value !== null && (!last || last.signature !== signature)) setLast({ value, signature });
  return value !== null ? value : last ? last.value : null;
}
