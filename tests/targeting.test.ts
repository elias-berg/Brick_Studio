import test from "node:test";
import assert from "node:assert/strict";
import { brick, engine } from "./support/engine";
import { shapeFor } from "../src/engine/parts";
import { snapToConnection } from "../src/engine/targeting";
import { compatibleConnectors, distance, orientationSignature } from "../src/engine/spatial";

// A valid neighboring stud must never win over the stud under the mouse.
test("hovered anchor wins over validity and previous-preview hysteresis", () => {
  const support = brick("support", "3001");
  const wide = shapeFor({ id: "3001", name: "Brick 2 x 4", category: 11 })!;
  const small = shapeFor({ id: "3005", name: "Brick 1 x 1", category: 11 })!;
  const normal = { x: 0, y: 1, z: 0 };
  const preferred = brick("preview", "3005", .5, 1.2, -.5);
  for (const jitter of [-.2, 0, .2]) {
    const snap = snapToConnection({ x: -.5 + jitter, y: 1.2, z: -.5 }, normal, support, small, { rotation: 0 }, wide, {
      preferred, accept: b => b.x > 0,
    });
    assert(snap); assert.equal(snap.x, -.5); assert.equal(snap.z, -.5);
  }
  const right = snapToConnection({ x: .5, y: 1.2, z: -.5 }, normal, support, small, { rotation: 0 }, wide, { accept: b => b.x > 0 });
  assert(right); assert.equal(right.x, .5);
});

test("every direct stud target remains engaged in all 24 orientations", () => {
  const seen = new Set<string>(); let targets = 0;
  for (const rotationX of [0,90,180,270]) for (const rotation of [0,90,180,270]) for (const rotationZ of [0,90,180,270]) {
    const pose = { rotation, rotationX, rotationZ }, signature = orientationSignature(pose);
    if (seen.has(signature)) continue;
    seen.add(signature);
    const support = brick("support", "3001", 0, 8, 0, pose);
    for (const stud of engine.ports(support).filter(p => p.kind === "stud")) {
      const snap = engine.snap(stud.point, stud.normal, support, "3005", pose);
      assert(snap);
      assert(engine.ports(snap).some(p => compatibleConnectors(stud, p) && distance(stud.point, p.point) < 1e-5));
      targets++;
    }
  }
  assert.equal(targets, 192);
});
