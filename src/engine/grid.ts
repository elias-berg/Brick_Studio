/** Remove arithmetic drift without changing legitimate connector offsets. */
export const gridPrecision = (value: number) => Math.round(value * 1e6) / 1e6;

/** Put a local connector on the world lattice, then recover the brick origin. */
export function snapTranslation(pointer: number, connectorOffset: number, spacing = 1) {
  return gridPrecision(Math.round((pointer + connectorOffset) / spacing) * spacing - connectorOffset);
}
