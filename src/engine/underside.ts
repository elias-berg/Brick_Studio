import type { Shape, Vec3 } from "./types";
import { PLATE } from "./parts";

export interface BodyBox { center: Vec3; size: Vec3 }
export interface BodyRing { x: number; z: number; bottom: number; top: number; outer: number; inner: number }
export interface BodyFace { vertices: Vec3[]; normal: Vec3 }
export interface BodyDefinition {
  boxes: BodyBox[];
  rings: BodyRing[];
  faces: BodyFace[];
  cavity: { roof: number; wall: number } | null;
}
const cache = new Map<string, BodyDefinition>();
const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
/** Standard family undersides, in stud units. This is not a mould-detail model. */
export function bodyDefinition(shape: Shape): BodyDefinition {
  const key = `${shape.kind}:${shape.width}:${shape.depth}:${shape.height}`;
  const saved = cache.get(key);
  if (saved) return saved;
  const result: BodyDefinition = { boxes: [], rings: [], faces: [], cavity: null };
  const { boxes, rings, faces } = result;
  const h = shape.height * PLATE, w = shape.width - .02, d = shape.depth - .02;
  const wall = .19, roof = Math.min(.2, h / 2), ceiling = h - roof;
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => boxes.push({ center: v(x, y, z), size: v(sx, sy, sz) });
  // Orient quads explicitly so inner walls render and raycast from the cavity.
  const face = (vertices: Vec3[], normal: Vec3) => {
    const [a,b,c] = vertices;
    const ab = v(b.x-a.x,b.y-a.y,b.z-a.z), ac = v(c.x-a.x,c.y-a.y,c.z-a.z);
    const cross = v(ab.y*ac.z-ab.z*ac.y,ab.z*ac.x-ab.x*ac.z,ab.x*ac.y-ab.y*ac.x);
    if (cross.x*normal.x+cross.y*normal.y+cross.z*normal.z < 0) vertices.reverse();
    faces.push({ vertices, normal });
  };
  const horizontal = (x0:number,x1:number,z0:number,z1:number,y:number,up:number) => face([v(x0,y,z0),v(x1,y,z0),v(x1,y,z1),v(x0,y,z1)],v(0,up,0));
  const xwall = (x:number,z0:number,z1:number,y0:number,y1:number,n:number) => face([v(x,y0,z0),v(x,y1,z0),v(x,y1,z1),v(x,y0,z1)],v(n,0,0));
  const zwall = (z:number,x0:number,x1:number,y0:number,y1:number,n:number) => face([v(x0,y0,z),v(x0,y1,z),v(x1,y1,z),v(x1,y0,z)],v(0,0,n));
  const ring = (r: BodyRing) => {
    rings.push(r);
    const segments = 24;
    for (let i=0;i<segments;i++) {
      const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments,mid=(a+b)/2;
      const p=(radius:number,angle:number,y:number)=>v(r.x+radius*Math.cos(angle),y,r.z+radius*Math.sin(angle));
      const radial=v(Math.cos(mid),0,Math.sin(mid));
      face([p(r.outer,a,r.bottom),p(r.outer,b,r.bottom),p(r.outer,b,r.top),p(r.outer,a,r.top)],radial);
      if(r.inner>0) face([p(r.inner,a,r.bottom),p(r.inner,b,r.bottom),p(r.inner,b,r.top),p(r.inner,a,r.top)],v(-radial.x,0,-radial.z));
      for(const [y,n] of [[r.bottom,-1],[r.top,1]]) face([p(r.inner,a,y),p(r.outer,a,y),p(r.outer,b,y),p(r.inner,b,y)],v(0,n,0));
    }
  };
  if(shape.kind === "round") {
    result.cavity={roof,wall:.19};
    ring({x:0,z:0,bottom:0,top:ceiling,outer:.49,inner:.3});
    ring({x:0,z:0,bottom:ceiling,top:h,outer:.49,inner:0});
  } else {
    const x=w/2,z=d/2;
    horizontal(-x,x,-z,z,h,1);
    xwall(-x,-z,z,0,h,-1);xwall(x,-z,z,0,h,1);
    zwall(-z,-x,x,0,h,-1);zwall(z,-x,x,0,h,1);
    if(shape.kind === "baseplate") {
      horizontal(-x,x,-z,z,0,-1);box(0,h/2,0,w,h,d);
    } else {
      result.cavity={roof,wall};
      const ix=x-wall,iz=z-wall;
      horizontal(-ix,ix,-iz,iz,ceiling,-1);
      xwall(-ix,-iz,iz,0,ceiling,1);xwall(ix,-iz,iz,0,ceiling,-1);
      zwall(-iz,-ix,ix,0,ceiling,1);zwall(iz,-ix,ix,0,ceiling,-1);
      horizontal(-x,-ix,-z,z,0,-1);horizontal(ix,x,-z,z,0,-1);
      horizontal(-ix,ix,-z,-iz,0,-1);horizontal(-ix,ix,iz,z,0,-1);
      box(0,h-roof/2,0,w,roof,d);
      box(-x+wall/2,ceiling/2,0,wall,ceiling,d);box(x-wall/2,ceiling/2,0,wall,ceiling,d);
      box(0,ceiling/2,-z+wall/2,2*ix,ceiling,wall);box(0,ceiling/2,z-wall/2,2*ix,ceiling,wall);
      if(shape.width>1 && shape.depth>1) {
        for(let i=1;i<shape.width;i++) for(let j=1;j<shape.depth;j++) ring({x:i-shape.width/2,z:j-shape.depth/2,bottom:0,top:ceiling,outer:.4,inner:.3});
      } else {
        const alongX=shape.width>1, count=Math.max(shape.width,shape.depth);
        for(let i=1;i<count;i++) ring({x:alongX?i-count/2:0,z:alongX?0:i-count/2,bottom:0,top:ceiling,outer:.2,inner:0});
      }
    }
  }
  cache.set(key,result);
  return result;
}
