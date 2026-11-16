# Brick Studio

A local LEGO building editor built with React, TypeScript, Three.js and Vite. Rebrickable supplies the catalog; procedural geometry defines the pieces that can actually be built. No API key or backend is needed for normal use.

## Run locally

Requires Node.js 20+ and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally http://127.0.0.1:5173/. The development command first generates the thumbnail bundle.

```sh
npm run build
npm run preview
```

Production output is in `dist/`. Serve it from the domain root with WebGL available. Keep `public/` in source control; omit `node_modules/`, `dist/` and TypeScript build cache files when transferring the source.

## Refresh catalog data and generated SVGs

```sh
npm run catalog:refresh
```

This downloads `parts.csv.gz`, `colors.csv.gz`, `part_categories.csv.gz` and `elements.csv.gz` from Rebrickable's public CDN, converts them to JSON, then regenerates the SVG thumbnail bundle. Reload the editor after a refresh. Rebuild and redeploy for a production site.

Commit the changed files:

- `public/data/catalog.json`: part, category and color metadata.
- `public/data/elements.json`: LEGO element-ID mappings for part/color combinations.
- `public/data/thumbnails.json`: generated SVG templates in a single JSON bundle.

**Yes: regenerated SVG assets belong in the commit when they change.** They are embedded in `thumbnails.json`, rather than stored as hundreds of separate `.svg` files. A refresh that only changes unsupported parts or metadata may leave the thumbnail bundle unchanged. The generator avoids rewriting an identical bundle.

After editing geometry without refreshing CSV data, run:

```sh
npm run thumbnails:generate
```

Generation also runs automatically before development and production builds. `public/` contains the three JSON files above plus `favicon.svg`.

## Filtering the catalog

The raw catalog stays intact. `src/engine/catalog.ts` applies `isBuildingPart()` before displaying any part. It hides merchandise/accessories, sticker sheets and pen/watch categories, plus booklets, instructions, packaging and other recognized paper/media names. Additional category, name or part-ID exclusions currently belong in this function. Printed physical parts are retained where their names do not identify a non-building item.

**Buildable** shows supported geometry only. **All** additionally shows physical pieces without geometry, marked **Catalog only**. A CSV refresh does not make unfamiliar pieces placeable automatically.

The library is a virtual grid. Only visible rows plus a small buffer are mounted, with one or two columns depending on width. Search accepts dimensions with or without spaces: `2x3`, `2 x 3` and `2 × 3`. Catalog cards support arrow keys, Page Up/Down and Home/End when focused.

## Supported geometry

- Rectangular bricks, plates, tiles and baseplates matching the supported dimensional names.
- Round 1 × 1 bricks/plates: 3062a, 3062b, 4073 and 6141.
- **87087:** 1 × 1 brick with a top stud and one side stud.
- **11211:** 1 × 2 brick with top studs and two studs on one side.

