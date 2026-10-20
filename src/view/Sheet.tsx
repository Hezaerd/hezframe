import { memo, type ReactNode, type RefObject } from 'react';
import { panelSrc } from '../model/assets.ts';
import { app, isSettingsDetail, isSheet, top } from '../model/state.ts';
import {
  CAP,
  ED_CUT,
  ED_ROW,
  ED_SEP,
  ED_VIEW,
  FULL,
  GRID_COL,
  GRID_COLS,
  GRID_ROW,
  GRID_VISIBLE,
  LAST,
} from '../model/tables.ts';
import type {
  App,
  AppsView,
  EditorView,
  Env,
  MessageView,
  SettingsView,
  State,
} from '../model/types.ts';
import {
  appsItems,
  editorEntries,
  editorHomeY,
  otherGroups,
  settingsRows,
} from '../model/views.ts';
import { useLastShown, useStableOrder } from './hooks.ts';
import { Icon, OnHomeBadge, type IconName } from './icons.tsx';
import { AppMark } from './marks.tsx';
import { Rebuilt } from './rebuilt.tsx';

type Head = [id: string, label: string, cls: string, icon: IconName | ''];

function HeadButtons({
  list,
  focus,
  prefix,
  undoCaption,
  status,
}: {
  list: Head[];
  focus: number;
  prefix: string;
  undoCaption?: string;
  status: boolean;
}) {
  return (
    <Rebuilt markup={JSON.stringify([list, focus, undoCaption])}>
      {list.map(([id, label, cls, icon], i) => (
        <button
          key={id}
          type="button"
          tabIndex={-1}
          className={
            'btn' +
            (i === focus ? ' is-focus' : '') +
            (cls ? ' ' + cls : '') +
            (i === focus && status ? ' has-local-status' : '')
          }
          data-z="head"
          data-i={i}
          data-action={prefix + '.' + id}
          aria-label={id === 'undo' && undoCaption ? undoCaption : label}
        >
          {icon && <Icon name={icon} />}
          <span>{label}</span>
        </button>
      ))}
    </Rebuilt>
  );
}

/** One installed app. Memoised so a key press re-renders only the tiles whose focus changed. */
const GridTile = memo(function GridTile({
  env,
  app: a,
  i,
  focus,
  home,
  status,
  light,
  revision,
}: {
  env: Env;
  app: App;
  i: number;
  focus: boolean;
  home: boolean;
  status: boolean;
  light: boolean;
  revision: number;
}) {
  return (
    <div
      className={'gt' + (focus ? ' is-focus' : '') + (focus && status ? ' has-local-status' : '')}
      style={{
        transform:
          'translate3d(' +
          (i % GRID_COLS) * GRID_COL +
          'px,' +
          Math.floor(i / GRID_COLS) * GRID_ROW +
          'px,0)',
      }}
      role="button"
      aria-label={a.name}
      data-z="grid"
      data-i={i}
      data-action={'apps.open.' + a.id}
    >
      <Rebuilt markup={[a.id, a.name, home, revision].join('|')}>
        <span className="panel-content">
          <AppMark env={env} app={a} light={light} w={120} h={72} size={58} />
          <span className="label">{a.name}</span>
        </span>
        <span className="state">
          {home && (
            <>
              <OnHomeBadge />
              <span>On Home</span>
            </>
          )}
        </span>
      </Rebuilt>
    </div>
  );
});

