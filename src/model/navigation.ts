import { clamp, isAppId, safeIcon } from './ids.ts';
import {
  applyWallpaper,
  cancelLook,
  closeWallpaper,
  normWallpaper,
  openWallpaper,
  previewWallpaper,
  restoreLook,
  retryWallpaper,
  setLook,
} from './look.ts';
import {
  CAP,
  FONT_IDS,
  FULL,
  GRID_COLS,
  LAST,
  MODE_IDS,
  ON_OFF,
  PRIMARY_APPS,
  PRIMARY_IDS,
  UTILS,
} from './tables.ts';
import {
  app,
  collectionById,
  detailFocus,
  ensureSel,
  next,
  pop,
  push,
  setSel,
  snap,
  token,
  top,
  write,
  type Draft,
} from './state.ts';
import {
  appsItems,
  appsTop,
  axes,
  detailLocation,
  detailRows,
  editorEntries,
  GROUP_AXIS,
  isExtraAxis,
  nearestHome,
  otherList,
  settingsRows,
  type DetailItem,
} from './views.ts';
import type {
  App,
  AppId,
  AppsView,
  CatalogEntry,
  DetailGroup,
  DetailView,
  DeviceOp,
  EditorView,
  ExtraAxis,
  HomeView,
  LookPatch,
  MessageContent,
  MessageView,
  PointZone,
  RemoteKey,
  SettingsView,
  View,
} from './types.ts';

const LEAVE: MessageContent = {
  title: 'Leave Home?',
  line: 'Open Samsung Home?',
  note: '',
  actions: [
    ['stay', 'Stay'],
    ['samsung', 'Samsung Home'],
  ],
};

/* ---------- Devices and busy state ---------- */

export function release(d: Draft): void {
  d.session.busy = 0;
  d.session.press = null;
}

/** One device call at a time; the TV adapter always answers within its own bound. */
export function perform(d: Draft, title: string, op: DeviceOp): void {
  if (d.session.busy) return;
  d.session.busy = token(d);
  d.fx.push(
    {
      kind: 'after',
      ms: 10_000,
      action: { type: 'releaseTimeout', token: d.session.busy },
    },
    { kind: 'device', title, op },
  );
}

export function message(d: Draft, title: string, line: string, note: string): void {
  push(d, {
    kind: 'message',
    msg: 'error',
    content: { title, line, note, actions: [['back', 'Back']] },
    b: 0,
  });
}

function launch(d: Draft, id: AppId | null): void {
  const a = id ? d.apps.get(id) : undefined;
  if (!a || d.session.busy) return;
  if (d.prefs.home.includes(a.id)) write(d, { ...next(d), lastApp: a.id }, { kind: 'lastApp' });
  d.session.press = a.id;
  perform(d, a.name, { op: 'launch', appId: a.appId });
}

/* ---------- Installed-app catalogue ---------- */

export function refreshCatalog(d: Draft): void {
  if (d.catalog.loading) return;
  d.catalog.request++;
  d.catalog.loading = true;
  d.catalog.error = null;
  d.fx.push({ kind: 'loadCatalog', request: d.catalog.request });
}

export function catalogLoaded(
  d: Draft,
  request: number,
  error: string | null,
  entries: CatalogEntry[],
): void {
  if (request !== d.catalog.request) return;
  d.catalog.loading = false;
  if (error !== null) {
    d.catalog.error = error;
    if (!d.catalog.loaded) d.catalog.ids = [];
    return;
  }
  const t = top(d),
    oldFocus = t.kind === 'apps' ? d.catalog.ids[t.i] : undefined;
  const apps = new Map(d.apps),
    ids: AppId[] = [];
  for (const entry of entries) {
    const id = PRIMARY_IDS.includes(entry.brand) ? entry.brand : entry.appId;
    if (!isAppId(id) || !isAppId(entry.appId) || ids.includes(id)) continue;
    const primary = PRIMARY_APPS.find((p) => p.id === id);
    const a: App = {
      id,
      appId: entry.appId,
      brand: entry.brand || '',
      mark: !!entry.brand,
      icon: safeIcon(entry.icon),
      name: primary ? primary.name : entry.name.slice(0, 160),
    };
    apps.set(id, a);
    ids.push(id);
  }
  ids.sort((x, y) =>
    (apps.get(x)?.name ?? '').toLowerCase().localeCompare((apps.get(y)?.name ?? '').toLowerCase()),
  );
  d.apps = apps;
  d.catalog.ids = ids;
  d.catalog.loaded = true;
  d.catalog.error = null;
  d.catalog.revision++;
  if (t.kind === 'apps' && oldFocus && ids.includes(oldFocus)) t.i = ids.indexOf(oldFocus);
  norm(d);
}

