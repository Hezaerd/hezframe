import { FONTS } from './tables.ts';
import type { FaceMetrics, FontId, Material, WallId } from './types.ts';

export const ICONS = 'assets/icons/';
export const WALLPAPERS = 'assets/wallpapers/';

export function photoSrc(wall: WallId): string { return WALLPAPERS + wall + '.jpg'; }
export function panelSrc(wall: WallId): string { return WALLPAPERS + wall + '-panel.jpg'; }
export function thumbSrc(wall: WallId): string { return WALLPAPERS + wall + '-thumb.jpg'; }
export function matSrc(wall: WallId, material: Material): string {
  return 'assets/materials/' + wall + (material === 'soft' ? '-study-soft.jpg' : material === 'tint' ? '-field-clear.jpg' : '-field-frost.jpg');
}
export function fieldSrc(wall: WallId, material: Material): string {
  return 'assets/materials/' + wall + (material === 'soft' ? '-field-blur.jpg' : material === 'tint' ? '-field-clear.jpg' : '-field-frost.jpg');
}

export type FontRole = 'display' | 'clock' | 'primary' | 'ui';
/** The rendered family, weight and optical size of a Home text role. Only Newsreader has an optical axis. */
export function fontRole(id: FontId, role: FontRole, size?: number): { family: string; weight: number; opsz: number } {
  const f = FONTS[id], serif = id === 'newsreader';
  return {
    family: f.family,
    weight: role === 'display' ? f.display : role === 'clock' ? f.clock : serif ? 400 : f.ui,
    opsz: serif ? role === 'display' ? 72 : role === 'clock' ? 48 : role === 'ui' && (!size || size === 28) ? 28 : 36 : 0
  };
}

/** Vertical shift that puts a custom face's cap height where Manrope's sits. */
export function fontShift(metrics: Partial<Record<FontId, FaceMetrics>>, id: FontId, role: FontRole, size: number): number {
  const base = metrics.manrope, m = metrics[id];
  if (id === 'manrope' || !base || !m) return 0;
  const a = base.roles[role][size], b = m.roles[role][size];
  return (a.ascent - a.descent - a.cap - b.ascent + b.descent + b.cap) / 2;
}

export function px(n: number): string { return n.toFixed(2) + 'px'; }
