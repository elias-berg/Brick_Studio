import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import sharp from "sharp";
import { shapeFor } from "../src/engine/parts";
import { thumbnailSvg } from "../src/engine/thumbnailSvg";
import type { Catalog } from "../src/engine/types";

const catalog: Catalog = JSON.parse(
  await readFile("public/data/catalog.json", "utf8"),
);
await mkdir("public/thumbnails", { recursive: true });
await mkdir("src/data", { recursive: true });
const images: Record<string, string> = {};
let generated = 0;
async function image(svg: string) {
  const name =
    createHash("sha256").update(svg).digest("hex").slice(0, 16) + ".png";
  const path = `public/thumbnails/${name}`;
  try {
    await access(path);
  } catch {
    await sharp(Buffer.from(svg)).png().toFile(path);
    generated++;
  }
  return `/thumbnails/${name}`;
}
images.unknown = await image(thumbnailSvg(null));
for (const part of catalog.parts) {
  const shape = shapeFor(part);
  if (!shape) continue;
  for (const rotation of [0, 90, 180, 270])
    images[`${part.id}:${rotation}`] = await image(
      thumbnailSvg(shape, undefined, rotation),
    );
}
const manifest = JSON.stringify(images, null, 2) + "\n",
  path = "src/data/thumbnails.json";
let previous = "";
try {
  previous = await readFile(path, "utf8");
} catch {
  /* first generation */
}
if (previous !== manifest) await writeFile(path, manifest);
console.log(
  `Thumbnails: ${generated} new PNGs; ${Object.keys(images).length - 1} part/orientation mappings.`,
);
