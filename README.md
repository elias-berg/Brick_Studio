# Brick Studio

A local, mouse-first LEGO building editor using React, TypeScript, Three.js, and Vite. No account, API key, backend, or cloud database is needed. The source is contained in this directory and ready for a new GitHub repository.

## Run

Requires Node.js 20+ and npm.

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite (normally http://127.0.0.1:5173).

```sh
npm run build
npm run preview
```

The production output is `dist/`, which can be served by any static host. Serve from the domain root. A WebGL-capable desktop browser and a mouse are recommended.

## What works

- Search the bundled Rebrickable bulk catalog: 64,955 parts and 273 named colors in the initial snapshot. Placeholder/unknown colors are excluded. The catalog date is visible in the library.
- Choose among **96 placeable parts**: simple rectangular bricks, plates, tiles, baseplates, and round 1 × 1 bricks/plates. The building-parts catalog is browsable; unsupported parts are explicitly marked “Catalog only.”
- Move the mouse to see a green/red wireframe; click to place. Auto height prioritizes the surface under the pointer, even below an overhang. Only when no brick is targeted does it search for a valid support beneath the footprint. Manual layers reach under overhangs.
- Solid-body collision detection, stud/socket alignment checks, grounded placement, and a required lower stud connection for each new elevated piece.
- Rotation is restricted to 90° steps: r clockwise. The rotate button shows its shortcut. Square and round parts with identical quarter-turns hide the rotation controls and ignore the shortcut. Legacy project files retain previously saved angles.
- Hold the **middle mouse button and drag to orbit**, or select **Orbit view (o)** and left-drag. Orbit mode never places pieces; select Build (b) to resume placement. Right-drag or hold the arrow keys to pan; the wheel zooms. On-screen controls rotate bricks, zoom, and reset the camera.
- Edge panning moves the world opposite the cursor’s edge. Configure activation width (16–160 px), speed, enable/disable, and board size in Viewport settings.
- The **? / Pick brick and color** tool (i) highlights the hovered piece. Click once to select its part, color and quarter-turn orientation and return to build mode, without placing or deleting anything.
- Recursive delete previews the selected brick and any connected branch that would lose its path to the ground after removal, including suspended bricks below it. Shared supports and grounded bridges preserve connected branches.
- Undo/redo (80 history states), local autosave, project JSON import/export, and a live part/color inventory. LEGO CSV and JSON exports use actual element IDs; a separate detailed inventory CSV retains Rebrickable IDs.
- A LEGO Pick a Brick link next to the inventory. **No automatic cart, ordering, or availability lookup.**

New projects start empty with the name “Untitled.” Use New build → Load the sample pavilion for a shared-support example. `examples/connection-study.brick.json` contains a simple tower that demonstrates upward deletion; open it with the folder button.

## Upload your build to LEGO

1. Open **Parts list** and wait for the element-ID catalog to load.
2. Missing part/color mappings offer known color alternatives. The older 3062a solid-stud round brick also offers an explicit switch to 3062b open-stud in the same color when mapped. Replacements update all matching bricks and support Undo; nothing is silently substituted. Exact legacy parts link to Rebrickable. No manual element-ID entry is required.
3. Download **LEGO CSV** or **LEGO JSON**. Both contain only `elementId` and `quantity`. JSON IDs are strings and quantities are numbers. The CSV header is exactly `elementId,quantity`, without a BOM or extra inventory columns.
4. On [LEGO Pick a Brick](https://www.lego.com/en-us/pick-and-build/pick-a-brick), choose **Upload List**, upload the downloaded file, then **View All Pieces**. LEGO reports availability separately from file validity.
5. If there are more than 200 distinct element IDs, select and download each numbered export file separately. The LEGO upload dialog checked during development accepted at most 200 different pieces per file.

The detailed inventory CSV and `.brick.json` project file serve different purposes and must **not** be uploaded to LEGO. The former retains Rebrickable metadata; the latter saves positions and editor settings. Part/color replacements persist in the project. If some combinations remain unmapped, an explicit checkbox allows a mapped-only LEGO export with excluded piece counts and a clearly named file. The detailed inventory always includes every piece.

The user's supplied CSV/JSON templates were used as the format contract. Both generated formats were downloaded through the editor and uploaded to LEGO's US importer: each parsed the sample pavilion as eight entries with correct quantities. LEGO reported six available and two unavailable entries. No pieces were added to the shopping bag and no order was placed.

## Controls

| Action                      | Mouse / keyboard                                      |
| --------------------------- | ----------------------------------------------------- |
| Place                       | Left click                                            |
| Orbit camera                | Horizontal scroll, middle drag, or Orbit view (o) + drag            |
| Pan camera                  | Right drag, arrow keys, or hover near a viewport edge |
| Zoom                        | Vertical scroll, or + / −                                       |
| Rotate selected part        | Rotate button, r                                      |
| Build / delete / pick tools | Toolbar, b / x (single) / shift+x (recursive) / i                                    |
| Undo / redo                 | Toolbar, Cmd/Ctrl Z / Cmd/Ctrl Shift Z                |
| Home camera                 | Reset view button, H                                  |

## Geometry and physical limits

This is a usable **basic V1**, not a complete LEGO CAD system. Rebrickable supplies catalog metadata, not collision solids or mechanical connection definitions. The entire catalog is **not** placeable. The library filters out merchandise/accessories, sticker sheets and pen/watch items, plus obvious books, activity cards and printed documentation in other categories. Book and booklet entries, including molded book accessories, are excluded. Other physical pieces, including printed bricks and minifigure accessories, remain visible even without geometry. The raw bundled snapshot is retained unchanged. In particular, Technic pins/axles, hinges, clips, slopes, wheels, minifigures, inverted construction, and articulated assemblies are not implemented. Unsupported parts are not given misleading placeholder solids.

The supported family uses procedural solids in stud units (1 stud = 8 mm; 1 plate = 3.2 mm). Rectangular solids use separating-axis collision detection; round solids use a conservative circumscribed polygon. Studs are permitted to enter matching underside sockets only at the mating height. Body volumes are conservative solid envelopes: underbody cavities, tube details, open-stud bores, manufacturing tolerances, clutch force, stress, balance and gravity are not simulated. Collision checks can reject some physically possible arrangements. They do not certify every real-world LEGO connection as legal.

The editor allows only quarter-turn rotations; there is no pin/axle, stud swivel or hinge solver. With floating bricks disabled, new pieces must attach from above. After deletion, a piece can remain hanging from a grounded bridge; project import validates the entire grounded connection graph to preserve this case.

Every catalog color is selectable, but not every part was produced in every color. The model retains Rebrickable part/color IDs. LEGO exports resolve those pairs using the bundled Rebrickable `elements.csv.gz` mapping; live LEGO stock is not checked. Multiple catalog IDs can exist for a pair, and an ID may be retired or unavailable. Element IDs are selected automatically. Unmapped pairs offer explicit replacements where available; a partial LEGO upload requires acknowledging the excluded quantities. The complete inventory remains downloadable.

Projects are capped at 5,000 pieces as an input guard, not a performance guarantee. This renderer is intended for small builds; large assemblies need instanced meshes, spatial indexing and a cached connection graph. The browser stores one active project; download JSON to retain multiple projects or move devices. Undo history is session-only.

## TODO / unfinished work

The original brief is only partially covered by V1. These are the remaining implementation tasks, in a useful order for the next contributor:

- [ ] **Implement the rest of the bricks.** The 64,955-part catalog is searchable, but only 96 parts have placeable procedural geometry. Add slopes, wedges, round multi-stud parts, jumpers, modified bricks, arches, wheels and other families. Extend visuals, collision solids and connector metadata together; never enable an approximate catalog box as though it were an accurate part.
- [ ] Import LDraw geometry with Rebrickable-to-LDraw ID mapping, recursive subparts, caching, attribution and missing-part handling. Keep rendering meshes separate from physical connection/collision definitions.
- [ ] Model underside cavities, tubes and open studs accurately. Replace conservative body envelopes with appropriate collision solids; add precise connector compatibility for special parts.
- [ ] Add Technic pin/axle, hinge, clip/bar and ball-joint definitions, orientations and compatibility. Include articulated assemblies and allowed joint axes/ranges. Arbitrary rotation is deliberately disabled in the current UI; add constrained joint controls only alongside a real connection solver.
- [ ] Support sideways, inverted and other valid nonvertical constructions. Revise deletion behavior deliberately for those connections; the cascade uses the grounded connection graph.
- [ ] Add official set lookup and inventory import, with a clear report for parts whose geometry is unsupported. Import a set inventory as a parts palette, not an invented assembled model.
- [x] Map Rebrickable part/color pairs to LEGO element IDs and export the official `elementId,quantity` CSV and JSON array formats.
- [ ] Restrict the color selector to known produced part/color combinations and optionally look up current Pick a Brick availability. Exports use catalog mappings, not live stock, and do not prefill a cart.
- [ ] Add selection/move, multi-select, copy/paste and assembled submodels while preserving collision and support validation.
- [ ] Scale larger builds with spatial indexing, instanced rendering, incremental connection graphs and chunked catalog delivery. The 5,000-piece input limit is not a performance guarantee.
- [ ] Add multiple named local projects and recovery/version history. The current browser autosave holds only one active project, and undo history disappears on reload.
- [ ] Improve keyboard focus management in dialogs and accessible nonvisual descriptions of placement results. On narrow screens, Selected brick remains visible below the library.
- [ ] Broaden real-mouse checks across browsers, especially middle-button orbit, high-DPI layouts and long editing sessions. No automated test suite has been added, per the original request.

The toolbox now keeps tiles at least 100 px wide, switches to one column when two no longer fit, and retains a 140 px minimum sidebar width. r rotates the selected piece clockwise; arrow keys pan continuously until released and never intercept text/select inputs.

## Investigation: corner, angled and curved parts

These families are researched next steps, **not enabled geometry**. Clockwise 90° rotation is sufficient for all four orientations of a future asymmetric part; it does not require restoring reverse rotation.

| Family / initial candidates                               | What implementation needs                                                                                                                                                                                                                                                                    | Relative scope                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| L-shaped corner plate **2420** and corner brick **2357**  | A shared footprint with a missing corner, an explicit three-position stud/socket layout, polygon extrusion for the visual and thumbnail, and two convex boxes for collision. The empty corner must remain usable by another brick.                                                           | Smallest useful first addition.                                                      |
| Flat angled/wedge plates                                  | Constant-height polygon footprints and explicit connector positions. Convex wedges can use the existing separating-axis approach once it accepts custom polygons. Left/right variants need separate verified definitions.                                                                    | Next after corners.                                                                  |
| Round corner plate **30357** and macaroni brick **85080** | Verified arc radii, thickness and stud/socket positions; arc extrusion for rendering and sampled convex sections for collision. Macaroni parts need their open center preserved rather than a solid bounding box.                                                                            | Moderate; more geometry verification than straight corners.                          |
| Sloped brick **3039** and similar roof pieces             | A wedge-shaped 3D solid, connector positions only on the actual flat studded surface, and connectors with their own heights. The current single `top()` height and full-footprint solid must be replaced or extended; otherwise the solver would invent studs/support over the sloping face. | More work than a flat angled plate; implement after footprint/connector refactoring. |

The current code assumes a full rectangular stud grid and uses convex footprint SAT plus one body height. Enabling parts by catalog name alone would break collision checking, snapping and deletion. A practical implementation order is:

1. Add shared local-space footprint polygons and explicit top-stud/bottom-socket definitions in `types.ts` and `parts.ts`.
2. Have `geometry.ts`, `thumbnailSvg.ts`, `physics.ts` and placement snapping consume those same definitions. Allow a union of convex collision pieces so empty corners and curved openings remain empty.
3. Add 2420 and 2357 together, then verify rotated placement, stacking, a brick in the missing corner, edge contact, deletion through a shared support, project reload and LEGO export.
4. Add flat wedges, then curved footprints. Add per-connector heights and 3D collision volumes before adding true slopes.

Official geometry references: [2357 corner brick](https://library.ldraw.org/parts/2128), [2420 corner plate](https://library.ldraw.org/parts/list?tableSearch=2420.dat), [85080 macaroni brick](https://library.ldraw.org/parts/12916), and [3039 slope](https://library.ldraw.org/parts/list?tableSearch=3039.dat). LDraw supplies reference geometry; connector compatibility still needs explicit modeling in this editor. Preserve upstream licensing/attribution if meshes are imported.

## Source map

- `src/App.tsx`: editor interface, history and project lifecycle.
- `src/components/`: catalog browser, color palette, project dialogs and lightweight part thumbnails.
- `src/engine/EditorScene.ts`: Three.js scene, pointer interactions, raycasts, camera and ghost previews. Placed meshes are retained between edits; deletion previews are cached for the hovered root.
- `src/engine/catalog.ts`: reusable building-part filter; excludes non-building categories and obvious paper/media entries without matching words inside printed-piece descriptions.
- `src/engine/parts.ts`: the supported part registry. This is the first place to extend coverage.
- `src/engine/geometry.ts`: procedural visual and wireframe generation; disposal utilities.
- `src/engine/physics.ts`: footprints, connectors, collision/placement validation, grounded deletion cascades and inventory aggregation. Independent of React and Three.js.
- `src/engine/legoExport.ts`: element-ID lookup, complete-inventory resolution, LEGO CSV/JSON serialization and 200-element file batches.
- `src/components/InventoryPanel.tsx`: LEGO-ID alternatives, missing-ID resolution and export controls.
- `src/engine/storage.ts`: project validation and file exports.
- `src/engine/types.ts`: shared data types.
- `scripts/refresh-catalog.mjs`: download and convert official bulk CSVs.
- `public/data/catalog.json`: bundled snapshot, so normal use works without an API request.

To add a new geometry family, extend the shape type and registry, rendering, collision footprints/solids and connector definitions together. Do not enable a catalog part based on its name alone unless its shape and connections match the implementation. A general-purpose future version should import LDraw meshes for visuals and maintain separate collision/connection metadata; the LDraw file format alone does not supply a full legal-connection solver.

## Refresh the catalog

```sh
npm run catalog:refresh
```

Downloads `parts.csv.gz`, `colors.csv.gz`, `part_categories.csv.gz`, and `elements.csv.gz` from Rebrickable’s public CDN. The script includes a quoted-field CSV parser and fails on unsuccessful downloads. The element mapping is written to `public/data/elements.json` and loaded on demand when the parts dialog opens. Geometry coverage remains governed by the explicit registry. Rebuild after refreshing the snapshot for a production deployment.

Catalog: [Rebrickable bulk downloads](https://rebrickable.com/downloads/) and [API documentation](https://rebrickable.com/api/v3/docs/). Three.js: [OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls). Future geometry reference: [LDraw format specification](https://www.ldraw.org/article/218.html).

LEGO is a trademark of the LEGO Group. This independent application is not affiliated with or endorsed by LEGO or Rebrickable. Catalog attribution and source URLs are preserved in the data and UI; review upstream data terms before redistributing commercially.

## Verification

No test suite was added, as requested. Validation consisted of the TypeScript/production build and local browser interaction checks: placement, stacking, overlap rejection, deletion cascades, shared support preservation, undo/redo, project import/export, catalog search, color/rotation controls, viewport settings, and inventory export. Follow-up checks cover responsive one-column brick layouts, visible rotation shortcuts, arrow-key panning and automatic footprint-based support selection. The middle-button orbit mapping uses Three.js OrbitControls; physical middle-drag behavior should also be tried with your own mouse.

Thumbnail geometry uses the same plate/stud dimensions as the 3D scene. Each full silhouette is centered and scaled to fit, with every stud drawn (including all 256 on a 16 × 16 plate).

The lightbulb toolbar toggle switches between directional lighting with shadows and uniform ambient-only lighting with high-contrast outlines. Circular wireframes include two camera-facing tangent side lines connecting their rings. This setting is saved with the project.

The reset-orientation button below Orbit restores the initial camera angle while preserving zoom and the pan target.

The workspace follows the placement workflow from left to right: brick library, color/selected brick, then the 3D viewport. The header keeps the project name editable at every width. Narrow screens put New build, Open project and Help in the hamburger menu, separated from Parts list and Save.

On narrow screens, the left column splits equally between Brick library above and Selected brick below, each with its own vertical scroll area; the canvas stays on the right. Empty builds show a short “To get started:” control list rather than a splash message.

The duplicate Your build panel is removed; the header Parts list remains the inventory entry point.

Brick rotation is available beside the selected-piece image and through r. That image shows the selected color and actual quarter-turn orientation. Camera rotation uses the separate XYZ-axis Orbit view tool (o), with a grab cursor and left-button drag.

## Thumbnail and scrolling performance

The brick library uses pre-rendered, lazy-loaded 300 × 210 PNG images. Every library tile keeps its standard catalog color; the Selected brick panel alone previews the chosen color, rotation and placement coordinates. There are no per-stud SVG elements in the list.

`src/engine/thumbnailSvg.ts` is the shared geometry-to-image renderer. `npm run thumbnails:generate` uses `sharp` to rasterize supported parts and quarter-turn orientations, writes content-addressed PNGs to `public/thumbnails/`, and updates `src/data/thumbnails.json`. Duplicate shapes/orientations share image files. Existing images are reused; unchanged manifests are not rewritten. The build and catalog-refresh commands run generation automatically. Generated images and the manifest are committed/shipped with the source.

Nonstandard preview colors are rasterized once on selection and shared through a bounded 64-entry cache in `thumbnailCache.ts`; the canvas/temporary SVG is never inserted into the list DOM. Color and rotation changes therefore do not regenerate the library or change its images. Failed custom-color rendering retains the pre-rendered image.

The Three.js viewport still checks camera damping and edge/keyboard pan in its animation loop, but only raycasts when the pointer, camera or scene changes and only renders when the view is dirty. Scrolling the library no longer redraws an unchanged 3D model at 60 frames per second. Orbit, zoom, pan, resize, placement, deletion and hover highlights invalidate the scene as needed.

Wireframe previews use a white outline around their colored lines, with consistent screen-space widths. Solid faces use a small depth offset so the bottom rings of studs remain as dark as their other edges.

## Placement offsets and surface targeting

Use the w/a/s/d pad under the selected-brick preview, or those keys in Build mode, to shift the placement by one stud: a/d change world x, w/s change world z. The offset is added after stud alignment and preserves the hovered surface height. This allows larger bricks to overhang a small support; normal collision and connection checks still apply. Reset (f) clears the offset, resets the selected brick rotation to 0°, and returns to Auto. Selecting or picking another brick resets it too. Delete now uses x.

Auto targeting uses the nearest visible brick rather than top faces hidden behind it. Near the middle of similarly sized pieces it snaps toward their centers; one-stud offsets remain available through the pad. Preview outlines render after translucent bricks and use their depth: visible segments stay solid with a white border; occluded segments are faint and dashed.

Sideways trackpad scrolling or Shift + wheel orbits the camera. Vertical scrolling zooms. Diagonal gestures use the dominant direction.

## Sidebar layout, delete modes, and floating bricks

The button beside Viewport settings toggles between two sidebars and a compact stacked column, leaving more room for the canvas. This preference is saved locally. Narrow windows always use the stacked layout.

Delete defaults to single-brick mode, indicated by a subscript **1**. Clicking the delete tool activates the selected mode and opens a submenu with single and recursive (**∞**) deletion. The x shortcut selects single delete; shift+x selects recursive delete. Single deletion highlights only its target. If deletion would disconnect other pieces from the ground while floating is disabled, a dialog offers cancellation or explicitly enabling floating and removing that one brick. Recursive deletion retains the grounded-connectivity cascade and highlights the full set before removal. Undo restores the previous bricks and floating setting.

**Allow floating bricks** is available directly below the placement pad. It is off by default and saved in the project. Enabling it removes the support requirement but keeps collision, stud alignment, ground and board-boundary checks. Turning the setting off offers to delete unsupported pieces, with Cancel preserving them. Floating projects can be exported, reopened and autosaved normally.

The pad’s Auto/Layer button switches height modes. Auto follows the hovered surface; q/e enter Layer mode and move the bottom layer within 0–600 plates. Layer 0 is the ground. With floating enabled, arbitrary manual layers need no underlying brick. Edge activation zone and pan-speed controls are disabled while edge panning is off; manual camera pan still works.

The pad keeps a fixed size while switching modes. Allow floating bricks uses an aligned checkbox and label directly below it.

Offset buttons display −x/+x and −z/+z, with their a/d/w/s hotkeys in small subscripts. Reset uses f. Placement coordinates are shown only in the viewport; Height and mode are managed entirely by the pad. Delete choices use plain 1/∞ labels, and clicking away closes the submenu while retaining the selected deletion mode.

Trying to disable floating while unsupported pieces remain flashes those pieces red three times. A dialog offers to delete unsupported pieces and disable floating, or cancel and keep the setting enabled. The highlight restores original materials afterward and uses a steady highlight for reduced-motion preferences.

To build underneath a floating overhang, use q/e to choose a bottom layer for the new brick. With floating enabled, that plane does not need support. The mouse projects directly onto the chosen plane, ignoring foreground brick surfaces; x/z offset controls can move the preview into occluded spaces. Collision and stud alignment checks still apply to the new placement. Red floating warnings tint both the original surface and emission, then restore the exact original material colors.

## Layer shortcuts and placement lock

The placement pad adds **+y (e)** at the top-right and **−y (q)** at the bottom-left. Each step is one plate (3.2 mm). From Auto, either key starts at the latest preview bottom layer and enters Layer mode. **m** toggles Auto/Layer and restores the last manual layer. Layers stay within 0–600.

**Lock (l)** occupies the bottom-right and starts enabled. Locked placement preserves brick rotation and x/z offsets for repeated placement. When unlocked, a successful placement resets rotation and x/z offsets; failed placements do not reset them. The chosen layer stays unchanged in either case. **Reset (f)** immediately clears rotation, x/z offsets and the y layer and returns to Auto.

**x** selects single delete and **shift+x** selects recursive delete directly. The footer now wraps instead of hiding shortcut groups, listing every keyboard shortcut and camera mouse gesture, including undo/redo alternatives. The mode and lock buttons retain subscript hotkeys in the pad.

Manual-layer mouse movement stays on a fixed horizontal reference plane captured when leaving Auto. Changing q/e or the layer number moves only y; it no longer changes x/z through camera projection. The first step also preserves the preview’s stud alignment. Returning to Auto restores surface targeting.

## Custom keyboard shortcuts

Viewport settings contains all 24 keyboard actions. Click a shortcut field and press a key, optionally with Shift, Alt or Cmd/Ctrl. Assigning an occupied combination swaps its previous action onto the old key, so no action becomes inaccessible. Restore defaults resets the complete map. Mouse gestures remain fixed.

Bindings are saved in browser configuration, validated when restored, and used by one shared dispatcher. The pad’s subscripts, rotation hints, tooltips, help and bottom bar update immediately. Project imports retain the current browser key map. Model undo/redo preserves the current keyboard bindings. Keyboard shortcuts do not run while entering text or editing the shortcut fields.

Manual y movement uses a captured horizontal projection plane: changing layers with the mouse or keyboard preserves x/z instead of moving the preview toward the camera. Reset clears y as well as rotation and x/z offsets and returns to Auto.

The redundant Placement height section has been removed. Allow floating bricks sits directly below the placement pad; q/e and the Auto/Layer pad button handle height. Reset zeroes rotation, x/z offsets, and the manual y layer (including the remembered manual layer), then returns to Auto. Changing y while in Auto enters Layer mode. The bottom-right world-axis indicator projects signed x/y/z directions using the camera orientation.

## Local configuration persistence and reset

Personal configuration is saved separately in localStorage under `brick-studio-config-v1`: keyboard shortcuts, directional lighting, edge panning, activation zone and pan speed. It is restored independently of the active project and retained when opening another project. Existing installations migrate from the active project's settings on first save. Sidebar layout retains its separate local preference.

Viewport settings has **Reset config**, which restores all personal configuration and the wide sidebar layout. It preserves bricks, board dimensions and the floating/support rule, so resetting preferences cannot invalidate a build. **Restore defaults** within Keyboard shortcuts continues to reset only the key map. Storage failures are reported instead of silently claiming a save.

Project JSON and the active build autosave contain only build data plus board size and the floating/support rule. No keyboard, camera-lighting, panning or layout preferences are written into project files. Legacy project preferences are ignored on import; a one-time migration can recover preferences from this browser’s own existing legacy autosave into the separate configuration entry.

The board has no direction arrows or labels. A camera-synchronized world-axis indicator in the bottom-right rotates with orbiting and resets with the view. Solid positive-axis lines and dashed negative-axis lines carry signed labels. Its state updates locally only when camera orientation changes, without rerendering the catalog.

There are no toast notifications. Disabling floating with unsupported components opens a confirmation dialog with the affected count and an option to delete those components and turn floating off. The action preserves grounded structures and is undoable, including restoring the floating setting. Cancel preserves the build and returns to settings if the action began there. Unexpected failures use a dismissible alert dialog.

Reset clears rotation, x/z offsets, and the remembered manual y layer, then returns to Auto. It remains available even in Layer mode at layer 0. Switching back to Layer after Reset starts at 0.

Settings is accessible from the header (or its hamburger menu on narrow screens). The footer contains only control/shortcut hints; the Configure button and edge-pan status have been removed. Floating-brick control is only under the placement pad. Settings uses a wider modal with fixed shortcut input columns and aligned rows; narrow screens use a single column.


## Cleanup and UX review — November 10, 2026

Placement state lives in `src/hooks/usePlacementControls.ts`; keyboard event lifetimes and held panning keys live in `src/hooks/useEditorShortcuts.ts`. The main editor still owns project history and commands. Placement-pad styling is consolidated in `src/styles/placement.css`, and obsolete height-section rules have been removed. Grounding and recursive deletion share a breadth-first traversal without changing rigid-connection semantics. Normal builds now reject unused variables and parameters.

The default placement reset is **f**, beside WASD. It clears rotation, x/z offsets and remembered y, then returns to Auto. Configuration version 2 upgrades the untouched old default map from 0 to f; customized key maps, including an intentional 0 binding, stay unchanged. The inspector labels x/z in studs and y in plates.

This pass used an external, disposable verification script rather than adding a permanent test suite. It passed 3,869 checks, including baseline comparisons across 100 seeded assemblies, grounded stacks, a shared bridge with a hanging branch, collision checks, inventory grouping, project round-tripping, duplicate-ID rejection, preference separation/migration, shortcut swaps and LEGO CSV/JSON/batching. Randomized assemblies compare behavior, not physical validity. The production build and strict TypeScript checks passed. Vite still reports the existing large-bundle advisory; this is a remaining optimization task.

Browser checks used a separate localhost origin to preserve the active user's project: mouse placement and stacking, pick, single-delete support warning, recursive deletion, undo/redo, q/e alignment and collision rejection, f reset and remembered-layer clearing, custom-binding persistence after reload, disabled edge-pan controls, condensed sidebars and the 664 × 928 layout. The placement-pad and inspector rectangles stayed identical across hover, and the narrow inspector had no horizontal overflow. No browser errors or warnings were captured. These checks found no regressions in the exercised flows; they are not exhaustive cross-browser or large-model validation.

### UX priorities remaining

1. **Contain keyboard focus in dialogs.** The project dialogs declare themselves modal but do not yet focus an initial control, trap Tab, or return focus to the opener. Keyboard users can reach obscured editor controls. Introduce one reusable dialog primitive and verify all dialog variants with Tab/Shift+Tab/Escape.
2. **Make placement state easier to understand.** The pad is compact, but Auto/Layer and the lock rely on tooltips. Keep the existing layout; add concise accessible descriptions explaining that q/e select the brick's bottom layer, and that the lock preserves rotation and x/z after placement while the layer remains unchanged. If all frequently used controls should stay under the left hand, consider c for Auto/Layer and v for Lock, subject to user preference and existing custom bindings.
3. **Improve shortcut readability without hiding commands.** At narrow widths the footer retains every command, as requested, but its 7–8 px key labels are hard to scan. A user-selectable expanded reference could use larger type while retaining the compact complete reference. Do not remove commands or add another permanent status row.
4. **Reduce catalog interruption.** Catalog-only parts currently open a modal. An inline details area could explain the specific unsupported geometry while retaining the external Rebrickable link, so browsing a part does not interrupt the editor. Keep unsupported parts unplaceable until their geometry and connections exist.
5. **Clarify export readiness earlier.** Colors are catalog colors, not verified production availability. Surface element-ID availability beside the selected color once its mapping is loaded; keep explicit replacement choices and never silently substitute a mold or color. This would reduce surprises at export.
6. **Prioritize interaction latency over more visual detail.** The initial bundle is large and connection/collision work still scales poorly for large builds. Profile a representative growing model before promising a piece count; then use spatial indexing and cached connections. Library thumbnails are already static images and should stay that way.
