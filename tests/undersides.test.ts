import test from "node:test";
import assert from "node:assert/strict";
import { brick, catalog } from "./support/engine";
import { shapeFor, STUD_RADIUS, STUD_HEIGHT } from "../src/engine/parts";
import { bodyDefinition } from "../src/engine/underside";
import { bodyMaterialSolids, bodySolid, cylinderSolid, solidsOverlap } from "../src/engine/solids";
import { frame } from "../src/engine/spatial";

const shape = (id: string) => shapeFor(catalog.parts.find(p => p.id === id)!)!;

test("current underside families have finite surfaces and expected tube layouts", () => {
  assert.equal(bodyDefinition(shape("3034")).rings.length, 7);
  assert.equal(bodyDefinition(shape("3001")).rings.length, 3);
  assert.equal(bodyDefinition(shape("3004")).rings.length, 1);
  assert.equal(bodyDefinition(shape("3005")).rings.length, 0);
  assert.equal(bodyDefinition(shape("3811")).cavity, null);
  let count = 0;
  for (const part of catalog.parts) {
    const s = shapeFor(part); if (!s) continue;
    const definition = bodyDefinition(s);
    assert(definition.faces.length, part.id);
    for (const face of definition.faces) for (const point of face.vertices) assert(Object.values(point).every(Number.isFinite), part.id);
    count++;
  }
  assert(count >= 98, "existing modeled parts must remain supported");
});

test("studs fit cavities and hollow tubes, but cannot pass through roofs, walls or tube material", () => {
  for (const rotationX of [0,90,180,270]) for (const rotationZ of [0,90,180,270]) {
    const s = shape("3001"), b = brick("body", "3001", 0, 5, 0, { rotation: 0, rotationX, rotationZ });
    const transform = frame(s, b), pieces = bodyMaterialSolids(b, s);
    const probe = (x: number, y: number, z: number, radius = .06, height = .1) =>
      cylinderSolid(transform.point({ x, y, z }), transform.normal({ x: 0, y: 1, z: 0 }), radius, height);
    const cavity = probe(-.5, .25, -1.5, STUD_RADIUS, STUD_HEIGHT);
    assert(solidsOverlap(cavity, bodySolid(b, s, true)), "probe must be inside outer body bounds");
    assert(!pieces.some(piece => solidsOverlap(cavity, piece)), "cavity must accept studs");
    assert(pieces.some(piece => solidsOverlap(probe(0, .25, -1, .36), piece)), "tube material must collide");
    assert(!pieces.some(piece => solidsOverlap(probe(0, .25, -1, .2), piece)), "tube center must remain hollow");
    assert(pieces.some(piece => solidsOverlap(probe(-.5, 1.05, -1.5), piece)), "roof must collide");
    assert(pieces.some(piece => solidsOverlap(probe(.9, .25, 0), piece)), "wall must collide");
  }
});
