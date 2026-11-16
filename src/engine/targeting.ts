import type { Intersection, Object3D } from "three";
import type { Brick, Shape, Vec3 } from "./types";
import { worldConnectors, distance, dot, sub, add, mul, compatibleConnectors, orientationSignature } from "./spatial";
import { gridPrecision } from "./grid";
export function buildSurfaceHit(hits: Intersection<Object3D>[]) { return hits[0]; }

interface SnapOptions {
  accept?: (brick: Brick) => boolean;
  preferred?: Brick | null;
  viewDirection?: Vec3;
}

/** Search the targeted connector plane; never round its depth onto another grid. */
export function snapToConnection(point: Vec3, normal: Vec3, support: Brick, shape: Shape, orientation: Pick<Brick, "rotation" | "rotationX" | "rotationZ">, supportShape: Shape, options: SnapOptions = {}): Brick | null {
  const ports = worldConnectors(support, supportShape);
  const seed: Brick = { id: "preview", partId: "", colorId: 0, x: 0, y: 0, z: 0,
    rotation: orientation.rotation, rotationX: orientation.rotationX ?? 0, rotationZ: orientation.rotationZ ?? 0 };
  const selectedPorts = worldConnectors(seed, shape);
  let visible = ports.filter((p) => dot(p.normal, normal) > .8);
  // A body edge has no connectors of its own. Target the nearest compatible
  // exposed face of this same brick, retaining its exact connector phase.
  // Never select a back face through the body or switch to a different brick.
  if (!visible.length) {
    const faces = [...new Map(selectedPorts.map((p) => [`${p.kind}:${p.normal.x}:${p.normal.y}:${p.normal.z}`, p])).values()];
    const exposed = ports.filter((p) => (!options.viewDirection || dot(p.normal, options.viewDirection) > .05)
      && faces.some((mate) => compatibleConnectors(p, mate)));
    if (!exposed.length) return null;
    const nearest = exposed.reduce((a, b) => distance(a.point, point) <= distance(b.point, point) ? a : b);
    visible = exposed.filter((p) => p.kind === nearest.kind && dot(p.normal, nearest.normal) > .999);
  }
  const mates = selectedPorts.filter((p) => compatibleConnectors(p, visible[0]));
  if (!mates.length) return null;

  // Work in the face plane so touching a stud's tip or side gives the same
  // target. Every candidate must mate to the connector under the pointer.
  const faceNormal = visible[0].normal;
  const inPlane = (v: Vec3) => sub(v, mul(faceNormal, dot(v, faceNormal)));
  const planeDistance = (a: Vec3, b: Vec3) => distance(inPlane(a), inPlane(b));
  const average = (points: Vec3[]) => mul(points.reduce(add, { x: 0, y: 0, z: 0 }), 1 / points.length);
  const mateCenter = average(mates.map((p) => p.point));
  const desired = point;
  const anchors = visible.map((port) => ({ port, distance: planeDistance(port.point, point) }))
    .sort((a, b) => a.distance - b.distance);
  const anchor = anchors[0].port;
  const candidates = new Map<string, { brick: Brick; score: number }>();
  for (const mate of mates) {
    const delta = sub(anchor.point, mate.point);
    const brick = { ...seed, x: gridPrecision(delta.x), y: gridPrecision(delta.y), z: gridPrecision(delta.z) };
    if (brick.y < -.012) continue;
    const key = `${brick.x}:${brick.y}:${brick.z}`;
    if (!candidates.has(key)) candidates.set(key, { brick, score: planeDistance(add(mateCenter, brick), desired) });
  }
  const ranked = [...candidates.values()].sort((a, b) => a.score - b.score || a.brick.x - b.brick.x || a.brick.y - b.brick.y || a.brick.z - b.brick.z);
  if (!ranked.length) return null;
  // A long brick may need a substantial overhang to clear adjacent rows.
  // Every candidate still mates to the exact hovered anchor; a valid nearby
  // stud is not a substitute for the stud the user actually targeted.
  const preferred = options.preferred;
  // Small hysteresis prevents pointer jitter from flipping between grid cells.
  if (preferred && orientationSignature(preferred) === orientationSignature(orientation)) {
    const held = ranked.find(({ brick, score }) => distance(brick, preferred) < 1e-5 && score <= ranked[0].score + .16);
    if (held && (!options.accept || options.accept(held.brick))) return held.brick;
  }
  return ranked.find(({ brick }) => !options.accept || options.accept(brick))?.brick ?? ranked[0].brick;
}