Side-stud definitions use face positions and outward directions, shared by rendering, previews, snapping, collision and connectivity. Their side-stud centers are 0.7 stud units above the unrotated base. References: [LDraw 87087](https://library.ldraw.org/parts/13106) and [LDraw 11211](https://library.ldraw.org/parts/385), authored by Magnus Forsberg. These remain procedural family models; hollow-stud pin/axle insertion is not implemented.

## Undersides and material collision

`src/engine/underside.ts` describes the shared body material for all currently
supported shape families. Rectangular bricks, plates, tiles and side-stud bricks
have an open underside with walls and an inner ceiling. Wider parts have hollow
support tubes between stud rows; one-stud-wide parts have intermediate support
pins. Round 1 x 1 parts have a recessed circular underside. Thin baseplates keep
a flat bottom and do not provide underside socket connections.

The viewport, wireframe previews and tilted selected-brick SVGs use these same
surface definitions. Upright catalog thumbnails retain their compact cached
rendering. Collision first checks the original outer envelope, then checks the
actual wall/roof/support material only when needed. Empty cavities and tube
bores no longer count as solid boxes. Existing directional stud/socket mating
points and project coordinates are preserved; proximity inside a cavity alone
does not establish a connection or bypass ground-connectivity rules.

Open [`examples/underside-study.brick.json`](examples/underside-study.brick.json) to inspect upright undersides of a plate, brick, narrow brick and round brick.

These are common-family structural interiors, not exact mould revisions. Small
ribs, logos, injection marks, grooves and part-specific stud bores are not fully
modeled. Exact imported geometry and reviewed per-part overrides are phase 2.
The proposed contract and first candidate parts are documented in
[the part format proposal](docs/proposals/part-format.md), with a
[JSON Schema](docs/proposals/part.schema.json) and
[3034 example](docs/proposals/3034.part.example.json). These proposal files are
not loaded by the application yet.

## Build and move the view

1. Select a part in Brick library.
2. Select its color in Selected brick.
3. Move onto the viewport. A bordered green preview indicates a valid placement; red indicates an invalid placement and the status explains why.
4. Click to place.

Middle-drag or the **Orbit** tool (`o`) rotates the camera. Right-drag or arrow keys pan. Vertical scroll zooms; horizontal or Shift+scroll orbits. The orientation reset under Orbit restores the angle while preserving the pan target and zoom. The full reset-view control (`h`) returns to the starting view. The world-axis indicator follows the camera.

The lightbulb toggles directional/shadow lighting versus ambient lighting with stronger outlines. Edge panning, activation width, speed, board size and keyboard bindings are available in Settings, including the header menu on narrow screens. Panning options are disabled when edge panning is off.

## Placement offsets and height

Outside Rotate mode, the placement pad moves in world coordinates: `a/d` change x, `w/s` change z, and `q/e` lower/raise y. X/Z steps are one stud; Y steps are one plate (0.4 stud units). The exact starting height is preserved, including baseplate and side-connection offsets. Rotate mode uses 90° increments.

The first offset adjustment holds the latest preview's world-space XYZ target. Mouse or camera movement cannot retarget it while held. The held preview stays visible when using the sidebar. Click inside the viewport to place it when valid.

Auto follows the visible surface and its available connectors. `m` enters Layer mode or releases an existing held/manual target back to Auto. Returning to Auto clears X/Z offsets and manual height while preserving brick rotation, so the pointer becomes the target again. The pad's mode button has the same behavior. Manual height is the lowest occupied extent of the rotated piece and is limited to 0–600 plate units. Auto snapping works in both directions: an existing stud can receive the selected brick’s socket, or an existing socket can receive its stud. Connector positions and facing directions follow each brick’s full X/Y/Z rotation; snapping does not rotate the selected piece automatically. Snaps stay on the targeted connector plane, rank nearby alignments by pointer distance, and check collisions before choosing one. A small hysteresis keeps a valid preview steady near a cell boundary; all receiving alignments to the exact nearest hovered connector are considered, including larger overhangs needed to clear neighboring bricks. A blocked hovered stud is not replaced with a different valid stud on that face. Previous-preview hysteresis cannot override the hovered anchor. Free-space placement uses the same connector lattice and coordinate precision for upright and tipped pieces, preserving exact side-stud offsets. Hovering a plain edge of a tipped brick targets the nearest compatible connector face visible to the camera on that same brick. It retains fractional side-connection height/depth offsets instead of dropping back to the ground grid.

**Reset (`f`)** clears X/Y/Z rotation, x/z offsets and the remembered y layer, exits Rotate mode, and returns to Auto. Selecting/picking another part or opening/starting a project also releases the held target. Successful placement releases it for the next piece.

**Placement lock (`l`)** starts enabled and preserves all three rotation angles and x/z offsets after placement. When disabled, a successful placement resets those angles and x/z offsets. The chosen manual layer is retained either way.

## Rotate mode: X, Y and Z

The Rotate mode button is below the placement offsets. **`r` toggles the mode; it no longer immediately turns a brick.** X/Y/Z values remain visible when the mode is closed. Opening it repurposes the existing directional pad and its bindings: a/d rotate X, q/e rotate Y, and w/s rotate Z, in 90° steps. The pad labels and footer switch to degrees; position offsets and the selected height are preserved while rotating. Switching Rotate mode off restores movement controls. Custom axis bindings apply in both modes. The preview area contains the brick itself, without a separate rotation button or angle overlay.

Angles use an XYZ Euler convention shared by the renderer, collision model and connectors. The old single `rotation` property represents **Y**, the vertical axis; project files add optional `rotationX` and `rotationZ`, defaulting to zero for older projects. Existing upright builds keep their positions and orientation. The UI does not offer arbitrary angles. Symmetric square pieces still expose Rotate mode because tipping around X or Z changes where their studs face.

Rotate mode overrides the axis controls while preserving the underlying Auto/Layer height. The Auto/Layer button or m also exits Rotate mode without changing that height. It does not activate camera orbit. A position already held by the offset controls stays held while rotating; exit Rotate mode and choose Auto, or use Reset, to release it and target another face. For a side attachment, rotate the receiving piece so its underside sockets face the side stud, then hover that stud until the preview is valid.

Picking (`i`, the `?` tool) copies the clicked piece's part, color and all three angles. Undo/redo retains complete placed orientations.

## Connections, collisions and deletion

Body envelopes use convex box/circular-prism checks in their actual orientation; overlapping envelopes are resolved against the shared hollow body material. Studs are separate directional solids. Stud penetration is allowed only at a matching socket with the opposite facing direction. Side contact alone never forms a connection. Tilting a piece also rotates its body bounds, studs and sockets; it cannot bypass collision or board boundaries.

With floating disabled, a new piece must connect to a component that reaches the ground. Connections can carry rigid branches above, below or to the side. This is a connectivity rule, not a weight, balance or gravity simulation. Underside cavities are usable free space, but attachment still requires a defined compatible connector pair. Stacked side-stud bricks have side rows separated by a brick height (1.2 studs), which does not match the 1-stud pitch of a tipped brick. A candidate spanning these rows may collide with internal supports even when one row aligns. The placement status identifies the interfering part and measured socket-grid offset; automatic placement searches for a clear overhang on the same face. For stud/material clashes, red rings mark the actual blocked studs and blue crosses mark the nearest compatible socket centers. These markers come from the same material-collision iterator used for rejection, including held targets. A held target validates its exact coordinates and does not automatically move to a different overhang; release it with Auto/Layer (`m`) to resume automatic snapping. Open support-tube bores are also socket locations. Matching checks opposing directions, lateral axis alignment and insertion depth instead of requiring coincident connector origins. A partially inserted stud must overlap the socket by at least 0.05 stud units (1 LDU); tip contact or a true air gap does not carry support. This is an editor engagement rule, not a clutch-strength simulation.

The delete button opens a submenu and retains the chosen mode:

- **Delete 1 (`x`)** removes one piece and warns if doing so would leave unsupported pieces. The confirmation can enable floating and continue.
- **Delete ∞ (`shift+x`)** removes the selected piece and connected branches that lose their path to the ground. Other grounded components and shared supports remain.

Allow floating bricks is below the selected-piece controls. It bypasses support requirements, but never collision checks. Turning it off with unsupported components highlights them and offers to delete them. Deletion is undoable. There are no toast notifications.

## Projects and configuration

New projects start as Untitled. The header keeps the name editable; narrow screens put New, Open, Settings and Help in a menu. The sidebars stack on narrow screens and can be condensed manually on wider screens.

The browser autosaves one active project. Download `.brick.json` files to retain multiple builds or move devices. New build can also load a sample pavilion. Undo/redo (`cmd/ctrl+z`, `cmd/ctrl+shift+z`, or `cmd/ctrl+y`) retains up to 80 history states and is session-only.

Project files contain bricks, their full orientation, board size and the floating rule. Personal keyboard, lighting, panning and sidebar preferences are saved separately in localStorage, retained when opening a different project, and kept through model undo/redo. Settings has **Reset config**; Keyboard shortcuts has its own **Restore defaults**. Rebinding an occupied key swaps its previous action onto the old binding. Inputs do not trigger editor shortcuts. All current shortcuts are shown in the footer and configuration.

Projects are capped at 5,000 pieces as an input guard, not a performance guarantee. Large builds still need spatial indexing, instanced rendering and incremental connection graphs.

## LEGO inventory export

Parts list groups the build by part and color. LEGO exports use element IDs identifying each exact part/color combination; they are not derived by concatenating Rebrickable IDs.

1. Open Parts list and wait for its element mapping to load.
2. Resolve missing mappings with the offered explicit part/color replacements, or acknowledge a mapped-only export that excludes the listed quantities. Replacements update the build and support Undo.
3. Download LEGO CSV or JSON. CSV contains `elementId,quantity`; JSON is an array of objects with those same fields. Element IDs stay strings.
4. On [LEGO Pick a Brick](https://www.lego.com/en-us/pick-and-build/pick-a-brick), use Upload List and review availability.

Exports are split into batches of at most 200 distinct element IDs. The detailed inventory CSV preserves Rebrickable IDs and every piece, while `.brick.json` preserves the model; neither is a LEGO upload format. Element mappings do not guarantee current production or stock. There is no automatic cart or ordering integration.

Run the connection regression suite with `npm test`; see [testing notes](docs/testing.md) for coverage and the schema-migration adapter.

## Code map

- `src/App.tsx`: project lifecycle, history and editor commands.
- `src/hooks/`: placement/rotation state and keyboard event lifetimes.
- `src/components/`: virtual catalog, selected-piece controls, palette, dialogs and inventory.
- `src/engine/parts.ts`: supported procedural shape registry.
- `src/engine/spatial.ts`: shared transforms, local/world connectors and physical bounds.
- `src/engine/solids.ts`: convex bodies, cylinders and collision geometry.
- `src/engine/physics.ts`: placement, connectivity, grounded deletion and inventory grouping.
- `src/engine/targeting.ts`: face-aware stud/socket snapping.
- `src/engine/geometry.ts`: meshes, outlines and directional cylinder silhouettes.
- `src/engine/EditorScene.ts`: Three.js viewport, camera and interaction bridge.
- `src/engine/thumbnail*.ts`: generated SVG assets and oriented preview rendering.
- `src/engine/storage.ts`, `config.ts`, `shortcuts.ts`: project files and personal configuration.
- `scripts/`: CSV refresh and SVG bundle generation.

## Remaining work

- Expand side-stud variants, corner bricks/plates, wedges, slopes, arches, modified pieces, wheels and other families. Add geometry, collision pieces and connector layouts together; never make an unfamiliar catalog item placeable with an approximate box.
- Corner parts 2420/2357 need missing-corner footprints and connector grids; macaroni/curved pieces need their open centers preserved. Slopes need distinct connector heights rather than assuming a flat top.
- Implement an admin CSV upload and editable category/name/part-ID exclusion rules. An upload should update the runtime catalog, regenerate the SVG bundle, and define what happens to builds referencing removed or changed parts. CSV metadata alone does not define geometry or connectors.
- Add hinges, clips, Technic pins/axles and articulated connections. Quarter-turn rigid orientation is not a hinge or cylindrical-joint solver.
- Add selection/move, multi-select, copy/paste and submodels.
- Improve large-build performance and chunk catalog delivery.
- Contain dialog keyboard focus and return it to the opener.
- Improve the narrow footer's shortcut readability and reduce catalog-only modal interruptions.
- Show known part/color production mappings earlier and optionally check live Pick a Brick stock.

Catalog sources: [Rebrickable bulk downloads](https://rebrickable.com/downloads/) and [API docs](https://rebrickable.com/api/v3/docs/). Geometry references: [LDraw format](https://www.ldraw.org/article/218.html). Preserve upstream terms and attribution if importing mesh files in future.

LEGO is a trademark of the LEGO Group. This independent application is not affiliated with or endorsed by LEGO or Rebrickable. Source attribution is retained in the catalog and UI.
