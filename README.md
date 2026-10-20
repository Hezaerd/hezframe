# HezFrame

A quiet Samsung TV home screen, adapted from CleanFrame.

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

The package/application identity is intentionally retained for updates to the existing installation. For an independent installation, generate your own identity and adapt the manifest, device self-filter and identity checks. The original `cleanframe.home.v1` preference key is retained for migration. The six-app order is applied once on upgrade; subsequent customization is preserved.

## Upstream documentation

Documents under `docs/` and the native Home helper are inherited CleanFrame reference material. Their Mac paths, model assumptions and Tizen 9 Home-routing experiment do not describe this Q60B setup. Do not run the reference device scripts unchanged. Native Home changes are separate from installing the web app.

## Credits and license

Based on CleanFrame, under the MIT license. Original copyright and [third-party notices](THIRD_PARTY_NOTICES.md) are retained. Fonts, photographs and service logos retain their respective licenses. No affiliation with Samsung or the streaming services.
