import type { Brick } from "./types";
export function demoBuild(): Brick[] {
  const bricks: Brick[] = [];
  const add = (
    partId: string,
    colorId: number,
    x: number,
    y: number,
    z: number,
    rotation = 0,
  ) =>
    bricks.push({
      id: crypto.randomUUID(),
      partId,
      colorId,
      x,
      y,
      z,
      rotation,
    });
  add("3036", 19, 0.5, 0, 0.5);
  for (let level = 0; level < 3; level++)
    for (const [x, z, color] of [
      [-1.5, -2.5, 1],
      [2.5, -2.5, 4],
      [-1.5, 3.5, 3],
      [2.5, 3.5, 14],
    ])
      add("3003", color, x, 0.4 + level * 1.2, z);
  add("3036", 14, 0.5, 4, 0.5);
  add("3001", 15, 0.5, 4.4, 0.5, 90);
  add("3020", 4, 0.5, 5.6, 0.5, 90);
  return bricks;
}
