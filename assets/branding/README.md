# Shore branding

- `logo.png`: default white symbol and wordmark on a deep charcoal background.
- `logo-dark.png`: the same white logo, retained under its original background-based filename.
- `logo-on-light.png`: original dark symbol and wordmark on a light background.
- `icon.png`: default white shoreline symbol on a deep charcoal background. `app/icon.png` is the runtime copy used by the Tizen manifest and browser favicon.
- `icon-dark.png`: original dark symbol on a transparent background.

Generated using the built-in imagegen tool. The wordmark is a generated approximation of Manrope SemiBold (600), the app's default display face; it is not an exact font rendering.

Logo revision prompt: “Change only the wordmark typography to Manrope SemiBold (weight 600). Exact text Shore. Preserve the shoreline symbol, monochrome dark charcoal on light background, centered horizontal composition and generous whitespace.”

Icon prompt: “Extract only the existing shoreline symbol as a standalone square app icon. Preserve its geometry and dark charcoal color. Remove the word Shore. Center the symbol at approximately 80% of the canvas, with transparent background and transparent negative space. Do not redesign.”

Dark logo prompt (built-in imagegen edit): “Change only colors: symbol and Shore wordmark to white, background and symbol negative space to deep charcoal (#181A1B). Preserve geometry, letterforms, weight, spacing, scale, positions, aspect ratio and margins. No redesign or extra elements.”

## Rename compatibility

Default icon prompt (built-in imagegen edit): “Create a clean white version of the existing shoreline symbol on a solid deep charcoal #181A1B square background. Preserve geometry and the smooth winding gap. No text, speckles or texture; match source framing and silhouette.”

The display name and build artifacts use Shore. The Tizen package/application identity and localStorage keys remain unchanged so existing installations retain their preferences. The persisted `hezframeVersion` migration marker remains intentional. New owner configuration uses `window.ShoreConfig`; `window.HezFrameConfig` remains supported as a fallback.
