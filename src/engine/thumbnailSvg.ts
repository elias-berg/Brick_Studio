import type { Shape } from "./types";
import { PLATE, STUD_HEIGHT, STUD_RADIUS } from "./parts";

export const THUMBNAIL_COLOR = "#edb638";
export const THUMBNAIL_WIDTH = 300;
export const THUMBNAIL_HEIGHT = 210;
export const quarterTurn = (angle: number) =>
  (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
const shade = (color: string, factor: number) =>
  "#" +
  [1, 3, 5]
    .map((i) =>
      Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * factor))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

// One geometry definition feeds build-time PNGs and the selected-color cache.
// Current supported shapes are symmetric rectangles/cylinders, so a quarter
// turn swaps footprint dimensions rather than rotating a flat image in CSS.
export function thumbnailSvg(
  shape: Shape | null,
  requestedColor = THUMBNAIL_COLOR,
  rotation = 0,
): string {
  const color = /^#[0-9a-f]{6}$/i.test(requestedColor)
    ? requestedColor
    : THUMBNAIL_COLOR;
  const contents = () => {
    if (!shape)
      return '<path d="m25 22 25-13 25 13v28L50 63 25 50Z" fill="#e2e3df"/><path d="m25 22 25 14 25-14M50 36v27" fill="none" stroke="#bdc1b9"/><text x="50" y="47" text-anchor="middle" font-size="16" fill="#7f887d">?</text>';
    const swapped = quarterTurn(rotation) % 180 !== 0;
    const width = swapped ? shape.depth : shape.width,
      depth = swapped ? shape.width : shape.depth;
    const height = shape.height * PLATE,
      minY = -(width + depth) / 4 - height - (shape.studs ? STUD_HEIGHT : 0),
      maxY = (width + depth) / 4;
    const scale = Math.min(22, 82 / (width + depth), 54 / (maxY - minY));
    const project = (x: number, z: number, y = 0) => [
      50 + (x - z) * scale,
      35 + ((x + z) / 2 - y - (minY + maxY) / 2) * scale,
    ];
    const points = (vertices: number[][]) =>
      vertices.map((p) => p.join(",")).join(" ");
    const a = project(-width / 2, -depth / 2, height),
      b = project(width / 2, -depth / 2, height),
      c = project(width / 2, depth / 2, height),
      d = project(-width / 2, depth / 2, height);
    const b0 = project(width / 2, -depth / 2),
      c0 = project(width / 2, depth / 2),
      d0 = project(-width / 2, depth / 2);
    const rx = STUD_RADIUS * Math.SQRT2 * scale,
      ry = rx / 2,
      h = STUD_HEIGHT * scale;
    const top = project(0, 0, height),
      bottom = project(0, 0),
      roundRx = 0.49 * Math.SQRT2 * scale,
      roundRy = roundRx / 2;
    const body =
      shape.kind === "round"
        ? `<path d="M${top[0] - roundRx} ${top[1]}V${bottom[1]}a${roundRx} ${roundRy} 0 0 0 ${roundRx * 2} 0V${top[1]}"/><ellipse cx="${top[0]}" cy="${top[1]}" rx="${roundRx}" ry="${roundRy}"/>`
        : `<polygon points="${points([d, c, c0, d0])}"/><polygon fill="${shade(color, 0.8)}" points="${points([b, c, c0, b0])}"/><polygon points="${points([a, b, c, d])}"/>`;
    const studs = shape.studs
      ? Array.from({ length: width * depth }, (_, i) => ({
          x: Math.floor(i / depth) - (width - 1) / 2,
          z: (i % depth) - (depth - 1) / 2,
        }))
          .sort((a, b) => a.x + a.z - b.x - b.z)
          .map(({ x, z }) => {
            const p = project(x, z, height);
            return `<use href="#stud" xlink:href="#stud" x="${p[0]}" y="${p[1]}"/>`;
          })
          .join("")
      : "";
    return `<ellipse cx="50" cy="${35 + (maxY - (minY + maxY) / 2) * scale + 3}" rx="${Math.min(32, (width + depth) * scale * 0.34)}" ry="2.5" fill="#000" opacity=".05"/><g fill="${color}" stroke="#000" stroke-opacity=".22" stroke-width=".45">${body}<defs><g id="stud"><path fill="${shade(color, 0.88)}" d="M${-rx} ${-h}v${h}a${rx} ${ry} 0 0 0 ${rx * 2} 0v${-h}"/><ellipse fill="${shade(color, 1.12)}" cx="0" cy="${-h}" rx="${rx}" ry="${ry}"/></g></defs>${studs}</g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" viewBox="0 0 100 70">${contents()}</svg>`;
}
