export type Brand<T, B extends string> = T & { readonly __brand: B };
/** A saved or installed application id that passed `safeId`. */
export type AppId = Brand<string, 'AppId'>;
/** A wallpaper id present in the bundled gallery. */
export type WallId = Brand<string, 'WallId'>;
/** A collection id present in the configured collections. */
export type CollectionId = Brand<string, 'CollectionId'>;

export type FontId = 'manrope' | 'montreal' | 'mori' | 'pangram' | 'geist' | 'newsreader';
export type Bg = 'dark' | 'light' | 'photo';
export type Layout = 'list' | 'dock';
export type Display = 'icons' | 'both' | 'text';
export type FocusStyle = 'type' | 'glass';
export type Material = 'soft' | 'frost' | 'tint';
export type OnOff = 'on' | 'off';
export type RotationMode = 'fixed' | 'open' | '5' | '15' | '60';
export type RemoteKey = 'left' | 'right' | 'up' | 'down' | 'ok' | 'back';

/** The appearance axes, in the key order the stored `look` object has always used. */
export interface Look {
  bg: Bg;
  wall: WallId;
  layout: Layout;
  apps: Display;
  font: FontId;
  controls: Display;
  focus: FocusStyle;
  material: Material;
}
export type LookAxis = keyof Look;
export type LookPatch = Partial<Look>;
export type ExtraAxis = 'cinema' | 'crossfade' | 'greeting' | 'collection';

/** Committed preferences. Key order matches the stored JSON written since 0.6. */
export interface Prefs extends Look {
  home: AppId[];
  recent: AppId[];
  lastApp: AppId;
  mode: RotationMode;
  cinema: OnOff;
  crossfade: OnOff;
  greeting: OnOff;
  collection: CollectionId;
}

export interface App {
  id: AppId;
  appId: string;
  name: string;
  brand: string;
  mark: boolean;
  icon: string;
}

export interface Wallpaper {
  id: WallId;
  name: string;
  tone: string;
  ut: { tr: string; br: string };
  frostVeil: number;
  listColumn: number;
  dockQuiet: boolean;
  clockMist: boolean;
  clockInk: string;
  dockClockInk: string;
}
export interface Collection { id: CollectionId; name: string; wallpapers: WallId[] }
/** Offline photo-family inks. Absent fields stay absent so their CSS variables are removed. */
export interface PaletteZone { pol?: string; ink?: string; clockInk?: string; restInk?: string; peerInk?: string; restAlpha?: number | string; peerAlpha?: number | string; halo?: string; shadow?: string; rung?: string }
export interface Palette { locked: boolean; light: string; tl?: PaletteZone; tr?: PaletteZone; br?: PaletteZone }
export interface IconMetric { n: number; x: number; y: number; w: number; h: number; fill: number }

/** Everything read from the runtime scripts and the browser once at startup. */
export interface Env {
  walls: Wallpaper[];
  collections: Collection[];
  initialWall: WallId;
  wallRevision: number;
  defaultCollection: CollectionId;
  defaultRotation: RotationMode;
  privateFonts: string[];
  defaults: { cinema: OnOff; crossfade: OnOff; greeting: OnOff };
  cinemaSeconds: number;
  dimAmount: number;
  crossfadeMs: number;
  greetingName: string;
  palettes: Record<string, Palette | undefined>;
  iconMetrics: Record<string, IconMetric | undefined>;
  reducedMotion: boolean;
  maskSupport: boolean;
  minuteMs: number;
}

export interface UndoEntry { label: string; snap: { home: AppId[]; recent: AppId[] } }

export type HomeZone = 'apps' | 'util';
export type SettingsGroup = 'background' | 'layout' | 'typography' | 'focus' | 'editor' | 'atmosphere' | 'samsung';
export type DetailGroup = 'background' | 'layout' | 'typography' | 'focus' | 'atmosphere' | 'samsung' | 'rotation' | 'collections';
export type MessageAction = 'stay' | 'samsung' | 'back';
export interface MessageContent { title: string; line: string; note: string; actions: [MessageAction, string][] }
export interface Lifted { id: AppId; from: number; order: AppId[]; snap: UndoEntry['snap'] }