function AppsSheet({ s, t, status }: { s: State; t: AppsView; status: boolean }) {
  const items = appsItems(s),
    n = items.length,
    rows = Math.ceil(n / GRID_COLS),
    order = useStableOrder(items),
    c = s.catalog;
  const head: Head[] = c.error
    ? [['retry', 'Try again', '', '']]
    : [['editor', 'Apps on Home', '', 'home']];
  return (
    <>
      <h2 className="s-title">All apps</h2>
      <p className="s-sub">
        {c.loading ? 'Loading installed apps…' : c.error || (!n ? 'No installed apps found.' : '')}
      </p>
      <div className={'s-head' + (t.zone === 'head' ? ' is-awake' : '')}>
        <HeadButtons list={head} focus={t.zone === 'head' ? 0 : -1} prefix="apps" status={status} />
      </div>
      <div
        className={
          'grid-view' +
          (t.top > 0 ? ' more-before' : '') +
          (rows - t.top > GRID_VISIBLE ? ' more-after' : '')
        }
      >
        <div
          className="grid-in"
          style={{ transform: 'translate3d(0,' + -t.top * GRID_ROW + 'px,0)' }}
        >
          {order.map((id) => {
            const i = items.indexOf(id);
            return (
              <GridTile
                key={id}
                env={s.env}
                app={app(s, id)}
                i={i}
                focus={t.zone === 'grid' && i === t.i}
                home={s.prefs.home.indexOf(id) >= 0}
                status={status}
                light={s.prefs.bg === 'light'}
                revision={c.revision}
              />
            );
          })}
        </div>
      </div>
      <div className={'row-cue grid-before' + (t.top > 0 ? ' is-on' : '')} aria-hidden="true">
        <Icon name="up" />
      </div>
      <div
        className={'row-cue grid-after' + (rows - t.top > GRID_VISIBLE ? ' is-on' : '')}
        aria-hidden="true"
      >
        <Icon name="down" />
      </div>
    </>
  );
}

function undoCaption(s: State): string {
  const u = s.session.undo[s.session.undo.length - 1];
  return u ? 'Undo ' + u.label.charAt(0).toLowerCase() + u.label.slice(1) : 'Nothing to undo';
}

