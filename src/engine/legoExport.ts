import type { Brick } from "./types";
import { inventory } from "./physics";

export interface ElementIndex {
  fetched: string;
  source: string;
  pairs: Record<string, string[]>;
}
export interface LegoItem {
  elementId: string;
  quantity: number;
}
export const elementKey = (partId: string, colorId: number) =>
  `${partId}:${colorId}`;
export const isElementId = (id: string) =>
  /^\d{1,10}$/.test(id) && Number(id) > 0;
let pending: Promise<ElementIndex> | undefined;
export function loadElementIndex(): Promise<ElementIndex> {
  pending ??= fetch("/data/elements.json")
    .then(async (response) => {
      if (!response.ok) throw Error("Could not load LEGO element IDs.");
      const data = await response.json();
      if (!data.pairs || typeof data.pairs !== "object")
        throw Error("Invalid element-ID catalog.");
      return data as ElementIndex;
    })
    .catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}

export function resolveLegoList(
  bricks: Brick[],
  index: ElementIndex,
  choices: Record<string, string>,
) {
  const rows = new Map<string, LegoItem>();
  const missing: string[] = [];
  for (const group of inventory(bricks)) {
    const key = elementKey(group.partId, group.colorId);
    const elementId = (choices[key] ?? index.pairs[key]?.[0] ?? "").trim();
    if (!isElementId(elementId)) {
      missing.push(key);
      continue;
    }
    const existing = rows.get(elementId);
    if (existing) existing.quantity += group.quantity;
    else rows.set(elementId, { elementId, quantity: group.quantity });
  }
  return { rows: [...rows.values()], missing };
}
// Match the user's official LEGO templates exactly: no inventory columns,
// Rebrickable IDs, wrapper object, BOM or numeric coercion of elementId strings.
export function legoCsv(rows: LegoItem[]) {
  return [
    "elementId,quantity",
    ...rows.map((row) => `${row.elementId},${row.quantity}`),
  ].join("\r\n");
}
export function legoJson(rows: LegoItem[]) {
  return JSON.stringify(rows, null, 2);
}
// Conservative file size across country-specific LEGO upload limits.
export const LEGO_BATCH_SIZE = 200;
export function legoBatches(rows: LegoItem[]) {
  return Array.from(
    { length: Math.ceil(rows.length / LEGO_BATCH_SIZE) },
    (_, i) => rows.slice(i * LEGO_BATCH_SIZE, (i + 1) * LEGO_BATCH_SIZE),
  );
}

// Explicit alternatives only: different molds are never silently exported as the original.
export function replacementPairs(partId: string, colorId: number, index: ElementIndex, catalog: import("./types").Catalog) {
  const alternatives: { partId: string; colorId: number; label: string }[] = [];
  if (partId === "3062a" && index.pairs[elementKey("3062b", colorId)]?.length) {
    alternatives.push({ partId: "3062b", colorId, label: "Use open-stud round brick · same color" });
  }
  for (const color of [...catalog.colors].sort((a, b) => a.name.localeCompare(b.name))) {
    if (color.id !== colorId && index.pairs[elementKey(partId, color.id)]?.length) {
      alternatives.push({ partId, colorId: color.id, label: `Use ${color.name} · same part` });
    }
  }
  return alternatives;
}
