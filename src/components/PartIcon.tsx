import { memo, useEffect, useState } from "react";
import type { Part } from "../engine/types";
import { shapeFor } from "../engine/parts";
import { THUMBNAIL_COLOR, quarterTurn } from "../engine/thumbnailSvg";
import { coloredThumbnail } from "../engine/thumbnailCache";
import thumbnailUrls from "../data/thumbnails.json";
const images: Record<string, string> = thumbnailUrls;

export const PartIcon = memo(function PartIcon({
  part,
  color = THUMBNAIL_COLOR,
  rotation = 0,
  large = false,
}: {
  part: Part;
  color?: string;
  rotation?: number;
  large?: boolean;
}) {
  const angle = quarterTurn(rotation),
    key = `${part.id}:${color}:${angle}`;
  const base = images[`${part.id}:${angle}`] ?? images.unknown;
  const [preview, setPreview] = useState<{ key: string; url: string } | null>(
    null,
  );
  useEffect(() => {
    const shape = shapeFor(part);
    if (!shape || color.toLowerCase() === THUMBNAIL_COLOR) return;
    let active = true;
    coloredThumbnail(shape, color, angle)
      .then((url) => {
        if (active) setPreview({ key, url });
      })
      .catch(() => {
        /* Keep the pre-rendered thumbnail if custom color rendering fails. */
      });
    return () => {
      active = false;
    };
  }, [part, color, angle, key]);
  return (
    <img
      className={`part-icon ${large ? "large" : ""}`}
      src={preview?.key === key ? preview.url : base}
      width="300"
      height="210"
      alt=""
      aria-hidden="true"
      loading={large ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
    />
  );
});
