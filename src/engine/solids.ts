import { bodyDefinition } from "./underside";
import type { Brick, Shape, Vec3 } from "./types";
import { PLATE, STUD_HEIGHT, STUD_RADIUS } from "./parts";
import { add, sub, mul, dot, cross, unit, length, bounds, frame } from "./spatial";
export interface Solid {
  vertices: Vec3[]; faces: number[][]; normals: Vec3[]; edges: Vec3[];
  bounds: ReturnType<typeof bounds>;
}
function uniqueAxes(axes: Vec3[]) {
  const result: Vec3[] = [];
  for (const axis of axes) if (length(axis) > 1e-8) {
    const n = unit(axis);
    if (!result.some((a) => Math.abs(dot(a, n)) > 1 - 1e-7)) result.push(n);
  }
  return result;
}
export function solid(vertices: Vec3[], faces: number[][]): Solid {
  const center = mul(vertices.reduce(add, { x: 0, y: 0, z: 0 }), 1 / vertices.length);
  const normals: Vec3[] = [], edges: Vec3[] = [];
  faces = faces.map((indices) => {
    const normal = cross(sub(vertices[indices[1]], vertices[indices[0]]), sub(vertices[indices[2]], vertices[indices[0]]));
    const faceCenter = mul(indices.map((i) => vertices[i]).reduce(add, { x: 0, y: 0, z: 0 }), 1 / indices.length);
    if (dot(normal, sub(faceCenter, center)) < 0) indices = [...indices].reverse();
    normals.push(unit(cross(sub(vertices[indices[1]], vertices[indices[0]]), sub(vertices[indices[2]], vertices[indices[0]]))));
    indices.forEach((index, i) => edges.push(sub(vertices[indices[(i + 1) % indices.length]], vertices[index])));
    return indices;
  });
  return { vertices, faces, normals, edges: uniqueAxes(edges), bounds: bounds(vertices) };
}
export function boxSolid(width: number, height: number, depth: number, point: (p: Vec3) => Vec3): Solid {
  const vertices = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => point({ x: x * width / 2, y: y * height / 2, z: z * depth / 2 }))));
  return solid(vertices, [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]]);
}
export function cylinderSolid(base: Vec3, normal: Vec3, radius: number, height: number, segments = 24): Solid {
  const u = unit(cross(normal, Math.abs(normal.y) < .9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }));
  const v = cross(normal, u);
  const vertices = [0, height].flatMap((y) => Array.from({ length: segments }, (_, i) => {
    const angle = i * Math.PI * 2 / segments;
    return add(add(base, mul(normal, y)), add(mul(u, Math.cos(angle) * radius), mul(v, Math.sin(angle) * radius)));
  }));
  const faces = [Array.from({ length: segments }, (_, i) => i), Array.from({ length: segments }, (_, i) => i + segments)];
  for (let i = 0; i < segments; i++) { const j = (i + 1) % segments; faces.push([i, j, j + segments, i + segments]); }
  return solid(vertices, faces);
}
export function bodySolid(brick: Brick, shape: Shape, collision = false) {
  const transform = frame(shape, brick);
  if (shape.kind === "round") return cylinderSolid(transform.point({ x: 0, y: 0, z: 0 }), transform.normal({ x: 0, y: 1, z: 0 }), .49 / (collision ? Math.cos(Math.PI / 24) : 1), shape.height * PLATE);
  return boxSolid(shape.width - (collision ? .02 : 0), shape.height * PLATE, shape.depth - (collision ? .02 : 0), (p) => transform.point(add(p, { x: 0, y: shape.height * PLATE / 2, z: 0 })));
}
/** Convex material pieces preserve the cavity; the outer body remains a broad phase. */
export function bodyMaterialSolids(brick: Brick, shape: Shape): Solid[] {
  const { boxes, rings } = bodyDefinition(shape), transform = frame(shape, brick);
  const result = boxes.map(({center,size}) => boxSolid(size.x,size.y,size.z,p=>transform.point(add(p,center))));
  const segments=16;
  for(const ring of rings) {
    if(!ring.inner) {
      result.push(cylinderSolid(transform.point({x:ring.x,y:ring.bottom,z:ring.z}),transform.normal({x:0,y:1,z:0}),ring.outer,ring.top-ring.bottom,segments));
      continue;
    }
    for(let i=0;i<segments;i++) {
      const angles=[i*Math.PI*2/segments,(i+1)*Math.PI*2/segments];
      const vertices=[ring.bottom,ring.top].flatMap(y=>[ring.inner,ring.outer].flatMap(r=>angles.map(a=>transform.point({x:ring.x+r*Math.cos(a),y,z:ring.z+r*Math.sin(a)}))));
      result.push(solid(vertices,[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]]));
    }
  }
  return result;
}
export function studBounds(point: Vec3, normal: Vec3) {
  const end = add(point, mul(normal, STUD_HEIGHT));
  const min = { ...point }, max = { ...point };
  for (const axis of ["x", "y", "z"] as const) {
    const radius = STUD_RADIUS * Math.sqrt(Math.max(0, 1 - normal[axis] ** 2));
    min[axis] = Math.min(point[axis], end[axis]) - radius;
    max[axis] = Math.max(point[axis], end[axis]) + radius;
  }
  return { min, max };
}
export function boxesOverlap(a: Solid["bounds"], b: Solid["bounds"], epsilon = .012) {
  return (["x", "y", "z"] as const).every((axis) => a.min[axis] < b.max[axis] - epsilon && a.max[axis] > b.min[axis] + epsilon);
}
/** Convex SAT covers tilted boxes and circular prisms, including legacy yaw. */
export function solidsOverlap(a: Solid, b: Solid) {
  if (!boxesOverlap(a.bounds, b.bounds)) return false;
  const axes = uniqueAxes([...a.normals, ...b.normals, ...a.edges.flatMap((edge) => b.edges.map((other) => cross(edge, other)))]);
  return axes.every((axis) => {
    const pa = a.vertices.map((p) => dot(p, axis)), pb = b.vertices.map((p) => dot(p, axis));
    return Math.max(...pa) > Math.min(...pb) + .012 && Math.max(...pb) > Math.min(...pa) + .012;
  });
}
