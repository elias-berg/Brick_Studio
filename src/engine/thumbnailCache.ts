import type { Shape } from "./types";
import {
  thumbnailSvg,
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
  quarterTurn,
} from "./thumbnailSvg";

// Only the selected-piece preview needs custom colors. Concurrent consumers
// share one rasterization, and the cache is bounded across long editing sessions.
const cache = new Map<string, Promise<string>>();
export function coloredThumbnail(
  shape: Shape,
  color: string,
  rotation: number,
): Promise<string> {
  const key = `${shape.kind}:${shape.width}:${shape.depth}:${shape.height}:${shape.studs}:${color}:${quarterTurn(rotation)}`;
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key);
    cache.set(key, existing);
    return existing;
  }
  const pending = new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(
      new Blob([thumbnailSvg(shape, color, rotation)], {
        type: "image/svg+xml",
      }),
    );
    const image = new Image();
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Error("Could not render the selected brick image."));
    };
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = THUMBNAIL_WIDTH;
        canvas.height = THUMBNAIL_HEIGHT;
        const context = canvas.getContext("2d");
        if (!context) throw Error("Canvas unavailable");
        context.drawImage(image, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(URL.createObjectURL(blob))
              : reject(Error("Could not encode brick image.")),
          "image/png",
        );
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    image.src = url;
  });
  cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  if (cache.size > 64) {
    const oldest = cache.keys().next().value!;
    const expired = cache.get(oldest)!;
    cache.delete(oldest);
    expired.then((url) => URL.revokeObjectURL(url)).catch(() => {});
  }
  return pending;
}
