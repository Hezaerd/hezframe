import type { ReactNode } from 'react';

const PATHS = {
  apps: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-.6 2.4-2 1.2L4 6l-2 3.5L3.8 11v2L2 14.5 4 18l2.4-.6 2 1.2L9 21h6l.6-2.4 2-1.2 2.4.6 2-3.5-1.8-1.5v-2L22 9.5 20 6l-2.4.6-2-1.2L15 3Z" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  home: <path d="M4 11 12 4.5l8 6.5v8a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z" />,
  undo: (
    <>
      <path d="M9 6 5 10l4 4" />
      <path d="M5 10h9.5a4.5 4.5 0 0 1 0 9H11" />
    </>
  ),
  check: <path d="m5.5 12.5 4 4 9-9" />,
  left: <path d="m14.5 5-7 7 7 7" />,
  right: <path d="m9.5 5 7 7-7 7" />,
  up: <path d="m5 15.5 7-7 7 7" />,
  down: <path d="m5 8.5 7 7 7-7" />,
  updown: <path d="m7.5 9.5 4.5-4.5 4.5 4.5M7.5 14.5l4.5 4.5 4.5-4.5" />,
} satisfies Record<string, ReactNode>;
export type IconName = keyof typeof PATHS;

/** A stroke icon. Home controls draw a darker underlay so the glyph reads on any photo. */
export function Icon({
  name,
  className,
  underlay,
}: {
  name: IconName;
  className?: string;
  underlay?: boolean;
}) {
  return (
    <svg
      className={'ico' + (className ? ' ' + className : '')}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {underlay ? (
        <>
          <g className="ut-underlay" transform="translate(0 .5)">
            {PATHS[name]}
          </g>
          <g className="ut-ink">{PATHS[name]}</g>
        </>
      ) : (
        PATHS[name]
      )}
    </svg>
  );
}

export function OnHomeBadge() {
  return (
    <svg className="badge is-on" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        className="badge-tick"
        d="m7.6 12.4 3 3 5.8-6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
