import { bodyDefinition } from "./underside";
import type { Brick, Shape, Vec3 } from "./types";
import { bodySolid, cylinderSolid } from "./solids";
import { worldConnectors, dot, add, mul, frame, distance } from "./spatial";
import { STUD_HEIGHT, STUD_RADIUS } from "./parts";
import { thumbnailPalette } from "./thumbnailAssets";

/** Project the same oriented bodies/connectors as the editor, without WebGL. */
export function thumbnail3d(shape: Shape, color: string, orientation: Pick<Brick, "rotation" | "rotationX" | "rotationZ">) {
  const brick: Brick = { id: "thumbnail", partId: "", colorId: 0, x: 0, y: 0, z: 0, ...orientation };
  const body = bodySolid(brick, shape);
  const ports = worldConnectors(brick, shape).filter((p) => p.kind === "stud");
  const camera = { x: 1, y: 1.3, z: 1 };
  const project = (p: Vec3) => ({ x: (p.x - p.z) * .7071, y: (p.x + p.z) * .4 - p.y });
  const palette = thumbnailPalette(color);
  const defs: string[] = [], items: { depth: number; svg: string }[] = [];
  const symbolIds = new Map<string, string>();
  const points = (vertices: Vec3[]) => vertices.map((v) => { const p = project(v); return `${p.x},${p.y}`; }).join(" ");
  const faceColor = (n: Vec3) => n.y > .5 ? palette.studTop : n.x > .5 ? palette.side : palette.base;
  const faces = (solid: ReturnType<typeof bodySolid>) => solid.faces.flatMap((indices, i) => {
    const normal = solid.normals[i];
    if (dot(normal, camera) <= 1e-6) return [];
    const vertices = indices.map((j) => solid.vertices[j]);
    const center = mul(vertices.reduce(add, { x: 0, y: 0, z: 0 }), 1 / vertices.length);
    return [{ depth: dot(center, camera), svg: `<polygon points="${points(vertices)}" fill="${faceColor(normal)}" stroke="none"/>` }];
  });
  const transform = frame(shape, brick);
  // Short surface patches keep painter ordering local around hollow supports.
  // Sorting a full-height inner ceiling as one polygon can cover nearer tubes.
  const patches = bodyDefinition(shape).faces.flatMap(face => {
    const [a,b,c,d]=face.vertices;
    const nx=Math.ceil(distance(a,b)/.25), nz=Math.ceil(distance(a,d)/.25);
    if(nx*nz<=1) return [face];
    const mix=(u:number,v:number)=>({x:(1-u)*(1-v)*a.x+u*(1-v)*b.x+u*v*c.x+(1-u)*v*d.x,y:(1-u)*(1-v)*a.y+u*(1-v)*b.y+u*v*c.y+(1-u)*v*d.y,z:(1-u)*(1-v)*a.z+u*(1-v)*b.z+u*v*c.z+(1-u)*v*d.z});
    return Array.from({length:nx},(_,i)=>Array.from({length:nz},(_,j)=>({normal:face.normal,vertices:[mix(i/nx,j/nz),mix((i+1)/nx,j/nz),mix((i+1)/nx,(j+1)/nz),mix(i/nx,(j+1)/nz)]}))).flat();
  });
  const bodyFaces = patches.flatMap(face => {
    const normal=transform.normal(face.normal);
    if(dot(normal,camera)<=1e-6) return [];
    const vertices=face.vertices.map(transform.point);
    const center=mul(vertices.reduce(add,{x:0,y:0,z:0}),1/vertices.length);
    return [{depth:dot(center,camera),svg:`<polygon points="${points(vertices)}" fill="${faceColor(normal)}" stroke="none"/>`}];
  });
  const extents = body.vertices.map(project);
  for (const port of ports) {
    // Back-facing studs are occluded by the brick's body.
    if (dot(port.normal, camera) <= 1e-6) continue;
    const key = JSON.stringify(port.normal);
    let id = symbolIds.get(key);
    if (!id) {
      id = `stud${symbolIds.size}`;
      symbolIds.set(key, id);
      const cylinder = cylinderSolid({ x: 0, y: 0, z: 0 }, port.normal, STUD_RADIUS, STUD_HEIGHT, 16);
      defs.push(`<g id="${id}">${faces(cylinder).sort((a, b) => a.depth - b.depth).map((f) => f.svg).join("")}</g>`);
    }
    const p = project(port.point);
    items.push({ depth: dot(add(port.point, mul(port.normal, STUD_HEIGHT / 2)), camera), svg: `<use href="#${id}" xlink:href="#${id}" x="${p.x}" y="${p.y}"/>` });
    for (const delta of [-STUD_RADIUS, STUD_RADIUS]) extents.push({ x: p.x + delta, y: p.y + delta - STUD_HEIGHT });
  }
  const minX = Math.min(...extents.map((p) => p.x)), maxX = Math.max(...extents.map((p) => p.x));
  const minY = Math.min(...extents.map((p) => p.y)), maxY = Math.max(...extents.map((p) => p.y));
  const scale = Math.min(82 / Math.max(.1, maxX - minX), 54 / Math.max(.1, maxY - minY));
  return `<g transform="translate(${50 - (minX + maxX) * scale / 2} ${35 - (minY + maxY) * scale / 2}) scale(${scale})" stroke="#000" stroke-opacity=".22" stroke-width="${.45 / scale}"><defs>${defs.join("")}</defs>${[...bodyFaces,...items].sort((a, b) => a.depth - b.depth).map((f) => f.svg).join("")}</g>`;
}
