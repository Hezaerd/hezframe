import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { ICONS, px } from '../model/assets.ts';
import { clamp } from '../model/ids.ts';
import type { App, Env } from '../model/types.ts';
import { isBadMark, probeMark, subscribeMarks } from '../platform/marks.ts';

/** A bundled brand mark, optically centred from its measured ink box. */
type MarkRef = (el: HTMLSpanElement | null) => void;

function BrandMark({ env, id, w, h, size, markRef }: { env: Env; id: string; w: number; h: number; size: number; markRef?: MarkRef }) {
  const bad = useSyncExternalStore(subscribeMarks, () => isBadMark(id));
  useEffect(() => probeMark(id), [id]);
  const m = env.iconMetrics[id], url = ICONS + id + '.svg';
  let box: CSSProperties;
  if (m) {
    const weight = clamp(Math.pow(0.45 / m.fill, 0.3), 0.84, 1.25);
    const k = Math.min(w / m.w, h / m.h, size * weight / Math.sqrt(m.w * m.h)), s = m.n * k;
    box = { width: px(s), height: px(s), left: px(w / 2 - (m.x + m.w / 2) * k), top: px(h / 2 - (m.y + m.h / 2) * k) };
  } else box = { width: w + 'px', height: h + 'px', left: 0, top: 0, objectFit: 'contain' };
  return (
    <span ref={markRef} className={'mark' + (bad ? ' is-bad' : '')} data-mark={id} style={{ width: w + 'px', height: h + 'px' }}>
      {env.maskSupport
        ? <span className="mk" style={{ ...box, WebkitMaskImage: 'url(' + url + ')', maskImage: 'url(' + url + ')' }} />
        : <img alt="" src={url} style={box} />}
    </span>
  );
}

/** Initials, covered by the TV's own app icon once that icon has loaded. */
function Monogram({ app, w, h, size, markRef }: { app: App; w: number; h: number; size: number; markRef?: MarkRef }) {
  const [icon, setIcon] = useState<'loading' | 'ready' | 'failed'>('loading');
  const img = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const el = img.current;
    if (el && el.complete) setIcon(el.naturalWidth ? 'ready' : 'failed');
  }, []);
  const words = app.name.split(/\s+/), letters = words[0].charAt(0) + (words.length > 1 ? words[1].charAt(0) : '');
  return (
    <span ref={markRef} className={'mark monogram' + (app.icon ? ' native-icon' : '') + (icon === 'ready' ? ' has-native-icon' : '')} style={{ width: w + 'px', height: h + 'px', fontSize: Math.round(size * .65) + 'px' }}>
      <span>{letters.toUpperCase()}</span>
      {app.icon && <img ref={img} alt="" data-native-icon="true" src={app.icon} style={icon === 'failed' ? { display: 'none' } : undefined} onLoad={() => setIcon('ready')} onError={() => setIcon('failed')} />}
    </span>
  );
}

export function AppMark({ env, app, light, w, h, size, markRef }: { env: Env; app: App; light: boolean; w: number; h: number; size: number; markRef?: MarkRef }) {
  if (app.mark && (env.maskSupport || !light)) return <BrandMark env={env} id={app.brand || app.id} w={w} h={h} size={size} markRef={markRef} />;
  return <Monogram key={app.icon} app={app} w={w} h={h} size={size} markRef={markRef} />;
}
