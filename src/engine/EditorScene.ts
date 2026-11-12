import { cameraAxes, type AxisDirection } from "./orientation";
import { keyLabel } from "./shortcuts";
import * as THREE from "three";
import { buildSurfaceHit, centeredStudSnap } from "./targeting";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Brick, Catalog, Color, Hover, Settings, Tool } from "./types";
import { shapeFor, PLATE } from "./parts";
import { brickMesh, disposeGroup, setBrickContrast, updateBrickSilhouettes } from "./geometry";
import {
  connectors,
  footprintsOverlap,
  deletionCascade,
  rotatePoint,
  shapeOf,
  top,
  validate,
} from "./physics";
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(29, 29, 34);

export interface SceneState {
  bricks: Brick[];
  partId: string;
  colorId: number;
  rotation: number;
  placementOffset: { x: number; z: number };
  tool: Tool;
  settings: Settings;
  layer: number | null;
  deleteMode: "single" | "recursive";
}
export class EditorScene {
  private scene = new THREE.Scene();
  private directionalLight = new THREE.DirectionalLight("#fff7e8", 3.2);
  private hemisphereLight = new THREE.HemisphereLight("#ffffff", "#8b9690", 2.6);
  private ambientLight = new THREE.AmbientLight("#ffffff", 3);

