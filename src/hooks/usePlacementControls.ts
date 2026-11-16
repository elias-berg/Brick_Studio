import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { gridPrecision } from "../engine/grid";
import { quarter } from "../engine/spatial";
import { PLATE } from "../engine/parts";
import type { Brick, Hover, PlacementAnchor, Tool } from "../engine/types";

/** Placement transforms and a temporarily fixed target are independent of the project. */
export function usePlacementControls(tool: Tool, setTool: Dispatch<SetStateAction<Tool>>, hover: Hover) {
  const [rotation, setRotation] = useState(0);
  const [rotationX, setRotationX] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);
  const [rotationMode, setRotationMode] = useState(false);
  const [placementOffset, setPlacementOffset] = useState({ x: 0, z: 0 });
  const [layer, setLayer] = useState<number | null>(null);
  const [placementAnchor, setPlacementAnchor] = useState<PlacementAnchor | null>(null);
  const [placementLocked, setPlacementLocked] = useState(true);
  const current = useRef({ layer, placementOffset, placementAnchor });
  current.current = { layer, placementOffset, placementAnchor };
  const lastManualLayer = useRef<number | null>(null);
  const lastPreview = useRef<Brick | null>(null);
  if (tool === "build" && hover.brick) lastPreview.current = hover.brick;
  const releasePlacement = useCallback(() => {
    setPlacementAnchor(null);
    lastPreview.current = null;
  }, []);
  const pinPlacement = useCallback(() => {
    const sample = lastPreview.current;
    if (!sample) return;
    const offset = current.current.placementOffset;
    setPlacementAnchor((anchor) => anchor ?? {
      x: sample.x - offset.x, y: sample.y, z: sample.z - offset.z,
    });
  }, []);
  const nudgeRotation = useCallback((axis: "x" | "y" | "z", step: number) => {
    const setter = axis === "x" ? setRotationX : axis === "y" ? setRotation : setRotationZ;
    setter((angle) => quarter(angle + step * 90));
    setTool("build");
  }, [setTool]);
  const toggleRotationMode = useCallback(() => {
    setRotationMode((active) => !active);
    setTool("build");
  }, [setTool]);
  const resetPlacement = useCallback(() => {
    setRotation(0);
    setRotationX(0);
    setRotationZ(0);
    setRotationMode(false);
    setPlacementOffset({ x: 0, z: 0 });
    lastManualLayer.current = 0;
    setLayer(null);
    releasePlacement();
    setTool("build");
  }, [releasePlacement, setTool]);
  const nudgePlacement = useCallback((x: number, z: number) => {
    pinPlacement();
    setPlacementOffset((offset) => ({ x: gridPrecision(offset.x + x), z: gridPrecision(offset.z + z) }));
    setTool("build");
  }, [pinPlacement, setTool]);
  const chooseLayer = useCallback((value: number) => {
    // Preserve the exact connector phase while moving by whole plates.
    const next = Math.max(0, Math.min(600, Number(value.toFixed(6))));
    pinPlacement();
    lastManualLayer.current = next;
    setLayer(next);
    setTool("build");
  }, [pinPlacement, setTool]);
  const toggleLayerMode = useCallback(() => {
    if (rotationMode) { setRotationMode(false); return; }
    const { layer, placementAnchor, placementOffset } = current.current;
    if (layer !== null || placementAnchor || placementOffset.x || placementOffset.z) {
      setLayer(null);
      setPlacementOffset({ x: 0, z: 0 });
      releasePlacement();
      setTool("build");
    } else chooseLayer(lastManualLayer.current ?? (lastPreview.current?.y ?? 0) / PLATE);
  }, [chooseLayer, releasePlacement, setTool, rotationMode]);
  const nudgeLayer = useCallback((delta: number) => {
    const base = current.current.layer ?? (lastPreview.current?.y ?? 0) / PLATE;
    chooseLayer(base + delta);
  }, [chooseLayer]);
  // Both keyboard bindings and the on-screen pad use this dispatcher.
  const adjustAxis = useCallback((axis: "x" | "y" | "z", step: number) => {
    if (rotationMode) nudgeRotation(axis, step);
    else if (axis === "y") nudgeLayer(step);
    else nudgePlacement(axis === "x" ? step : 0, axis === "z" ? step : 0);
  }, [rotationMode, nudgeRotation, nudgeLayer, nudgePlacement]);
  return { rotation, setRotation, rotationX, setRotationX, rotationZ, setRotationZ, rotationMode, setRotationMode, adjustAxis, toggleRotationMode, placementOffset, setPlacementOffset, layer, setLayer,
    placementAnchor, releasePlacement, placementLocked, setPlacementLocked, lastManualLayer,
    resetPlacement, toggleLayerMode };
}