/* ---------- Opening views ---------- */

function openSettings(d: Draft): void {
  push(d, { kind: 'settings', focus: d.session.settingsFocus });
}
function openAppearance(d: Draft, group: DetailGroup): void {
  const c = d.prefs;
  const axisValue =
    group === 'background'
      ? 'choice.bg.' + c.bg
      : group === 'layout'
        ? 'choice.layout.' + c.layout
        : group === 'typography'
          ? 'choice.font.' + c.font
          : group === 'focus'
            ? 'choice.focus.' + c.focus
            : null;
  const action =
    d.session.detailFocus[group] ||
    axisValue ||
    (group === 'rotation' ? 'rotation.' + c.mode : 'samsung.home');
  push(d, { kind: 'appearance', group, action, column: undefined });
}
function openApps(d: Draft): void {
  push(d, {
    kind: 'apps',
    top: 0,
    zone: 'grid',
    i: Math.max(0, d.session.appsFocus ? d.catalog.ids.indexOf(d.session.appsFocus) : -1),
  });
  refreshCatalog(d);
}
function clearSession(d: Draft): void {
  d.session.undo = [];
  d.session.removedAt = {};
  d.session.note = null;
  d.session.err = null;
}
function openEditor(d: Draft): void {
  const i = ensureSel(d);
  clearSession(d);
  refreshCatalog(d);
  push(d, {
    kind: 'editor',
    lifted: null,
    top: 0,
    otherReturn: { id: otherList(d)[0] || null, index: 0, top: 0 },
    zone: d.prefs.home.length > 0 ? 'home' : 'other',
    i: Math.max(0, i),
    part: 'name',
    h: 1,
    j: 0,
  });
}

export function goScene(
  d: Draft,
  name: 'home' | 'apps' | 'settings' | 'appearance' | 'editor',
): void {
  const t = top(d);
  if (t.kind === 'wallpaper') t.previewDue = null;
  d.stack = [d.stack[0]];
  d.stack[0].zone = 'apps';
  clearSession(d);
  restoreLook(d);
  if (name === 'apps') openApps(d);
  else if (name === 'settings') openSettings(d);
  else if (name === 'appearance') {
    openSettings(d);
    const s = top(d);
    if (s.kind === 'settings') s.focus = 'background';
    d.session.settingsFocus = 'background';
    openAppearance(d, 'background');
  } else if (name === 'editor') {
    openSettings(d);
    openEditor(d);
  }
  norm(d);
}

/* ---------- Home ---------- */

function utilAction(d: Draft, u: number): void {
  if (UTILS[u].id === 'apps') openApps(d);
  else openSettings(d);
}

function homeKey(d: Draft, t: HomeView, k: RemoteKey): void {
  const h = d.prefs.home,
    n = UTILS.length,
    i = ensureSel(d);
  const x =
    d.prefs.layout === 'list'
      ? { prev: 'up', next: 'down', out: 'right', inn: 'left' }
      : axes('dock');
  if (t.zone === 'util') {
    t.u = clamp(t.u, 0, n - 1);
    if (k === x.prev && t.u > 0) t.u--;
    else if (k === x.next && t.u < n - 1) t.u++;
    else if (k === x.inn || k === 'back') t.zone = 'apps';
    else if (k === 'ok') {
      d.session.lastUtil = t.u;
      utilAction(d, t.u);
      return;
    }
    d.session.lastUtil = t.u;
    return;
  }
  t.zone = 'apps';
  if (d.prefs.layout === 'list') {
    if (k === 'up' && i > 0) setSel(d, h[i - 1]);
    else if (k === 'right') {
      t.zone = 'util';
      t.u = clamp(d.session.lastUtil, 0, n - 1);
    } else if (k === 'down' && i < h.length - 1) setSel(d, h[i + 1]);
    else if (k === 'back') push(d, { kind: 'message', msg: 'leave', content: LEAVE, b: 0 });
    else if (k === 'ok') launch(d, d.session.sel);
    return;
  }
  if (k === x.out) {
    t.zone = 'util';
    t.u = clamp(d.session.lastUtil, 0, n - 1);
  } else if (k === 'back') push(d, { kind: 'message', msg: 'leave', content: LEAVE, b: 0 });
  else if (k === x.prev && i > 0) setSel(d, h[i - 1]);
  else if (k === x.next && i < h.length - 1) setSel(d, h[i + 1]);
  else if (k === 'ok') launch(d, d.session.sel);
}

