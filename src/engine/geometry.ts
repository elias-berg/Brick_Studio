import { bodyDefinition } from "./underside";
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { Brick, Color, Shape, StudConflict } from "./types";
import { lift, localConnectors } from "./spatial";
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
  const cylinders: { x: number; y: number; z: number; radius: number; height: number; normal: THREE.Vector3 }[] = [];
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
    normal = new THREE.Vector3(0, 1, 0),
    stud = false,
  ) => {
    if (geometry instanceof THREE.CylinderGeometry) {
      cylinders.push({ x, y, z, radius: geometry.parameters.radiusTop, height: geometry.parameters.height, normal });
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal));
    }
    if (!wire) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.brickId = brick.id;
      if (stud) mesh.userData.studNormal = normal.toArray();
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
  const body = bodyDefinition(shape);
  const bodyPositions: number[] = [], bodyNormals: number[] = [];
  for (const face of body.faces) for (let i=1;i<face.vertices.length-1;i++) {
    const triangle=[face.vertices[0],face.vertices[i],face.vertices[i+1]];
    if (triangle[0].x === triangle[2].x && triangle[0].y === triangle[2].y && triangle[0].z === triangle[2].z) continue;
    for (const p of triangle) {
      bodyPositions.push(p.x,p.y,p.z);
      bodyNormals.push(face.normal.x,face.normal.y,face.normal.z);
    }
  }
  const bodyGeometry = new THREE.BufferGeometry();
  bodyGeometry.setAttribute("position",new THREE.Float32BufferAttribute(bodyPositions,3));
  bodyGeometry.setAttribute("normal",new THREE.Float32BufferAttribute(bodyNormals,3));
  add(bodyGeometry,0,0,0);
  for (const ring of body.rings) for (const radius of [ring.outer,ring.inner]) if(radius) {
    cylinders.push({x:ring.x,y:(ring.bottom+ring.top)/2,z:ring.z,radius,height:ring.top-ring.bottom,normal:new THREE.Vector3(0,1,0)});
  }
  for (const port of localConnectors(shape)) if (port.kind === "stud") {
    const normal = new THREE.Vector3(port.normal.x, port.normal.y, port.normal.z);
    const center = new THREE.Vector3(port.point.x, port.point.y, port.point.z).addScaledVector(normal, STUD_HEIGHT / 2);
    add(new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 24), center.x, center.y, center.z, normal, true);
  }
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
    localCamera.y += h / 2;
    let offset = wirePositions.length;
    for (const cylinder of cylinders) {
      const center = new THREE.Vector3(cylinder.x, cylinder.y, cylinder.z);
      const u = new THREE.Vector3().crossVectors(cylinder.normal, Math.abs(cylinder.normal.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
      const v = new THREE.Vector3().crossVectors(cylinder.normal, u);
      const delta = localCamera.clone().sub(center);
      const dx = delta.dot(u), dz = delta.dot(v);
      const angle = Math.atan2(dz, dx);
      const tangent = Math.acos(Math.min(1, cylinder.radius / Math.max(Math.hypot(dx, dz), cylinder.radius)));
      for (const side of [-1, 1]) {
        const rim = center.clone().addScaledVector(u, Math.cos(angle + side * tangent) * cylinder.radius).addScaledVector(v, Math.sin(angle + side * tangent) * cylinder.radius);
        for (const end of [-1, 1]) {
          const p = rim.clone().addScaledVector(cylinder.normal, end * cylinder.height / 2);
          positions[offset++] = p.x; positions[offset++] = p.y; positions[offset++] = p.z;
        }
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
  for (const child of group.children) child.position.y -= h / 2;
  group.position.set(brick.x, brick.y + lift(shape, brick), brick.z);
  group.rotation.set(THREE.MathUtils.degToRad(brick.rotationX ?? 0), THREE.MathUtils.degToRad(brick.rotation), THREE.MathUtils.degToRad(brick.rotationZ ?? 0), "XYZ");
  return group;
}
/** High-contrast evidence from the same material test that rejects placement. */
export function studConflictMarkers(conflicts: StudConflict[]) {
  const group = new THREE.Group();
  const red = new THREE.MeshBasicMaterial({ color: "#e52b25", transparent: true, depthTest: false, depthWrite: false });
  const white = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthTest: false, depthWrite: false });
  const blue = new THREE.MeshBasicMaterial({ color: "#006cf0", transparent: true, depthTest: false, depthWrite: false });
  for (const conflict of conflicts) {
    const normal = new THREE.Vector3(conflict.normal.x, conflict.normal.y, conflict.normal.z);
    const point = new THREE.Vector3(conflict.point.x, conflict.point.y, conflict.point.z).addScaledVector(normal, STUD_HEIGHT / 2);
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), normal);
    for (const [thickness, material, order] of [[.045, white, 30], [.025, red, 31]] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(STUD_RADIUS + .06, thickness, 6, 32), material);
      ring.position.copy(point); ring.quaternion.copy(rotation); ring.renderOrder = order;
      group.add(ring);
    }
    if (conflict.socket) {
      const socket = new THREE.Vector3(conflict.socket.x, conflict.socket.y, conflict.socket.z).addScaledVector(normal, STUD_HEIGHT / 2);
      for (const [thickness, material, order] of [[.055,white,30],[.025,blue,32]] as const) {
        for (const angle of [-Math.PI/4,Math.PI/4]) {
          const cross = new THREE.Mesh(new THREE.BoxGeometry(.22,thickness,thickness), material);
          cross.rotation.z = angle;
          cross.applyQuaternion(rotation);
          cross.position.copy(socket); cross.renderOrder = order;
          group.add(cross);
        }
      }
    }
  }
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
