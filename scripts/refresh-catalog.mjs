// Public Rebrickable bulk data. No API key or backend required.
import { gunzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
const base = "https://cdn.rebrickable.com/media/downloads/";
function csv(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(field.replace(/\r$/, ""));
      field = "";
      if (c === "\n") {
        rows.push(row);
        row = [];
      }
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift();
  return rows
    .filter((r) => r.length === headers.length)
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}
const [parts, colors, categories, elements] = await Promise.all(
  ["parts", "colors", "part_categories", "elements"].map(async (name) => {
    const res = await fetch(`${base}${name}.csv.gz`);
    if (!res.ok) throw new Error(`${name}: ${res.status}`);
    return csv(
      gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8"),
    );
  }),
);
await mkdir("public/data", { recursive: true });
await writeFile(
  "public/data/catalog.json",
  JSON.stringify({
    fetched: new Date().toISOString(),
    source: "https://rebrickable.com/downloads/",
    parts: parts.map((p) => ({
      id: p.part_num,
      name: p.name,
      category: Number(p.part_cat_id),
    })),
    colors: colors
      .filter((c) => Number(c.id) >= 0 && !c.name.startsWith("["))
      .map((c) => ({
        id: Number(c.id),
        name: c.name,
        rgb: c.rgb,
        transparent: c.is_trans === "True",
      })),
    categories: categories.map((c) => ({ id: Number(c.id), name: c.name })),
  }),
);
console.log(`Saved ${parts.length} parts and ${colors.length} colors.`);

// A LEGO element ID identifies a particular part/color combination. Never derive
// it by concatenating a Rebrickable part number and color ID.
const elementPairs = {};
for (const row of elements) {
  if (!/^\d+$/.test(row.element_id)) continue;
  const key = `${row.part_num}:${row.color_id}`;
  (elementPairs[key] ??= []).push(row);
}
const pairs = Object.fromEntries(
  Object.entries(elementPairs).map(([key, rows]) => {
    // Explicit design mappings first; alternatives remain selectable in the UI.
    rows.sort(
      (a, b) =>
        Number(Boolean(b.design_id)) - Number(Boolean(a.design_id)) ||
        Number(b.element_id) - Number(a.element_id),
    );
    return [key, [...new Set(rows.map((row) => row.element_id))]];
  }),
);
await writeFile(
  "public/data/elements.json",
  JSON.stringify({
    fetched: new Date().toISOString(),
    source: "https://rebrickable.com/downloads/",
    pairs,
  }),
);
console.log(
  `Saved LEGO element mappings for ${Object.keys(pairs).length} part/color pairs.`,
);
