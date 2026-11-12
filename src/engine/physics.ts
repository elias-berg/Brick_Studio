import type { Brick, Part, Shape } from "./types";
import { PLATE, shapeFor } from "./parts";
export type Library = Map<string, Part>;
const EPS = 0.012;
export const shapeOf = (b: Brick, lib: Library) => shapeFor(lib.get(b.partId))!;
export const top = (b: Brick, lib: Library) =>
  b.y + shapeOf(b, lib).height * PLATE;
export function rotatePoint(x: number, z: number, a: number) {
  const t = (a * Math.PI) / 180;
  return {
    x: x * Math.cos(t) + z * Math.sin(t),
    z: -x * Math.sin(t) + z * Math.cos(t),
  };
}
export function connectors(b: Brick, s: Shape) {
  const points = [];
  for (let x = 0; x < s.width; x++)
    for (let z = 0; z < s.depth; z++) {
      const p = rotatePoint(
        x - (s.width - 1) / 2,
        z - (s.depth - 1) / 2,
        b.rotation,
      );
      points.push({ x: b.x + p.x, z: b.z + p.z });
    }
  return points;
}
function polygon(b: Brick, s: Shape) {
  // Circumscribed round polygon is conservative: never permits a body intersection.
  const points =
    s.kind === "round"
      ? Array.from({ length: 32 }, (_, i) => ({
          x: (Math.cos((i * Math.PI) / 16) * 0.49) / Math.cos(Math.PI / 32),
          z: (Math.sin((i * Math.PI) / 16) * 0.49) / Math.cos(Math.PI / 32),
        }))
      : [
          { x: -s.width / 2 + 0.01, z: -s.depth / 2 + 0.01 },
          { x: s.width / 2 - 0.01, z: -s.depth / 2 + 0.01 },
          { x: s.width / 2 - 0.01, z: s.depth / 2 - 0.01 },
          { x: -s.width / 2 + 0.01, z: s.depth / 2 - 0.01 },
        ];
  return points.map((p) => {
    const q = rotatePoint(p.x, p.z, b.rotation);
    return { x: q.x + b.x, z: q.z + b.z };
  });
}
export function footprintsOverlap(a: Brick, b: Brick, lib: Library) {
  const pa = polygon(a, shapeOf(a, lib)),
    pb = polygon(b, shapeOf(b, lib));
  for (const poly of [pa, pb])
    for (let i = 0; i < poly.length; i++) {
      const next = poly[(i + 1) % poly.length],
        cur = poly[i];
      const axis = { x: next.z - cur.z, z: cur.x - next.x };
      const da = pa.map((p) => p.x * axis.x + p.z * axis.z),
        db = pb.map((p) => p.x * axis.x + p.z * axis.z);
      if (
        Math.max(...da) <= Math.min(...db) + 1e-6 ||
        Math.max(...db) <= Math.min(...da) + 1e-6
      )
        return false;
    }
  return true;
}
export function connected(lower: Brick, upper: Brick, lib: Library) {
  const s = shapeOf(lower, lib),
    u = shapeOf(upper, lib);
  if (
    !s.studs ||
    u.kind === "baseplate" ||
    Math.abs(top(lower, lib) - upper.y) > EPS
  )
    return false;
  return connectors(lower, s).some((a) =>
    connectors(upper, u).some((b) => Math.hypot(a.x - b.x, a.z - b.z) < EPS),
  );
}
function studInside(stud: { x: number; z: number }, body: Brick, s: Shape) {
  const p = rotatePoint(stud.x - body.x, stud.z - body.z, -body.rotation);
  return s.kind === "round"
    ? Math.hypot(p.x, p.z) < 0.49 + 0.29
    : Math.abs(p.x) < s.width / 2 - 0.01 + 0.29 &&
        Math.abs(p.z) < s.depth / 2 - 0.01 + 0.29;
}
export function validate(
  brick: Brick,
  bricks: Brick[],
  lib: Library,
  boardSize: number,
  requireSupport = true,
) {
  const s = shapeOf(brick, lib);
  if (!s) return "This part needs a geometry definition.";
  if (brick.y < -0.001) return "Below the building surface";
  if (
    polygon(brick, s).some(
      (p) =>
        Math.abs(p.x) > boardSize / 2 + 0.001 ||
        Math.abs(p.z) > boardSize / 2 + 0.001,
    )
  )
    return "Outside the build area";
  for (const b of bricks) {
    if (b.id === brick.id) continue;
    const bs = shapeOf(b, lib);
    if (
      brick.y < top(b, lib) - EPS &&
      top(brick, lib) > b.y + EPS &&
      footprintsOverlap(brick, b, lib)
    )
      return "Collision — another brick occupies this space";
    // Studs may enter only a matching socket at the exact mating height.
    for (const [lower, ls, upper, us] of [
      [b, bs, brick, s],
      [brick, s, b, bs],
    ] as const) {
      if (!ls.studs) continue;
      const t = lower.y + ls.height * PLATE;
      if (upper.y >= t + 0.22 - EPS || upper.y + us.height * PLATE <= t + EPS)
        continue;
      const sockets = connectors(upper, us);
      for (const stud of connectors(lower, ls)) {
        if (!studInside(stud, upper, us)) continue;
        if (
          us.kind === "baseplate" ||
          Math.abs(upper.y - t) > EPS ||
          !sockets.some((p) => Math.hypot(p.x - stud.x, p.z - stud.z) < EPS)
        )
          return "Studs must align with the sockets underneath";
      }
    }
  }
  if (
    requireSupport &&
    brick.y > EPS &&
    !bricks.some((b) => b.id !== brick.id && connected(b, brick, lib))
  )
    return "Needs a stud connection underneath";
  return "";
}
export function deletionCascade(root: string, bricks: Brick[], lib: Library) {
  const graph = new Map(bricks.map((brick) => [brick.id, new Set<string>()]));
  for (let i = 0; i < bricks.length; i++) {
    for (let j = i + 1; j < bricks.length; j++) {
      const a = bricks[i], b = bricks[j];
      if (connected(a, b, lib) || connected(b, a, lib)) {
        graph.get(a.id)!.add(b.id);
        graph.get(b.id)!.add(a.id);
      }
    }
  }
  if (!graph.has(root)) return [];
  const affected = reachable([root], (id) => graph.get(id)!);
  // Rigid connections carry hanging branches too. Preserve any surviving path
  // from the affected component to the ground, in either connection direction.
  const anchors = bricks.filter((brick) => brick.id !== root && brick.y < EPS && affected.has(brick.id)).map((brick) => brick.id);
  const anchored = reachable(anchors, (id) => graph.get(id)!, root);
  return [...affected].filter((id) => !anchored.has(id));
}
export function inventory(bricks: Brick[]) {
  const groups = new Map<
    string,
    { partId: string; colorId: number; quantity: number }
  >();
  for (const b of bricks) {
    const key = `${b.partId}:${b.colorId}`;
    const g = groups.get(key);
    if (g) g.quantity++;
    else groups.set(key, { partId: b.partId, colorId: b.colorId, quantity: 1 });
  }
  return [...groups.values()].sort(
    (a, b) => a.partId.localeCompare(b.partId) || a.colorId - b.colorId,
  );
}

/** Rigid stud connections can carry a hanging branch in either direction. */
export function groundedBrickIds(bricks: Brick[], lib: Library) {
  const byId = new Map(bricks.map((brick) => [brick.id, brick]));
  const anchors = bricks.filter((brick) => brick.y < EPS).map((brick) => brick.id);
  return reachable(anchors, function* (id, visited) {
    const source = byId.get(id)!;
    for (const brick of bricks) {
      if (!visited.has(brick.id) && (connected(source, brick, lib) || connected(brick, source, lib))) yield brick.id;
    }
  });
}

/** Breadth-first traversal shared by support checks and recursive deletion. */
function reachable(seeds: string[], neighbors: (id: string, visited: ReadonlySet<string>) => Iterable<string>, excluded?: string) {
  const visited = new Set(seeds);
  const queue = [...seeds];
  for (let i = 0; i < queue.length; i++) {
    for (const id of neighbors(queue[i], visited)) {
      if (id !== excluded && !visited.has(id)) {
        visited.add(id);
        queue.push(id);
      }
    }
  }
  return visited;
}
