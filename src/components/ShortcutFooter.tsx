import { keyLabel, type KeyBindings, type ShortcutAction } from "../engine/shortcuts";
const groups: { actions: ShortcutAction[]; label: string }[] = [
  { actions: ["moveForward", "moveLeft", "moveBack", "moveRight"], label: "Move x/z" },
  { actions: ["layerDown", "layerUp"], label: "−y/+y · plates" },
  { actions: ["toggleLayer"], label: "Auto / Layer" },
  { actions: ["lock"], label: "Lock" },
  { actions: ["reset"], label: "Reset / Auto" },
  { actions: ["rotate"], label: "Rotate brick" },
  { actions: ["build"], label: "Build" },
  { actions: ["deleteSingle"], label: "Delete 1" },
  { actions: ["deleteRecursive"], label: "Delete ∞" },
  { actions: ["pick"], label: "Pick" },
  { actions: ["orbit"], label: "Orbit tool" },
  { actions: ["home"], label: "Reset view" },
  { actions: ["panUp", "panDown", "panLeft", "panRight"], label: "Pan" },
  { actions: ["undo"], label: "Undo" },
  { actions: ["redo"], label: "Redo" },
  { actions: ["redoAlt"], label: "Redo" },
  { actions: ["cancel"], label: "Close / Build" },
];
export function ShortcutFooter({ bindings }: { bindings: KeyBindings }) {
  return <footer className="app-footer shortcut-footer" aria-label="Mouse controls and all keyboard shortcuts">
    <span><b>Middle drag</b> Orbit</span>
    <span><b>Right drag</b> Pan</span>
    <span><b>Scroll</b> Zoom</span>
    <span><b>Sideways / shift+scroll</b> Orbit</span>
    {groups.map(({ actions, label }) => <span key={actions.join("/")}><kbd>{actions.map((action) => keyLabel(bindings[action])).join(" / ")}</kbd>{label}</span>)}
  </footer>;
}
