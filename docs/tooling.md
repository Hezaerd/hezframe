# Formatting and linting

Use `npm run format` to write formatting and `npm run lint:fix` for safe lint fixes.
`npm run check` includes `lint` and `format:check`; warnings fail the check.
Oxlint and Oxfmt versions are pinned in the lockfile.

Oxlint enables correctness errors, suspicious/performance warnings, TypeScript,
React (including hooks), accessibility, import and OXC rules. Every non-nursery
Unicorn rule supported by the pinned version is listed explicitly. Generated
catalogues and asset records under `app/assets/` are excluded; their generators
are checked. Oxfmt formats the maintained JS, TS, CSS, HTML, JSON, Markdown and
YAML files. It excludes generated assets and the npm lockfile. Git stores text
with LF endings so formatting also works after a Windows checkout.

## Exceptions

- `no-null` stays off: DOM APIs, React refs, persistence and the test contract
  use explicit null values. `prefer-global-this` stays off because browser code
  uses `window` deliberately. `no-nested-ternary` stays off for declarative view
  expressions. `max-nested-calls` allows five calls. Filename case accepts kebab,
  camel and Pascal case for modules and React components. Named `node:path`
  imports are allowed.
- `no-array-callback-reference` stays off: typed pure predicates are shared
  directly. `prefer-set-has` stays off for tiny, ordered app/choice arrays where
  a Set would add allocation or duplicated state.
- Runtime TypeScript keeps `sort`/`reverse`, indexed access, own-property checks
  and the ES2020 string/clone APIs instead of Unicorn's newer replacements.
  `toSorted`, `toReversed`, `at`, `Object.hasOwn` and `structuredClone` do not run
  on Chrome 85. The runtime also keeps generic `Element.getAttribute` reads and
  immutable map results; `prefer-dom-node-dataset` and `oxc/no-map-spread` are
  disabled there. Mutating a mapped view would lose its refined type and violate
  the reducer's ownership rules.
- The unbundled `app/*.js` adapter/config retain their ES5 conventions instead
  of Unicorn's modernization rules. Syntax and resource checks still run.
- Browser scenarios intentionally await sequential actions and use isolated
  mock globals; their await-in-loop, underscore and nested-await rules are off.
  Script callbacks passed to `page.evaluate` cannot be hoisted out of the browser
  context, so function-scoping and shadow checks are off for scripts. Small test
  arrays immediately filled with repeated keys are allowed. Tests retain
  `innerText` where they assert rendered text, and the contrast check retains
  `parseFloat` to read CSS values with units.
- React's automatic JSX runtime needs no React namespace import. Declaration
  augmentation uses an unassigned type import. The TV's existing remote-focus
  widgets retain their ARIA roles and stage-level keyboard controller instead
  of changing their DOM tags. The stage's delegated click and focus handlers,
  and delegated utility hover handler, have scoped accessibility exceptions;
  keyboard behavior is covered by the browser suite. Fixed clock positions may
  use their index as a key.
- Four layout effects need a synchronous second commit after measuring DOM
  bounds or preparing an opacity transition. Each `set-state-in-effect`
  suppression explains that dependency at the call site. Hook dependency
  checks remain enabled.

Keep new exceptions narrow and explain their purpose here or at the call site.
Do not apply suggestion/dangerous fixes without reviewing behavior and running
the relevant checks.
