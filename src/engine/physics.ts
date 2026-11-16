import { rotate, worldConnectors, bodyBounds, compatibleConnectors, distance, dot, sub } from "./spatial";
import { bodySolid, bodyMaterialSolids, cylinderSolid, boxesOverlap, solidsOverlap, studBounds } from "./solids";
import type { Brick, Part, Shape, LocalConnector, StudConflict } from "./types";
import { STUD_HEIGHT, STUD_RADIUS, shapeFor } from "./parts";
export type Library = Map<string, Part>;
const EPS = 0.012;
// Editor builds are immutable arrays. Reuse connectivity across pointer moves;
// a placement/deletion/catalog replacement supplies a new array or library.
const supportCache = new WeakMap<Brick[], { library: Library; length: number; ids: Set<string> }>();
function placementGroundedIds(bricks: Brick[], library: Library) {
  const saved = supportCache.get(bricks);
  if (saved?.library === library && saved.length === bricks.length) return saved.ids;
  const ids = groundedBrickIds(bricks, library);
  supportCache.set(bricks, { library, length: bricks.length, ids });
  return ids;
}
export const shapeOf = (b: Brick, lib: Library) => shapeFor(lib.get(b.partId))!;
export const top = (b: Brick, lib: Library) => bodyBounds(b, shapeOf(b, lib)).max.y;
export function rotatePoint(x: number, z: number, angle: number) {
  const point = rotate({ x, y: 0, z }, { rotation: angle });
  return { x: point.x, z: point.z };
}
/** Compatibility helper for upright grid snapping. */
export function connectors(brick: Brick, shape: Shape) {
  return worldConnectors(brick, shape).filter((p) => p.kind === "socket").map((p) => p.point);
}
/** Match cylindrical engagement, not coincident origins. The socket mouth
 * can sit partway along a stud while the axes stay aligned. Require at least
 * 1 LDU of insertion; touching tips or a visible air gap never carries support.
 */
