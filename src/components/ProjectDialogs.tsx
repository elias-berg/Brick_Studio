import { ShortcutSettings } from "./ShortcutSettings";
import { keyLabel, defaultBindings } from "../engine/shortcuts";
import { Plus, Save, X } from "lucide-react";
import type { Brick, Catalog, Settings } from "../engine/types";
import { shapeFor } from "../engine/parts";
import { InventoryPanel } from "./InventoryPanel";

export type DialogName = "disable-floating" | "delete-single" | "settings" | "help" | "inventory" | "new" | null;
interface Props {
  floatingCount: number;
  onDeleteFloating: () => void;
  onResetConfig: () => void;
  pendingDeleteCount: number;
  onConfirmSingleDelete: () => void;
  modal: DialogName;
  setModal: (value: DialogName) => void;
  settings: Settings;
  setting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  catalog: Catalog;
  bricks: Brick[];
  name: string;
  notify: (message: string) => void;
  exportProject: () => void;
  onNew: (sample: boolean) => void;
  onReplacePair: (fromPart: string, fromColor: number, toPart: string, toColor: number) => void;
}
export function ProjectDialogs({
  floatingCount,
  onDeleteFloating,
  onResetConfig,
  pendingDeleteCount,
  onConfirmSingleDelete,
  modal,
  setModal,
  settings,
  setting,
  catalog,
  bricks,
  name,
  notify,
  exportProject,
  onNew,
  onReplacePair,
}: Props) {
  return (
    <>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div
            className={`modal ${modal === "inventory" ? "wide" : modal === "settings" ? "settings-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "disable-floating" ? "Remove floating bricks" : modal === "delete-single" ? "Deleting would leave floating bricks" : modal === "inventory"
                ? "Parts list"
                : modal === "settings"
                  ? "Viewport settings"
                  : modal === "help"
                    ? "How to build"
                    : "New build"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "disable-floating" && <>
              <h2>Remove floating bricks?</h2>
              <p>{floatingCount} {floatingCount === 1 ? "piece has" : "pieces have"} no connection to the ground. Delete those pieces and turn floating off, or cancel to keep them. You can undo the deletion.</p>
              <div className="modal-actions"><button className="button" onClick={() => setModal(null)}>Cancel</button><button className="button primary" onClick={onDeleteFloating}>Delete {floatingCount} &amp; turn off</button></div>
            </>}
            {modal === "delete-single" && <>
              <h2>Deleting would leave floating bricks</h2>
              <p>This removes only the selected brick and leaves {pendingDeleteCount} {pendingDeleteCount === 1 ? "piece" : "pieces"} without a connection to the ground. Enable floating bricks to continue, or use recursive delete to remove the unsupported structure too.</p>
              <div className="modal-actions"><button className="button" onClick={() => setModal(null)}>Cancel</button><button className="button primary" onClick={onConfirmSingleDelete}>Allow floating &amp; delete one</button></div>
            </>}
            {modal === "settings" && (
              <>
                <h2>Viewport settings</h2>
                <div className="config-reset-row"><p className="muted tiny">Config saves automatically in this browser. Reset restores shortcuts, lighting, panning, and sidebar layout. Your bricks, build area, and floating setting are kept.</p><button className="button" onClick={onResetConfig}>Reset config</button></div>
                <label className="setting-row">
                  <span>
                    <strong>Pan at viewport edges</strong>
                    <small>Moves the scene opposite your cursor’s edge.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.edgePan}
                    onChange={(e) => setting("edgePan", e.target.checked)}
                  />
                </label>
                <fieldset className="pan-options" disabled={!settings.edgePan}>
                <label className="range-label">
                  Edge activation zone <strong>{settings.edgeSize} px</strong>
                  <input
                    type="range"
                    min="16"
                    max="160"
                    value={settings.edgeSize}
                    onChange={(e) => setting("edgeSize", +e.target.value)}
                  />
                </label>
                <label className="range-label">
                  Pan speed <strong>{settings.panSpeed} studs / sec</strong>
                  <input
                    type="range"
                    min="1"
                    max="40"
                    value={settings.panSpeed}
                    onChange={(e) => setting("panSpeed", +e.target.value)}
                  />
                </label>
                </fieldset>
                <label className="range-label">
                  Build area
                  <select
                    value={settings.boardSize}
                    onChange={(e) => {
                      const size = +e.target.value;
                      const lib = new Map(catalog.parts.map((p) => [p.id, p]));
                      const exceeds = bricks.some((b) => {
                        const s = shapeFor(lib.get(b.partId))!;
                        const r = (b.rotation * Math.PI) / 180;
                        const hx =
                            (Math.abs(Math.cos(r)) * s.width) / 2 +
                            (Math.abs(Math.sin(r)) * s.depth) / 2,
                          hz =
                            (Math.abs(Math.sin(r)) * s.width) / 2 +
                            (Math.abs(Math.cos(r)) * s.depth) / 2;
                        return (
                          Math.abs(b.x) + hx > size / 2 ||
                          Math.abs(b.z) + hz > size / 2
                        );
                      });
                      if (exceeds) {
                        notify(
                          "Choose a larger area: some bricks would be outside this size.",
                        );
                        return;
                      }
                      setting("boardSize", size);
                    }}
                  >
                    {[32, 48, 64, 96].map((n) => (
                      <option key={n} value={n}>
                        {n} × {n} studs
                      </option>
                    ))}
                  </select>
                </label>
                <ShortcutSettings bindings={settings.keyBindings ?? defaultBindings} onChange={(bindings) => setting("keyBindings", bindings)} />
                <button
                  className="button primary full"
                  onClick={() => setModal(null)}
                >
                  Back to building
                </button>
              </>
            )}
            {modal === "help" && (
              <>
                <h2>How to build</h2>
                <div className="help-list">
                  <p>
                    <b>1. Pick a part and a color.</b> Move your mouse over the
                    board to see its wireframe. Green means you can place it;
                    red explains what needs adjusting.
                  </p>
                  <p>
                    <b>2. Click to place.</b> Hover over an existing brick to
                    stack. Use the mouse rotation buttons or {keyLabel((settings.keyBindings ?? defaultBindings).rotate)} to turn a part.
                    Rectangular parts rotate clockwise in 90° steps; symmetric square and round parts do not need rotation.
                  </p>
                  <p>
                    <b>3. Explore your build.</b> Hold the middle mouse button
                    to orbit, or select the Orbit view tool ({keyLabel((settings.keyBindings ?? defaultBindings).orbit)}) and drag with
                    the left button. Right drag to pan, scroll vertically to zoom, and scroll sideways to orbit.
                    All keyboard shortcuts appear in the bottom bar and can be changed in Viewport settings.
                    Your configured pan keys also pan the view. Moving to a viewport edge pans
                    the camera.
                  </p>
                  <p>
                    <b>4. Remove with care.</b> Select the delete tool, then
                    hover. The submenu selects single delete (1) or recursive delete (∞).
                    Single delete warns if other pieces would float. Recursive delete
                    removes every connected branch that loses its path to the ground.
                    Enable Allow floating bricks in Selected brick to place at any manual layer without support.
                  </p>
                  <p>
                    <b>5. Keep your work.</b> This browser saves automatically.
                    Download a project to move devices, or export the parts list
                    for shopping.
                  </p>
                </div>
                <div className="catalog-note">
                  <b>V1 geometry scope</b>
                  <br />
                  {catalog.parts.filter((p) => shapeFor(p)).length} rectangular
                  bricks, plates, tiles, baseplates and round 1 × 1 pieces.
                  Other catalog parts can be searched but cannot be placed.
                  Technic pin/axle joints, hinges, slopes, inverted builds and
                  elastic connections need additional geometry and connector
                  rules.
                </div>
                <button
                  className="button primary full"
                  onClick={() => setModal(null)}
                >
                  Close
                </button>
              </>
            )}
            {modal === "new" && (
              <>
                <h2>New project</h2>
                <p>
                  Download the current project first if you’d like to keep it.
                  Your browser keeps only the active project.
                </p>
                <div className="modal-actions">
                  <button className="button" onClick={exportProject}>
                    <Save size={15} />
                    Download current
                  </button>
                  <button
                    className="button primary"
                    onClick={() => onNew(false)}
                  >
                    Start empty <Plus size={15} />
                  </button>
                </div>
                <button className="text-button" onClick={() => onNew(true)}>
                  Load the sample pavilion
                </button>
              </>
            )}
            {modal === "inventory" && (
              <InventoryPanel bricks={bricks} catalog={catalog} name={name} onReplacePair={onReplacePair} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
