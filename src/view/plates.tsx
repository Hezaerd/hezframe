import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { fieldSrc } from '../model/assets.ts';
import type { BundleKey } from '../model/types.ts';
import { useSelect } from './store.ts';

export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An image of the installed bundle. It follows the store directly: bundles swap even while Home is frozen. */
export function BundleImage({
  id,
  className,
  style,
  src,
}: {
  id: string;
  className: string;
  style?: CSSProperties;
  src: (b: BundleKey) => string;
}) {
  const installed = useSelect((s) => s.look.installed);
  return (
    <img
      className={className}
      id={id}
      alt=""
      style={style}
      src={installed ? src(installed) : undefined}
    />
  );
}

/** The stage-registered photo behind a glass plate; Clear tint enlarges it slightly. */
const PlateField = memo(function PlateField({
  id,
  imgId,
  placement,
  scrim,
}: {
  id: string;
  imgId: string;
  placement: Placement | null;
  scrim: boolean;
}) {
  const tint = useSelect(
    (s) => s.prefs.bg === 'photo' && s.prefs.material === 'tint' && !s.env.reducedMotion,
  );
  const style: CSSProperties | undefined = placement
    ? {
        transformOrigin:
          placement.x + placement.width / 2 + 'px ' + (placement.y + placement.height / 2) + 'px',
        transform:
          'translate3d(' +
          -placement.x +
          'px,' +
          -placement.y +
          'px,0)' +
          (tint ? ' scale(1.04)' : ''),
      }
    : undefined;
  return (
    <div className="ph-field" id={id} style={style}>
      <BundleImage id={imgId} className="ph-field-img" src={(b) => fieldSrc(b.wall, b.material)} />
      {scrim && <div className="scrim"></div>}
      <div className="shade"></div>
      <div className="ph-dim"></div>
      <div className="ph-scrim"></div>
      <div className="ph-col"></div>
      <div className="ut-dim ut-tr"></div>
      <div className="ut-dim ut-br"></div>
    </div>
  );
});

interface Pair {
  cur: 0 | 1;
  key: string | null;
  place: [Placement | null, Placement | null];
  rest: [string, string];
  lastCls: string;
  preparing: boolean;
}

/**
 * Two plates alternate. A new target goes to the hidden plate, which is first rendered at zero
 * opacity, style-resolved, then made current, so it fades in while the old plate fades out.
 * Plates never animate their size or position.
 */
function usePair(
  initial: string,
  request: {
    key: string;
    placement: Placement;
    current: string;
    outgoing: (last: string) => string;
  } | null,
  off: string,
) {
  const [pair, setPair] = useState<Pair>({
    cur: 0,
    key: null,
    place: [null, null],
    rest: [initial, initial],
    lastCls: initial,
    preparing: false,
  });
  const firstRef = useRef<HTMLDivElement>(null),
    secondRef = useRef<HTMLDivElement>(null);
  const refs = [firstRef, secondRef];
  let next = pair;
  if (!request) {
    if (pair.key !== null || pair.rest[0] !== off || pair.rest[1] !== off || pair.lastCls !== off)
      next = { ...pair, key: null, rest: [off, off], lastCls: off, preparing: false };
  } else if (request.key !== pair.key) {
    const cur = pair.cur === 0 ? 1 : 0,
      place: Pair['place'] = [pair.place[0], pair.place[1]],
      rest: Pair['rest'] = [pair.rest[0], pair.rest[1]];
    place[cur] = request.placement;
    rest[pair.cur] = request.outgoing(pair.lastCls);
    next = { cur, key: request.key, place, rest, lastCls: request.current, preparing: true };
  } else if (!pair.preparing && pair.lastCls !== request.current)
    next = { ...pair, lastCls: request.current };
  if (next !== pair) setPair(next);
  useLayoutEffect(() => {
    if (!pair.preparing) return;
    const incoming = (pair.cur === 0 ? firstRef : secondRef).current;
    if (incoming) incoming.getBoundingClientRect();
    // oxlint-disable-next-line react/set-state-in-effect -- A second layout commit starts the measured plate crossfade before paint.
    setPair((p) => ({ ...p, preparing: false }));
  }, [pair, firstRef, secondRef]);
  const classes = [0, 1].map((i) =>
    i !== next.cur || !request
      ? next.rest[i]
      : next.preparing
        ? initial + ' is-preparing'
        : request.current,
  );
  return { pair: next, refs, classes };
}

export function PhotoPlates({
  target,
}: {
  target: { key: string; placement: Placement; state: string } | null;
}) {
  const request = target && {
    key: target.key,
    placement: target.placement,
    current: 'ph-plate is-current' + (target.state ? ' ' + target.state : ''),
    outgoing: (last: string) => last.replace(' is-current', '') + ' is-outgoing',
  };
  const { pair, refs, classes } = usePair('ph-plate', request, 'ph-plate');
  return (
    <>
      {(['', 'Alt'] as const).map((alt, i) => {
        const p = pair.place[i];
        return (
          <div
            key={alt}
            ref={refs[i]}
            className={classes[i]}
            id={'phPlate' + alt}
            aria-hidden="true"
            style={
              p
                ? {
                    width: p.width + 'px',
                    height: p.height + 'px',
                    transform: 'translate3d(0,' + p.y + 'px,0)',
                  }
                : undefined
            }
          >
            <PlateField
              id={'phField' + alt}
              imgId={'phFieldImg' + alt}
              placement={p}
              scrim={false}
            />
            <div className="ph-veil"></div>
          </div>
        );
      })}
    </>
  );
}

export function LensPlates({ target }: { target: { key: string; placement: Placement } | null }) {
  const request = target && {
    key: target.key,
    placement: target.placement,
    current: 'ph-plate ut-lens is-current on-focus',
    outgoing: () => 'ph-plate ut-lens is-outgoing',
  };
  const { pair, refs, classes } = usePair(
    'ph-plate ut-lens',
    request,
    'ph-plate ut-lens is-outgoing',
  );
  return (
    <>
      {(['', 'Alt'] as const).map((alt, i) => {
        const p = pair.place[i];
        return (
          <div
            key={alt}
            ref={refs[i]}
            className={classes[i]}
            id={'utLens' + alt}
            aria-hidden="true"
            style={
              p
                ? { width: p.width + 'px', transform: 'translate3d(' + p.x + 'px,' + p.y + 'px,0)' }
                : undefined
            }
          >
            <PlateField id={'utField' + alt} imgId={'utFieldImg' + alt} placement={p} scrim />
            <div className="ph-veil"></div>
          </div>
        );
      })}
    </>
  );
}
