import test from "node:test";
import assert from "node:assert/strict";
import { brick, engine } from "./support/engine";
import { rotate, orientationSignature, sub } from "../src/engine/spatial";

test("aligned studs may engage a socket before the two body faces touch", () => {
  const seen = new Set<string>(); let cases = 0;
  for (const rotationX of [0,90,180,270]) for (const rotation of [0,90,180,270]) for (const rotationZ of [0,90,180,270]) {
    const pose = { rotationX, rotation, rotationZ }, key = orientationSignature(pose);
    if (seen.has(key)) continue; seen.add(key);
    const source = brick("source", "3005", 0, 8, 0, pose);
    const stud = engine.ports(source).find(p => p.kind === "stud")!;
    const seed = brick("receiver", "3003", 0, 0, 0, pose);
    const socket = engine.regularSockets(seed)[0];
    const translation = sub(stud.point, socket.point);
    for (const gap of [0, .05, .1, .15]) {
      const receiver = { ...seed, x: translation.x + stud.normal.x * gap, y: translation.y + stud.normal.y * gap, z: translation.z + stud.normal.z * gap };
      assert.equal(engine.validate(receiver, [source], false), "");
      assert(engine.connected(source, receiver));
      assert.equal(engine.conflicts(receiver, [source]).length, 0);
      const tangent = rotate({ x: .2, y: 0, z: 0 }, pose);
      const shifted = { ...receiver, x: receiver.x + tangent.x, y: receiver.y + tangent.y, z: receiver.z + tangent.z };
      assert(!engine.connected(source, shifted), "axial insertion must not increase lateral tolerance");
      cases++;
    }
    for (const gap of [.21, .3]) {
      const detached = { ...seed, x: translation.x + stud.normal.x * gap, y: translation.y + stud.normal.y * gap, z: translation.z + stud.normal.z * gap };
      assert(!engine.connected(source, detached), "tips touching or separated by air cannot form a connection");
    }
  }
  assert.equal(cases, 96);
});

test("a partially inserted sideways piece is grounded and participates in deletion", () => {
  const source = brick("source", "87087");
  const receiver = brick("receiver", "3024", 0, .2, .8, { rotation: 0, rotationX: 90 });
  assert.equal(engine.validate(receiver, [source]), "");
  assert.equal(engine.grounded([source, receiver]).size, 2);
  assert.deepEqual(new Set(engine.cascade(source.id, [source, receiver])), new Set([source.id, receiver.id]));
  assert(!engine.connected(source, { ...receiver, z: .92 }));
});
