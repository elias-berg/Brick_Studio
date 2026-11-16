export const SHORTCUTS = [
  { id: "moveLeft", label: "Move / rotate −x", key: "a" },
  { id: "moveRight", label: "Move / rotate +x", key: "d" },
  { id: "moveForward", label: "Move / rotate −z", key: "w" },
  { id: "moveBack", label: "Move / rotate +z", key: "s" },
  { id: "layerDown", label: "Lower / rotate −y", key: "q" },
  { id: "layerUp", label: "Raise / rotate +y", key: "e" },
  { id: "toggleLayer", label: "Auto / Layer", key: "m" },
  { id: "lock", label: "Placement lock", key: "l" },
  { id: "reset", label: "Reset brick / Auto", key: "f" },
  { id: "rotate", label: "Rotate mode", key: "r" },
  { id: "build", label: "Build", key: "b" },
  { id: "deleteSingle", label: "Delete 1", key: "x" },
  { id: "deleteRecursive", label: "Delete ∞", key: "shift+x" },
  { id: "pick", label: "Pick brick", key: "i" },
  { id: "orbit", label: "Orbit tool", key: "o" },
  { id: "home", label: "Reset view", key: "h" },
  { id: "panLeft", label: "Pan left", key: "arrowleft" },
  { id: "panRight", label: "Pan right", key: "arrowright" },
  { id: "panUp", label: "Pan up", key: "arrowup" },
  { id: "panDown", label: "Pan down", key: "arrowdown" },
  { id: "undo", label: "Undo", key: "mod+z" },
  { id: "redo", label: "Redo", key: "mod+shift+z" },
  { id: "redoAlt", label: "Redo (alternative)", key: "mod+y" },
  { id: "cancel", label: "Close / Build", key: "escape" },
] as const;
export type ShortcutAction = typeof SHORTCUTS[number]["id"];
export type KeyBindings = Record<ShortcutAction, string>;
export const defaultBindings = Object.fromEntries(SHORTCUTS.map(({ id, key }) => [id, key])) as KeyBindings;

const BINDING_PATTERN = /^(mod\+)?(alt\+)?(shift\+)?(.|space|plus|escape|arrow(up|down|left|right)|backspace|delete|home|end|page(up|down)|enter|f([1-9]|1[0-9]|2[0-4]))$/;
export function eventBinding(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): string | null {
  const key = event.key.toLowerCase();
  if (["control", "meta", "shift", "alt", "altgraph", "capslock"].includes(key)) return null;
  const binding = [...(event.ctrlKey || event.metaKey ? ["mod"] : []), ...(event.altKey ? ["alt"] : []), ...(event.shiftKey ? ["shift"] : []), key === " " ? "space" : key === "+" ? "plus" : key].join("+");
  return BINDING_PATTERN.test(binding) ? binding : null;
}
export function keyLabel(binding: string): string {
  const labels: Record<string, string> = { mod: "cmd/ctrl", arrowleft: "←", arrowright: "→", arrowup: "↑", arrowdown: "↓", escape: "esc", plus: "+" };
  return binding.split("+").map((key) => labels[key] ?? key).join("+");
}
export function ariaShortcut(binding: string): string {
  const key = binding.replace(/\bspace\b/g, "Space").replace(/\bplus\b/g, "Plus");
  return key.includes("mod+") ? `${key.replace("mod+", "Control+")} ${key.replace("mod+", "Meta+")}` : key;
}
export function parseBindings(value: unknown): KeyBindings {
  if (value === undefined) return { ...defaultBindings };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid keyboard shortcuts.");
  const bindings = { ...defaultBindings };
  for (const { id } of SHORTCUTS) {
    const key = (value as Record<string, unknown>)[id] ?? defaultBindings[id];
    if (typeof key !== "string" || !BINDING_PATTERN.test(key)) throw Error("Invalid keyboard shortcut binding.");
    bindings[id] = key;
  }
  if (new Set(Object.values(bindings)).size !== SHORTCUTS.length) throw Error("Keyboard shortcuts must be unique.");
  return bindings;
}
/** Swapping keeps both actions available, including modifier combinations. */
export function rebindShortcut(bindings: KeyBindings, action: ShortcutAction, key: string): KeyBindings {
  const updated = { ...bindings, [action]: key };
  const other = SHORTCUTS.find(({ id }) => id !== action && bindings[id] === key);
  if (other) updated[other.id] = bindings[action];
  return parseBindings(updated);
}
