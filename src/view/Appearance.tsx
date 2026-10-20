import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { thumbSrc } from '../model/assets.ts';
import { isSettingsDetail, top, wallById, wallIndex } from '../model/state.ts';
import { DETAIL_NAMES, FONTS, LOOK_NAMES, WALL_ROW, WALL_VISIBLE } from '../model/tables.ts';
import type { DetailView, Look, State, WallpaperView } from '../model/types.ts';
import { detailLocation, detailParent, detailSections, type DetailItem } from '../model/views.ts';
import { useLatestWhen } from './hooks.ts';
import { Rebuilt } from './rebuilt.tsx';
import { Icon } from './icons.tsx';

const LOOK_AXES: string[] = ['bg', 'wall', 'layout', 'apps', 'font', 'controls', 'focus', 'material'];
const isLookAxis = (axis: string): axis is keyof Look => LOOK_AXES.indexOf(axis) >= 0;

interface Choice extends DetailItem { focus: boolean; applied: boolean; loading: boolean; swatch: string | null }

function choiceOf(s: State, t: DetailView, item: DetailItem): Choice {
  const pending = s.look.pending, axis = item.axis;
  const swatch = item.axis === 'bg' || item.thumbnail ? item.value === 'light' || item.value === 'dark' ? 'swatch-' + item.value : thumbSrc(s.prefs.wall) : null;
  return {
    ...item, swatch, focus: t.action === item.action,
    applied: !!axis && s.prefs[axis] === item.value,
    loading: !!(axis && pending && isLookAxis(axis) && pending.target[axis] === item.value && pending.row === axis)
  };
}

function ChoiceButton({ c, cls, children }: { c: Choice; cls?: string; children: ReactNode }) {
  return (
    <button type="button" tabIndex={-1} className={'setting-choice' + (cls ? ' ' + cls : '') + (c.focus ? ' is-focus' : '') + (c.disabled ? ' is-disabled' : '') + (c.applied ? ' is-applied' : '') + (c.loading ? ' is-loading' : '')}
      role={c.axis ? 'radio' : undefined} aria-checked={c.axis ? c.applied : undefined} aria-label={c.axis && c.value === 'both' ? 'Icons and text' : c.label} aria-disabled={!!c.disabled} aria-busy={c.loading}
      data-z="detail" data-i="0" data-id={c.action} data-action={c.action}>
      {children}
      {c.axis && <span className="setting-tick" aria-hidden="true">{c.applied && <Icon name="check" />}</span>}
    </button>
  );
}

