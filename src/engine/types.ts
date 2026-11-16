import type { KeyBindings } from "./shortcuts";
export interface Part {
  id: string;
  name: string;
  category: number;
}
export interface Color {
  id: number;
  name: string;
  rgb: string;
  transparent: boolean;
}
export interface Catalog {
  fetched: string;
  source: string;
  parts: Part[];
  colors: Color[];
  categories: { id: number; name: string }[];
}
export interface Vec3 { x: number; y: number; z: number }
export interface LocalConnector { point: Vec3; normal: Vec3; kind: "stud" | "socket" }
export interface Shape {
  width: number;
  depth: number;
  height: number;
  kind: "brick" | "plate" | "tile" | "round" | "baseplate";
  studs: boolean;
  sideStuds?: { point: Vec3; normal: Vec3 }[];
}
export interface Brick {
  id: string;
  partId: string;
  colorId: number;
  x: number;
  y: number;
  z: number;
  /** Legacy rotation is world Y; absent X/Z rotations mean upright. */
  rotation: number;
  rotationX?: number;
  rotationZ?: number;
}
export interface Settings {
  keyBindings: KeyBindings;
  allowFloating: boolean;
  directionalLight: boolean;
  edgePan: boolean;
  edgeSize: number;
  panSpeed: number;
  boardSize: number;
}
export type Tool = "build" | "delete" | "pick" | "orbit";
export interface StudConflict {
  sourceId: string;
  targetId: string;
  point: Vec3;
  normal: Vec3;
  socket?: Vec3;
}
export interface Hover {
  brick: Brick | null;
  valid: boolean;
  reason: string;
  deleting: string[];
  conflicts?: StudConflict[];
}

/** World-space base of a preview held while adjusting its offsets. */
export type PlacementAnchor = Pick<Brick, "x" | "y" | "z">;
