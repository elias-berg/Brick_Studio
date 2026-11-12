import { Quaternion, Vector3 } from "three";

export interface AxisDirection {
  label: string;
  color: string;
  x: number;
  y: number;
  depth: number;
  negative: boolean;
}
/** Project world axes into camera space, independent of camera position/zoom. */
export function cameraAxes(cameraRotation: Quaternion): AxisDirection[] {
  const inverse = cameraRotation.clone().invert();
  return ([
    ["x", "#a65343", new Vector3(1, 0, 0)],
    ["y", "#60874f", new Vector3(0, 1, 0)],
    ["z", "#44789e", new Vector3(0, 0, 1)],
  ] as const).flatMap(([label, color, direction]) => [-1, 1].map((sign) => {
    const projected = direction.clone().multiplyScalar(sign).applyQuaternion(inverse);
    return { label: `${sign > 0 ? "+" : "−"}${label}`, color, x: projected.x, y: -projected.y, depth: projected.z, negative: sign < 0 };
  })).sort((a, b) => a.depth - b.depth);
}