export function hoverUtil(d: Draft, index: number): void {
  const t = top(d);
  if (t.kind !== 'home' || (t.zone === 'util' && t.u === index)) return;
  t.zone = 'util';
  t.u = index;
  d.session.lastUtil = index;
}

/* ---------- All apps ---------- */

function appsKey(d: Draft, t: AppsView, k: RemoteKey): void {
  const items = appsItems(d),
    n = items.length,
    col = t.i % GRID_COLS,
    row = Math.floor(t.i / GRID_COLS);
  if (k === 'back') {
    pop(d);
    return;
  }
  if (t.zone === 'head') {
    if (k === 'down' && n) t.zone = 'grid';
    else if (k === 'ok') {
      if (d.catalog.error) refreshCatalog(d);
      else openEditor(d);
    }
    return;
  }
  if (k === 'left' && col > 0) t.i--;
  else if (k === 'right' && col < GRID_COLS - 1 && t.i < n - 1) t.i++;
  else if (k === 'down' && row < Math.ceil(n / GRID_COLS) - 1)
    t.i = Math.min(t.i + GRID_COLS, n - 1);
  else if (k === 'up') {
    if (row > 0) t.i -= GRID_COLS;
    else t.zone = 'head';
  } else if (k === 'ok' && n) launch(d, items[t.i]);
  d.session.appsFocus = items[t.i] || null;
}

/* ---------- Apps on Home ---------- */

const without = (list: AppId[], id: AppId) => list.filter((x) => x !== id);

function rememberOther(d: Draft, t: EditorView): void {
  const list = otherList(d);
  t.otherReturn = { id: list[t.j] || null, index: t.j, top: t.top };
}
function returnOther(d: Draft, t: EditorView): void {
  const list = otherList(d),
    memory = t.otherReturn,
    i = memory.id ? list.indexOf(memory.id) : -1;
  t.zone = 'other';
  t.j = i >= 0 ? i : clamp(memory.index, 0, Math.max(0, list.length - 1));
  t.top = memory.top;
}

function editorRemove(d: Draft, id: AppId): void {
  const i = d.prefs.home.indexOf(id),
    before = snap(d);
  if (i === -1) return;
  if (d.prefs.home.length <= 1) {
    d.session.note = LAST;
    return;
  }
  const h = [...d.prefs.home];
  h.splice(i, 1);
  write(d, next(d, h, [id, ...without(d.prefs.recent, id)].slice(0, 5)), {
    kind: 'remove',
    id,
    index: i,
    before,
  });
}
export function removed(
  d: Draft,
  id: AppId,
  index: number,
  before: { home: AppId[]; recent: AppId[] },
): void {
  d.session.removedAt[id] = index;
  d.session.undo.push({ label: 'Remove ' + app(d, id).name, snap: before });
  const t = top(d);
  if (t.kind !== 'editor') return;
  t.zone = 'other';
  t.j = otherList(d).indexOf(id);
  d.session.note = app(d, id).name + ' is in Recently removed. OK puts it back.';
}

function editorAdd(d: Draft, t: EditorView, id: AppId | undefined): void {
  rememberOther(d, t);
  if (!id) return;
  const before = snap(d),
    h = [...d.prefs.home];
  if (h.length >= CAP) {
    d.session.note = FULL;
    return;
  }
  const at = Object.prototype.hasOwnProperty.call(d.session.removedAt, id)
    ? Math.min(d.session.removedAt[id] ?? h.length, h.length)
    : h.length;
  h.splice(at, 0, id);
  write(d, next(d, h, without(d.prefs.recent, id)), { kind: 'add', id, before });
}
export function added(d: Draft, id: AppId, before: { home: AppId[]; recent: AppId[] }): void {
  d.session.undo.push({ label: 'Add ' + app(d, id).name, snap: before });
  const t = top(d);
  if (t.kind !== 'editor') return;
  const remaining = otherList(d),
    at = clamp(t.otherReturn.index, 0, Math.max(0, remaining.length - 1));
  t.otherReturn.id = remaining[at] || null;
  t.otherReturn.index = at;
  t.zone = 'home';
  t.i = d.prefs.home.indexOf(id);
  t.part = 'remove';
  d.session.note = app(d, id).name + ' is on Home, position ' + (t.i + 1) + '.';
}

