import { knownAppId } from './ids.ts';
import type {
  AppId,
  Bg,
  Display,
  FocusStyle,
  FontId,
  Layout,
  Material,
  RotationMode,
} from './types.ts';

export const STORAGE_KEY = 'cleanframe.home.v1';
export const LEGACY_STORAGE_KEY = 'cleanframe.shore.v1';
export const CAP = 9;
export const FULL = 'Home holds nine apps. Remove one first.';
export const LAST = 'Home needs one app';
export const WALL_VISIBLE = 6;
export const WALL_ROW = 92;
export const WALL_DELAY = 200;
export const GRID_ROW = 240;
export const GRID_COL = 344;
export const GRID_COLS = 5;
export const GRID_VISIBLE = 3;
export const ED_ROW = 80;
export const ED_SEP = 56;
export const ED_VIEW = 752;
export const ED_CUT = 5;
export const PH_TOP = 220;
export const PH_PITCH = 128;
export const PH_FULL = 5;
export const PH_HEIGHT = 944;
export const SCRIM_Y = 560;

export const PRIMARY_APPS: { id: AppId; name: string; appId: string }[] = [
  ['stremio', 'Stremio', 'IkWsFHtOY9.Stremio'],
  ['netflix', 'Netflix', 'org.tizen.netflix-app'],
  ['disneyplus', 'Disney+', 'MCmYXNxgcu.DisneyPlus'],
  ['youtube', 'YouTube', '9Ur5IzDKqV.TizenYouTube'],
  ['appletv', 'Apple TV', 'com.samsung.tv.aria-video'],
  ['primevideo', 'Prime Video', 'org.tizen.primevideo'],
  ['abciview', 'ABC iview', 'mWK87Xghap.ABCiview'],
  ['sbs', 'SBS On Demand', 'OyE7OuxlUi.SBSOnDemand'],
  ['applemusic', 'Apple Music', 'org.tizen.apple.apple-music'],
].map(([id, name, appId]) => ({ id: knownAppId(id), name, appId }));
export const PRIMARY_IDS: string[] = PRIMARY_APPS.map((a) => a.id);
export const DEFAULT_HOME: AppId[] = [
  'stremio',
  'youtube',
  'netflix',
  'disneyplus',
  'primevideo',
  'appletv',
].map(knownAppId);
export const EXTRA_BRANDS = ['hbomax', 'spotify', 'tubi'];

export interface FontFace {
  name: string;
  family: string;
  display: number;
  ui: number;
  clock: number;
}
export const FONTS: Record<FontId, FontFace> = {
  manrope: { name: 'Manrope', family: 'Manrope', display: 600, ui: 500, clock: 500 },
  montreal: { name: 'Neue Montreal', family: 'Study Montreal', display: 300, ui: 400, clock: 300 },
  mori: { name: 'Mori', family: 'Study Mori', display: 200, ui: 400, clock: 200 },
  pangram: { name: 'Pangram Sans', family: 'Study Pangram', display: 300, ui: 400, clock: 300 },
  geist: { name: 'Geist', family: 'Study Geist', display: 300, ui: 400, clock: 300 },
  newsreader: { name: 'Newsreader', family: 'Study Newsreader', display: 400, ui: 400, clock: 400 },
};
export const FONT_IDS: FontId[] = ['manrope', 'montreal', 'mori', 'pangram', 'geist', 'newsreader'];

export const MODES: { id: RotationMode; name: string; min: number }[] = [
  { id: 'fixed', name: 'Fixed', min: 0 },
  { id: 'open', name: 'Each time Home opens', min: 0 },
  { id: '5', name: 'Every 5 minutes', min: 5 },
  { id: '15', name: 'Every 15 minutes', min: 15 },
  { id: '60', name: 'Every hour', min: 60 },
];
export const MODE_IDS = MODES.map((m) => m.id);

export const BG_VALUES: Bg[] = ['dark', 'light', 'photo'];
export const LAYOUT_VALUES: Layout[] = ['list', 'dock'];
export const DISPLAY_VALUES: Display[] = ['icons', 'both', 'text'];
export const FOCUS_VALUES: FocusStyle[] = ['type', 'glass'];
export const MATERIAL_VALUES: Material[] = ['soft', 'frost', 'tint'];
export const ON_OFF = ['on', 'off'] as const;

export const VALUE_NAMES: Record<string, string> = {
  dark: 'Dark',
  light: 'Light',
  photo: 'Photo',
  list: 'List',
  dock: 'Dock',
  type: 'Type',
  glass: 'Glass',
  soft: 'Soft',
  frost: 'Frost',
  tint: 'Clear tint',
  icons: 'Icons',
  both: 'Icons and text',
  text: 'Text',
};
export const LOOK_NAMES: Record<string, string> = {
  bg: 'Background',
  layout: 'Layout',
  apps: 'Apps',
  font: 'Font',
  controls: 'Home controls',
  focus: 'Focus',
  material: 'Material',
};
export const DETAIL_NAMES = {
  atmosphere: 'Atmosphere',
  collections: 'Collections',
  background: 'Background',
  layout: 'Layout',
  typography: 'Typography',
  focus: 'Focus',
  rotation: 'Rotation',
  samsung: 'Samsung',
} as const;
export const UTILS = [
  { id: 'apps', label: 'All apps', icon: 'apps' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
] as const;
export const DOCK_MODES: Record<Display, { tw: number; th: number; pitch: number }> = {
  both: { tw: 288, th: 200, pitch: 296 },
  text: { tw: 288, th: 104, pitch: 296 },
  icons: { tw: 176, th: 144, pitch: 184 },
};
