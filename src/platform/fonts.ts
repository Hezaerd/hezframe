import { fontRole, type FontRole } from '../model/assets.ts';
import { FONT_IDS, FONTS } from '../model/tables.ts';
import type { FaceMetrics, FontId } from '../model/types.ts';

let measureContext: CanvasRenderingContext2D | null = null;
let measureSpan: HTMLSpanElement | null = null;

/** A hidden measureSpan for optical-size measurements; canvas has no optical-size property. */
export function initTextMeasure(doc: Document): void {
  measureContext = doc.createElement('canvas').getContext('2d');
  measureSpan = doc.createElement('measureSpan');
  measureSpan.setAttribute('aria-hidden', 'true');
  measureSpan.style.cssText =
    'position:absolute;left:-10000px;top:0;visibility:hidden;white-space:pre;font-synthesis:none;';
  doc.body.append(measureSpan);
}
function tools(): { ctx: CanvasRenderingContext2D; span: HTMLSpanElement } {
  if (!measureContext || !measureSpan)
    throw new Error('initTextMeasure must run before text is measured');
  return { ctx: measureContext, span: measureSpan };
}

const ROLE_SIZES: Record<FontRole, number[]> = {
  display: [88, 76, 56],
  clock: [48],
  primary: [30, 32, 34, 36, 40],
  ui: [28, 30, 48],
};

function measureFace(id: FontId, faces: FontFace[][]): FaceMetrics {
  const { ctx, span } = tools();
  const roles: FaceMetrics['roles'] = { display: {}, clock: {}, primary: {}, ui: {} };
  const face = id === 'newsreader' ? faces[0][0] : null,
    original = face ? face.variationSettings : '';
  for (const role of ['display', 'clock', 'primary', 'ui'] as const) {
    for (const size of ROLE_SIZES[role]) {
      const r = fontRole(id, role, size);
      // Set this face's optical size only while measuring; CSS sets each rendered role explicitly.
      if (face) face.variationSettings = r.opsz ? '"opsz" ' + r.opsz : original;
      ctx.font = r.weight + ' ' + size + 'px "' + r.family + '"';
      const m = ctx.measureText('H'),
        d = ctx.measureText('gjpqy');
      roles[role][size] = {
        cap: m.actualBoundingBoxAscent || size * 0.72,
        ascent: m.fontBoundingBoxAscent || size * 1.066,
        descent: m.fontBoundingBoxDescent || size * 0.3,
        lower: d.actualBoundingBoxDescent || size * 0.255,
      };
    }
  }
  if (face) face.variationSettings = original;
  const r = fontRole(id, 'clock');
  span.style.font = r.weight + ' 48px/64px "' + r.family + '"';
  span.style.letterSpacing = '0';
  span.style.fontVariantNumeric = 'tabular-nums';
  span.style.fontVariationSettings = r.opsz ? '"opsz" ' + r.opsz : 'normal';
  const digits = '0123456789'.split('').map((n) => {
    span.textContent = n;
    return span.getBoundingClientRect().width;
  });
  const min = Math.min(...digits),
    max = Math.max(...digits);
  return { roles, digits, digitCell: max - min > 0.02 ? max : 0 };
}

export interface FontSnapshot {
  metrics: Partial<Record<FontId, FaceMetrics>>;
  unavailable: FontId[];
  ready: boolean;
}
type Done = (ok: boolean, reason: string | null) => void;
const ignoreSnapshot = (_snapshot: FontSnapshot): void => {};

/**
 * Loads Home faces and measures them. Owns the font cache and publishes every change, so the
 * store always holds the metrics that rendering and `ensureFont` decisions use.
 */
