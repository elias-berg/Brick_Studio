/** Schema migration boundary: keep behavior tests unchanged; replace this adapter. */
import { readFileSync } from "node:fs";
import { shapeOf, validate, connected, groundedBrickIds, deletionCascade, placementStudConflicts } from "../../src/engine/physics";
import { frame, worldConnectors } from "../../src/engine/spatial";
import { snapToConnection } from "../../src/engine/targeting";
import type { Brick, Catalog, Vec3 } from "../../src/engine/types";

export const catalog: Catalog = JSON.parse(readFileSync(new URL("../../public/data/catalog.json", import.meta.url), "utf8"));
const library = new Map(catalog.parts.map(part => [part.id, part]));
export type Pose = Pick<Brick, "rotation" | "rotationX" | "rotationZ">;
export const upright: Pose = { rotation: 0, rotationX: 0, rotationZ: 0 };
export const brick = (id: string, partId: string, x = 0, y = 0, z = 0, pose: Pose = upright): Brick => ({ id, partId, colorId: 14, x, y, z, ...pose });
export const engine = {
  ports: (b: Brick) => worldConnectors(b, shapeOf(b, library)),
  regularSockets: (b: Brick) => {
    const shape = shapeOf(b, library), transform = frame(shape, b);
    return Array.from({ length: shape.width }, (_, x) => Array.from({ length: shape.depth }, (_, z) => ({
      kind: "socket" as const, normal: transform.normal({ x: 0, y: -1, z: 0 }),
      point: transform.point({ x: x - (shape.width - 1) / 2, y: 0, z: z - (shape.depth - 1) / 2 }),
    }))).flat();
  },
  validate: (b: Brick, others: Brick[], support = true, board = 96) => validate(b, others, library, board, support),
  connected: (a: Brick, b: Brick) => connected(a, b, library),
  grounded: (bricks: Brick[]) => groundedBrickIds(bricks, library),
  cascade: (id: string, bricks: Brick[]) => deletionCascade(id, bricks, library),
  conflicts: (b: Brick, others: Brick[]) => placementStudConflicts(b, others, library),
  snap: (point: Vec3, normal: Vec3, support: Brick, partId: string, pose: Pose, others = [support], preferred?: Brick) => {
    const candidate = brick("preview", partId, 0, 0, 0, pose);
    const snapped = snapToConnection(point, normal, support, shapeOf(candidate, library), pose, shapeOf(support, library), {
      accept: b => !validate({ ...b, partId }, others, library, 96, false), preferred,
    });
    return snapped ? { ...snapped, partId } : null;
  },
};
