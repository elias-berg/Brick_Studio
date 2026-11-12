import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { PLATE } from "../engine/parts";
import type { Hover, Tool } from "../engine/types";

/** Placement transforms are independent of the project and personal preferences. */
export function usePlacementControls(tool: Tool, setTool: Dispatch<SetStateAction<Tool>>, hover: Hover) {
  const [rotation, setRotation] = useState(0);
  const [placementOffset, setPlacementOffset] = useState({ x: 0, z: 0 });
  const [layer, setLayer] = useState<number | null>(null);
  const [placementLocked, setPlacementLocked] = useState(true);
  const currentLayer = useRef(layer);
  currentLayer.current = layer;
  const lastManualLayer = useRef<number | null>(null);
  const lastPreviewLayer = useRef(0);
  if (tool === "build" && hover.brick) lastPreviewLayer.current = Math.round(hover.brick.y / PLATE);
  const resetPlacement = useCallback(() => {
    setRotation(0);
    setPlacementOffset({ x: 0, z: 0 });
    lastManualLayer.current = 0;
    setLayer(null);
    setTool("build");
  }, []);
  const nudgePlacement = useCallback((x: number, z: number) => {
    setPlacementOffset((offset) => ({ x: offset.x + x, z: offset.z + z }));
  }, []);
  const chooseLayer = useCallback((value: number) => {
    const next = Math.max(0, Math.min(600, Math.round(value || 0)));
    lastManualLayer.current = next;
    setLayer(next);
    setTool("build");
  }, []);
  const toggleLayerMode = useCallback(() => {
    if (currentLayer.current === null) chooseLayer(lastManualLayer.current ?? lastPreviewLayer.current);
    else { setLayer(null); setTool("build"); }
  }, [chooseLayer]);
  const nudgeLayer = useCallback((delta: number) => {
    const base = currentLayer.current ?? lastPreviewLayer.current;
    chooseLayer(base + delta);
  }, [chooseLayer]);
  return { rotation, setRotation, placementOffset, setPlacementOffset, layer, setLayer,
    placementLocked, setPlacementLocked, lastManualLayer, resetPlacement,
    nudgePlacement, toggleLayerMode, nudgeLayer };
}
