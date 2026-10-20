import { fieldSrc, matSrc, panelSrc, photoSrc } from '../model/assets.ts';
import type { BundleKey } from '../model/types.ts';

const key = (b: BundleKey) => b.wall + '|' + b.material;

function whenReady(im: HTMLImageElement, done: (ok: boolean) => void): void {
  let finished = false;
  const finish = (ok: boolean) => { if (finished) return; finished = true; clearTimeout(timer); done(ok); };
  const timer = setTimeout(() => finish(false), 8000);
  const ready = () => { if (im.decode) im.decode().then(() => finish(true), () => finish(false)); else finish(true); };
  if (im.complete) { if (im.naturalWidth) ready(); else finish(false); }
  else { im.onload = ready; im.onerror = () => finish(false); }
}

/**
 * Decodes a photo, its Settings backdrop and its material ahead of display, so every layer
 * changes in one frame. Decoded images stay referenced while the store can still show them.
 */
export function createImageLoader() {
  const retained = new Map<string, HTMLImageElement[]>(), loading = new Map<string, number>();
  function load(bundle: BundleKey, done: (ok: boolean) => void): void {
    const k = key(bundle), sources = [photoSrc(bundle.wall), panelSrc(bundle.wall), matSrc(bundle.wall, bundle.material), fieldSrc(bundle.wall, bundle.material)];
    const images = sources.filter((src, i) => sources.indexOf(src) === i).map(src => { const im = new Image(); im.alt = ''; im.src = src; return im; });
    let left = images.length, allOk = true;
    retained.set(k, images);
    loading.set(k, (loading.get(k) || 0) + 1);
    for (const im of images) whenReady(im, ok => {
      allOk = allOk && ok;
      if (--left) return;
      const n = (loading.get(k) || 1) - 1;
      if (n) loading.set(k, n); else loading.delete(k);
      done(allOk);
    });
  }
  function retain(bundles: (BundleKey | null)[]): void {
    const keep = new Set(bundles.filter((b): b is BundleKey => !!b).map(key));
    for (const k of Array.from(retained.keys())) if (!keep.has(k) && !loading.has(k)) retained.delete(k);
  }
  return { load, retain };
}