function editorPlace(d: Draft, t: EditorView): void {
  const lifted = t.lifted;
  if (!lifted) return;
  d.session.note = null;
  const home = d.prefs.home;
  if (lifted.order.length === home.length && lifted.order.every((id, i) => id === home[i])) {
    t.lifted = null;
    return;
  }
  write(d, next(d, [...lifted.order]), { kind: 'move', id: lifted.id, before: lifted.snap });
}
export function moved(d: Draft, id: AppId, before: { home: AppId[]; recent: AppId[] }): void {
  d.session.undo.push({ label: 'Move ' + app(d, id).name, snap: before });
  const t = top(d);
  if (t.kind !== 'editor') return;
  t.lifted = null;
  d.session.note = app(d, id).name + ' moved to position ' + (t.i + 1) + '.';
}

function undoLast(d: Draft): void {
  const u = d.session.undo[d.session.undo.length - 1];
  if (!u) {
    d.session.note = 'Nothing to undo';
    return;
  }
  write(d, next(d, [...u.snap.home], [...u.snap.recent]), { kind: 'undo', entry: u });
}
export function undone(d: Draft, label: string): void {
  d.session.undo.pop();
  d.session.note = 'Undone: ' + label + '.';
}

function closeEditor(d: Draft): void {
  clearSession(d);
  pop(d);
}

function editorKey(d: Draft, t: EditorView, k: RemoteKey): void {
  const H = t.lifted ? t.lifted.order : d.prefs.home,
    O = otherList(d),
    nh = H.length,
    no = O.length;
  if (t.lifted) {
    const step = k === 'up' ? -1 : k === 'down' ? 1 : 0;
    if (step && t.i + step >= 0 && t.i + step < nh) {
      const tmp = H[t.i + step];
      H[t.i + step] = H[t.i];
      H[t.i] = tmp;
      t.i += step;
      d.session.err = null;
    } else if (k === 'ok') editorPlace(d, t);
    else if (k === 'back') {
      t.i = t.lifted.from;
      t.lifted = null;
      d.session.err = null;
    }
    return;
  }
  if (k === 'back') {
    closeEditor(d);
    return;
  }
  if (t.zone === 'head') {
    if (k === 'left' && t.h > 0) t.h--;
    else if (k === 'right' && t.h < 1) t.h++;
    else if (k === 'down') {
      if (no) returnOther(d, t);
      else if (nh) t.zone = 'home';
    } else if (k === 'ok') {
      d.session.note = null;
      if (t.h === 0) undoLast(d);
      else closeEditor(d);
    }
  } else if (t.zone === 'home') {
    if (k === 'up') {
      if (t.i > 0) t.i--;
      else t.zone = 'head';
    } else if (k === 'down') {
      if (t.i < nh - 1) t.i++;
    } else if (k === 'right') {
      if (t.part === 'name') t.part = 'remove';
      else if (no) returnOther(d, t);
    } else if (k === 'left') {
      if (t.part === 'remove') t.part = 'name';
    } else if (k === 'ok') {
      d.session.note = null;
      if (t.part === 'name') t.lifted = { id: H[t.i], from: t.i, order: [...H], snap: snap(d) };
      else editorRemove(d, H[t.i]);
    }
  } else {
    if (k === 'up') {
      if (t.j > 0) {
        t.j--;
        rememberOther(d, t);
      } else t.zone = 'head';
    } else if (k === 'down') {
      if (t.j < no - 1) {
        t.j++;
        rememberOther(d, t);
      }
    } else if (k === 'left') {
      if (nh) {
        rememberOther(d, t);
        t.i = nearestHome(d, t, nh);
        t.zone = 'home';
        t.part = 'name';
      }
    } else if (k === 'ok') {
      d.session.note = null;
      editorAdd(d, t, O[t.j]);
    }
  }
}

/* ---------- Settings ---------- */

