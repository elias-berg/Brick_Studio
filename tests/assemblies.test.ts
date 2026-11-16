import test from "node:test";
import assert from "node:assert/strict";
import {brick,engine} from "./support/engine";

const faceZ={rotation:0,rotationX:90};
const faceX={rotation:0,rotationX:270,rotationZ:270};

test("side chain builds repeatedly outward and loses support recursively",()=>{
  const source=brick("root","87087"), chain=[source];
  for(const [i,z] of [.7,1.1,1.5,1.9].entries()){
    const piece=brick(`plate${i}`,"3024",0,.2,z,faceZ);
    assert.equal(engine.validate(piece,chain),"");chain.push(piece);
  }
  assert.equal(engine.grounded(chain).size,5);
  assert.deepEqual(new Set(engine.cascade("root",chain)),new Set(chain.map(b=>b.id)));
  assert.deepEqual(new Set(engine.cascade("plate1",chain)),new Set(["plate1","plate2","plate3"]));
});

test("a side bridge keeps its alternate path to ground after one support is removed",()=>{
  const left=brick("left","87087"),right=brick("right","87087",1);
  const bridge=brick("bridge","3022",.5,.2,.7,faceZ);
  assert.equal(engine.validate(bridge,[left,right]),"");
  assert.deepEqual(engine.cascade("left",[left,right,bridge]),["left"]);
  assert.equal(engine.grounded([right,bridge]).size,2);
});

test("a brick can hang below an underside when the component stays grounded",()=>{
  const root=brick("root","3005"),column=brick("column","3005",0,1.2);
  const ceiling=brick("ceiling","3020",.5,2.4,.5),hanging=brick("hanging","3005",1,1.2,1);
  assert.equal(engine.validate(column,[root]),"");
  assert.equal(engine.validate(ceiling,[root,column]),"");
  assert.equal(engine.validate(hanging,[root,column,ceiling]),"");
  assert.deepEqual(new Set(engine.cascade("ceiling",[root,column,ceiling,hanging])),new Set(["ceiling","hanging"]));
});

test("unsupported islands stay rejected unless floating is enabled",()=>{
  const floating=brick("floating","87087",0,4);
  const attached=brick("attached","3024",0,4.2,.7,faceZ);
  assert.notEqual(engine.validate(attached,[floating]),"");
  assert.equal(engine.validate(attached,[floating],false),"");
  assert.equal(engine.grounded([floating,attached]).size,0);
});

test("stacked side rows cannot both engage a tipped 1-stud socket grid",()=>{
  const lower=brick("lower","11211"),upper=brick("upper","11211",0,1.2);
  for(const y of [.2,.4]){
    const held=brick("preview","3001",1.1,y,0,faceX);
    assert.notEqual(engine.validate(held,[lower,upper]),"");
    const conflicts=engine.conflicts(held,[lower,upper]);
    assert.equal(conflicts.length,2);
    assert(conflicts.every(c=>c.sourceId===(y===.2?"upper":"lower")));
  }
  const clear=brick("clear","3001",1.1,1.4,0,faceX);
  assert.equal(engine.validate(clear,[lower,upper]),"");
  assert.equal(engine.conflicts(clear,[lower,upper]).length,0);
});

test("auto can overhang the pointed stud to clear lower rows",()=>{
  const lower=brick("lower","11211"),upper=brick("upper","11211",0,1.2);
  const snapped=engine.snap({x:.5,y:1.75,z:-.5},{x:1,y:0,z:0},upper,"3001",faceX,[lower,upper]);
  assert(snapped);assert.equal(engine.validate(snapped,[lower,upper]),"");
  assert.equal(snapped.y,1.4);
  assert(engine.connected(upper,snapped));
});