function detailParts(s: State, t: DetailView) {
  const at = detailLocation(s, t), selected = at.item, error = s.look.error, parent = detailParent(t.group);
  const back = choiceOf(s, t, { action: 'settings.back', label: parent, disabled: false });
  const sections = detailSections(s, t.group).map(section => ({ ...section, items: section.items.map(item => choiceOf(s, t, item)) }));
  const status = s.look.pending
    ? { loading: s.look.pending.row === 'font' ? FONTS[s.look.pending.target.font].name : 'your choice' }
    : error ? { error: (error.type === 'save' ? 'Couldn’t save this change.' : error.type === 'font' ? 'Couldn’t load ' + FONTS[error.font].name + '.' : 'Couldn’t load this appearance.') + ' Your current choice is kept.', retry: choiceOf(s, t, { action: 'settings.retry', label: 'Try again', disabled: false }) } : null;
  const hint = selected.disabled ? '' : selected.action === 'settings.back' ? 'Return to ' + parent : selected.action === 'settings.retry' ? 'Retry this change' : selected.axis ? 'Apply selected setting' : selected.action === 'background.wallpaper' ? 'Choose a wallpaper' : selected.action === 'background.rotation' ? 'Choose a rotation interval' : 'Open on the TV';
  return {
    back: <Rebuilt markup={JSON.stringify(back)}><ChoiceButton c={back} cls="setting-back"><Icon name="left" /><span>{parent}</span></ChoiceButton></Rebuilt>,
    title: DETAIL_NAMES[t.group],
    rows: <Rebuilt markup={JSON.stringify(sections)}>{sections.map(section => (
      <section key={section.id} className={'setting-section' + (section.horizontal ? ' is-horizontal' : '') + ' section-' + section.id}>
        {section.title && <h3 className="setting-label" id={'setting-' + section.id}>{section.title}</h3>}
        <div className="setting-options" role={section.items[0].axis ? 'radiogroup' : undefined} aria-label={section.items[0].axis ? section.title || LOOK_NAMES[section.id] || DETAIL_NAMES[t.group] : undefined}>
          {section.items.map(c => (
            <ChoiceButton key={c.action} c={c} cls={c.description ? 'has-description' : ''}>
              {c.swatch !== null && (c.swatch.indexOf('swatch-') === 0 ? <span className={'setting-swatch ' + c.swatch} aria-hidden="true"></span> : <img className="setting-swatch" src={c.swatch} alt="" />)}
              <span className="setting-copy"><span className="setting-name">{c.label}</span>{c.description && <span className="setting-description">{c.description}</span>}</span>
              {!c.axis && <Icon name="right" className="setting-forward" />}
            </ChoiceButton>
          ))}
        </div>
        {section.reason && <p className="setting-reason">{section.reason}</p>}
      </section>
    ))}</Rebuilt>,
    status: status && <Rebuilt markup={JSON.stringify(status)}>{'loading' in status
      ? <><p>Loading {status.loading}…</p><p>Back cancels this change.</p></>
      : <><p className="setting-error">{status.error}</p><ChoiceButton c={status.retry} cls="setting-retry"><span>Try again</span></ChoiceButton></>}</Rebuilt>,
    hint
  };
}

/** A gallery thumbnail; a failed one keeps its 16:9 slot without a broken-image glyph. */
function Thumb({ src }: { src: string | null }) {
  const [missing, setMissing] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const el = img.current;
    if (el && el.complete && !el.naturalWidth) setMissing(true);
  }, []);
  return <span className={'wallpaper-thumb' + (missing ? ' is-missing' : '')}>{src && <img ref={img} src={src} alt="" onError={() => setMissing(true)} />}</span>;
}

