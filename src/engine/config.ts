import { SHORTCUTS } from "./shortcuts";
import type { Settings } from "./types";
import { defaults, parseSettings } from "./storage";

const CONFIG_STORAGE = "brick-studio-config-v1";
type UserConfig = Pick<Settings, "keyBindings" | "directionalLight" | "edgePan" | "edgeSize" | "panSpeed">;

/** Board dimensions and support rules belong to the build, not user preferences. */
export function userConfig(settings: Settings): UserConfig {
  const { keyBindings, directionalLight, edgePan, edgeSize, panSpeed } = settings;
  return { keyBindings: keyBindings ?? defaults.keyBindings, directionalLight, edgePan, edgeSize, panSpeed };
}
export function applyUserConfig(settings: Settings, config: UserConfig | null): Settings {
  return config ? { ...settings, ...config } : settings;
}
export function readUserConfig(): UserConfig | null {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE);
    if (!saved) return null;
    return userConfig(parseSettings(upgradeDefaultBindings(JSON.parse(saved))));
  } catch (error) {
    console.warn("Saved configuration could not be restored", error);
    return null;
  }
}
export function saveUserConfig(settings: Settings) {
  localStorage.setItem(CONFIG_STORAGE, JSON.stringify({ version: 3, ...userConfig(settings) }));
}
export const defaultUserConfig = userConfig(defaults);

/** One-time migration is limited to this browser's active legacy autosave. */
export function migrateLegacyUserConfig(value: unknown) {
  try {
    if (localStorage.getItem(CONFIG_STORAGE) !== null || !value || typeof value !== "object") return;
    const settings = (value as { settings?: unknown }).settings;
    if (!settings || typeof settings !== "object" || !("keyBindings" in settings || "edgePan" in settings || "directionalLight" in settings)) return;
    saveUserConfig(parseSettings(upgradeDefaultBindings(settings)));
  } catch (error) {
    console.warn("Legacy configuration could not be migrated", error);
  }
}

/** Only the untouched legacy defaults should follow a new ergonomic default. */
function upgradeDefaultBindings(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const config = value as { version?: number; keyBindings?: Record<string, unknown> };
  const bindings = config.keyBindings;
  if (!config.version && bindings?.reset === "0" && SHORTCUTS.every(({ id, key }) =>
    bindings[id] === (id === "reset" ? "0" : key))) {
    return { ...config, keyBindings: { ...bindings, reset: "f" } };
  }
  return value;
}