export interface HomeView { kind: 'home'; zone: HomeZone; u: number }
export interface SettingsView { kind: 'settings'; focus: SettingsGroup }
export interface DetailView { kind: 'appearance'; group: DetailGroup; action: string; column: number | undefined }
export interface WallpaperView {
  kind: 'wallpaper';
  /** Distinguishes this picker from a later reopened one, as the old object identity did. */
  instance: number;
  i: number;
  top: number;
  zone: 'photo' | 'back' | 'retry';
  previewDue: WallId | null;
  /** The debounce timer that may load `previewDue`; a newer browse move replaces it. */
  previewSeq: number;
  applyPending: WallId | null;
  failedId: WallId | null;
  failedApply: boolean;
  retryBundle: BundleKey | null;
}
export interface AppsView { kind: 'apps'; top: number; zone: 'grid' | 'head'; i: number }
export interface EditorView {
  kind: 'editor';
  lifted: Lifted | null;
  top: number;
  otherReturn: { id: AppId | null; index: number; top: number };
  zone: 'home' | 'other' | 'head';
  i: number;
  part: 'name' | 'remove';
  h: number;
  j: number;
}
export interface MessageView { kind: 'message'; msg: 'leave' | 'error'; content: MessageContent; b: number }
export type Overlay = SettingsView | DetailView | WallpaperView | AppsView | EditorView | MessageView;
export type View = HomeView | Overlay;
export type ViewKind = View['kind'];
export type Stack = [HomeView, ...Overlay[]];

/** A decoded wallpaper plus material set; images are retained by the loader per key. */
export interface BundleKey { wall: WallId; material: Material }
export interface Shown { bg: Bg; wall: WallId; material: Material; font: FontId }
export interface Pending {
  patch: LookPatch;
  target: Look;
  row: string;
  transient?: boolean;
  preview?: boolean;
  deferred?: boolean;
}
/** The failed change. Try again re-reads `patch[row]`, as the stored error always has. */
export type LookError =
  | { type: 'save'; patch: Partial<Record<string, string>>; row: string; transient?: boolean }
  | { type: 'load' | 'font'; reason: string | null; patch: Partial<Record<string, string>>; row: string; transient: boolean; wall: WallId; font: FontId };
export interface LookOptions { row?: string; transient?: boolean; startup?: boolean }

/** An in-flight appearance change (setLook) or wallpaper preview (showWall). */
export type LookFlow =
  | { kind: 'look'; target: Look; changes: LookPatch; opts: LookOptions; changed: boolean; imageDone: boolean; fontDone: boolean; failed: boolean; loaded: BundleKey | null }
  | { kind: 'preview'; target: Look; picker: number; wall: WallId };

export interface FaceMetrics {
  roles: Record<'display' | 'clock' | 'primary' | 'ui', Record<number, { cap: number; ascent: number; descent: number; lower: number }>>;
  digits: number[];
  digitCell: number;
  fallback?: boolean;
}

export interface CatalogState { loading: boolean; loaded: boolean; error: string | null; request: number; revision: number; ids: AppId[] }
export interface Crossfade { token: number; wall: WallId | null }

