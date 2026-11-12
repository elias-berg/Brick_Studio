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
export interface Shape {
  width: number;
  depth: number;
  height: number;
  kind: "brick" | "plate" | "tile" | "round" | "baseplate";
  studs: boolean;
}
export interface Brick {
  id: string;
  partId: string;
  colorId: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
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
export interface Hover {
  brick: Brick | null;
  valid: boolean;
  reason: string;
  deleting: string[];
}