function settingsKey(d: Draft, t: SettingsView, k: RemoteKey): void {
  const ids = settingsRows(d).map((r) => r.id);
  let i = Math.max(0, ids.indexOf(t.focus));
  if (k === 'up' && i > 0) i--;
  else if (k === 'down' && i < ids.length - 1) i++;
  else if (k === 'back') {
    pop(d);
    return;
  }
  t.focus = ids[i];
  d.session.settingsFocus = ids[i];
  const group = ids[i];
  if (k === 'ok') {
    if (group === 'editor') openEditor(d);
    else openAppearance(d, group);
  }
}

function applyRotation(d: Draft, value: string | undefined): void {
  if (d.prefs.bg !== 'photo') return;
  d.session.err = null;
  d.look.error = null;
  if (value === d.prefs.mode) return;
  const mode = MODE_IDS.find((m) => m === value);
  // A Try again whose stored row was Rotation but whose patch was not a rotation used to save an undefined mode.
  if (!mode) return;
  write(d, { ...next(d), mode }, { kind: 'rotation', mode });
}

function applyExtra(d: Draft, axis: ExtraAxis, value: string | undefined): void {
  const c = d.prefs;
  if (axis === 'collection') {
    const id = d.env.collections.map((x) => x.id).find((x) => x === value);
    if (!id || c.collection === id) return;
    d.session.err = null;
    d.look.error = null;
    write(d, { ...next(d), collection: id }, { kind: 'extra', axis, value: id });
    return;
  }
  const v = ON_OFF.find((x) => x === value);
  if (!v || c[axis] === v) return;
  d.session.err = null;
  d.look.error = null;
  const prefs = next(d);
  if (axis === 'cinema') prefs.cinema = v;
  else if (axis === 'crossfade') prefs.crossfade = v;
  else if (axis === 'greeting') prefs.greeting = v;
  else prefs.sounds = v;
  write(d, prefs, { kind: 'extra', axis, value: v });
}
export function extraSaved(d: Draft, axis: ExtraAxis, _value: string): void {
  d.fx.push({ kind: 'wakeCinema' });
  if (axis !== 'collection' || d.prefs.bg !== 'photo') return;
  const collection = collectionById(d.env, d.prefs.collection);
  if (!collection.wallpapers.includes(d.prefs.wall))
    setLook(d, { wall: collection.wallpapers[0] }, { row: 'wall' });
}

function lookPatchFor(axis: string, value: string | undefined): LookPatch | null {
  const patch: LookPatch = {};
  if (axis === 'bg' && (value === 'dark' || value === 'light' || value === 'photo'))
    patch.bg = value;
  else if (axis === 'layout' && (value === 'list' || value === 'dock')) patch.layout = value;
  else if (
    (axis === 'apps' || axis === 'controls') &&
    (value === 'icons' || value === 'both' || value === 'text')
  )
    patch[axis] = value;
  else if (axis === 'focus' && (value === 'type' || value === 'glass')) patch.focus = value;
  else if (axis === 'material' && (value === 'soft' || value === 'frost' || value === 'tint'))
    patch.material = value;
  else if (axis === 'font' && FONT_IDS.some((f) => f === value))
    patch.font = FONT_IDS.find((f) => f === value);
  else return null;
  return patch;
}

function detailBack(d: Draft): void {
  cancelLook(d);
  d.session.err = null;
  pop(d);
}

function detailOk(d: Draft, t: DetailView, item: DetailItem): void {
  const error = d.look.error;
  if (item.action === 'settings.back') {
    detailBack(d);
    return;
  }
  if (item.disabled || d.look.pending) return;
  if (item.action === 'settings.retry') {
    if (!error) return;
    const value = error.patch[error.row];
    if (value !== undefined)
      detailFocus(
        d,
        t,
        {
          action: error.row === 'mode' ? 'rotation.' + value : 'choice.' + error.row + '.' + value,
          axis: error.row,
        },
        0,
      );
    if (
      error.row === 'cinema' ||
      error.row === 'crossfade' ||
      error.row === 'greeting' ||
      error.row === 'collection'
    )
      applyExtra(d, error.row, value);
    else if (error.row === 'mode') applyRotation(d, error.patch.mode);
    else {
      const patch: LookPatch = {};
      for (const [k, v] of Object.entries(error.patch))
        Object.assign(patch, lookPatchFor(k, v) || (k === 'wall' ? wallPatch(d, v) : {}));
      setLook(d, patch, { row: error.row });
    }
  } else if (isExtraAxis(item.axis)) applyExtra(d, item.axis, item.value);
  else if (item.axis === 'mode') applyRotation(d, item.value);
  else if (item.axis) {
    const patch = lookPatchFor(item.axis, item.value);
    if (patch) setLook(d, patch, { row: item.axis });
  } else if (item.action === 'background.wallpaper') openWallpaper(d);
  else if (item.action === 'background.collections') openAppearance(d, 'collections');
  else if (item.action === 'background.rotation') openAppearance(d, 'rotation');
  else if (item.action === 'samsung.home') perform(d, 'Samsung Home', { op: 'home' });
  else if (item.action === 'samsung.settings') perform(d, 'TV settings', { op: 'settings' });
}
function wallPatch(d: Draft, v: string | undefined): LookPatch {
  for (const w of d.env.walls) if (w.id === v) return { wall: w.id };
  return {};
}

