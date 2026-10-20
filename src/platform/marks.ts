import { ICONS } from '../model/assets.ts';

/** Bundled brand marks are probed once; a mark whose SVG fails to load hides its glyph. */
const probes = new Map<string, 'loading' | 'ok' | 'bad'>();
const listeners = new Set<() => void>();

export function probeMark(id: string): void {
  if (probes.has(id)) return;
  probes.set(id, 'loading');
  const im = new Image();
  im.onload = () => {
    probes.set(id, 'ok');
  };
  im.onerror = () => {
    probes.set(id, 'bad');
    listeners.forEach((l) => l());
  };
  im.src = ICONS + id + '.svg';
}
export function isBadMark(id: string): boolean {
  return probes.get(id) === 'bad';
}
export function subscribeMarks(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