export function createFontService(doc: Document) {
  let publish: (snapshot: FontSnapshot) => void = ignoreSnapshot;
  const metrics: Partial<Record<FontId, FaceMetrics>> = {},
    unavailable: Partial<Record<FontId, true>> = {};
  let ready = false,
    baselineRecovery = false;
  const emit = () =>
    publish({
      metrics: { ...metrics },
      unavailable: FONT_IDS.filter((id) => unavailable[id]),
      ready,
    });

  // A rejected CSS FontFace cannot load again. Recreate only that family's rules.
  function retryFontFaces(id: FontId): void {
    for (const sheet of doc.styleSheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (!(rule instanceof CSSFontFaceRule)) continue;
        if (
          rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim() !==
          FONTS[id].family
        )
          continue;
        const css = rule.cssText;
        sheet.deleteRule(i);
        sheet.insertRule(css, i);
      }
    }
  }

  function fallbackBaseline(): void {
    metrics.manrope = { ...measureFace('manrope', []), fallback: true };
    ready = true;
  }

  function loadFont(id: FontId, done: Done): void {
    const f = FONTS[id],
      weights = [f.display];
    if (metrics[id]) {
      done(true, null);
      return;
    }
    if (!doc.fonts || !doc.fonts.load) {
      if (id === 'manrope') {
        metrics.manrope = measureFace('manrope', []);
        ready = true;
        emit();
        done(true, null);
      } else done(false, 'unsupported');
      return;
    }
    if (unavailable[id]) retryFontFaces(id);
    if (id !== 'newsreader' && !weights.includes(f.ui)) weights.push(f.ui);
    let ended = false;
    const finish = (ok: boolean, reason: string, faces?: FontFace[][]) => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      if (ok && faces) {
        metrics[id] = measureFace(id, faces);
        delete unavailable[id];
        if (id === 'manrope') ready = true;
      } else if (reason !== 'timeout') unavailable[id] = true;
      emit();
      done(ok, reason);
    };
    const timer = setTimeout(() => finish(false, 'timeout'), 3000);
    Promise.all(weights.map((weight) => doc.fonts.load(weight + ' 88px "' + f.family + '"'))).then(
      (faces) => {
        finish(
          faces.every((list) => list.length > 0 && list.every((face) => face.status === 'loaded')),
          'load',
          faces,
        );
      },
      () => finish(false, 'load'),
    );
  }

  /** Manrope first: a missing baseline falls back to a local face and recovers when fonts settle. */
  function ensureFont(id: FontId, done: Done, report: (snapshot: FontSnapshot) => void): void {
    publish = report;
    loadFont('manrope', (ok, reason) => {
      if (!ok && id === 'manrope') {
        fallbackBaseline();
        emit();
        done(true, reason);
        if (!baselineRecovery && doc.fonts && doc.fonts.ready) {
          baselineRecovery = true;
          doc.fonts.ready.then(() => {
            delete metrics.manrope;
            delete unavailable.manrope;
            loadFont('manrope', (loaded) => {
              if (!loaded) {
                fallbackBaseline();
                emit();
              }
            });
          });
        }
        return;
      }
      if (!ok || id === 'manrope') done(ok, reason);
      else loadFont(id, done);
    });
  }

  return { ensureFont };
}

const widths = new Map<string, number>();
/**
 * Rendered text width on the 1920px stage. Widths are cached only once the face has loaded,
 * so fallback measurements never outlive the fallback.
 */
export function textWidth(
  id: FontId,
  loaded: boolean,
  text: string,
  size: number,
  weight: number,
  spacing: number,
  role: FontRole = 'ui',
): number {
  const { ctx, span } = tools(),
    r = fontRole(id, role, size);
  if (id !== 'manrope') {
    weight = r.weight;
    spacing = role === 'display' ? -size * 0.01 : 0;
  }
  const key = [id, role, text, size, weight, spacing].join('|');
  const cached = widths.get(key);
  if (cached !== undefined) return cached;
  let width: number;
  if (r.opsz) {
    span.style.font = weight + ' ' + size + 'px "' + r.family + '"';
    span.style.fontVariationSettings = '"opsz" ' + r.opsz;
    span.style.fontVariantNumeric = 'normal';
    span.style.letterSpacing = '0';
    span.textContent = text;
    width = span.getBoundingClientRect().width;
  } else {
    ctx.font = (weight || 500) + ' ' + size + 'px "' + r.family + '", Arial, sans-serif';
    width = ctx.measureText(text).width;
  }
  width += Math.max(0, text.length - 1) * (spacing || 0);
  if (loaded) widths.set(key, width);
  return width;
}
