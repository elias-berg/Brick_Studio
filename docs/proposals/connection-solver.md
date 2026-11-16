# Replacing the procedural connection approximation

## Current changes and their limits

The matching implementation previously recognized only the regular underside stud grid and required connector origins to coincide. Open underside tube bores now supply additional sockets. Matching now separates lateral alignment from axial insertion, with at least 1 LDU of insertion required. Existing solid-material collisions and off-axis rejection remain active.

These changes address reproducible missing connection types. They do **not** establish that every placement in the reported screenshots is valid. The saved assembly's rejected pose at x=9.1, y=8.6, z=6.8 has three off-axis stud/material conflicts under the current procedural model. Changing insertion depth does not repair a sideways offset. The generic underside model is insufficient evidence to call a disputed real-world assembly impossible.

## Recommended replacement

Use reference part geometry plus explicit connection primitives, rather than expanding a global alignment tolerance or deriving every underside from its bounding dimensions.

1. Normalize imported LDraw coordinates to an integer LDU lattice (20 LDU/stud, 8 LDU/plate, 24 LDU/brick). Store part-to-world rigid transforms. Keep port identifiers stable through transforms.
2. Define each connection with a local frame, male/female profile, radius, opening/cap constraints and insertion interval. Distinguish ordinary underside cells, open tubes, hollow studs and specialized connectors. Draw these definitions from reviewed part metadata, rather than assuming every ring or cavity has identical clutch behavior.
3. Generate a rigid candidate transform from the pointed connector and each compatible receiving connector. Solve their axis and entry-plane constraints directly; do not independently round world x/y/z. Preserve the pointed anchor across candidate ranking.
4. Rank candidates by cursor proximity and previous pose, then check the **entire** candidate against neighboring material. A matched port pair authorizes only its specified mating volume, never a blanket collision exemption for the two parts. Other studs can still obstruct the assembly.
5. Separate outcomes: connected and clear; geometrically clear but unconnected; blocked by a specific material volume; unsupported. Include the blocking part and local primitive in diagnostic data. Use the same accepted connections for placement, grounding and deletion.
6. Generate reviewed collision components from reference meshes. Use bounds only for broad-phase rejection; support tubes, webs, recesses, hollow studs and mould-specific differences must survive narrow-phase checks.

Start with 3001, 3003, 3020, 3034, 87087 and 11211. Verify their side-by-side and sideways assemblies against fixed-coordinate fixtures and the reference models before adding more families. Keep the current engine behind the adapter while the replacement runs on the same fixtures; compare disagreements explicitly rather than rewriting expected outcomes to match the new engine.

This is the next engine/schema migration, not a completed importer. The existing `part-format.md` proposal provides the asset/schema outline.

## Reference material

- [LDraw units and coordinate conventions](https://www.ldraw.org/article/218.html)
- [11211 reference geometry](https://library.ldraw.org/library/official/parts/11211.dat)
- [3001 underside subpart](https://library.ldraw.org/library/official/parts/s/3001s01.dat)
- [Open tube geometry](https://library.ldraw.org/library/official/p/stud4.dat)
- [LDCad connection metadata](https://www.melkert.net/LDCad/tech/meta): cylindrical profiles, genders, caps and grids are a useful model. Review licensing before importing metadata. Its open-tube shadow annotation is deliberately disabled pending multi-matching, illustrating why primitive-only inference needs whole-part collision checks.
