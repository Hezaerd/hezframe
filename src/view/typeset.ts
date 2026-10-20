import { fontShift, type FontRole } from '../model/assets.ts';
import { clamp } from '../model/ids.ts';
import type { App, AppId, FaceMetrics, FontId, Prefs } from '../model/types.ts';
import { textWidth } from '../platform/fonts.ts';

export interface TypesetInput {
  font: FontId;
  metrics: Partial<Record<FontId, FaceMetrics>>;
  prefs: Prefs;
  apps: ReadonlyMap<AppId, App>;
}

/** Home text measurement in the face Home currently shows. */
export function typeset({ font, metrics, prefs, apps }: TypesetInput) {
  const loaded = !!metrics[font];
  const width = (text: string, size: number, weight: number, spacing: number, role?: FontRole) =>
    textWidth(font, loaded, text, size, weight, spacing, role);
  const shift = (role: FontRole, size: number) => fontShift(metrics, font, role, size);
  const name = (id: AppId) => {
    const a = apps.get(id);
    if (!a) throw new Error('Unknown app: ' + id);
    return a.name;
  };
  function dockLabelSize(id: AppId): number {
    return prefs.apps === 'text'
      ? width(name(id), 40, 600, -0.8, 'primary') > 264
        ? 34
        : 40
      : width(name(id), 36, 500, -0.8, 'primary') > 280
        ? 32
        : 36;
  }
  function photoLabel(id: AppId) {
    const limit = 992;
    let size = 88,
      w = width(name(id), size, 600, -1.8, 'display');
    if (w > limit) {
      size = 76;
      w = width(name(id), size, 600, -1.8, 'display');
    }
    return {
      size,
      top: (size === 76 ? 10.36 : 9.68) + shift('display', size),
      width: Math.min(limit, w),
      ellipsis: w > limit,
    };
  }
  function listPlateWidth(id: AppId): number {
    if (prefs.apps === 'icons') return 144;
    const text = prefs.apps === 'text';
    return clamp(
      Math.ceil(photoLabel(id).width + (text ? 84 : 184)),
      text ? 280 : 360,
      text ? 1076 : 1176,
    );
  }
  return {
    width,
    shift,
    dockLabelSize,
    photoLabel,
    listPlateWidth,
    reducedDockLabel: (id: AppId) =>
      prefs.apps !== 'icons' && dockLabelSize(id) === (prefs.apps === 'text' ? 34 : 32),
  };
}