function mate(a: LocalConnector, b: LocalConnector) {
  if (!compatibleConnectors(a, b)) return false;
  const stud = a.kind === "stud" ? a : b, socket = a.kind === "socket" ? a : b;
  const delta = sub(socket.point, stud.point), gap = dot(delta, stud.normal);
  const lateral = sub(delta, { x: stud.normal.x * gap, y: stud.normal.y * gap, z: stud.normal.z * gap });
  return distance(lateral, { x: 0, y: 0, z: 0 }) < EPS
    && gap >= -EPS && gap <= STUD_HEIGHT - .05;
}
const modelCache = new WeakMap<Brick, { key: string; model: ReturnType<typeof makeModel> }>();
const portKey = (point: LocalConnector["point"], normal: LocalConnector["normal"]) => [point.x, point.y, point.z, normal.x, normal.y, normal.z].map((n) => Math.round(n * 1e4)).join(":");
function envelope(boxes: ReturnType<typeof studBounds>[]) {
  const first = boxes[0];
  const min = { ...first.min }, max = { ...first.max };
  for (const box of boxes) for (const axis of ["x", "y", "z"] as const) {
    min[axis] = Math.min(min[axis], box.min[axis]); max[axis] = Math.max(max[axis], box.max[axis]);
  }
  return { min, max };
}
function makeModel(brick: Brick, shape: Shape) {
  const ports = worldConnectors(brick, shape);
  const body = bodySolid(brick, shape, true);
  const studs = ports.filter((p) => p.kind === "stud").map((p) => ({ ...p, bounds: studBounds(p.point, p.normal) }));
  const sockets = ports.filter((p) => p.kind === "socket");
  const socketMap = new Map(sockets.map((p) => [portKey(p.point, p.normal), p]));
  let material: ReturnType<typeof bodyMaterialSolids> | undefined;
  return { brick, body, studs, sockets, socketMap,
    material: () => material ??= bodyMaterialSolids(brick, shape),
    studEnvelope: studs.length ? envelope(studs.map((p) => p.bounds)) : null,
    occupied: envelope([body.bounds, ...studs.map((p) => p.bounds)]),
  };
}
function matchedSocket(stud: LocalConnector, model: ReturnType<typeof makeModel>) {
  const opposite = { x: -stud.normal.x, y: -stud.normal.y, z: -stud.normal.z };
  const exact = model.socketMap.get(portKey(stud.point, opposite));
  return exact && mate(stud, exact) || model.sockets.some((socket) => mate(stud, socket));
}
type PhysicalModel = ReturnType<typeof makeModel>;
const studSolidCache = new WeakMap<LocalConnector, ReturnType<typeof cylinderSolid>>();
function studSolid(stud: LocalConnector) {
  let saved = studSolidCache.get(stud);
  if (!saved) {
    saved = cylinderSolid(stud.point, stud.normal, STUD_RADIUS / Math.cos(Math.PI / 24), STUD_HEIGHT);
    studSolidCache.set(stud, saved);
  }
  return saved;
}
function nearestFaceSocket(stud: LocalConnector, target: PhysicalModel) {
  let nearest: LocalConnector | undefined, best = Infinity;
  for (const socket of target.sockets) {
    if (!compatibleConnectors(stud, socket) || Math.abs(dot(sub(socket.point, stud.point), stud.normal)) >= EPS) continue;
    const gap = distance(stud.point, socket.point);
    if (gap < best) { best = gap; nearest = socket; }
  }
  return nearest;
}
/** One material test supplies both rejection and its visible collision evidence. */
function* interferingStuds(source: PhysicalModel, target: PhysicalModel) {
  if (!source.studEnvelope || !boxesOverlap(source.studEnvelope, target.body.bounds)) return;
  for (const stud of source.studs) {
    if (!boxesOverlap(stud.bounds, target.body.bounds) || matchedSocket(stud, target)) continue;
    const solid = studSolid(stud);
    if (target.material().some(piece => solidsOverlap(solid, piece))) yield stud;
  }
}
function studCollisionReason(stud: LocalConnector, source: PhysicalModel, target: PhysicalModel) {
  const socket = nearestFaceSocket(stud, target);
  if (socket) {
    const amount = Number(distance(stud.point, socket.point).toFixed(3));
    return `Part ${source.brick.partId}: stud misses the socket grid by ${amount} studs`;
  }
  return `Stud on part ${source.brick.partId} hits solid material on part ${target.brick.partId}`;
}
/** All relevant blocked studs, including when the target is held by offsets. */
export function placementStudConflicts(brick: Brick, bricks: Brick[], lib: Library): StudConflict[] {
  const candidate = model(brick, lib), conflicts: StudConflict[] = [];
  for (const other of bricks) {
    if (other.id === brick.id) continue;
    const existing = model(other, lib);
    if (!boxesOverlap(candidate.occupied, existing.occupied)) continue;
    for (const [source, target] of [[candidate, existing], [existing, candidate]]) {
      for (const stud of interferingStuds(source, target)) {
        conflicts.push({ sourceId: source.brick.id, targetId: target.brick.id,
          point: stud.point, normal: stud.normal, socket: nearestFaceSocket(stud, target)?.point });
        if (conflicts.length >= 16) return conflicts;
      }
    }
  }
  return conflicts;
}
function model(brick: Brick, lib: Library) {
  const shape = shapeOf(brick, lib), key = JSON.stringify(shape);
  const cached = modelCache.get(brick);
  if (cached?.key === key) return cached.model;
  const result = makeModel(brick, shape);
  modelCache.set(brick, { key, model: result });
  return result;
}
export function footprintsOverlap(a: Brick, b: Brick, lib: Library) {
  const x = model(a, lib).body.bounds, y = model(b, lib).body.bounds;
  return x.min.x < y.max.x && x.max.x > y.min.x && x.min.z < y.max.z && x.max.z > y.min.z;
}
export function connected(studded: Brick, socketed: Brick, lib: Library) {
  const a = model(studded, lib), b = model(socketed, lib);
  return boxesOverlap(a.occupied, b.occupied) && a.studs.some((stud) => matchedSocket(stud, b));
}
export function validate(brick: Brick, bricks: Brick[], lib: Library, boardSize: number, requireSupport = true) {
  const shape = shapeOf(brick, lib);
  if (!shape) return "This part needs a geometry definition.";
  const candidate = model(brick, lib);
  const occupied = [candidate.occupied];
  if (occupied.some((b) => b.min.y < -.012)) return "Below the building surface";
  if (occupied.some((b) => b.min.x < -boardSize / 2 - .001 || b.max.x > boardSize / 2 + .001 || b.min.z < -boardSize / 2 - .001 || b.max.z > boardSize / 2 + .001)) return "Outside the build area";
  for (const other of bricks) {
    if (other.id === brick.id) continue;
    const existing = model(other, lib);
    if (!boxesOverlap(candidate.occupied, existing.occupied)) continue;
    if (solidsOverlap(candidate.body, existing.body) && candidate.material().some(a => existing.material().some(b => solidsOverlap(a,b)))) return "Collision — another brick occupies this space";
    for (const [source, target] of [[candidate, existing], [existing, candidate]]) {
      const collision = interferingStuds(source, target).next();
      if (!collision.done) return studCollisionReason(collision.value, source, target);
    }
    if (candidate.studEnvelope && existing.studEnvelope && boxesOverlap(candidate.studEnvelope, existing.studEnvelope)) {
      for (const a of candidate.studs) for (const b of existing.studs) {
        if (boxesOverlap(a.bounds, b.bounds) && solidsOverlap(studSolid(a), studSolid(b))) return "Collision — studs overlap";
      }
    }
  }
  if (requireSupport && brick.y > EPS) {
    const neighbors = bricks.filter((b) => b.id !== brick.id && (connected(b, brick, lib) || connected(brick, b, lib)));
    if (!neighbors.length) return "Needs an aligned stud/socket connection to a grounded brick";
    const grounded = placementGroundedIds(bricks, lib);
    if (!neighbors.some((b) => grounded.has(b.id))) return "Connection is only to floating bricks";
  }
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

export function withinBoard(brick: Brick, lib: Library, size: number) {
  const m = model(brick, lib);
  return [m.occupied].every((b) => b.min.x >= -size / 2 - .001 && b.max.x <= size / 2 + .001 && b.min.z >= -size / 2 - .001 && b.max.z <= size / 2 + .001);
}
