import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ReactNode } from 'react';

export interface CaptionProps { time: string; digits: boolean; greeting: string; fullName: string }
export interface SettingsRow { id: string; label: string; value: string }
export interface SettingsProps { rows: SettingsRow[]; focusedId: string }

function Caption({ time, digits, greeting, fullName }: CaptionProps) {
  return <><span className="clock">{digits ? [...time].map((char, index) => /[0-9]/.test(char) ? <span className="clock-digit" key={index}>{char}</span> : char) : time}</span>
    {greeting && <span className="greeting">{greeting}</span>}
    {fullName && <span className="cap-line full-name">{fullName}</span>}</>;
}
function SettingsOverview({ rows, focusedId }: SettingsProps) {
  return <>{rows.map(row => <button key={row.id} type="button" tabIndex={-1}
    className={'settings-group' + (row.id === focusedId ? ' is-focus' : '')}
    data-z="row" data-i="0" data-id={row.id}
    data-action={'settings.' + (row.id === 'editor' ? 'editor' : 'group.' + row.id)}>
    <span className="settings-group-copy"><span className="settings-group-name">{row.label}</span><span className="settings-group-value">{row.value}</span></span>
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7" /></svg>
  </button>)}</>;
}
const roots = new Map<HTMLElement, Root>();
function render(container: HTMLElement, node: ReactNode) {
  let root = roots.get(container);
  if (!root) { root = createRoot(container); roots.set(container, root); }
  // The remote controller measures focus immediately after rendering.
  flushSync(() => root.render(node));
}
export const ui = {
  renderCaption: (container: HTMLElement, props: CaptionProps) => render(container, <Caption {...props} />),
  renderSettings: (container: HTMLElement, props: SettingsProps) => render(container, <SettingsOverview {...props} />),
  disposeWithin(container: HTMLElement) {
    for (const [element, root] of roots) {
      if (container.contains(element)) { flushSync(() => root.unmount()); roots.delete(element); }
    }
  }
};
declare global { interface Window { HezFrameUI: typeof ui } }
