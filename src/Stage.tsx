export function Stage() {
  return (
      <main className="stage" id="stage" tabIndex={0} aria-label="TV stage, 1920 by 1080. Click it, then use the arrow keys, Enter for OK and Escape for Back.">
        <div className="scene" id="scene">
        <div className="bg" id="bg" aria-hidden="true">
          <img className="photo" id="photo" alt="" />
          <div className="scrim"></div>
          <div className="shade"></div>
          <div className="ph-dim"></div>
          <div className="ph-scrim"></div>
          <div className="ph-col"></div>
          <div className="ut-dim ut-tr"></div><div className="ut-dim ut-br"></div>
        </div>

        <div className="home" id="home">
          <div className="caption" id="caption"></div>
          <nav className="utils" id="utils" aria-label="Home controls"></nav>
          <div className="util-focus-label" id="utilFocusLabel" aria-hidden="true"></div>
          <div className="app-focus-name" id="appFocusName" aria-hidden="true"></div>
          <div className="ph-plate ut-lens" id="utLens" aria-hidden="true">
            <div className="ph-field" id="utField">
              <img className="ph-field-img" id="utFieldImg" alt="" />
              <div className="scrim"></div><div className="shade"></div><div className="ph-dim"></div><div className="ph-scrim"></div><div className="ph-col"></div><div className="ut-dim ut-tr"></div><div className="ut-dim ut-br"></div>
            </div><div className="ph-veil"></div>
          </div>
          <div className="ph-plate ut-lens" id="utLensAlt" aria-hidden="true">
            <div className="ph-field" id="utFieldAlt">
              <img className="ph-field-img" id="utFieldImgAlt" alt="" />
              <div className="scrim"></div><div className="shade"></div><div className="ph-dim"></div><div className="ph-scrim"></div><div className="ph-col"></div><div className="ut-dim ut-tr"></div><div className="ut-dim ut-br"></div>
            </div><div className="ph-veil"></div>
          </div>

          <div className="dock" id="dock">
            <div className="mat" aria-hidden="true"><img className="mat-img" id="matImg" alt="" /><div className="mat-scrim" id="matScrim"></div><div className="mat-veil"></div></div>
            <div className="shelf" id="shelf"><div className="track" id="track"><div className="plate" id="plate"></div></div></div>
          </div>
          <div className="cue" id="cueL" aria-hidden="true"></div>
          <div className="cue" id="cueR" aria-hidden="true"></div>

          <div className="ph-scene" id="phScene">
            <div className="ph-plate" id="phPlate" aria-hidden="true">
              <div className="ph-field" id="phField">
                <img className="ph-field-img" id="phFieldImg" alt="" />
                <div className="shade"></div><div className="ph-dim"></div><div className="ph-scrim"></div><div className="ph-col"></div><div className="ut-dim ut-tr"></div><div className="ut-dim ut-br"></div>
              </div>
              <div className="ph-veil"></div>
            </div>
            <div className="ph-plate" id="phPlateAlt" aria-hidden="true">
              <div className="ph-field" id="phFieldAlt">
                <img className="ph-field-img" id="phFieldImgAlt" alt="" />
                <div className="shade"></div><div className="ph-dim"></div><div className="ph-scrim"></div><div className="ph-col"></div><div className="ut-dim ut-tr"></div><div className="ut-dim ut-br"></div>
              </div>
              <div className="ph-veil"></div>
            </div>
            <div className="ph-list" id="phList"><div className="ph-rows" id="phRows"></div></div>
          </div>

        </div>

        </div>
        <div id="cinemaVeil" className="cinema-veil" aria-hidden="true"></div>
        <section className="appearance" id="appearance" hidden={true} role="dialog" aria-labelledby="appearanceTitle">
          <div className="settings-back" id="appearanceBack"></div>
          <h2 className="settings-title" id="appearanceTitle"></h2>
          <div className="appearance-rows" id="appearanceRows"></div>
          <p className="appearance-desc" id="appearanceDesc"></p>
          <div className="settings-status" id="appearanceStatus" aria-live="polite"></div>
        </section>
        <div className="sheet" id="sheet" hidden>
          <img className="sheet-bg" id="sheetBg" alt="" aria-hidden="true" />
          <div className="sheet-veil" aria-hidden="true"></div>
          <div className="view" id="sheetView" role="dialog" aria-modal="true"></div>
        </div>
        <div className="focus-status" id="focusStatus" aria-live="polite"></div>
      </main>
  );
}
