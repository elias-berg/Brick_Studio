# Connection regression suite

Run from the repository root after `npm install`:

```sh
npm test
npm run test:types
npm run build
```

The tests use Node's built-in test runner through the existing `tsx` dependency. No browser installation is required.

## Coverage

- `connections.test.ts`: fixed-coordinate attachments for 87087 and 11211; wrong-facing, penetrating, off-grid and out-of-bounds placements; all 64 Euler combinations / 24 unique orientations; nine receiving part families, every compatible underside socket and twist; reverse attachment into existing undersides; fractional translations and pointer jitter.
- `targeting.test.ts`: the pointed stud remains the anchor even when a neighbor would be valid or was the previous preview; every top stud is targetable in all 24 orientations.
- `assemblies.test.ts`: repeated sideways chains, bridges with alternate supports, hanging pieces, floating components, recursive deletion, stacked side-row pitch conflicts, and legal overhangs.
- `tube-connections.test.ts`: centered tube-bore clutch, sideways tube attachments, and rejection of tube-wall penetration.
- `engagement.test.ts`: partial insertion in all 24 orientations, grounded side attachments, lateral misalignment and separated tips.
- `undersides.test.ts`: finite surfaces for the current modeled catalog, tube layouts, empty cavities and hollow bores, plus solid walls, roofs and tube material after rotation.
- `config.test.ts`: legacy step-size preference removal and arithmetic drift.

The side-connection matrix checks 12,096 aligned poses in each placement order, 12,096 off-grid disconnected poses, 7,776 snap attempts, and 6,000 grounded cases. It uses generated combinations for breadth and explicit coordinate fixtures for independent dimension/polarity checks. Counts are asserted so accidentally skipping the matrix fails the suite.

## During the part-schema migration

`tests/support/engine.ts` is the model-loading adapter. Update its catalog/model access for the new schema while retaining the behavior assertions and fixed-coordinate examples. Lower-level transform and underside tests intentionally cover the current implementation; adapt their construction helpers if those APIs change. Do not replace real connector normals, collision material or grounding with mocks.

Keep the existing pitch-conflict fixtures: side rows separated by 1.2 studs cannot all engage a tipped 1-stud socket grid merely because one row aligns. An overhang that clears the extra studs should still work.

These are engine regressions, not browser end-to-end coverage. Mouse raycasts, camera occlusion, keyboard focus, input editing and rendering still need browser checks. The suite models defined rigid connections; it does not establish real-world clutch strength, structural stability or unmodeled connection types.
