import { SHORTCUTS, defaultBindings, eventBinding, keyLabel, rebindShortcut, type KeyBindings } from "../engine/shortcuts";

export function ShortcutSettings({ bindings, onChange }: { bindings: KeyBindings; onChange: (bindings: KeyBindings) => void }) {
  return <section className="shortcut-settings">
    <div className="section-title"><h3>Keyboard shortcuts</h3><button className="text-button" onClick={() => onChange({ ...defaultBindings })}>Restore defaults</button></div>
    <p className="muted tiny">Click a shortcut and press a key or combination. Reusing a key swaps the two actions. Tab moves to the next field. Mouse gestures stay fixed.</p>
    <div className="shortcut-settings-grid">
      {SHORTCUTS.map(({ id, label }) => <label key={id}><span>{label}</span><input readOnly aria-label={`${label} shortcut`} value={keyLabel(bindings[id])} onKeyDown={(event) => {
        if (event.key === "Tab") return;
        event.preventDefault();
        event.stopPropagation();
        const key = eventBinding(event);
        if (key) onChange(rebindShortcut(bindings, id, key));
      }} /></label>)}
    </div>
  </section>;
}
