import test from "node:test";
import assert from "node:assert/strict";
import { brick, engine } from "./support/engine";
import { distance } from "../src/engine/spatial";

test("a 2x2 brick can clutch a single stud through its center underside tube", () => {
  const source = brick("source", "3005");
  const centered = brick("receiver", "3003", 0, 1.2, 0);
  assert.equal(engine.validate(centered, [source]), "");
  assert(engine.connected(source, centered));
  assert.equal(engine.grounded([source, centered]).size, 2);
});

test("underside tube connections work sideways on both side-stud families", () => {
  for (const [source, receiver, point, normal] of [
    [brick("source", "87087", 0, 2), brick("receiver", "3003", 0, 1.7, 1.1, { rotation: 0, rotationX: 90 }), { x: 0, y: 2.7, z: .5 }, { x: 0, y: 0, z: 1 }],
    [brick("source", "11211", 0, 2), brick("receiver", "3001", 1.1, 1.7, .5, { rotation: 0, rotationZ: 270 }), { x: .5, y: 2.7, z: -.5 }, { x: 1, y: 0, z: 0 }],
  ] as const) {
    assert.equal(engine.validate(receiver, [source], false), "");
    assert(engine.connected(source, receiver));
    assert.equal(engine.validate(source, [receiver], false), "");
    const snap = engine.snap(point, normal, source, receiver.partId, receiver);
    assert(snap); assert.equal(engine.validate(snap, [source], false), "");
    assert(engine.ports(receiver).some(port => port.kind === "socket" && distance(port.point, point) < 1e-6));
  }
});

test("an off-center tube attachment still rejects tube walls and reversed polarity", () => {
  const source = brick("source", "3005");
  const centered = brick("receiver", "3003", 0, 1.2, 0);
  assert.notEqual(engine.validate({ ...centered, x: .2 }, [source]), "");
  assert.notEqual(engine.validate({ ...centered, y: 1.1 }, [source]), "");
  const sideways = brick("sideways", "3003", 0, .2, 1.1, { rotation: 0, rotationX: 90 });
  assert(!engine.connected(source, sideways));
});

test("the interactive side-connection example loads as a fully grounded assembly", async () => {
  const { readFile } = await import("node:fs/promises");
  const example = JSON.parse(await readFile(new URL("../examples/side-connections.brick.json", import.meta.url), "utf8"));
  for (const piece of example.bricks) assert.equal(engine.validate(piece, example.bricks), "", piece.id);
  assert.equal(engine.grounded(example.bricks).size, example.bricks.length);
});
