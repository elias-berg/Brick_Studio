import type { Part } from "./types";

// Rebrickable's "Gear Parts" means merchandise/accessories, not Technic gears
// (those are category 52). Keep the raw snapshot intact for future integrations.
const nonBuildingCategories = new Set([
  17, // Gear Parts: books, trading cards, storage, software, packaging, etc.
  58, // Sticker sheets
  78, // Pen & Watch merchandise
]);

// Catch obvious paper/media entries filed in other categories. Match the start
// of the name so a physical brick with a book/sticker/box print stays visible.
const nonBuildingName =
  /^(?:(?:Activity|Instruction|Comic|Coloring|Colouring|Story|Idea|Ideas|Duplo|Clikits) (?:Books?|Booklets?|Bookmarks?|Cards?)\b|Books?\b|Bookmarks?\b|Plate Special Book\b|Booklets?\b|Instructions?\b|Sticker Sheets?\b|Packaging\b|Posters?\b|Catalog(?:ue)?\b|Leaflets?\b|Brochures?\b|Certificates?\b|Trading Cards?\b|User (?:Guide|Manual)\b)/i;

export function isBuildingPart(part: Part): boolean {
  if (nonBuildingCategories.has(part.category)) return false;
  return !nonBuildingName.test(part.name);
}

// Treat dimension separators and whitespace consistently in names and queries.
export function normalizePartSearch(value: string): string {
  return value.toLowerCase().replace(/[×✕]/g, "x").replace(/\s+/g, "");
}
