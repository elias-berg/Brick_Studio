import { useEffect, useRef, type RefObject } from "react";
import { eventBinding, SHORTCUTS, type KeyBindings, type ShortcutAction } from "../engine/shortcuts";
import type { EditorScene } from "../engine/EditorScene";

const PAN_ACTIONS: Partial<Record<ShortcutAction, string>> = {
  panLeft: "ArrowLeft", panRight: "ArrowRight", panUp: "ArrowUp", panDown: "ArrowDown",
};

/** Own key lifetimes so rerendering a preview cannot interrupt a held pan key. */
export function useEditorShortcuts(
  bindings: KeyBindings,
  scene: RefObject<EditorScene | null>,
  blocked: boolean,
  onAction: (action: ShortcutAction, repeat: boolean) => void,
) {
  const handler = useRef(onAction);
  handler.current = onAction;
  useEffect(() => {
    const heldPan = new Map<string, string>();
    const clear = () => { heldPan.clear(); scene.current?.clearPanKeys(); };
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) return;
      const binding = eventBinding(event);
      const action = SHORTCUTS.find(({ id }) => bindings[id] === binding)?.id;
      if (!action) return;
      if (blocked) {
        if (action === "cancel") { event.preventDefault(); handler.current(action, event.repeat); }
        return;
      }
      event.preventDefault();
      const pan = PAN_ACTIONS[action];
      if (pan) {
        heldPan.set(event.code || event.key.toLowerCase(), pan);
        scene.current?.setPanKey(pan, true);
      } else handler.current(action, event.repeat);
    };
    const release = (event: KeyboardEvent) => {
      const code = event.code || event.key.toLowerCase();
      const pan = heldPan.get(code);
      if (pan) {
        heldPan.delete(code);
        if (![...heldPan.values()].includes(pan)) scene.current?.setPanKey(pan, false);
      }
      if (["Control", "Meta", "Alt", "Shift"].includes(event.key)) clear();
    };
    if (blocked) clear();
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", release);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, [bindings, scene, blocked]);
}
