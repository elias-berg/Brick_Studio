import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { Brick, Color, Shape } from "./types";
import { PLATE, STUD_HEIGHT, STUD_RADIUS } from "./parts";
export function brickMesh(
  brick: Brick,
  shape: Shape,
  color: Color,
  wire?: string,
) {
  const group = new THREE.Group();
  const wirePositions: number[] = [];
  const h = shape.height * PLATE;
  const cylinders: { x: number; y: number; z: number; radius: number; height: number }[] = [];
  const material = new THREE.MeshStandardMaterial({
    color: `#${color.rgb}`,
    roughness: 0.27,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    metalness: 0.02,
    transparent: color.transparent,
    opacity: color.transparent ? 0.62 : 1,
  });
  const lineMaterial = new THREE.LineBasicMaterial({
    color: wire ?? "#18212b",
    transparent: true,
    opacity: wire ? 1 : 0.13,
    depthTest: !wire,
  });
  const add = (
    geometry: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
  ) => {
    if (geometry instanceof THREE.CylinderGeometry) {
      cylinders.push({ x, y, z, radius: geometry.parameters.radiusTop, height: geometry.parameters.height });
    }
    if (!wire) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.brickId = brick.id;
      group.add(mesh);
    }
    const edgeGeometry = new THREE.EdgesGeometry(geometry, 25);
    if (wire) {
      const points = edgeGeometry.getAttribute("position");
      for (let i = 0; i < points.count; i++) wirePositions.push(points.getX(i) + x, points.getY(i) + y, points.getZ(i) + z);
      edgeGeometry.dispose();
      geometry.dispose();
    } else {
      const edges = new THREE.LineSegments(edgeGeometry, lineMaterial);
      edges.userData.brickEdges = true;
      edges.position.set(x, y, z);
      group.add(edges);
    }
  };
  add(
    shape.kind === "round"
      ? new THREE.CylinderGeometry(0.49, 0.49, h, 40)
      : new THREE.BoxGeometry(shape.width - 0.02, h, shape.depth - 0.02),
    0,
    h / 2,
    0,
  );
  if (shape.studs)
    for (let x = 0; x < shape.width; x++)
      for (let z = 0; z < shape.depth; z++)
        add(
          new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 24),
          x - (shape.width - 1) / 2,
          h + STUD_HEIGHT / 2,
          z - (shape.depth - 1) / 2,
        );
  const positions = new Float32Array(wirePositions.length + cylinders.length * 12);
  positions.set(wirePositions);
  let markUpdated: () => void;
  let sideLines: THREE.LineSegments | undefined;
  if (wire) {
    const geometry = new LineSegmentsGeometry().setPositions(positions);
    // Use the scene depth (including translucent brick bodies) to distinguish
    // visible edges from edges behind a brick. Neither pass changes that depth.
    let dashedLines: LineSegments2 | undefined;
    for (const hidden of [true, false]) {
      for (const [color, width, order] of [["#ffffff", 4, 10], [wire, 1.8, 11]] as const) {
        const lines = new LineSegments2(geometry, new LineMaterial({
          color,
          linewidth: width,
          transparent: true,
          opacity: hidden ? 0.38 : 1,
          depthTest: true,
          depthFunc: hidden ? THREE.GreaterDepth : THREE.LessEqualDepth,
          depthWrite: false,
          dashed: hidden,
          dashSize: 0.14,
          gapSize: 0.12,
        }));
        lines.renderOrder = order + (hidden ? 0 : 2);
        lines.frustumCulled = false;
        group.add(lines);
        if (hidden) dashedLines = lines;
      }
    }
    markUpdated = () => {
      (geometry.getAttribute("instanceStart") as THREE.InterleavedBufferAttribute).data.needsUpdate = true;
      // The camera-facing cylinder sides move, so refresh their dash distances.
      dashedLines?.computeLineDistances();
    };
    material.dispose();
    lineMaterial.dispose();
  } else {
    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", attribute);
    sideLines = new THREE.LineSegments(geometry, lineMaterial);
    sideLines.userData.brickSilhouette = true;
    sideLines.visible = false;
    sideLines.frustumCulled = false;
    group.add(sideLines);
    markUpdated = () => { attribute.needsUpdate = true; };
  }
  const localCamera = new THREE.Vector3();
  group.userData.updateSilhouette = (camera: THREE.Camera) => {
    if (sideLines && !sideLines.visible) return;
    camera.getWorldPosition(localCamera);
    group.worldToLocal(localCamera);
    let offset = wirePositions.length;
    for (const cylinder of cylinders) {
      const dx = localCamera.x - cylinder.x, dz = localCamera.z - cylinder.z;
      const angle = Math.atan2(dz, dx);
      const tangent = Math.acos(Math.min(1, cylinder.radius / Math.max(Math.hypot(dx, dz), cylinder.radius)));
      for (const side of [-1, 1]) {
        const x = cylinder.x + Math.cos(angle + side * tangent) * cylinder.radius;
        const z = cylinder.z + Math.sin(angle + side * tangent) * cylinder.radius;
        positions[offset++] = x; positions[offset++] = cylinder.y - cylinder.height / 2; positions[offset++] = z;
        positions[offset++] = x; positions[offset++] = cylinder.y + cylinder.height / 2; positions[offset++] = z;
      }
    }
    markUpdated();
  };
  // A subtle circular inset on hollow round studs.
  if (!wire && shape.kind === "round" && brick.partId.startsWith("3062")) {
    const inset = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 24),
      new THREE.MeshStandardMaterial({
        color: `#${color.rgb}`,
        roughness: 0.8,
      }),
    );
    inset.userData.brickId = brick.id;
    inset.rotation.x = -Math.PI / 2;
    inset.position.y = h + 0.212;
    group.add(inset);
  }
  group.position.set(brick.x, brick.y, brick.z);
  group.rotation.y = THREE.MathUtils.degToRad(brick.rotation);
  return group;
}
/** Update dynamic edges before Three.js uploads geometry for this frame. */
export function updateBrickSilhouettes(root: THREE.Group, camera: THREE.Camera) {
  root.updateWorldMatrix(true, true);
  for (const brick of root.children) brick.userData.updateSilhouette?.(camera);
}
export function setBrickContrast(group: THREE.Object3D, highContrast: boolean) {
  group.traverse((object) => {
    if (object.userData.brickSilhouette) object.visible = highContrast;
    if (object instanceof THREE.LineSegments && object.userData.brickEdges) {
      const material = object.material as THREE.LineBasicMaterial;
      material.opacity = highContrast ? 0.85 : 0.13;
    }
  });
}
export function disposeGroup(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  group.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      geometries.add(o.geometry);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
