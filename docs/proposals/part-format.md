# Proposed part format — review before phase 2

Status: design proposal only. The application does not load these files yet.
Phase 1 remains procedural and uses `src/engine/underside.ts` for common
underside surfaces, collision material and the existence of socket openings.

## Coordinates and assets

Use LDraw units (LDU) in definitions: 20 per stud, 8 per plate. Normalize every
part to +Y up, X/Z centered on the body, Y=0 at its underside mating plane.
Project positions can retain today's stud units; convert definitions once at
load time. Never round a side connection to a different global grid.

Each catalog ID maps to one part record, not one custom implementation.
Geometry comes from a packed LDraw asset; reusable collision templates and
connector grids describe behavior. Store the original source, author and
license with each imported asset. Preprocess dependencies and normalize the
mesh at import/build time, rather than fetching a tree of subparts while scrolling.
Geometry and collision must describe the same solid material and cavities.
An imported visible mesh does not enable placement until its behavioral data
is reviewed. Exact mould variants can override a family template.

`3034.part.example.json` demonstrates a 2 x 8 plate. `part.schema.json` is the
proposed JSON Schema, not a runtime API. The example asset path is illustrative;
no LDraw asset importer or downloaded asset is included in this phase.

## Contract

- `geometry`: packed LDraw asset and an explicit basis/translation into canonical coordinates.
- `collision`: a reviewed shared template and dimensions, or a preprocessed convex-compound asset.
- `connectors`: individual connectors or regular grids, each with kind, outward normal, radius and insertion depth.
- `source`: provenance/license/attribution. Keep catalogue metadata separate from geometry revisions.
- `version`: version the file contract independently of project files and CSV snapshots.

Templates such as `rectangular-shell` expand into roofs, walls and hollow tubes
or pins using shared engine code. New families can add template implementations;
individual part records supply parameters. Imported convex compounds cover shapes
that do not fit a useful reusable template. Do not use one convex hull over an
L-shaped piece or a cavity: that fills empty space and recreates false collisions.

The schema validates structure; the importer must also check unit normals,
finite dimensions, solid topology, connector clearance, asset bounds and geometry/
collision agreement. A model is not buildable merely because its JSON is valid.

## First additions

These IDs/names are present in the bundled Rebrickable catalog. They remain
catalog-only until their geometry, material collision pieces and connectors are
implemented and checked.

| Order | Parts | Additional behavior/data needed |
| --- | --- | --- |
| 1 | 2420 Plate 2 x 2 Corner; 2357 Brick 2 x 2 Corner | Three-cell L footprint, matching cavity/walls, connectors only on occupied cells. Reuse existing rigid stud/socket rules. |
| 2 | 3039 Brick Sloped 45° 2 x 2; 3040b Brick Sloped 45° 2 x 1 with Bottom Pin; 3298 Brick Sloped 33° 3 x 2 | Slope/wedge material, correct limited stud rows, underside shell and clearance. No new joint solver. |
| 3 | 11477 Brick Curved 2 x 1 No Studs; 15068 Brick Curved 2 x 2 x 2/3 | Imported curved surface with simplified convex material pieces; correct stud-free regions. |
| 4 | 4070 Brick Special 1 x 1 with Headlight; 22885 Brick Special 1 x 2 x 1 2/3 with 4 Studs on 1 Side | Recesses and exact side-connector offsets; extend existing directional connectors. |
| 5 | 99207 Bracket 1 x 2 - 2 x 2 Inverted | Thin perpendicular flanges, cavities, connectors on distinct faces and exact offsets. |

Start with corner parts: they exercise nonrectangular footprints without adding
another connection type. Defer Technic axles/pins, clips and hinges until their
compatibility and articulation rules have been designed explicitly.

## CSV/admin workflow for phase 2

1. Import CSV metadata and apply the existing non-building filters.
2. Match existing part records by catalog ID, preserving reviewed definitions.
3. For a new part, assign/import a model and choose a collision/connector template.
4. Preview geometry, cavities and connector directions together; review placement.
5. Generate the same thumbnail bundle from the approved geometry and publish the
   catalog/model revision together. Keep unmatched parts catalog-only.
