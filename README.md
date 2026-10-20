# HezFrame

A quiet Samsung TV home screen with your apps, photographs and the time.

Photo backgrounds, large app names, a clock, remote navigation, and local appearance settings. The default Home order is Stremio, YouTube, Netflix, Disney+, Prime Video, and Apple TV. Apps open their installed native versions; HezFrame does not provide streaming content or accounts.

## Current device status

The initial version was installed and physically tested on a Samsung Q60B running Tizen 6.5: rendering, remote navigation and launching Stremio worked. HezFrame 0.6.2 adds the six-app order and rebrands that installation. Physical verification of this update remains pending.

Home-button reassignment and automatic startup are not configured. Open the app from Samsung Apps. Art Mode is omitted on this non-Frame TV.

## Preview and checks

Requires Node.js 22+ and Python 3.10+ available as `python`.

```sh
npm ci
npm run dev:public
npm run check
npx playwright install chromium
npm run check:browser
npm run check:public
npm run export:public
```

Open http://localhost:4795/home/. Use arrow keys, Enter and Escape. The browser cannot launch TV apps. All public fonts and wallpaper assets are bundled.

The unsigned export is `dist/HezFrame-public-unsigned.wgt`. Installing requires Samsung's official SDK and your own Samsung signing certificates with your TV registered. Signing keys, device addresses, local setup records and signed packages are excluded from Git.

The package/application identity is intentionally retained for updates to the existing installation. For an independent installation, generate your own identity and adapt the manifest, device self-filter and identity checks. The existing preference storage is retained for migration. The six-app order is applied once on upgrade; subsequent customization is preserved.

## Upstream documentation

Documents under `docs/` and the native Home helper are inherited reference material. Their Mac paths, model assumptions and Tizen 9 Home-routing experiment do not describe this Q60B setup. Do not run the reference device scripts unchanged. Native Home changes are separate from installing the web app.

## Credits and license

Distributed under the [MIT license](LICENSE). Original copyright and [third-party notices](THIRD_PARTY_NOTICES.md) are retained. Fonts, photographs and service logos retain their respective licenses. No affiliation with Samsung or the streaming services.
## Wallpaper configuration

`app/config.js` controls the Unsplash nature playlist, starting photo and default rotation. Photos are bundled locally with their credits in `app/assets/wallpapers/SOURCES.json`, so rotation works offline without an API key.

- `initial`: starting wallpaper ID (default `forest`).
- `rotation`: `fixed`, `open`, `5`, `15` or `60` (minutes). Default: `5`.
- `playlist`: ordered wallpaper IDs used for rotation. Unknown IDs and duplicates are ignored; an empty valid playlist falls back to the full gallery.
- `revision`: increase this number to apply revised wallpaper/rotation defaults to existing installations. Otherwise their saved choices take precedence.

On screen, use **Settings → Background → Wallpaper / Rotation**. Manual wallpaper selection retains the full gallery. Automatic rotation uses only the configured playlist, skips city/abstract images by default, and pauses in settings, on flat backgrounds and while the app is hidden.

## Atmosphere

**Settings → Atmosphere** toggles cinema dimming, wallpaper crossfades and the personal greeting. **Settings → Background → Collection** selects All nature, Forests, Mountains, Coastlines or Night skies. Selection switches to a matching photograph and limits subsequent rotation; a single-photo collection stays fixed.

In `app/config.js`:

- `cinema.idleSeconds` sets the idle delay (default 60 seconds); `dimAmount` sets the dark overlay strength (default 0.55). Dimming only affects HezFrame, pauses in panels, and wakes on keyboard/remote, pointer or touch input. It does not change the TV picture settings.
- `crossfade.durationMs` sets the wallpaper fade (default 900 ms). The next photo is loaded before fading; reduced-motion preferences disable this animation.
- `greeting.name` adds an optional name, such as `Hezaerd`. Leave it empty for just “Good morning”, “Good afternoon” or “Good evening”, based on the TV's local time.
- Each feature's `enabled` setting is the default for new preferences. Saved on-screen choices take precedence.
- `wallpapers.collections` defines collection names and their wallpaper IDs; `wallpapers.collection` sets the initial collection. Photos and their pre-rendered materials must exist in the bundled gallery.
