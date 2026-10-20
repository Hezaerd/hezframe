# Shore branding

- `logo.png`: approved horizontal shoreline symbol and wordmark, on a light background.
- `icon.png`: standalone shoreline symbol with a transparent background. `app/icon.png` is the runtime copy used by the Tizen manifest and browser favicon.

Generated using the built-in imagegen tool. The wordmark is a generated approximation of Manrope SemiBold (600), the app's default display face; it is not an exact font rendering.

Logo revision prompt: “Change only the wordmark typography to Manrope SemiBold (weight 600). Exact text Shore. Preserve the shoreline symbol, monochrome dark charcoal on light background, centered horizontal composition and generous whitespace.”

Icon prompt: “Extract only the existing shoreline symbol as a standalone square app icon. Preserve its geometry and dark charcoal color. Remove the word Shore. Center the symbol at approximately 80% of the canvas, with transparent background and transparent negative space. Do not redesign.”

## Rename compatibility

The display name and build artifacts use Shore. The Tizen package/application identity and localStorage keys remain unchanged so existing installations retain their preferences. The persisted `hezframeVersion` migration marker remains intentional. New owner configuration uses `window.ShoreConfig`; `window.HezFrameConfig` remains supported as a fallback.