function wallpaperParts(s: State, t: WallpaperView) {
  const walls = s.env.walls, c = s.prefs, shown = s.look.wallShown ? wallById(s.env, s.look.wallShown) : wallById(s.env, c.wall), candidate = walls[t.i];
  let note = t.previewDue ? 'Preparing ' + candidate.name + '…' : s.look.wallPending ? (t.applyPending ? 'Applying ' : 'Loading ') + candidate.name + '…' : shown.id === c.wall ? 'Applied' : 'Preview';
  if (t.failedId) note = s.session.err ? 'Couldn’t save ' + wallById(s.env, t.failedId).name + '.' : 'Couldn’t load ' + wallById(s.env, t.failedId).name + '.';
  let hint = t.zone === 'back' ? 'Return to Background' : t.zone === 'retry' ? 'Retry this photo' : 'Apply selected photo';
  if (t.zone === 'photo' && candidate.id === c.wall && !s.look.pending && !t.failedId) hint = '';
  const status = { name: shown.name, count: (wallIndex(s.env, shown.id) + 1) + ' of ' + walls.length, note, failed: !!t.failedId, retry: t.zone === 'retry' };
  return {
    back: <Rebuilt markup={t.zone}><button type="button" tabIndex={-1} className={'setting-choice setting-back' + (t.zone === 'back' ? ' is-focus' : '')} data-z="wall-back" data-action="wallpaper.back"><Icon name="left" /><span>Background</span></button></Rebuilt>,
    title: 'Wallpaper',
    rows: <>
      <div className={'wallpaper-edge wallpaper-before' + (t.top > 0 ? ' is-on' : '')} aria-hidden="true"><Icon name="up" /></div>
      <div className="wallpaper-list" role="radiogroup" aria-label="Wallpaper">
        <div className="wallpaper-rows" style={{ transform: 'translate3d(0,' + (-t.top * WALL_ROW) + 'px,0)' }}>
          {walls.map((w, i) => {
            const visible = i >= t.top && i < t.top + WALL_VISIBLE, applied = w.id === c.wall;
            return (
              <div key={w.id} className={'setting-choice wallpaper-choice' + (t.zone === 'photo' && t.i === i ? ' is-focus' : '') + (applied ? ' is-applied' : '')}
                style={{ transform: 'translate3d(0,' + (i * WALL_ROW) + 'px,0)', visibility: visible ? 'visible' : 'hidden' }}
                role="radio" tabIndex={-1} aria-label={w.name} aria-checked={applied} aria-posinset={i + 1} aria-setsize={walls.length} aria-busy={t.previewDue === w.id || s.look.wallPending === w.id}
                data-z="wall-choice" data-i={i} data-action={'wallpaper.choose.' + w.id}>
                <Rebuilt markup={w.id + '|' + visible + '|' + s.catalog.revision}>
                  <Thumb src={visible ? thumbSrc(w.id) : null} />
                  <span className="setting-copy"><span className="setting-name">{w.name}</span></span>
                  <span className="setting-tick" aria-hidden="true">{applied && <Icon name="check" />}</span>
                </Rebuilt>
              </div>
            );
          })}
        </div>
      </div>
      <div className={'wallpaper-edge wallpaper-after' + (t.top + WALL_VISIBLE < walls.length ? ' is-on' : '')} aria-hidden="true"><Icon name="down" /></div>
    </>,
    status: <Rebuilt markup={JSON.stringify(status)}>
      <p className="wallpaper-preview-name"><span>{status.name}</span><span className="wallpaper-count">{status.count}</span></p>
      <p className={'wallpaper-preview-state' + (status.failed ? ' setting-error' : '')}>{note}</p>
      {status.failed && <button type="button" tabIndex={-1} className={'setting-choice setting-retry' + (status.retry ? ' is-focus' : '')} data-z="wall-retry" data-action="wallpaper.retry">Try again</button>}
    </Rebuilt>,
    hint
  };
}

/** Settings groups and the wallpaper picker, beside the scaled Home preview. Hidden content keeps its last render. */
export function Appearance({ s, appearanceRef }: { s: State; appearanceRef: RefObject<HTMLElement | null> }) {
  const open = isSettingsDetail(top(s).kind), last = useLatestWhen(s, open), t = top(last);
  const view = t.kind === 'appearance' ? detailParts(last, t) : t.kind === 'wallpaper' ? wallpaperParts(last, t) : null;
  const className = t.kind === 'appearance' ? 'appearance detail-' + t.group : t.kind === 'wallpaper' ? 'appearance detail-wallpaper' : 'appearance';
  return (
    <section ref={appearanceRef} className={className} id="appearance" hidden={!open} role="dialog" aria-labelledby="appearanceTitle" aria-modal={open ? 'true' : undefined}>
      <div className="settings-back" id="appearanceBack">{view && view.back}</div>
      <h2 className="settings-title" id="appearanceTitle">{view && view.title}</h2>
      <div className={'appearance-rows' + (t.kind === 'wallpaper' ? ' wallpaper-picker' : '')} id="appearanceRows">{view && view.rows}</div>
      <p className="appearance-desc" id="appearanceDesc">{view && view.hint && <Rebuilt markup={view.hint}><span className="remote-key">OK</span><span>{view.hint}</span></Rebuilt>}</p>
      <div className="settings-status" id="appearanceStatus" aria-live="polite">{view && view.status}</div>
    </section>
  );
}
