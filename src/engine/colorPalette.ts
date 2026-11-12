import type { Color } from "./types";

const families = [
  "Neutrals",
  "Reds",
  "Oranges, browns & tans",
  "Yellows",
  "Greens",
  "Teals",
  "Blues",
  "Purples",
  "Pinks",
  "Transparent colors",
];

function colorPosition(color: Color) {
  const [r, g, b] = [0, 2, 4].map(
    (offset) => parseInt(color.rgb.slice(offset, offset + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const lightness = (max + min) / 2;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue =
    delta === 0
      ? 0
      : max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  // Catalog names keep tinted blacks/grays and lavender with the expected family.
  const namedFamilies: [RegExp, number][] = [
    [/white|black|gr[ae]y|silver|^metal$/i, 0],
    [/pink|magenta|coral|salmon/i, 8],
    [/purple|violet|lavender|lilac/i, 7],
    [/turquoise|teal|aqua|cyan/i, 5],
    [/blue/i, 6], [/green|lime/i, 4],
    [/tan|brown|nougat|copper|brass|orange|terracotta/i, 2],
    [/yellow|gold|lemon/i, 3], [/red/i, 1],
  ];
  const namedFamily = namedFamilies.find(([pattern]) => pattern.test(color.name))?.[1];
  const family = color.transparent ? 9 : namedFamily ?? (saturation < 0.13 ? 0
    : hue < 15 || hue >= 345 ? 1 : hue < 45 ? 2 : hue < 75 ? 3
    : hue < 165 ? 4 : hue < 195 ? 5 : hue < 250 ? 6 : hue < 290 ? 7 : 8);
  return { family, hue, lightness };
}

export function groupPalette(colors: Color[]) {
  const entries = colors.map((color) => ({ color, ...colorPosition(color) }));
  return families
    .map((name, family) => ({
      name,
      colors: entries
        .filter((entry) => entry.family === family)
        .sort(
          (a, b) =>
            (family === 9
              ? Math.floor(a.hue / 30) - Math.floor(b.hue / 30)
              : 0) ||
            b.lightness - a.lightness ||
            a.hue - b.hue ||
            a.color.name.localeCompare(b.color.name),
        )
        .map((entry) => entry.color),
    }))
    .filter((group) => group.colors.length > 0);
}