function detailKey(d: Draft, t: DetailView, k: RemoteKey): void {
  const at = detailLocation(d, t);
  let row = at.row,
    column = at.column;
  if (k === 'back') {
    detailBack(d);
    return;
  }
  if (k === 'ok') {
    detailOk(d, t, at.item);
    return;
  }
  if (k === 'up' || k === 'down') {
    row = clamp(row + (k === 'up' ? -1 : 1), 0, at.rows.length - 1);
    column = Math.min(t.column || 0, at.rows[row].length - 1);
    detailFocus(d, t, at.rows[row][column]);
  } else if (k === 'left' || k === 'right') {
    column = clamp(column + (k === 'left' ? -1 : 1), 0, at.rows[row].length - 1);
    detailFocus(d, t, at.rows[row][column], column);
  }
}

function normDetail(d: Draft, t: DetailView): void {
  const rows = detailRows(d, t.group),
    axis = GROUP_AXIS[t.group];
  let exists = false,
    applied: DetailItem | null = null;
  for (const items of rows)
    for (const item of items) {
      if (item.action === t.action) exists = true;
      if (axis && item.axis === axis && item.value === d.prefs[axis]) applied = item;
    }
  if (!exists) detailFocus(d, t, applied || (rows[1] || rows[0])[0], 0);
  if (t.column === undefined) t.column = detailLocation(d, t).column;
}

/* ---------- Messages ---------- */

function messageKey(d: Draft, t: MessageView, k: RemoteKey): void {
  const actions = t.content.actions;
  if (k === 'left') t.b = Math.max(0, t.b - 1);
  else if (k === 'right') t.b = Math.min(actions.length - 1, t.b + 1);
  else if (k === 'back') pop(d);
  else if (k === 'ok') {
    const a = actions[t.b][0];
    pop(d);
    if (a === 'samsung') perform(d, 'Samsung Home', { op: 'home' });
  }
}

/* ---------- Dispatch ---------- */

function key(d: Draft, t: View, k: RemoteKey): void {
  switch (t.kind) {
    case 'home': {
      homeKey(d, t, k);
      return;
    }
    case 'apps': {
      appsKey(d, t, k);
      return;
    }
    case 'editor': {
      editorKey(d, t, k);
      return;
    }
    case 'settings': {
      settingsKey(d, t, k);
      return;
    }
    case 'appearance': {
      detailKey(d, t, k);
      return;
    }
    case 'wallpaper': {
      wallpaperKey(d, t, k);
      return;
    }
    case 'message': {
      messageKey(d, t, k);
      return;
    }
    default: {
      const exhaustive: never = t;
      return exhaustive;
    }
  }
}

function wallpaperKey(d: Draft, t: Extract<View, { kind: 'wallpaper' }>, k: RemoteKey): void {
  if (k === 'back') {
    closeWallpaper(d, t);
    return;
  }
  if (t.zone === 'back') {
    if (k === 'ok') closeWallpaper(d, t);
    else if (k === 'down' || k === 'right') t.zone = 'photo';
    return;
  }
  if (t.zone === 'retry') {
    if (k === 'ok') retryWallpaper(d, t);
    else if (k === 'up' || k === 'left') t.zone = 'photo';
    return;
  }
  if (k === 'left' || (k === 'up' && t.i === 0)) {
    t.zone = 'back';
    t.applyPending = null;
  } else if (k === 'up' && t.i > 0) previewWallpaper(d, t, t.i - 1, false, false);
  else if (k === 'down' && t.i < d.env.walls.length - 1)
    previewWallpaper(d, t, t.i + 1, false, false);
  else if ((k === 'right' || k === 'down') && t.failedId) t.zone = 'retry';
  else if (k === 'ok') applyWallpaper(d, t, t.retryBundle);
}

