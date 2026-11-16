import { readFile, writeFile } from "node:fs/promises";
import { shapeFor } from "../src/engine/parts";
import { isBuildingPart } from "../src/engine/catalog";
import { thumbnailSvg } from "../src/engine/thumbnailSvg";
import { thumbnailKey, thumbnailPalette, type ThumbnailBundle } from "../src/engine/thumbnailAssets";
import type { Catalog, Shape } from "../src/engine/types";

const catalog: Catalog = JSON.parse(await readFile("public/data/catalog.json", "utf8"));
const templates: Record<string, string> = {};
function add(shape: Shape | null, rotation = 0) {
  const key = thumbnailKey(shape, rotation);
  if (templates[key]) return;
  let svg = thumbnailSvg(shape, undefined, rotation);
  for (const [name, color] of Object.entries(thumbnailPalette())) svg = svg.replaceAll(color, `{{${name}}}`);
  templates[key] = svg;
}
add(null);
for (const part of catalog.parts.filter(isBuildingPart)) {
  const shape = shapeFor(part);
  if (!shape) continue;
  add(shape, 0);
  add(shape, 90);
  if (shape.sideStuds?.length) { add(shape, 180); add(shape, 270); }
}
const bundle: ThumbnailBundle = { version: 1, templates: Object.fromEntries(Object.entries(templates).sort(([a], [b]) => a.localeCompare(b))) };
const path = "public/data/thumbnails.json";
const content = JSON.stringify(bundle) + "\n";
let previous = "";
try { previous = await readFile(path, "utf8"); } catch { /* First generation. */ }
if (previous !== content) await writeFile(path, content);
console.log(`Thumbnails: ${Object.keys(templates).length} SVG templates in one asset bundle.`);
