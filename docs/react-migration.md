# React migration

The UI now renders through React and TypeScript. The imperative `app/main.js`
controller and the temporary React bridge have been deleted.

## Ownership

- `src/model/` owns typed preferences, views, navigation and a pure reducer.
- `src/store.ts` applies actions synchronously and runs the resulting effects.
  Storage results join the same action queue, so failed writes keep the committed
  appearance and app order.
- `src/view/` renders the screens. DOM reads are limited to layout measurements.
- `src/platform/` wraps storage, images, fonts and the existing Tizen adapter.
  `src/controllers.ts` owns remote events, visibility, rotation and idle timers.
- `src/qa.ts` preserves the existing browser-test interface.

Home keeps its last rendered content while a panel covers it, and only the active
Home layout updates. This preserves the existing return animations. Keyed,
absolutely positioned rows retain their DOM order during reordering. Short-lived
contents that the old renderer rebuilt are explicitly keyed to preserve their
focus-transition behavior. No live blur or image analysis was introduced.

## Verification

The migration retains the localStorage keys and existing preference migrations.
The 344 browser assertions remain unchanged; their source-inventory checks now
hash the TypeScript files instead of the removed controller. There are also 21
model tests covering navigation, migrations, write failure, cancellation and
out-of-order resource completion.

A local comparison of the old and React builds captured 110 states and seven
1920 × 1080 screens: Dock, List, Settings, Background, Wallpaper, All apps and the
Home editor. All seven settled screenshots were pixel-identical. Remaining
structural differences were an explicit `aria-hidden` on a decorative image,
subpixel status-line measurements and a stale status class on covered Home
content. Failed native icons remain hidden. Invalid collection IDs are ignored,
and rotation pauses during a pending appearance change.

Three alternating performance runs per build used Chromium with 4× CPU
throttling. The median across scenario key-response p95 values increased from
12.8 ms to 17.5 ms; median startup was 1462 ms versus 1420 ms. All runs passed the
existing performance budgets. These are browser comparisons, not TV timings.
The production JavaScript grew from 304.97 kB (96.54 kB gzip) to 317.10 kB
(99.86 kB gzip). Chrome 85 remains the shared JavaScript/CSS target, including the
packaged-CSS compatibility gate.

Physical rendering and remote feel for this migration still need TV observation.
No installation or native Home/startup change is part of this refactor.
