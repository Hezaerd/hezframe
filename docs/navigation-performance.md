# Navigation performance

React stays responsible for the interface. The first optimization pass limits work that runs when remote focus changes:

- Dock edge measurements run when the shelf moves or its contents, typography or Type focus geometry changes. Glass focus changes on a stationary shelf no longer restart a 220 ms measurement loop. Scrolling still watches the moving icons so clipping stays synchronized.
- Home controls measure their lens and label when their own inputs change, rather than on every app selection.
- The stage's appearance variables and Home font metrics are reused across focus changes. Hidden Appearance content also keeps its rendered element tree, and the inactive storage-error indicator skips unrelated updates.
- Removed marks are released from the Dock's DOM-reference map.

The existing focus/crossfade transitions, cached material images, React production build and Chrome 85 target remain. There are no new runtime dependencies. React Compiler remains off for the reasons and measurements in [the compiler investigation](react-compiler.md).

## Reproduce a comparison

Save a production build before changing the app, then build the candidate. For example, copy `dist/web` to an ignored `.local/navigation-before` directory after `npm run build`. After the candidate build, run:

```sh
node scripts/compare-navigation.mjs .local/navigation-before dist/web
npm run check:render-work
```

The comparison serves the two immutable build directories on loopback, uses a fresh browser context per build and alternates their order over three pairs. It records bundle hashes, raw samples, geometry-read counts and script/layout/style durations in `.local/qa/navigation/comparison.json`. Keep both builds on identical assets and public fonts, and avoid concurrent benchmarks or builds.

Measurements use Chromium at 1920 × 1080 with CPU throttled 4×. Each sample runs the actual document keyboard handler, waits for the next animation-frame callback, and records elapsed time. No QA state or focus-geometry reads run inside that interval. This includes React's update before that callback; it does not measure when the pixels reach the display. Dock samples move focus within the stationary shelf; the regression check separately covers scrolling, both shelf ends, Text/Icons/Both, Glass/Type, single focus and 720p scaling.

The existing `node scripts/check-performance.mjs` audit remains useful for broad regression budgets and retained-memory checks. Its key timings include `ShoreQA.nav()`'s synchronous render and QA state/geometry report, so they should not be presented as native remote-handler timings.

## Recorded comparison, 20 October 2026

Baseline: `7d85f36`, bundle SHA-256 `0a1af8f9583b0410cb030362d5f30bebe385434843c139fd4c7689d1fa547d37`. Candidate bundle: `ea72e410bf5b6d122cfd75ea25acef938eab281b3793c8584425cfb16bb1470c`. Chromium: `156.0.8078.4` on Windows. Values below are medians of three runs' statistics, not pooled sample percentiles.

- Stationary Dock, 36 keys per run: key-to-frame-callback p50 **21.4 → 11.6 ms**, p95 **43.6 → 22.8 ms**. Scripting across the full sampling interval **845.5 → 383.0 ms** (55% less). Shelf reads **209–213 → 0** per run.
- Dock utilities, 12 keys: p50 **24.4 → 26.1 ms**, p95 **28.0 → 59.7 ms**. Scripting **259.5 → 206.1 ms**; shelf reads **72–80 → 0**. Less scripting did not produce a consistent latency win.
- List, 36 keys: p50 **28.9 → 32.5 ms**, p95 **52.4 → 56.8 ms**. Scripting **481.3 → 488.9 ms**. This pass does not establish a List improvement.

Earlier exploratory pairs also varied substantially. The repeatable structural result is eliminating stationary-shelf polling; the clearest timing gain is on Dock app navigation. These results do not support an application-wide latency or FPS claim. The production JavaScript grows from 318,993 to 319,458 bytes; no compiler or runtime dependency was added.

## Validation and remaining work

The model, full browser suite, wallpaper/atmosphere/sound checks and geometry regression checks run independently of these timings. Before/after comparisons of List, Dock, Settings, editor and error flows produced five pixel-identical screenshots. A subpixel retry-line placement variation also reproduced when comparing the unchanged baseline against itself; it is a timing-dependent measurement of an animating control, not an exact-DOM guarantee for that error flow.

A 4× desktop slowdown does not emulate the TV's processor, GPU, memory limits or browser engine. The next useful step is a trace on the actual TV: measure dropped frames while scrolling and changing wallpapers, image decoding/upload stalls, layer/texture memory, cold startup and sustained navigation. Use that evidence to choose further work on component subscriptions, hidden layers or asset sizes. Additional memoization and a smaller JavaScript bundle alone cannot establish smooth rendering on the device.
