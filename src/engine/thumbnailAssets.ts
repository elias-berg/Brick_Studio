import { canonicalOrientation, orientationSignature } from "./spatial";
import type { Shape } from "./types";
export const THUMBNAIL_COLOR = "#edb638";
export const THUMBNAIL_WIDTH = 300;
export const THUMBNAIL_HEIGHT = 210;
// Upright unmodified pieces repeat after a half-turn; side-stud pieces do not.
export const thumbnailAngle = (angle: number): 0 | 90 =>
  ((((Math.round(angle / 90) * 90) % 180) + 180) % 180) as 0 | 90;

/** Shared asset keys depend on geometry, not IDs from one catalog snapshot. */
export function thumbnailKey(shape: Shape | null, rotation = 0, rotationX = 0, rotationZ = 0) {
  if (!shape) return "unknown";
  const orientation = canonicalOrientation({ rotation, rotationX, rotationZ });
  const extra = shape.sideStuds ? JSON.stringify(shape.sideStuds) : "";
  const prefix = `${shape.kind}:${shape.width}:${shape.depth}:${shape.height}:${shape.studs}:${extra}`;
  if (shape.sideStuds?.length || orientation.rotationX || orientation.rotationZ) return `${prefix}:${orientationSignature(orientation)}`;
  return `${prefix}:${shape.width === shape.depth ? 0 : thumbnailAngle(orientation.rotation)}`;
}
export function thumbnailPalette(requestedColor = THUMBNAIL_COLOR) {
  const color = /^#[0-9a-f]{6}$/i.test(requestedColor) ? requestedColor : THUMBNAIL_COLOR;
  const shade = (factor: number) => "#" + [1, 3, 5].map((i) => Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * factor)).toString(16).padStart(2, "0")).join("");
  return { base: color, side: shade(.8), studSide: shade(.88), studTop: shade(1.12) };
}
export type ThumbnailBundle = { version: 1; templates: Record<string, string> };