/** View focus normalisation; runs where the controller called `norm()`. */
export function norm(d: Draft): void {
  const t = top(d);
  if (t.kind === 'appearance') normDetail(d, t);
  else if (t.kind === 'wallpaper') normWallpaper(d, t);
  else if (t.kind === 'apps') {
    const n = appsItems(d).length;
    t.i = clamp(t.i, 0, Math.max(0, n - 1));
    if (!n) t.zone = 'head';
  } else if (t.kind === 'editor') {
    const nh = (t.lifted ? t.lifted.order : d.prefs.home).length,
      no = otherList(d).length;
    t.i = clamp(t.i, 0, Math.max(0, nh - 1));
    t.j = clamp(t.j, 0, Math.max(0, no - 1));
    if (t.zone === 'home' && !nh) t.zone = no ? 'other' : 'head';
    if (t.zone === 'other' && !no) t.zone = nh ? 'home' : 'head';
  } else if (t.kind === 'settings') {
    const ids = settingsRows(d).map((r) => r.id);
    if (!ids.includes(t.focus)) t.focus = ids[0];
  }
}

/** Normalisation the old renderer applied on every render: detail focus and scroll positions. */
export function renderNorm(d: Draft): void {
  const t = top(d);
  if (t.kind === 'appearance') normDetail(d, t);
  else if (t.kind === 'wallpaper') normWallpaper(d, t);
  else if (t.kind === 'apps') t.top = appsTop(d, t);
  else if (t.kind === 'editor') t.top = editorEntries(d, t).top;
}

export function press(d: Draft, k: RemoteKey): void {
  norm(d);
  key(d, top(d), k);
  norm(d);
}

export function point(d: Draft, zone: PointZone, i: number, id: string | null): void {
  norm(d);
  const t = top(d);
  switch (t.kind) {
    case 'home': {
      if (zone === 'util') {
        t.zone = 'util';
        t.u = i;
        d.session.lastUtil = i;
      } else if (zone === 'app') {
        t.zone = 'apps';
        setSel(d, d.prefs.home[i]);
      } else break;
      homeKey(d, t, 'ok');
      break;
    }
    case 'apps': {
      if (zone === 'grid') {
        t.zone = 'grid';
        t.i = i;
      } else if (zone === 'head') t.zone = 'head';
      else break;
      appsKey(d, t, 'ok');
      break;
    }
    case 'editor': {
      if (t.lifted) {
        if (zone === 'name' && i === t.i) editorKey(d, t, 'ok');
        break;
      }
      if (zone === 'name' || zone === 'remove') {
        t.zone = 'home';
        t.i = i;
        t.part = zone;
      } else if (zone === 'other') {
        t.zone = 'other';
        t.j = i;
        rememberOther(d, t);
      } else if (zone === 'head') {
        t.zone = 'head';
        t.h = i;
      } else break;
      editorKey(d, t, 'ok');
      break;
    }
    case 'settings': {
      if (zone !== 'row' || !id) break;
      const ids = settingsRows(d).map((r) => r.id),
        at = ids.indexOf(id as (typeof ids)[number]);
      t.focus = at === -1 ? ids[0] : ids[at];
      settingsKey(d, t, 'ok');
      break;
    }
    case 'appearance': {
      if (zone !== 'detail') break;
      detailRows(d, t.group).some((items) =>
        items.some((item, column) => {
          if (item.action !== id) return false;
          detailFocus(d, t, item, column);
          detailOk(d, t, item);
          return true;
        }),
      );
      break;
    }
    case 'wallpaper': {
      if (zone === 'wall-back') closeWallpaper(d, t);
      else if (zone === 'wall-retry') retryWallpaper(d, t);
      else if (zone === 'wall-choice' && i >= 0 && i < d.env.walls.length) {
        if (i === t.i) {
          t.zone = 'photo';
          wallpaperKey(d, t, 'ok');
        } else previewWallpaper(d, t, i, true, false);
      }
      break;
    }
    case 'message': {
      if (zone === 'act') {
        t.b = i;
        messageKey(d, t, 'ok');
      }
      break;
    }
    default: {
      const exhaustive: never = t;
      return exhaustive;
    }
  }
  norm(d);
}
