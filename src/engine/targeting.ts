import type { Intersection, Object3D } from "three";
import type { Brick, Part } from "./types";
import { shapeOf, connectors, rotatePoint } from "./physics";

/** Prefer the top of the visible brick, never an occluded brick behind it. */
export function buildSurfaceHit(hits: Intersection<Object3D>[]) {
  const first = hits[0];
  if (!first) return undefined;
  return hits.find((hit) => hit.object.userData.brickId === first.object.userData.brickId && hit.face && hit.face.normal.y >= 0.5) ?? first;
}

/** Center magnet for similarly sized pieces; edge targeting still allows offsets. */
export function centeredStudSnap(point: { x: number; z: number }, support: Brick, selected: import("./types").Shape, rotation: number, parts: Map<string, Part>) {
  const shape = shapeOf(support, parts);
  const rotatedSize = (width: number, depth: number, angle: number) => Math.round(angle / 90) % 2 === 0 ? [width, depth] : [depth, width];
  const [sw, sd] = rotatedSize(shape.width, shape.depth, support.rotation);
  const [pw, pd] = rotatedSize(selected.width, selected.depth, rotation);
  if (Math.abs(sw - pw) > 1 || Math.abs(sd - pd) > 1 || Math.abs(point.x - support.x) > 0.75 || Math.abs(point.z - support.z) > 0.75) return null;
  const supportStud = connectors(support, shape)[0];
  const socket = rotatePoint(-(selected.width - 1) / 2, -(selected.depth - 1) / 2, rotation);
  const phaseX = supportStud.x - socket.x, phaseZ = supportStud.z - socket.z;
  return { x: Math.round(support.x - phaseX) + phaseX, z: Math.round(support.z - phaseZ) + phaseZ };
}
