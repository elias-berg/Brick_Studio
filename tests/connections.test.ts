import test from "node:test";
import assert from "node:assert/strict";
import { Euler, Vector3 } from "three";
import { brick, engine, type Pose } from "./support/engine";
import { compatibleConnectors, distance, dot, orientationSignature, rotate, sub } from "../src/engine/spatial";

const poses: Pose[] = [];
const seen = new Set<string>();
for (const rotationX of [0,90,180,270]) for (const rotation of [0,90,180,270]) for (const rotationZ of [0,90,180,270]) {
  const pose = { rotation, rotationX, rotationZ }, key = orientationSignature(pose);
  if (!seen.has(key)) { seen.add(key); poses.push(pose); }
}
const toReceiver = (normal: {x:number;y:number;z:number}) => poses.find(pose => dot(rotate({x:0,y:-1,z:0},pose),normal)<-.999)!;

// Fixed coordinates independently pin down dimensions, phases, polarity and directions.
for (const [partId, source, receiver] of [
  ["87087", brick("source","87087"), brick("receiver","3024",0,.2,.7,{rotation:0,rotationX:90})],
  ["11211", brick("source","11211"), brick("receiver","3004",1.1,.2,0,{rotation:0,rotationZ:270})],
] as const) {
  test(`${partId}: known side attachment is clear and grounded`,()=>{
    assert.equal(engine.validate(receiver,[source]),"");
    assert(engine.connected(source,receiver));
    assert.equal(engine.grounded([source,receiver]).size,2);
  });
  test(`${partId}: wrong-facing, penetrating and off-grid placements stay rejected`,()=>{
    assert.notEqual(engine.validate({...receiver,rotationX:0,rotationZ:0},[source]),"");
    const axis=partId==="87087"?"z":"x";
    assert.notEqual(engine.validate({...receiver,[axis]:receiver[axis]-.1},[source]),"");
    assert.notEqual(engine.validate({...receiver,y:receiver.y+.2},[source]),"");
  });
  test(`${partId}: board limits and below-ground rejection survive rotation`,()=>{
    assert.notEqual(engine.validate({...receiver,y:-.1},[source]),"");
    assert.notEqual(engine.validate({...receiver,x:49},[source]),"");
  });
}

test("all 64 Euler combinations agree with the renderer convention",()=>{
  for(const rotationX of [0,90,180,270])for(const rotation of [0,90,180,270])for(const rotationZ of [0,90,180,270]){
    const actual=rotate({x:.2,y:.6,z:-.5},{rotation,rotationX,rotationZ});
    const expected=new Vector3(.2,.6,-.5).applyEuler(new Euler(rotationX*Math.PI/180,rotation*Math.PI/180,rotationZ*Math.PI/180,"XYZ"));
    assert(Math.hypot(actual.x-expected.x,actual.y-expected.y,actual.z-expected.z)<1e-9);
  }
  assert.equal(poses.length,24);
});

test("side-connector matrix: sizes, 24 orientations, twists, polarity, grounding and jitter",t=>{
  const counts={flush:0,reverse:0,offGrid:0,snaps:0,grounded:0};
  const receivers=["3005","3004","3003","3001","3024","3020","3034","3070b","3062b"];
  for(const sourceId of ["87087","11211"])for(const sourcePose of poses){
    const source=brick("source",sourceId,0,20,0,sourcePose);
    const topNormal=rotate({x:0,y:1,z:0},sourcePose);
    const side=engine.ports(source).filter(p=>p.kind==="stud"&&Math.abs(dot(p.normal,topNormal))<.5);
    assert.equal(side.length,sourceId==="87087"?1:2);
    for(const anchor of side)for(const receiverId of receivers)for(const pose of poses){
      const seed=brick("receiver",receiverId,0,0,0,pose);
      // The original matrix covers the regular grid. Tube bores have separate
      // fixtures because a neighboring source stud can hit the receiver rim.
      const sockets=engine.regularSockets(seed).filter(p=>compatibleConnectors(p,anchor));
      if(!sockets.length)continue;
      const label=`${sourceId}->${receiverId} ${JSON.stringify(sourcePose)} ${JSON.stringify(pose)}`;
      for(const socket of sockets){
        const receiver={...seed,...sub(anchor.point,socket.point)};
        assert.equal(engine.validate(receiver,[source],false),"",label);counts.flush++;
        assert(engine.connected(source,receiver),label);
        assert.equal(engine.validate(source,[receiver],false),"",label);counts.reverse++;
        const shifted=Math.abs(anchor.normal.x)<.5?{...receiver,x:receiver.x+.2}:{...receiver,z:receiver.z+.2};
        assert(!engine.connected(source,shifted),label);counts.offGrid++;
        const lowered={...receiver,y:receiver.y-20};
        if(lowered.y>=0){assert.equal(engine.validate(lowered,[{...source,y:0}]),"",label);counts.grounded++;}
      }
      for(const jitter of [-.12,0,.12]){
        const point={...anchor.point,x:anchor.point.x+(Math.abs(anchor.normal.y)>.5?jitter:0),y:anchor.point.y+(Math.abs(anchor.normal.y)<.5?jitter:0)};
        const snapped=engine.snap(point,anchor.normal,source,receiverId,pose);
        assert(snapped,label);assert.equal(engine.validate(snapped,[source],false),"",label);
        assert(engine.ports(snapped).some(p=>compatibleConnectors(p,anchor)&&distance(p.point,anchor.point)<1e-5),label);counts.snaps++;
      }
    }
  }
  assert.equal(counts.flush,12096);assert.equal(counts.snaps,7776);
  t.diagnostic(JSON.stringify(counts));
});

test("reverse snapping accepts a new stud into an existing sideways underside",()=>{
  let count=0;
  for(const pose of poses){
    const support=brick("support","3001",0,20,0,pose);
    for(const socket of engine.ports(support).filter(p=>p.kind==="socket")){
      const selectedPose=toReceiver({x:-socket.normal.x,y:-socket.normal.y,z:-socket.normal.z});
      const snapped=engine.snap(socket.point,socket.normal,support,"3005",selectedPose);
      assert(snapped);assert.equal(engine.validate(snapped,[support],false),"");
      assert(engine.ports(snapped).some(p=>compatibleConnectors(p,socket)&&distance(p.point,socket.point)<1e-5));count++;
    }
  }
  assert.equal(count,264);
});

test("fractional translations preserve the side-connector phase",()=>{
  for(const shift of [{x:.1,y:.2,z:-.3},{x:-.25,y:.6,z:.75},{x:1/3,y:1.2,z:2/3}]){
    const source=brick("source","87087",shift.x,shift.y,shift.z);
    const stud=engine.ports(source).find(p=>p.kind==="stud"&&p.normal.z>.9)!;
    const snapped=engine.snap(stud.point,stud.normal,source,"3024",{rotation:0,rotationX:90});
    assert(snapped);assert.equal(engine.validate(snapped,[source],false),"");
    assert(Math.abs(snapped.y-(shift.y+.2))<1e-6);
    assert(Math.abs(snapped.z-(shift.z+.7))<1e-6);
  }
});
