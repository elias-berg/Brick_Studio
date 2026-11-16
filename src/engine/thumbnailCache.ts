import type { Catalog, Shape } from "./types";
import { shapeFor } from "./parts";
import { isBuildingPart } from "./catalog";
import { thumbnailSvg } from "./thumbnailSvg";
import { thumbnailKey, thumbnailPalette, type ThumbnailBundle } from "./thumbnailAssets";

let templates: Record<string, string> = {};
const libraryImages = new Map<string, string>();
function template(shape: Shape | null, rotation: number, rotationX = 0, rotationZ = 0) {
  const key = thumbnailKey(shape, rotation, rotationX, rotationZ);
  if (!templates[key]) {
    // A runtime catalog revision can add a supported size before its asset bundle
    // is regenerated. Prepare it once at catalog load, never during scrolling.
    let svg = thumbnailSvg(shape, undefined, rotation, rotationX, rotationZ);
    for (const [name, color] of Object.entries(thumbnailPalette())) svg = svg.replaceAll(color, `{{${name}}}`);
    templates[key] = svg;
  }
  return templates[key];
}
export function thumbnailMarkup(shape: Shape | null, color?: string, rotation = 0, rotationX = 0, rotationZ = 0) {
  let svg = template(shape, rotation, rotationX, rotationZ);
  for (const [name, value] of Object.entries(thumbnailPalette(color))) svg = svg.replaceAll(`{{${name}}}`, value);
  return svg;
}
export function libraryThumbnail(shape: Shape | null) {
  const key = thumbnailKey(shape);
  const url = libraryImages.get(key);
  if (url) return url;
  // Keep the final image usable during a development hot reload or a runtime
  // catalog replacement. Normal startup has already decoded every library image.
  const prepared = imageUrl(thumbnailMarkup(shape));
  libraryImages.set(key, prepared);
  return prepared;
}
function imageUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
/** Keep the opening screen until every library image is decoded and ready. */
export async function prepareThumbnails(catalog: Catalog) {
  const response = await fetch("/data/thumbnails.json");
  if (!response.ok) throw Error("Could not load brick preview assets.");
  const bundle = await response.json() as ThumbnailBundle;
  if (bundle.version !== 1 || !bundle.templates || typeof bundle.templates !== "object") throw Error("Unsupported brick preview assets.");
  templates = { ...bundle.templates };
  const shapes = new Map<string, Shape | null>([["unknown", null]]);
  for (const part of catalog.parts.filter(isBuildingPart)) {
    const shape = shapeFor(part);
    if (shape) shapes.set(thumbnailKey(shape), shape);
  }
  await Promise.all([...shapes].map(async ([key, shape]) => {
    const url = imageUrl(thumbnailMarkup(shape));
    const image = new Image();
    image.src = url;
    await image.decode();
    libraryImages.set(key, url);
    // Prepare the selected-piece alternate orientation before opening the editor.
    if (shape) template(shape, 90);
  }));
}
