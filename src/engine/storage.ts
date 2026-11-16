import { defaultBindings, parseBindings } from "./shortcuts";
import type { Brick, Catalog, Settings } from "./types";
import { shapeFor } from "./parts";
import { groundedBrickIds, inventory, validate } from "./physics";
export interface Project {
  format: "brick-studio";
  version: 1;
  name: string;
  bricks: Brick[];
  settings: Pick<Settings, "boardSize" | "allowFloating">;
}
export type RestoredProject = Omit<Project, "settings"> & { settings: Settings };
export const defaults: Settings = {
  keyBindings: { ...defaultBindings },
  allowFloating: false,
  directionalLight: true,
  edgePan: true,
  edgeSize: 48,
  panSpeed: 12,
  boardSize: 48,
};
/** Serialized build files intentionally exclude browser preferences. */
export function projectDocument(name: string, bricks: Brick[], settings: Settings): Project {
  return {
    format: "brick-studio" as const,
    version: 1 as const,
    name,
    bricks,
    settings: { boardSize: settings.boardSize, allowFloating: settings.allowFloating },
  };
}
export function parseSettings(value: unknown): Settings {
  if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value))) throw Error("Invalid viewport settings.");
  const supplied = value as Partial<Settings> | undefined;
  const settings = { ...defaults, ...supplied, keyBindings: parseBindings(supplied?.keyBindings) };
  // Discard the removed step-size preference in legacy browser/project data.
  Reflect.deleteProperty(settings, "offsetSteps");
  if (
    ![32, 48, 64, 96].includes(settings.boardSize) ||
    typeof settings.allowFloating !== "boolean" ||
    typeof settings.edgePan !== "boolean" ||
    typeof settings.directionalLight !== "boolean" ||
    !Number.isFinite(settings.edgeSize) ||
    settings.edgeSize < 16 ||
    settings.edgeSize > 160 ||
    !Number.isFinite(settings.panSpeed) ||
    settings.panSpeed < 1 ||
    settings.panSpeed > 40
  )
    throw Error("Invalid viewport settings.");
  return settings;
}
export function parseProject(value: unknown, catalog: Catalog): RestoredProject {
  if (!value || typeof value !== "object")
    throw Error("Not a Brick Studio project.");
  const p = value as Project;
  if (
    p.format !== "brick-studio" ||
    p.version !== 1 ||
    !Array.isArray(p.bricks) ||
    p.bricks.length > 5000
  )
    throw Error("Unsupported project format (maximum 5,000 pieces).");
  const lib = new Map(catalog.parts.map((p) => [p.id, p])),
    colors = new Set(catalog.colors.map((c) => c.id));
  const settings = parseSettings({ boardSize: p.settings?.boardSize ?? defaults.boardSize, allowFloating: p.settings?.allowFloating ?? defaults.allowFloating });
  const ids = new Set<string>();
  const bricks = [...p.bricks].sort((a, b) => a.y - b.y);
  const accepted: Brick[] = [];
  for (const b of bricks) {
    if (
      !b ||
      typeof b.id !== "string" ||
      ids.has(b.id) ||
      !shapeFor(lib.get(b.partId)) ||
      !colors.has(b.colorId) ||
      ![b.x, b.y, b.z, b.rotation, b.rotationX ?? 0, b.rotationZ ?? 0].every(Number.isFinite) ||
      [b.rotationX ?? 0, b.rotationZ ?? 0].some((angle) => angle % 90 !== 0)
    )
      throw Error("Invalid or unsupported brick in project.");
    ids.add(b.id);
    accepted.push(b);
  }
  for (const b of accepted) {
    const reason = validate(b, accepted, lib, settings.boardSize, false);
    if (reason) throw Error(`Invalid placement of ${b.partId}: ${reason}`);
  }
  // A surviving column may hang from a supported bridge after a deletion. Validate
  // connectivity to ground, rather than requiring every saved piece to have a parent.
  if (!settings.allowFloating && groundedBrickIds(accepted, lib).size !== accepted.length)
    throw Error("The project contains disconnected floating pieces.");
  return {
    format: "brick-studio",
    version: 1,
    name: typeof p.name === "string" ? p.name.slice(0, 100) : "Untitled",
    bricks,
    settings,
  };
}
export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvInventory(bricks: Brick[], catalog: Catalog) {
  const quote = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [
      ["part_num", "part_name", "color_id", "color_name", "quantity"],
      ...inventory(bricks).map((g) => [
        g.partId,
        catalog.parts.find((p) => p.id === g.partId)?.name ?? "",
        g.colorId,
        catalog.colors.find((c) => c.id === g.colorId)?.name ?? "",
        g.quantity,
      ]),
    ]
      .map((row) => row.map(quote).join(","))
      .join("\r\n")
  );
}
