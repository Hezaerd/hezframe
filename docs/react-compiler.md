# React Compiler through OXC

Checked on 20 October 2026 against the migrated app with UI sounds.

The installed `@vitejs/plugin-react` 6.1.2 supports the native Rust React Compiler
through its optional `oxc-transform-react` peer dependency. This route does not
use Babel. It is separate from Oxlint's compiler-powered lint checks.

The local experiment used `oxc-transform-react` **0.152.0**, matching the plugin's
`^0.152.0` peer range, with Vite 8.3.4 and React 19.3.1:

```ts
react({ compiler: { target: '19', reportDiagnostics: true } });
```

`target: '19'` selects React's compiler runtime; it does not replace the Vite
build target of Chrome 85. The native compiler runs before JSX lowering. No
custom compiler wrapper or archived community plugin is needed.

## Results

- The native production build succeeded, without reported compiler diagnostics.
- All 344 existing browser checks passed against the compiled widget files.
- The completed Dock, List and Settings comparisons matched 69 state/DOM
  snapshots and four pixel-identical 1920 × 1080 screenshots. The older comparison
  harness became slow during wallpaper scenarios, so it was stopped and replaced
  by the full browser suite; no claim of a complete 110-state comparison is made.
- JavaScript grew from **318.99 kB / 100.66 kB gzip** to
  **339.90 kB / 109.24 kB gzip**. The compiler produced memo-cache code, so the
  successful build was not merely an unchanged pass-through.
- Both builds passed all 40 performance checks with 4× CPU throttling after
  correcting the memory check's precondition: it now waits for an outgoing
  wallpaper to finish fading before comparing image counts. The assertion and
  budgets are unchanged. The settled pair's median scenario key p95 was
  **25.35 ms → 27.70 ms**, with startup **3098 ms → 2503 ms**. The earlier pair's
  timing differences ran in the opposite direction. These exploratory pairs
  do not establish a consistent speed benefit and are not TV measurements.

The experiment stays under ignored `.local/react-compiler/`. The dependency was
installed locally without changing the project lockfile. Compiler optimization
remains disabled in the normal configuration. OXC and Vite both mark this path
experimental; enabling it should follow a useful measured runtime benefit and
physical TV validation, especially for layout measurements and focus transitions.

Sources: [OXC React Compiler](https://oxc.rs/docs/guide/usage/transformer/react-compiler)
and the [official Vite React plugin](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#rust-react-compiler).
