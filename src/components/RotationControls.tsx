import { RotateCw } from "lucide-react";
import { ariaShortcut, keyLabel } from "../engine/shortcuts";
export function RotationControls({ active, x, y, z, binding, onToggle }: {
  active: boolean; x: number; y: number; z: number; binding: string;
  onToggle: () => void;
}) {
  return <section className="rotation-controls" aria-label="Brick rotation">
    <button className={`rotation-mode ${active ? "selected" : ""}`} aria-pressed={active} aria-label="Rotate mode" aria-keyshortcuts={ariaShortcut(binding)} onClick={onToggle}>
      <RotateCw size={15} /><span>Rotate mode</span><kbd>{keyLabel(binding)}</kbd>
    </button>
    <div className="rotation-axes">
      {([['x', x], ['y', y], ['z', z]] as const).map(([axis, value]) => <div className="rotation-axis" key={axis}>
        <span>{axis.toUpperCase()}</span>
        <output aria-label={`${axis.toUpperCase()} rotation`}>{value}°</output>
      </div>)}
    </div>
  </section>;
}
