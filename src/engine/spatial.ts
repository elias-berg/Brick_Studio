import { bodyDefinition } from "./underside";
import type { Brick, LocalConnector, Shape, Vec3 } from "./types";
import { PLATE, STUD_HEIGHT, STUD_RADIUS } from "./parts";
export type Orientation = Pick<Brick, "rotation" | "rotationX" | "rotationZ">;
export const zeroRotation: Orientation = { rotation: 0, rotationX: 0, rotationZ: 0 };
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a: Vec3, n: number): Vec3 => ({ x: a.x * n, y: a.y * n, z: a.z * n });
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const length = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
export const unit = (a: Vec3) => mul(a, 1 / length(a));
export const distance = (a: Vec3, b: Vec3) => length(sub(a, b));
export const quarter = (angle: number) => ((Math.round(angle / 90) * 90 % 360) + 360) % 360;
/** Same XYZ Euler convention as Three.js: apply Z, then Y, then X. */
export function rotate(p: Vec3, orientation: Orientation): Vec3 {
  let { x, y, z } = p;
  const angle = (degrees: number) => degrees * Math.PI / 180;
  let c = Math.cos(angle(orientation.rotationZ ?? 0)), s = Math.sin(angle(orientation.rotationZ ?? 0));
  [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(angle(orientation.rotation)); s = Math.sin(angle(orientation.rotation));
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(angle(orientation.rotationX ?? 0)); s = Math.sin(angle(orientation.rotationX ?? 0));
  [y, z] = [y * c - z * s, y * s + z * c];
  const clean = (n: number) => Math.abs(n) < 1e-10 ? 0 : n;
  return { x: clean(x), y: clean(y), z: clean(z) };
}
export function orientationSignature(orientation: Orientation) {
  return [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }].flatMap((p) => Object.values(rotate(p, orientation)).map((n) => Math.round(n * 1e6))).join(",");
}
const canonical = new Map<string, Orientation>();
for (const rotationX of [0, 90, 180, 270]) for (const rotation of [0, 90, 180, 270]) for (const rotationZ of [0, 90, 180, 270]) {
  const value = { rotationX, rotation, rotationZ }, key = orientationSignature(value);
  if (!canonical.has(key)) canonical.set(key, value);
}
export function canonicalOrientation(orientation: Orientation): Orientation {
  return canonical.get(orientationSignature(orientation)) ?? orientation;
}
const connectorCache = new Map<string, LocalConnector[]>();
const liftCache = new Map<string, number>();
const shapeSignature = (s: Shape) => `${s.kind}:${s.width}:${s.depth}:${s.height}:${s.studs}:${JSON.stringify(s.sideStuds ?? [])}`;
export function localConnectors(shape: Shape): LocalConnector[] {
  const key = shapeSignature(shape);
  const existing = connectorCache.get(key);
  if (existing) return existing;
  const result: LocalConnector[] = [];
  for (let x = 0; x < shape.width; x++) for (let z = 0; z < shape.depth; z++) {
    const point = { x: x - (shape.width - 1) / 2, y: 0, z: z - (shape.depth - 1) / 2 };
    if (shape.studs) result.push({ point: { ...point, y: shape.height * PLATE }, normal: { x: 0, y: 1, z: 0 }, kind: "stud" });
    if (bodyDefinition(shape).cavity) result.push({ point, normal: { x: 0, y: -1, z: 0 }, kind: "socket" });
  }
  // Open underside tubes are clutch locations too, between the regular stud
  // cells. A stud can enter their bore (a half-stud offset on both axes).
  // Keep rendering/collision/connection locations derived from the same body.
  for (const ring of bodyDefinition(shape).rings) {
    if (ring.inner < STUD_RADIUS || ring.bottom !== 0) continue;
    const point = { x: ring.x, y: 0, z: ring.z };
    if (!result.some(port => port.kind === "socket" && distance(port.point, point) < 1e-8))
      result.push({ point, normal: { x: 0, y: -1, z: 0 }, kind: "socket" });
  }
  for (const stud of shape.sideStuds ?? []) result.push({ ...stud, kind: "stud" });
  connectorCache.set(key, result);
  return result;
}
export function bodyCorners(shape: Shape): Vec3[] {
  return [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => ({ x: x * shape.width / 2, y: y * shape.height * PLATE / 2, z: z * shape.depth / 2 }))));
}
/** Keep y as the lowest physical extent, including downward-facing studs. */
export function lift(shape: Shape, orientation: Orientation) {
  const key = `${shapeSignature(shape)}:${orientationSignature(orientation)}`;
  const existing = liftCache.get(key);
  if (existing !== undefined) return existing;
  let low = Math.min(...bodyCorners(shape).map((p) => rotate(p, orientation).y));
  for (const port of localConnectors(shape)) if (port.kind === "stud") {
    const normal = rotate(port.normal, orientation);
    const base = rotate(sub(port.point, { x: 0, y: shape.height * PLATE / 2, z: 0 }), orientation);
    low = Math.min(low, base.y + Math.min(0, normal.y * STUD_HEIGHT) - STUD_RADIUS * Math.sqrt(Math.max(0, 1 - normal.y ** 2)));
  }
  liftCache.set(key, -low);
  return -low;
}
export function frame(shape: Shape, brick: Brick) {
  const offset = { x: brick.x, y: brick.y + lift(shape, brick), z: brick.z };
  return {
    point: (p: Vec3) => add(rotate(sub(p, { x: 0, y: shape.height * PLATE / 2, z: 0 }), brick), offset),
    normal: (n: Vec3) => rotate(n, brick),
  };
}
/** Stud/socket pairs mate only when their outward directions oppose. */
export function compatibleConnectors(a: LocalConnector, b: LocalConnector) {
  return a.kind !== b.kind && dot(a.normal, b.normal) < -.999;
}
export function worldConnectors(brick: Brick, shape: Shape) {
  const transform = frame(shape, brick);
  return localConnectors(shape).map((port) => ({ ...port, point: transform.point(port.point), normal: transform.normal(port.normal) }));
}
export function bounds(points: Vec3[]) {
  return { min: { x: Math.min(...points.map((p) => p.x)), y: Math.min(...points.map((p) => p.y)), z: Math.min(...points.map((p) => p.z)) }, max: { x: Math.max(...points.map((p) => p.x)), y: Math.max(...points.map((p) => p.y)), z: Math.max(...points.map((p) => p.z)) } };
}
export function bodyBounds(brick: Brick, shape: Shape) {
  const transform = frame(shape, brick);
  return bounds(bodyCorners(shape).map((p) => transform.point(add(p, { x: 0, y: shape.height * PLATE / 2, z: 0 }))));
}
