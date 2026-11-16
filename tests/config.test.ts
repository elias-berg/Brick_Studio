import test from "node:test";
import assert from "node:assert/strict";
import { gridPrecision } from "../src/engine/grid";
import { defaults, parseSettings, projectDocument } from "../src/engine/storage";
import { readUserConfig, saveUserConfig, applyUserConfig, defaultUserConfig } from "../src/engine/config";

test("removed offset-step settings are discarded from legacy data", () => {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  } });
  try {
    assert(!("offsetSteps" in parseSettings({ offsetSteps: { x: .5, y: .5, z: .25 } })));
    const values = { x: .5, y: .5, z: .25 }, settings = { ...defaults, offsetSteps: values };
    saveUserConfig(settings);
    assert(!("offsetSteps" in readUserConfig()!));
    assert(!("offsetSteps" in applyUserConfig(defaults, readUserConfig())));
    assert(!("offsetSteps" in projectDocument("test", [], settings).settings));
    assert(!("offsetSteps" in defaultUserConfig));
  } finally { Reflect.deleteProperty(globalThis, "localStorage"); }
});

test("offset arithmetic does not drift", () => {
  let offset = 0;
  for (let i = 0; i < 1000; i++) offset = gridPrecision(offset + .1);
  for (let i = 0; i < 1000; i++) offset = gridPrecision(offset - .1);
  assert.equal(offset, 0);
});