function EditorSheet({ s, t, status }: { s: State; t: EditorView; status: boolean }) {
  const H = t.lifted ? t.lifted.order : s.prefs.home,
    o = otherGroups(s),
    list = o.recent.concat(o.rest),
    full = s.prefs.home.length >= CAP;
  const c = s.catalog,
    note = s.session.note,
    name = (id: (typeof H)[number]) => app(s, id).name;
  const hint = c.error
    ? c.error
    : c.loading
      ? 'Loading installed apps…'
      : t.zone === 'head' && t.h === 0
        ? undoCaption(s)
        : t.zone === 'home' && t.part === 'remove'
          ? H.length <= 1
            ? LAST
            : name(H[t.i]) + ' stays installed.'
          : '';
  const move = t.lifted ? 'Moving ' + name(t.lifted.id) + '. OK places it, Back puts it back.' : '';
  let sub: ReactNode = move || hint || note || '';
  if (s.session.err) sub = <span className="warn error-chip">Couldn’t save. Nothing changed.</span>;
  else if (note === FULL || note === LAST) sub = <span className="warn">{note}</span>;
  else if (hint === FULL || hint === LAST) sub = <span className="warn">{hint}</span>;
  const homeOrder = useStableOrder(H),
    { entries } = editorEntries(s, t),
    entryOrder = useStableOrder(entries.map((e) => e.key));
  const origin = useLastShown(
    t.lifted ? 264 + editorHomeY(t.lifted.from) + 16 : null,
    String(t.lifted ? t.lifted.from : ''),
  );
  let before = false,
    after = false;
  for (const it of entries) {
    const end = it.y + (it.sep ? ED_SEP : 72);
    before = before || it.y < t.top;
    after = after || end > t.top + ED_VIEW;
  }
  return (
    <>
      <h2 className="s-title">Apps on Home</h2>
      <p className="s-sub">{sub}</p>
      <div className={'s-head' + (t.zone === 'head' ? ' is-awake' : '')}>
        <HeadButtons
          list={[
            ['undo', 'Undo', s.session.undo.length ? '' : 'is-idle', 'undo'],
            ['done', 'Done', '', 'check'],
          ]}
          focus={t.zone === 'head' ? t.h : -1}
          prefix="editor"
          undoCaption={undoCaption(s)}
          status={status}
        />
      </div>
      <p className="s-label z-home">
        <Rebuilt markup={String(s.prefs.home.length)}>
          On Home <span className="s-count">{s.prefs.home.length + ' of ' + CAP}</span>
        </Rebuilt>
      </p>
      <p className="s-label z-other">Not on Home</p>
      <div className="ed-home">
        {homeOrder.map((id) => {
          const i = H.indexOf(id),
            a = app(s, id),
            here = t.zone === 'home' && i === t.i,
            lifted = !!t.lifted && i === t.i;
          const nameFocus = here && (t.part === 'name' || lifted),
            removeFocus = here && t.part === 'remove' && !lifted;
          return (
            <div
              key={id}
              className={'er' + (here ? ' is-active' : '') + (lifted ? ' is-lifted' : '')}
              style={{
                transform: 'translate3d(' + (lifted ? 16 : 0) + 'px,' + editorHomeY(i) + 'px,0)',
              }}
            >
              <Rebuilt markup={id + '|' + c.revision}>
                <div
                  className={
                    'er-name' +
                    (nameFocus ? ' is-focus' : '') +
                    (nameFocus && status ? ' has-local-status' : '')
                  }
                  role="button"
                  data-z="name"
                  data-i={i}
                  data-action={'editor.move.' + id}
                >
                  <span className="panel-content">
                    <span className="er-num">{i + 1}</span>
                    <AppMark
                      env={s.env}
                      app={a}
                      light={s.prefs.bg === 'light'}
                      w={56}
                      h={44}
                      size={36}
                    />
                    <span className="er-text">{a.name}</span>
                    <span className="er-move">
                      <Icon name="updown" />
                    </span>
                  </span>
                </div>
                <div
                  className={
                    'er-rm' +
                    (removeFocus ? ' is-focus' : '') +
                    (H.length <= 1 ? ' is-limit' : '') +
                    (removeFocus && status ? ' has-local-status' : '')
                  }
                  role="button"
                  data-z="remove"
                  data-i={i}
                  data-action={'editor.remove.' + id}
                >
                  <span>{H.length <= 1 ? LAST : 'Remove from Home'}</span>
                </div>
              </Rebuilt>
            </div>
          );
        })}
      </div>
      <div
        className={'ed-order-break' + (H.length > ED_CUT ? ' is-on' : '')}
        style={{ top: 264 + ED_CUT * ED_ROW + 'px' }}
      >
        Then scroll
      </div>
      <div className="ed-other-view">
        <div className="ed-other" style={{ transform: 'translate3d(0,' + -t.top + 'px,0)' }}>
          {entryOrder.map((key) => {
            const it = entries.filter((e) => e.key === key)[0],
              end = it.y + (it.sep ? ED_SEP : 72);
            const style = {
              transform: 'translate3d(0,' + it.y + 'px,0)',
              visibility:
                it.y >= t.top && end <= t.top + ED_VIEW
                  ? ('visible' as const)
                  : ('hidden' as const),
            };
            if (it.sep !== undefined)
              return (
                <div key={key} className="eo-sep" style={style}>
                  <Rebuilt markup={'sep|' + it.sep + '|' + c.revision}>{it.sep}</Rebuilt>
                </div>
              );
            const j = list.indexOf(it.id),
              focus = t.zone === 'other' && j === t.j,
              a = app(s, it.id);
            return (
              <div
                key={key}
                className={
                  'eo' + (focus ? ' is-focus' : '') + (focus && status ? ' has-local-status' : '')
                }
                style={style}
                role="button"
                data-z="other"
                data-i={j}
                data-action={'editor.add.' + it.id}
              >
                <Rebuilt markup={it.id + '|' + c.revision}>
                  <span className="panel-content">
                    <AppMark
                      env={s.env}
                      app={a}
                      light={s.prefs.bg === 'light'}
                      w={56}
                      h={44}
                      size={36}
                    />
                    <span className="eo-text">{a.name}</span>
                    <span className="eo-verb">
                      {focus && (
                        <span className={'verb' + (full ? ' is-off' : '')}>
                          {full ? 'Home is full' : 'Add to Home'}
                        </span>
                      )}
                    </span>
                  </span>
                </Rebuilt>
              </div>
            );
          })}
        </div>
      </div>
      <div
        className={'ed-origin' + (t.lifted && t.lifted.from !== t.i ? ' is-on' : '')}
        style={origin !== null ? { transform: 'translate3d(0,' + origin + 'px,0)' } : undefined}
      ></div>
      <div className={'row-cue editor-before' + (before ? ' is-on' : '')} aria-hidden="true">
        <Icon name="up" />
      </div>
      <div className={'row-cue editor-after' + (after ? ' is-on' : '')} aria-hidden="true">
        <Icon name="down" />
      </div>
    </>
  );
}

