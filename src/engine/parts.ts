import type { Part, Shape } from "./types";
export const PLATE = 0.4;
export const STUD_HEIGHT = 0.21;
export const STUD_RADIUS = 0.29;
// Deliberately explicit: a part is placeable only when its solid and connectors are known.
export function shapeFor(part?: Part): Shape | null {
  if (!part) return null;
  // Connector centers follow the LDraw dimensions: 20 LDU/stud, side
  // center 10 LDU below the top of a 24 LDU brick (0.7 above its base).
  if (part.id === "87087") return { width: 1, depth: 1, height: 3, kind: "brick", studs: true,
    sideStuds: [{ point: { x: 0, y: .7, z: .5 }, normal: { x: 0, y: 0, z: 1 } }] };
  if (part.id === "11211") return { width: 1, depth: 2, height: 3, kind: "brick", studs: true,
    sideStuds: [-.5, .5].map((z) => ({ point: { x: .5, y: .7, z }, normal: { x: 1, y: 0, z: 0 } })) };
  const match =
    /^(Brick|Plate|Tile|Baseplate) (\d+) x (\d+)(?: with (?:Bottom Tube|Groove|Bottom Pin))?$/.exec(
      part.name,
    );
  if (match) {
    const [, family, w, d] = match;
    return {
      width: +w,
      depth: +d,
      height: family === "Brick" ? 3 : family === "Baseplate" ? 0.5 : 1,
      kind: family.toLowerCase() as Shape["kind"],
      studs: family !== "Tile",
    };
  }
  if (["3062b", "3062a", "6141", "4073"].includes(part.id))
    return {
      width: 1,
      depth: 1,
      height: part.id.startsWith("3062") ? 3 : 1,
      kind: "round",
      studs: true,
    };
  return null;
}
export const preferredParts = [
  "3001",
  "87087",
  "11211",
  "3003",
  "3004",
  "3005",
  "3002",
  "3008",
  "3010",
  "3020",
  "3022",
  "3023",
  "3024",
  "3034",
  "3031",
  "3068b",
  "3069b",
  "3070b",
  "3062b",
  "6141",
];