export interface State {
  env: Env;
  prefs: Prefs;
  apps: ReadonlyMap<AppId, App>;
  catalog: CatalogState;
  stack: Stack;
  session: {
    sel: AppId | null;
    selIdx: number;
    lastUtil: number;
    appsFocus: AppId | null;
    settingsFocus: SettingsGroup;
    appearanceFocus: string;
    detailFocus: Partial<Record<DetailGroup, string>>;
    undo: UndoEntry[];
    removedAt: Partial<Record<string, number>>;
    note: string | null;
    err: string | null;
    writes: number;
    failed: number;
    storageOk: boolean;
    press: AppId | null;
    busy: number;
    nextToken: number;
  };
  look: {
    shown: Shown | null;
    pending: Pending | null;
    error: LookError | null;
    token: number;
    flow: LookFlow | null;
    installed: BundleKey | null;
    backdrop: WallId | null;
    committedBundle: BundleKey | null;
    previewBundle: BundleKey | null;
    wallShown: WallId | null;
    wallPending: WallId | null;
    wallError: WallId | null;
    reflow: number;
    fontSwitch: number;
    crossfade: Crossfade | null;
  };
  fonts: { metrics: Partial<Record<FontId, FaceMetrics>>; unavailable: FontId[]; ready: boolean };
  /** Scroll memory that the old renderer kept between renders. */
  scroll: { first: number; off: number; photo: number; dockOff: number };
  hidden: boolean;
  veil: 'unset' | 'clear' | 'dim';
}

export interface CatalogEntry { appId: string; name: string; brand: string; icon: string }
export interface DeviceError { message?: string; detail?: string }
export type DeviceOp = { op: 'launch'; appId: string } | { op: 'home' } | { op: 'settings' };

export type CommitIntent =
  | { kind: 'startup' }
  | { kind: 'remove'; id: AppId; index: number; before: UndoEntry['snap'] }
  | { kind: 'add'; id: AppId; before: UndoEntry['snap'] }
  | { kind: 'move'; id: AppId; before: UndoEntry['snap'] }
  | { kind: 'undo'; entry: UndoEntry }
  | { kind: 'lastApp' }
  | { kind: 'wallpaper'; wall: WallId; bundle: BundleKey }
  | { kind: 'rotation'; mode: RotationMode }
  | { kind: 'extra'; axis: ExtraAxis; value: string }
  | { kind: 'look'; target: Look; changes: LookPatch; opts: LookOptions; bundle: BundleKey | null; fontChanged: boolean; reflow: boolean };

export type PointZone = 'util' | 'app' | 'grid' | 'head' | 'name' | 'remove' | 'other' | 'row' | 'detail' | 'act' | 'wall-back' | 'wall-retry' | 'wall-choice';

export type Action =
  | { type: 'key'; key: RemoteKey }
  | { type: 'point'; zone: PointZone; index: number; id: string | null }
  | { type: 'hoverUtil'; index: number }
  | { type: 'look'; patch: LookPatch }
  | { type: 'scene'; name: 'home' | 'apps' | 'settings' | 'appearance' | 'editor' }
  | { type: 'resume' }
  | { type: 'visibility'; hidden: boolean }
  | { type: 'persisted'; intent: CommitIntent; prefs: Prefs; ok: boolean }
  | { type: 'deviceDone'; title: string; error: DeviceError | null }
  | { type: 'releaseTimeout'; token: number }
  | { type: 'catalogLoaded'; request: number; error: string | null; entries: CatalogEntry[] }
  | { type: 'bundleLoaded'; token: number; bundle: BundleKey; ok: boolean }
  | { type: 'fontResult'; token: number; ok: boolean; reason: string | null }
  | { type: 'fontsChanged'; metrics: Partial<Record<FontId, FaceMetrics>>; unavailable: FontId[]; ready: boolean }
  | { type: 'lookSettle'; token: number }
  | { type: 'previewDue'; seq: number; wall: WallId }
  | { type: 'rotate' }
  | { type: 'reflowEnded'; token: number }
  | { type: 'fontSwitchEnded'; token: number }
  | { type: 'crossfadeEnded'; token: number }
  | { type: 'veil'; dimmed: boolean };

export type Effect =
  | { kind: 'persist'; prefs: Prefs; intent: CommitIntent }
  | { kind: 'device'; title: string; op: DeviceOp }
  | { kind: 'loadCatalog'; request: number }
  | { kind: 'loadBundle'; bundle: BundleKey; token: number }
  | { kind: 'ensureFont'; font: FontId; token: number }
  | { kind: 'after'; ms: number; action: Action }
  | { kind: 'frames'; count: 1 | 2; action: Action }
  | { kind: 'wakeCinema' };