function SettingsSheet({ s, t, status }: { s: State; t: SettingsView; status: boolean }) {
  return (
    <>
      <h2 className="s-title">Settings</h2>
      <div className="settings-overview">
        {settingsRows(s).map((row) => {
          const focus = row.id === t.focus;
          return (
            <button
              key={row.id}
              type="button"
              tabIndex={-1}
              className={
                'settings-group' +
                (focus ? ' is-focus' : '') +
                (focus && status ? ' has-local-status' : '')
              }
              data-z="row"
              data-i="0"
              data-id={row.id}
              data-action={'settings.' + (row.id === 'editor' ? 'editor' : 'group.' + row.id)}
            >
              <span className="settings-group-copy">
                <span className="settings-group-name">{row.label}</span>
                <span className="settings-group-value">{row.value}</span>
              </span>
              <Icon name="right" />
            </button>
          );
        })}
      </div>
      <p className="settings-overview-hint">
        <span className="remote-key">OK</span>
        <span>Open selected group</span>
      </p>
    </>
  );
}

function MessageSheet({ t, status }: { t: MessageView; status: boolean }) {
  const m = t.content;
  return (
    <>
      <h2 className="msg-title">{m.title}</h2>
      <p className="msg-line">{m.line}</p>
      <p className="msg-note">{m.note}</p>
      <div className="msg-acts">
        <Rebuilt markup={String(t.b)}>
          {m.actions.map(([id, label], i) => (
            <button
              key={id}
              type="button"
              tabIndex={-1}
              className={
                'btn' +
                (i === t.b ? ' is-focus' : '') +
                (i === t.b && status ? ' has-local-status' : '')
              }
              data-z="act"
              data-i={i}
              data-action={'message.' + id}
            >
              <span>{label}</span>
            </button>
          ))}
        </Rebuilt>
      </div>
    </>
  );
}

/** A full-screen panel over a matte backdrop of the committed photo. */
export function Sheet({ s, sheetRef }: { s: State; sheetRef: RefObject<HTMLDivElement | null> }) {
  const t = top(s),
    sheet = isSheet(t.kind),
    status = !!s.session.err;
  let content: ReactNode = null;
  if (t.kind === 'apps') content = <AppsSheet s={s} t={t} status={status} />;
  else if (t.kind === 'editor') content = <EditorSheet s={s} t={t} status={status} />;
  else if (t.kind === 'settings') content = <SettingsSheet s={s} t={t} status={status} />;
  else if (t.kind === 'message') content = <MessageSheet t={t} status={status} />;
  return (
    <div ref={sheetRef} className="sheet" id="sheet" hidden={!(sheet || isSettingsDetail(t.kind))}>
      <img
        className="sheet-bg"
        id="sheetBg"
        alt=""
        aria-hidden="true"
        src={s.look.backdrop ? panelSrc(s.look.backdrop) : undefined}
      />
      <div className="sheet-veil" aria-hidden="true"></div>
      <div
        className="view"
        id="sheetView"
        role="dialog"
        aria-modal={sheet ? 'true' : undefined}
        hidden={!sheet}
      >
        {content && (
          <Rebuilt markup={t.kind + '|' + (t.kind === 'message' ? t.msg : '') + '|' + s.prefs.bg}>
            {content}
          </Rebuilt>
        )}
      </div>
    </div>
  );
}