  private floatingPulse: {
    start: number;
    reducedMotion: boolean;
    materials: { material: THREE.MeshStandardMaterial; color: THREE.Color; emissive: THREE.Color; intensity: number }[];
  } | null = null;
  private dirty = true;
  private hoverDirty = true;
  private invalidate = () => {
    this.dirty = true;
    this.hoverDirty = true;
  };
  private panKeys = new Set<string>();
  private lastOrientation = new THREE.Quaternion(0, 0, 0, 0);
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 800);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private models = new THREE.Group();
  private meshes = new Map<string, { brick: Brick; group: THREE.Group }>();
  private deleteCache: { bricks: Brick[] | null; id: string; ids: string[] } = {
    bricks: null,
    id: "",
    ids: [],
  };
  private overlays = new THREE.Group();
  private board = new THREE.Group();
  private manualProjection = { y: 0, x: 0, z: 0 };
  private lastBuildSample: { brick: Brick; pointer: THREE.Vector2; baseX: number; baseZ: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(999, 999);
  private cursor = { x: 0, y: 0, inside: false };
  private state: SceneState;
  private parts;
  private colors;
  private resize: ResizeObserver;
  private frame = 0;
  private previousTime = 0;
  private drag = false;
  private down = { x: 0, y: 0 };
  private buttons = 0;
  private hover: Hover = {
    brick: null,
    valid: false,
    reason: "Move onto the build area",
    deleting: [],
  };
  private signature = "";
  constructor(
    private host: HTMLDivElement,
    catalog: Catalog,
    state: SceneState,
    private onHover: (h: Hover) => void,
    private onPlace: (b: Brick) => void,
    private onDelete: (ids: string[]) => void,
    private onPick: (brick: Brick) => void,
    private onOrientation: (axes: AxisDirection[]) => void,
  ) {
    this.state = state;
    this.manualProjection.y = (state.layer ?? 0) * PLATE;
    this.parts = new Map(catalog.parts.map((p) => [p.id, p]));
    this.colors = new Map(catalog.colors.map((c) => [c.id, c]));
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor("#e8eae5");
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.camera.position.copy(DEFAULT_CAMERA_POSITION);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.mouseButtons = {
      LEFT:
        state.tool === "orbit"
          ? THREE.MOUSE.ROTATE
          : (null as unknown as THREE.MOUSE),
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.controls.addEventListener("change", this.invalidate);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 160;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.target.set(0, 0, 0);
    const light = this.directionalLight;
    light.position.set(-15, 35, 20);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -40;
    light.shadow.camera.right = 40;
    light.shadow.camera.top = 40;
    light.shadow.camera.bottom = -40;
    light.shadow.normalBias = 0.025;
    light.shadow.bias = -0.00015;
    this.scene.add(light, this.hemisphereLight, this.ambientLight, this.models, this.overlays, this.board);
    this.updateLighting();
    this.makeBoard();
    this.rebuild();
    const canvas = this.renderer.domElement;
    canvas.addEventListener("wheel", this.horizontalWheel, { passive: false, capture: true });
    canvas.addEventListener("pointermove", this.move);
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointerup", this.pointerUp);
    canvas.addEventListener("pointerleave", this.leave);
    canvas.addEventListener("contextmenu", this.contextMenu);
    this.resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.invalidate();
    });
    this.resize.observe(host);
    this.animate(0);
  }
  private makeBoard() {
    this.board.clear();
    const size = this.state.settings.boardSize;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: "#d7dcd1", roughness: 0.95 }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.012;
    plane.receiveShadow = true;
    plane.name = "ground";
    this.board.add(plane);
    const grid = new THREE.GridHelper(size, size, "#b9c2b3", "#c6cebf");
    grid.position.y = -0.008;
    this.board.add(grid);
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(size, 0.16, size)),
      new THREE.LineBasicMaterial({ color: "#aeb9a5" }),
    );
    border.position.y = -0.1;
    this.board.add(border);
    const dots = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.012, 8),
      new THREE.MeshStandardMaterial({ color: "#bcc7b5", roughness: 1 }),
      size * size,
    );
    const matrix = new THREE.Matrix4();
    let i = 0;
    for (let x = -size / 2; x < size / 2; x++)
      for (let z = -size / 2; z < size / 2; z++)
        dots.setMatrixAt(i++, matrix.makeTranslation(x, 0, z));
    this.board.add(dots);
  }
  private rebuild() {
    const ids = new Set(this.state.bricks.map((b) => b.id));
    for (const [id, entry] of this.meshes)
      if (!ids.has(id)) {
        this.models.remove(entry.group);
        disposeGroup(entry.group);
        this.meshes.delete(id);
      }
    for (const b of this.state.bricks) {
      const existing = this.meshes.get(b.id);
      if (existing?.brick === b) continue;
      if (existing) {
        this.models.remove(existing.group);
        disposeGroup(existing.group);
        this.meshes.delete(b.id);
      }
      const s = shapeFor(this.parts.get(b.partId)),
        c = this.colors.get(b.colorId);
      if (s && c) {
        const group = brickMesh(b, s, c);
        setBrickContrast(group, this.state.settings.directionalLight === false);
        this.models.add(group);
        this.meshes.set(b.id, { brick: b, group });
      }
    }
  }
  private updateLighting() {
    const directional = this.state.settings.directionalLight !== false;
    if (this.ambientLight.visible !== !directional) setBrickContrast(this.models, !directional);
    this.directionalLight.visible = directional;
    this.hemisphereLight.visible = directional;
    this.ambientLight.visible = !directional;
  }
  update(state: SceneState) {
    const old = this.state;
    if (old.layer === null && state.layer !== null) this.anchorManualProjection(state);
    this.state = state;
    this.updateLighting();
    this.controls.mouseButtons.LEFT =
      state.tool === "orbit"
        ? THREE.MOUSE.ROTATE
        : (null as unknown as THREE.MOUSE);
    if (old.bricks !== state.bricks) { this.clearFloatingPulse(); this.rebuild(); }
    if (old.settings.boardSize !== state.settings.boardSize) {
      disposeGroup(this.board);
      this.makeBoard();
    }
    this.signature = "";
    this.invalidate();
    this.computeHover();
  }
  /** Keep x/z on the same reference plane while changing only the bottom y. */
  private anchorManualProjection(state: SceneState) {
    const sample = this.lastBuildSample;
    this.manualProjection = { y: sample?.brick.y ?? 0, x: 0, z: 0 };
    const shape = shapeFor(this.parts.get(state.partId));
    if (!sample || !shape || sample.brick.partId !== state.partId || sample.brick.rotation !== state.rotation) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(sample.pointer, this.camera);
    const point = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.manualProjection.y), new THREE.Vector3());
    if (!point) return;
    const phase = rotatePoint((shape.width - 1) / 2, (shape.depth - 1) / 2, state.rotation);
    // Preserve the stud-centered Auto snap at the handoff to the manual plane.
    this.manualProjection.x = sample.baseX - (Math.round(point.x + phase.x) - phase.x);
    this.manualProjection.z = sample.baseZ - (Math.round(point.z + phase.z) - phase.z);
  }
  private move = (e: PointerEvent) => {
    this.hoverDirty = true;
    const r = this.host.getBoundingClientRect();
    this.cursor = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
    this.pointer.set(
      (this.cursor.x / r.width) * 2 - 1,
      (-this.cursor.y / r.height) * 2 + 1,
    );
    if (
      this.buttons &&
      Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 4
    )
      this.drag = true;
  };
  private pointerDown = (e: PointerEvent) => {
    this.hoverDirty = true;
    this.buttons = e.buttons;
    this.down = { x: e.clientX, y: e.clientY };
    this.drag = false;
    if (e.button === 1) e.preventDefault();
  };
  private pointerUp = (e: PointerEvent) => {
    this.hoverDirty = true;
    this.buttons = 0;
    if (e.button !== 0 || this.drag || this.state.tool === "orbit") return;
    this.move(e);
    this.computeHover();
    if (this.state.tool === "pick") {
      if (this.hover.brick) this.onPick(this.hover.brick);
    } else if (this.state.tool === "delete") {
      if (this.hover.deleting.length) this.onDelete(this.hover.deleting);
    } else if (this.hover.valid && this.hover.brick)
      this.onPlace({ ...this.hover.brick, id: crypto.randomUUID() });
  };
  private leave = () => {
    this.cursor.inside = false;
    this.buttons = 0;
    this.signature = "";
    this.invalidate();
    this.computeHover();
  };
  private horizontalWheel = (event: WheelEvent) => {
    const horizontal = event.deltaX || (event.shiftKey ? event.deltaY : 0);
    if (!horizontal || (!event.shiftKey && Math.abs(event.deltaY) > Math.abs(horizontal))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.host.clientWidth : 1;
    const angle = -Math.max(-200, Math.min(200, horizontal * unit)) * 0.004;
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    this.invalidate();
  };
  private contextMenu = (e: Event) => e.preventDefault();
  private computeHover() {
    if (!this.hoverDirty) return;
    this.hoverDirty = false;
    let h: Hover = {
      brick: null,
      valid: false,
      reason:
        this.state.tool === "orbit"
          ? `Drag with the left mouse button to orbit · ${keyLabel(this.state.settings.keyBindings?.build ?? "b")} returns to building`
          : "Move onto the build area",
      deleting: [],
    };
    if (this.cursor.inside && !this.buttons && this.state.tool !== "orbit") {
      this.models.updateMatrixWorld(true);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster
        .intersectObjects(this.models.children, true)
        .filter((o) => o.object instanceof THREE.Mesh && typeof o.object.userData.brickId === "string");
      const hit = this.state.tool === "build" && this.state.layer === null
        ? buildSurfaceHit(hits)
        : hits[0];
      const hitBrick = hit
        ? this.state.bricks.find((b) => b.id === hit.object.userData.brickId)
        : undefined;
      if (this.state.tool === "pick") {
        h = {
          brick: hitBrick ?? null,
          valid: !!hitBrick,
          deleting: [],
          reason: hitBrick
            ? `Click to select ${this.parts.get(hitBrick.partId)?.name} · ${this.colors.get(hitBrick.colorId)?.name}`
            : "Click a placed brick to select its part and color",
        };
      } else if (this.state.tool === "delete") {
        if (hitBrick) {
          if (
            this.deleteCache.bricks !== this.state.bricks ||
            this.deleteCache.id !== hitBrick.id
          )
            this.deleteCache = {
              bricks: this.state.bricks,
              id: hitBrick.id,
              ids: deletionCascade(hitBrick.id, this.state.bricks, this.parts),
            };
          h = {
            brick: hitBrick,
            valid: true,
            reason: this.state.deleteMode === "recursive"
              ? `Click to remove ${this.deleteCache.ids.length} highlighted pieces`
              : this.deleteCache.ids.length > 1 && !this.state.settings.allowFloating
                ? `Deleting this brick would leave ${this.deleteCache.ids.length - 1} pieces floating · click to review`
                : "Click to remove this brick",
            deleting: this.state.deleteMode === "single" ? [hitBrick.id] : this.deleteCache.ids,
          };
        } else h.reason = "Hover over a brick to preview removal";
      } else {
        const s = shapeFor(this.parts.get(this.state.partId));
        if (s) {
          // Auto follows visible surfaces; an explicit layer uses a fixed plane
          // so the user can build underneath overhangs.
          const followSurface = this.state.layer === null;
          const y =
            this.state.layer !== null
              ? this.state.layer * PLATE
              : followSurface && hitBrick
                ? top(hitBrick, this.parts)
                : 0;
          const point = new THREE.Vector3();
          // For an actual surface hit, preserve its x/z. Projecting a side or
          // raised stud onto the body-top plane shifts the pointer behind it.
          const intersection = followSurface && hitBrick && hit
            ? point.copy(hit.point)
            : this.raycaster.ray.intersectPlane(
                new THREE.Plane(new THREE.Vector3(0, 1, 0), -(followSurface ? y : this.manualProjection.y)),
                point,
              );
          if (intersection) {
            const offset = rotatePoint(
              (s.width - 1) / 2,
              (s.depth - 1) / 2,
              this.state.rotation,
            );
            let x = Math.round(point.x + offset.x) - offset.x + (followSurface ? 0 : this.manualProjection.x),
              z = Math.round(point.z + offset.z) - offset.z + (followSurface ? 0 : this.manualProjection.z);
            if (
              hitBrick &&
              followSurface &&
              shapeOf(hitBrick, this.parts).studs
            ) {
              const studs = connectors(hitBrick, shapeOf(hitBrick, this.parts));
              const anchor = studs.reduce((best, p) =>
                Math.hypot(p.x - point.x, p.z - point.z) <
                Math.hypot(best.x - point.x, best.z - point.z)
                  ? p
                  : best,
              );
              const candidate = {
                id: "preview",
                partId: this.state.partId,
                colorId: this.state.colorId,
                x,
                y,
                z,
                rotation: this.state.rotation,
              };
              const sockets = connectors(candidate, s);
              const socket = sockets.reduce((best, p) =>
                Math.hypot(p.x - anchor.x, p.z - anchor.z) <
                Math.hypot(best.x - anchor.x, best.z - anchor.z)
                  ? p
                  : best,
              );
              x += anchor.x - socket.x;
              z += anchor.z - socket.z;
              const centered = centeredStudSnap(point, hitBrick, s, this.state.rotation, this.parts);
              if (centered) { x = centered.x; z = centered.z; }
            }
            x += this.state.placementOffset.x;
            z += this.state.placementOffset.z;
            let b: Brick = {
              id: "preview",
              partId: this.state.partId,
              colorId: this.state.colorId,
              x,
              y,
              z,
              rotation: this.state.rotation,
            };
            // A directly targeted surface wins, including underneath overhangs.
            // Only search the footprint for support when the pointer misses every brick.
            if (followSurface && !hitBrick) {
              const supports = this.state.bricks
                .filter(
                  (other) =>
                    top(other, this.parts) > b.y + 0.012 &&
                    footprintsOverlap(b, other, this.parts),
                )
                .sort((a, c) => top(c, this.parts) - top(a, this.parts));
              for (const support of supports) {
                const lifted = { ...b, y: top(support, this.parts) };
                if (
                  !validate(
                    lifted,
                    this.state.bricks,
                    this.parts,
                    this.state.settings.boardSize,
                    !this.state.settings.allowFloating,
                  )
                ) {
                  b = lifted;
                  break;
                }
              }
            }
            const reason = validate(
              b,
              this.state.bricks,
              this.parts,
              this.state.settings.boardSize,
              !this.state.settings.allowFloating,
            );
            this.lastBuildSample = { brick: b, pointer: this.pointer.clone(), baseX: b.x - this.state.placementOffset.x, baseZ: b.z - this.state.placementOffset.z };
            h = {
              brick: b,
              valid: !reason,
              reason: reason || (this.state.settings.allowFloating ? "Click to place · clear" : "Click to place · connected & clear"),
              deleting: [],
            };
          }
        } else h.reason = "This catalog part has no geometry definition yet";
      }
    }
    const signature = JSON.stringify(h);
    if (signature === this.signature) return;
    this.signature = signature;
    this.dirty = true;
    this.hover = h;
    disposeGroup(this.overlays);
    this.overlays.clear();
    const color =
      this.colors.get(this.state.colorId) ??
      (this.colors.values().next().value as Color);
    if (this.state.tool === "build" && h.brick) {
      this.overlays.add(
        brickMesh(
          h.brick,
          shapeOf(h.brick, this.parts),
          color,
          h.valid ? "#147d57" : "#de5142",
        ),
      );
    }
    if (this.state.tool === "pick" && h.brick)
      this.overlays.add(
        brickMesh(h.brick, shapeOf(h.brick, this.parts), color, "#3677a8"),
      );
    if (this.state.tool === "delete")
      for (const id of h.deleting) {
        const b = this.state.bricks.find((b) => b.id === id)!;
        this.overlays.add(
          brickMesh(b, shapeOf(b, this.parts), color, "#df513f"),
        );
      }
    this.onHover(h);
  }
  /** Briefly identify every unsupported component without changing the build. */
  pulseFloatingBricks(ids: string[]) {
    this.clearFloatingPulse();
    const materials = new Set<THREE.MeshStandardMaterial>();
    for (const id of ids) {
      this.meshes.get(id)?.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          if (material instanceof THREE.MeshStandardMaterial) materials.add(material);
      });
    }
    if (!materials.size) return;
    this.floatingPulse = {
      start: performance.now(),
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      materials: [...materials].map((material) => ({ material, color: material.color.clone(), emissive: material.emissive.clone(), intensity: material.emissiveIntensity })),
    };
    this.dirty = true;
  }
  private clearFloatingPulse() {
    if (!this.floatingPulse) return;
    for (const { material, color, emissive, intensity } of this.floatingPulse.materials) {
      material.color.copy(color);
      material.emissive.copy(emissive);
      material.emissiveIntensity = intensity;
    }
    this.floatingPulse = null;
    this.dirty = true;
  }
  private updateFloatingPulse(time: number) {
    const pulse = this.floatingPulse;
    if (!pulse) return;
    const elapsed = time - pulse.start;
    if (elapsed >= 3600) { this.clearFloatingPulse(); return; }
    const strength = pulse.reducedMotion || Math.floor(elapsed / 600) % 2 === 0 ? 1 : 0;
    for (const { material, color } of pulse.materials) {
      // Tint the base as well as emission so yellow and white pieces turn red,
      // rather than merely appearing brighter under the scene's lights.
      material.color.copy(color).lerp(new THREE.Color("#ff1028"), strength);
      material.emissive.set("#ff0018");
      material.emissiveIntensity = strength * 1.4;
    }
    this.dirty = true;
  }
  private animate = (time: number) => {
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min((time - this.previousTime) / 1000, 0.05);
    this.previousTime = time;
    const { edgePan, edgeSize, panSpeed } = this.state.settings;
    if (edgePan && this.cursor.inside && !this.buttons) {
      const r = this.host.getBoundingClientRect(),
        zone = Math.min(edgeSize, r.width / 3, r.height / 3);
      const strength = (p: number, length: number) =>
        p < zone
          ? -(1 - p / zone)
          : p > length - zone
            ? 1 - (length - p) / zone
            : 0;
      const dx = strength(this.cursor.x, r.width),
        dy = strength(this.cursor.y, r.height);
      if (dx || dy) {
        this.panView(dx, dy, panSpeed * dt);
      }
    }
    const dx =
      Number(this.panKeys.has("ArrowRight")) -
      Number(this.panKeys.has("ArrowLeft"));
    const dy =
      Number(this.panKeys.has("ArrowDown")) -
      Number(this.panKeys.has("ArrowUp"));
    if (dx || dy) this.panView(dx, dy, (panSpeed * dt) / Math.hypot(dx, dy));
    this.controls.update();
    this.computeHover();
    this.updateFloatingPulse(time);
    if (this.dirty) {
      if (!this.lastOrientation.equals(this.camera.quaternion)) {
        this.lastOrientation.copy(this.camera.quaternion);
        this.onOrientation(cameraAxes(this.camera.quaternion));
      }
      updateBrickSilhouettes(this.models, this.camera);
      updateBrickSilhouettes(this.overlays, this.camera);
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  };
  setPanKey(key: string, pressed: boolean) {
    if (!key.startsWith("Arrow")) return;
    if (pressed) this.panKeys.add(key);
    else this.panKeys.delete(key);
  }
  clearPanKeys() {
    this.panKeys.clear();
  }
  private panView(dx: number, dy: number, distance: number) {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3()
      .crossVectors(forward, this.camera.up)
      .normalize();
    const move = right
      .multiplyScalar(dx)
      .add(forward.multiplyScalar(-dy))
      .multiplyScalar(distance);
    const next = this.controls.target.clone().add(move);
    if (
      Math.abs(next.x) < this.state.settings.boardSize &&
      Math.abs(next.z) < this.state.settings.boardSize
    ) {
      this.camera.position.add(move);
      this.controls.target.add(move);
    }
  }
  resetOrientation() {
    const target = this.controls.target.clone();
    const distance = this.camera.position.distanceTo(target);
    const damping = this.controls.enableDamping;
    // Consume pending orbit/pan momentum before restoring the orientation.
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.target.copy(target);
    this.camera.position.copy(DEFAULT_CAMERA_POSITION).setLength(distance).add(target);
    this.camera.up.set(0, 1, 0);
    this.controls.update();
    this.controls.enableDamping = damping;
    this.invalidate();
  }
  home() {
    this.invalidate();
    this.camera.position.copy(DEFAULT_CAMERA_POSITION);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
  zoom(factor: number) {
    this.invalidate();
    const delta = this.camera.position
      .clone()
      .sub(this.controls.target)
      .multiplyScalar(factor);
    if (delta.length() > 5 && delta.length() < 160)
      this.camera.position.copy(this.controls.target).add(delta);
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    this.clearFloatingPulse();
    this.resize.disconnect();
    this.controls.removeEventListener("change", this.invalidate);
    this.controls.dispose();
    const c = this.renderer.domElement;
    c.removeEventListener("wheel", this.horizontalWheel, true);
    c.removeEventListener("pointermove", this.move);
    c.removeEventListener("pointerdown", this.pointerDown);
    c.removeEventListener("pointerup", this.pointerUp);
    c.removeEventListener("pointerleave", this.leave);
    c.removeEventListener("contextmenu", this.contextMenu);
    disposeGroup(this.scene);
    this.renderer.dispose();
    c.remove();
  }
}
