import { memo, useId, useMemo } from "react";
import type { Part } from "../engine/types";
import { shapeFor } from "../engine/parts";
import { THUMBNAIL_COLOR } from "../engine/thumbnailSvg";
import { libraryThumbnail, thumbnailMarkup } from "../engine/thumbnailCache";

export const PartIcon = memo(function PartIcon({
  part, color = THUMBNAIL_COLOR, rotation = 0, rotationX = 0, rotationZ = 0, large = false,
}: { part: Part; color?: string; rotation?: number; rotationX?: number; rotationZ?: number; large?: boolean }) {
  const id = useId();
  const shape = useMemo(() => shapeFor(part), [part]);
  const content = useMemo(() => {
    if (!large) return "";
    const svg = thumbnailMarkup(shape, color, rotation, rotationX, rotationZ);
    return svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"))
      .replace(/id="([^"]+)"/g, (_, name) => `id="${id}-${name}"`).replace(/href="#([^"]+)"/g, (_, name) => `href="#${id}-${name}"`);
  }, [shape, color, rotation, rotationX, rotationZ, large, id]);
  // Only the single inspector preview is inline, so colors/rotation change in
  // the same render. Catalog cards remain one predecoded image each.
  if (large) return <svg className="part-icon large" width="300" height="210" viewBox="0 0 100 70" aria-hidden="true" dangerouslySetInnerHTML={{ __html: content }} />;
  return <img className="part-icon" src={libraryThumbnail(shape)} width="300" height="210" alt="" aria-hidden="true" decoding="sync" draggable={false} />;
});
