import { useEditorShortcuts } from "./hooks/useEditorShortcuts";
import { usePlacementControls } from "./hooks/usePlacementControls";
import { MessageDialog } from "./components/MessageDialog";
import { AxisWidget, type AxisWidgetHandle } from "./components/AxisWidget";
import { applyUserConfig, defaultUserConfig, migrateLegacyUserConfig, readUserConfig, saveUserConfig, userConfig } from "./engine/config";
import { defaultBindings, keyLabel, ariaShortcut, type ShortcutAction } from "./engine/shortcuts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  PanelLeftClose,
  PanelLeftOpen,
  LockKeyhole,
  LockKeyholeOpen,
  ExternalLink,
  Plus,
  Trash2,
  RotateCw,
  LocateFixed,
  Lightbulb,
  LightbulbOff,
  Undo2,
  Redo2,
  Download,
  Settings2,
  HelpCircle,
  X,
  Check,
  Expand,
  Minus,
  Package,
  TriangleAlert,
} from "lucide-react";
import type {
  Brick,
  Catalog as CatalogData,
  Hover,
  Settings,
  Tool,
} from "./engine/types";
import { EditorScene } from "./engine/EditorScene";
import { groundedBrickIds } from "./engine/physics";
import { shapeFor } from "./engine/parts";
import { defaults, download, parseProject, projectDocument } from "./engine/storage";
import type { RestoredProject } from "./engine/storage";
import { demoBuild } from "./engine/demo";
import { Catalog } from "./components/Catalog";
import { ProjectActions } from "./components/ProjectActions";
import { ShortcutFooter } from "./components/ShortcutFooter";
import { TooltipButton } from "./components/TooltipButton";
import { BrickIcon } from "./components/BrickIcon";
import { ViewOrbitIcon } from "./components/ViewOrbitIcon";
import { ColorPicker } from "./components/ColorPicker";
import { PartIcon } from "./components/PartIcon";
import { ProjectDialogs } from "./components/ProjectDialogs";
import type { DialogName } from "./components/ProjectDialogs";
const STORAGE = "brick-studio-project-v1";
type Snapshot = { bricks: Brick[]; settings: Settings; name: string };
function Editor({ catalog }: { catalog: CatalogData }) {
  const initial = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) {
        const value: unknown = JSON.parse(saved);
        migrateLegacyUserConfig(value);
        return parseProject(value, catalog);
      }
    } catch (e) {
      console.warn("Saved project could not be restored", e);
    }
    return {
      format: "brick-studio",
      version: 1,
      name: "Untitled",
      bricks: [],
      settings: defaults,
    } as RestoredProject;
  }, [catalog]);
  const [bricks, setBricks] = useState<Brick[]>(initial.bricks),
    [name, setName] = useState(initial.name),
    [settings, setSettings] = useState<Settings>(() => applyUserConfig(initial.settings, readUserConfig()));
  const [partId, setPartId] = useState("3001"),
    [colorId, setColorId] = useState(14),
    [tool, setTool] = useState<Tool>("build");
  const [hover, setHover] = useState<Hover>({
    brick: null,
    valid: false,
    reason: "Move onto the build area",
    deleting: [],
  });
  const { rotation, setRotation, placementOffset, setPlacementOffset, layer, setLayer,
    placementLocked, setPlacementLocked, lastManualLayer, resetPlacement,
    nudgePlacement, toggleLayerMode, nudgeLayer } = usePlacementControls(tool, setTool, hover);
  const [modal, setModal] = useState<DialogName>(null),
    [notice, setNotice] = useState("");
  const [compactSidebars, setCompactSidebars] = useState(() => localStorage.getItem("brick-studio-compact-sidebars") === "true");
  const [deleteMode, setDeleteMode] = useState<"single" | "recursive">("single");
  const [deleteMenu, setDeleteMenu] = useState(false);
  const [floatingCount, setFloatingCount] = useState(0);
  const [floatingReturnModal, setFloatingReturnModal] = useState<DialogName>(null);
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; count: number } | null>(null);
  const partLibrary = useMemo(() => new Map(catalog.parts.map((part) => [part.id, part])), [catalog]);
  const [past, setPast] = useState<Snapshot[]>([]),
    [future, setFuture] = useState<Snapshot[]>([]);
  const axisWidget = useRef<AxisWidgetHandle>(null);
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<EditorScene | null>(null),
    file = useRef<HTMLInputElement>(null);
  const latest = useRef({ bricks, past, future, settings, name, placementLocked });
  latest.current = { bricks, past, future, settings, name, placementLocked };
  const notify = useCallback((message: string) => setNotice(message), []);
  const commit = useCallback((next: Brick[]) => {
    setPast((p) => [
      ...p.slice(-79),
      {
        bricks: latest.current.bricks,
        settings: latest.current.settings,
        name: latest.current.name,
      },
    ]);
    setFuture([]);
    setBricks(next);
  }, []);
  const undo = useCallback(() => {
    const { past, bricks, settings, name } = latest.current;
    if (!past.length) return;
    setFuture((f) => [{ bricks, settings, name }, ...f]);
    const prev = past[past.length - 1];
    setBricks(prev.bricks);
    setSettings(applyUserConfig(prev.settings, userConfig(settings)));
    setName(prev.name);
    setPast((p) => p.slice(0, -1));
  }, []);
  const redo = useCallback(() => {
    const { future, bricks, settings, name } = latest.current;
    if (!future.length) return;
    setPast((p) => [...p, { bricks, settings, name }]);
    setBricks(future[0].bricks);
    setSettings(applyUserConfig(future[0].settings, userConfig(settings)));
    setName(future[0].name);
    setFuture((f) => f.slice(1));
  }, []);
  const place = useCallback(
    (brick: Brick) => {
      if (latest.current.bricks.length >= 5000) {
        notify("This version supports up to 5,000 pieces.");
        return;
      }
      commit([...latest.current.bricks, brick]);
      if (!latest.current.placementLocked) { setRotation(0); setPlacementOffset({ x: 0, z: 0 }); }
    },
    [commit, notify],
  );
  const remove = useCallback(
    (ids: string[]) => {
      const current = latest.current;
      const next = current.bricks.filter((b) => !ids.includes(b.id));
      if (!current.settings.allowFloating) {
        const grounded = groundedBrickIds(next, partLibrary);
        const count = next.length - grounded.size;
        if (count) {
          setPendingDelete({ ids, count });
          setModal("delete-single");
          return;
        }
      }
      commit(next);
    },
    [commit, partLibrary],
  );
  const pick = useCallback((brick: Brick) => {
    setPlacementOffset({ x: 0, z: 0 });
    setPartId(brick.partId);
    setColorId(brick.colorId);
    setRotation((((Math.round(brick.rotation / 90) * 90) % 360) + 360) % 360);
    setTool("build");
  }, []);
  useEffect(() => {
    if (!host.current) return;
    try {
      scene.current = new EditorScene(
        host.current,
        catalog,
        { bricks, partId, colorId, rotation, placementOffset, tool, settings, layer, deleteMode },
        setHover,
        place,
        remove,
        pick,
        (axes) => axisWidget.current?.update(axes),
      );
    } catch (e) {
      notify(
        `Could not start the 3D editor: ${e instanceof Error ? e.message : "WebGL unavailable"}`,
      );
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
    };
  }, [catalog, place, remove, pick]);
  useEffect(() => {
    scene.current?.update({
      bricks,
      partId,
      colorId,
      rotation,
      placementOffset,
      tool,
      settings,
      layer,
      deleteMode,
    });
  }, [bricks, partId, colorId, rotation, placementOffset, tool, settings, layer, deleteMode]);
  useEffect(() => {
    try { saveUserConfig(settings); }
    catch { notify("Configuration could not be saved in this browser."); }
  }, [settings, notify]);
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify(projectDocument(name, bricks, settings)),
      );
    } catch {
      notify("Autosave failed. Download your project to keep your work.");
    }
  }, [bricks, name, settings, notify]);
  const part = partLibrary.get(partId)!;
  const color = catalog.colors.find((c) => c.id === colorId)!;
  const shape = shapeFor(part)!;
  const canRotate = shape.width !== shape.depth;
  const rotate = useCallback(() => {
    if (canRotate) setRotation((r) => (r + 90) % 360);
  }, [canRotate]);
  const bindings = settings.keyBindings ?? defaultBindings;
  const shortcut = (action: ShortcutAction) => keyLabel(bindings[action]);
  useEditorShortcuts(bindings, scene, Boolean(modal || notice), (action, repeat) => {
    if (notice) { if (action === "cancel") setNotice(""); return; }
    if (deleteMenu && action === "cancel") { setDeleteMenu(false); return; }
    if (modal) { if (action === "cancel") setModal(modal === "disable-floating" ? floatingReturnModal : null); return; }
    const nudges: Partial<Record<ShortcutAction, [number, number]>> = {
      moveLeft: [-1, 0], moveRight: [1, 0], moveForward: [0, -1], moveBack: [0, 1],
    };
    const nudge = nudges[action];
    if (nudge) { if (tool === "build") nudgePlacement(...nudge); return; }
    if (action === "layerUp" || action === "layerDown") { if (tool === "build") nudgeLayer(action === "layerUp" ? 1 : -1); return; }
    if (repeat && ["toggleLayer", "lock", "cancel"].includes(action)) return;
    switch (action) {
      case "toggleLayer": toggleLayerMode(); break;
      case "lock": setPlacementLocked((locked) => !locked); break;
      case "reset": resetPlacement(); break;
      case "rotate": rotate(); break;
      case "undo": undo(); break;
      case "redo": case "redoAlt": redo(); break;
      case "build": case "cancel": setTool("build"); break;
      case "deleteSingle": case "deleteRecursive": setDeleteMode(action === "deleteSingle" ? "single" : "recursive"); setTool("delete"); setDeleteMenu(false); break;
      case "pick": setTool("pick"); break;
      case "orbit": setTool("orbit"); break;
      case "home": scene.current?.home(); break;
    }
  });
  const selectPart = useCallback((id: string) => {
    setPartId(id);
    setPlacementOffset({ x: 0, z: 0 });
    setRotation(0);
    setTool("build");
  }, []);
  const exportProject = () =>
    download(
      `${name || "untitled"}.brick.json`,
      JSON.stringify(
        projectDocument(name, bricks, settings),
        null,
        2,
      ),
      "application/json",
    );
  const importProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      if (f.size > 10_000_000) throw Error("Project file is too large.");
      const project = parseProject(JSON.parse(await f.text()), catalog);
      commit(project.bricks);
      setName(project.name);
      setSettings(applyUserConfig(project.settings, userConfig(latest.current.settings)));
      setLayer(null);
      scene.current?.home();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not open project");
    }
    e.target.value = "";
  };
  const setting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (key === "allowFloating" && value === false) {
      const grounded = groundedBrickIds(bricks, partLibrary);
      const floating = bricks.filter((brick) => !grounded.has(brick.id));
      if (floating.length) {
        scene.current?.pulseFloatingBricks(floating.map((brick) => brick.id));
        setFloatingCount(floating.length);
        setFloatingReturnModal(modal);
        setModal("disable-floating");
        return;
      }
    }
    setSettings((s) => ({ ...s, [key]: value }));
  };
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">
            <img src="/favicon.svg" width={32} height={32} alt="" />
          </span>
          <span className="brand-name">
            brick<span className="brand-light">studio</span>
          </span>
        </a>
        <div className="project-name">
          <input
            aria-label="Project name"
            placeholder="Untitled"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="header-actions">
          <ProjectActions onNew={() => setModal("new")} onOpen={() => file.current?.click()} onHelp={() => setModal("help")} onSettings={() => setModal("settings")} />
          <span className="divider" />
          <button className="button" aria-label={`Parts list ${bricks.length}`} onClick={() => setModal("inventory")}>
            <Package size={16} />
            <span className="parts-list-label">Parts list</span> <span className="pill">{bricks.length}</span>
          </button>
          <button className="button dark" aria-label="Save project" onClick={exportProject}>
            <Download size={15} />
            <span>Save project</span>
          </button>
        </div>
      </header>
      <main className={`workspace ${compactSidebars ? "compact-sidebars" : ""}`}>
        <Catalog catalog={catalog} selected={partId} onSelect={selectPart} />
        <aside className="inspector panel">
          <div className="panel-heading">
            <div>
              <h2>Selected brick</h2>
            </div>
            <div className="selected-heading-actions">
            <span className="mini-tag">{part.id}</span>
              <a
                className="rebrickable-link"
                href={`https://rebrickable.com/parts/${encodeURIComponent(part.id)}/`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${part.name} on Rebrickable (opens in a new tab)`}
                title="View on Rebrickable"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
          <div className="inspector-scroll">
            <section className="current-part">
              <div className={`selected-preview ${canRotate ? "" : "no-rotation"}`}>
                <PartIcon
                  part={part}
                  color={`#${color.rgb}`}
                  rotation={rotation}
                  large
                />
                {canRotate && <div className="preview-controls">
                <button
                  className="preview-rotate"
                  aria-label="Rotate selected brick"
                  aria-keyshortcuts={ariaShortcut(bindings.rotate)}
                  title={`Rotate selected brick 90° (${shortcut("rotate")})`}
                  onClick={rotate}
                >
                  <RotateCw size={18} />
                  <kbd>{shortcut("rotate")}</kbd>
                </button>
                <span className="preview-angle">{rotation}°</span>
                </div>}
              </div>
              <div className="placement-offset">
                <div className="offset-pad" aria-label="Placement controls">
                  {([['a', 'moveLeft', '-x', -1, 0], ['d', 'moveRight', '+x', 1, 0], ['w', 'moveForward', '-z', 0, -1], ['s', 'moveBack', '+z', 0, 1]] as const).map(([key, action, label, x, z]) => (
                    <button key={key} className={`offset-${key}`} aria-keyshortcuts={ariaShortcut(bindings[action])} title={`Shift placement ${label} by one stud (${shortcut(action)})`} aria-label={`Offset ${label}`} onClick={() => nudgePlacement(x, z)}><span>{label}</span><sub>{shortcut(action)}</sub></button>
                  ))}
                  <button className="offset-up" title={`Raise bottom layer by one plate (${shortcut("layerUp")})`} aria-label="Raise placement layer" aria-keyshortcuts={ariaShortcut(bindings.layerUp)} onClick={() => nudgeLayer(1)}><span>+y</span><sub>{shortcut("layerUp")}</sub></button>
                  <button className="offset-down" title={`Lower bottom layer by one plate (${shortcut("layerDown")})`} aria-label="Lower placement layer" aria-keyshortcuts={ariaShortcut(bindings.layerDown)} onClick={() => nudgeLayer(-1)}><span>−y</span><sub>{shortcut("layerDown")}</sub></button>
                  <button className="offset-reset" title={`Reset rotation and all offsets; return to Auto (${shortcut("reset")})`} aria-label="Reset brick orientation and offset" aria-keyshortcuts={ariaShortcut(bindings.reset)} disabled={!rotation && !placementOffset.x && !placementOffset.z && layer === null && (lastManualLayer.current ?? 0) === 0} onClick={resetPlacement}><span>Reset</span><sub>{shortcut("reset")}</sub></button>
                  <button className={`offset-mode ${layer !== null ? "selected" : ""}`} title={`Toggle Auto / Layer mode (${shortcut("toggleLayer")})`} aria-label="Toggle Auto and Layer mode" aria-keyshortcuts={ariaShortcut(bindings.toggleLayer)} aria-pressed={layer !== null} onClick={toggleLayerMode}><span>{layer === null ? "Auto" : "Layer"}</span><sub>{shortcut("toggleLayer")}</sub></button>
                  <button className={`offset-lock ${placementLocked ? "selected" : ""}`} title={`${placementLocked ? "Keep rotation and offsets after placing" : "Reset rotation and offsets after placing"} (${shortcut("lock")})`} aria-label="Lock placement orientation" aria-keyshortcuts={ariaShortcut(bindings.lock)} aria-pressed={placementLocked} onClick={() => setPlacementLocked((locked) => !locked)}>{placementLocked ? <LockKeyhole size={15} /> : <LockKeyholeOpen size={15} />}<sub>{shortcut("lock")}</sub></button>
                </div>
                <div className="offset-value"><span>x {placementOffset.x} · z {placementOffset.z} studs</span><span>y {layer === null ? "auto" : `${layer} plates`}</span></div>
              </div>
              <label className="floating-setting"><input type="checkbox" checked={settings.allowFloating === true} onChange={(e) => setting("allowFloating", e.target.checked)} /><span>Allow floating bricks</span></label>
              <h3>{part.name}</h3>
              <div className="part-specs">
                <span>
                  {shape.width} × {shape.depth} studs
                </span>
                <span>
                  {shape.height} {shape.height === 1 ? "plate" : "plates"} high
                </span>
              </div>
            </section>
            <ColorPicker
              colors={catalog.colors}
              selected={colorId}
              onChange={(id) => {
                setColorId(id);
                setTool("build");
                          }}
            />
          </div>
        </aside>
        <section
          className={`viewport ${tool === "delete" ? "delete-mode" : tool === "orbit" ? "orbit-mode" : tool === "pick" ? "pick-mode" : ""}`}
          aria-label="3D building viewport"
        >
          <div ref={host} className="canvas-host" />
          <div className="viewport-top">
            <span className="view-label">
              <span className="live-dot" />
              PERSPECTIVE <span className="dot-separator">/</span>{" "}
              {settings.boardSize} × {settings.boardSize} STUDS
            </span>
            <div className="view-actions">
            <TooltipButton tooltipSide="left" className="glass icon-button sidebar-toggle" title={compactSidebars ? "Expand sidebars" : "Condense sidebars"} aria-label={compactSidebars ? "Expand sidebars" : "Condense sidebars"} aria-pressed={compactSidebars} onClick={() => { setCompactSidebars(!compactSidebars); localStorage.setItem("brick-studio-compact-sidebars", String(!compactSidebars)); }}>
              {compactSidebars ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </TooltipButton>
            <TooltipButton tooltipSide="left"
              className="glass icon-button"
              title="Viewport settings"
              aria-label="Viewport settings"
              onClick={() => setModal("settings")}
            >
              <Settings2 size={17} />
            </TooltipButton>
            </div>
          </div>
          <div className="floating-tools glass">
            <TooltipButton
              aria-label="Build tool"
              title={`Build (${shortcut("build")})`}
              className={tool === "build" ? "active" : ""}
              onClick={() => setTool("build")}
            >
              <BrickIcon size={23} />
            </TooltipButton>
            <div className="delete-tool-group">
              <TooltipButton aria-label="Delete tool" title={deleteMode === "single" ? `Delete one brick (${shortcut("deleteSingle")})` : `Recursive delete (${shortcut("deleteRecursive")})`} className={tool === "delete" ? "active danger" : ""} aria-haspopup="menu" aria-expanded={deleteMenu} onClick={() => { setTool("delete"); setDeleteMenu(!deleteMenu); }}>
                <Trash2 size={18} /><sub className="delete-badge">{deleteMode === "single" ? "1" : "∞"}</sub>
              </TooltipButton>
              {deleteMenu && <><button className="delete-menu-dismiss" aria-label="Close delete menu" onClick={() => setDeleteMenu(false)} /><div className="delete-mode-menu glass" role="menu" aria-label="Delete mode">
                {([['single', '1', 'Single brick'], ['recursive', '∞', 'Recursive delete']] as const).map(([mode, badge, label]) => <button role="menuitemradio" aria-checked={deleteMode === mode} key={mode} onClick={() => { setDeleteMode(mode); setTool("delete"); setDeleteMenu(false); }}><sub>{badge}</sub><span>{label}</span></button>)}
              </div></>}
            </div>
            <TooltipButton
              aria-label="Pick brick and color"
              aria-keyshortcuts={ariaShortcut(bindings.pick)}
              title={`Pick brick and color (${shortcut("pick")})`}
              className={tool === "pick" ? "active" : ""}
              onClick={() => setTool("pick")}
            >
              <HelpCircle size={19} />
            </TooltipButton>
            <span />
            <TooltipButton
              aria-label="Orbit view"
              aria-keyshortcuts={ariaShortcut(bindings.orbit)}
              title={`Orbit view (${shortcut("orbit")})`}
              className={tool === "orbit" ? "active" : ""}
              onClick={() => setTool("orbit")}
            >
              <ViewOrbitIcon size={25} />
            </TooltipButton>
            <TooltipButton
              aria-label="Reset camera orientation"
              title="Reset camera orientation"
              onClick={() => scene.current?.resetOrientation()}
            >
              <LocateFixed size={18} />
            </TooltipButton>
            <span />
            <TooltipButton
              aria-label="Directional lighting"
              aria-pressed={settings.directionalLight !== false}
              title={settings.directionalLight !== false ? "Turn off directional light · ambient only" : "Turn on directional light"}
              className={settings.directionalLight !== false ? "active" : ""}
              onClick={() => setting("directionalLight", settings.directionalLight === false)}
            >
              {settings.directionalLight !== false ? <Lightbulb size={18} /> : <LightbulbOff size={18} />}
            </TooltipButton>
            <span />
            <TooltipButton
              aria-label="Undo"
              title={`Undo (${shortcut("undo")})`}
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 size={18} />
            </TooltipButton>
            <TooltipButton
              aria-label="Redo"
              title={`Redo (${shortcut("redo")})`}
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={18} />
            </TooltipButton>
          </div>
          {!bricks.length && (
            <div className="empty-build">
              <h2>To get started:</h2>
              <ol>
                <li>Select a brick in the brick library.</li>
                <li>Choose a color in Selected brick.</li>
                <li>Move onto the grid and click to place the brick.</li>
                {canRotate && <li>
                  Press <kbd>{shortcut("rotate")}</kbd> to rotate the brick.
                </li>}
                <li>
                  Use the Orbit tool or middle-drag to rotate the view; scroll
                  to zoom.
                </li>
              </ol>
            </div>
          )}
          <div
            className={`placement-status glass ${hover.brick && !hover.valid ? "invalid" : ""}`}
          >
            <span
              className={`status-circle ${tool === "delete" ? "red" : hover.brick && !hover.valid ? "red" : ""}`}
            >
              {tool === "orbit" ? (
                <ViewOrbitIcon size={17} />
              ) : tool === "pick" ? (
                <HelpCircle size={14} />
              ) : tool === "delete" ? (
                <Trash2 size={14} />
              ) : hover.brick && !hover.valid ? (
                <X size={14} />
              ) : (
                <Check size={14} />
              )}
            </span>
            <div>
              <strong>
                {tool === "orbit"
                  ? "Orbit view"
                  : tool === "pick"
                    ? "Pick brick and color"
                    : tool === "delete"
                      ? hover.deleting.length
                        ? `Remove ${hover.deleting.length} ${hover.deleting.length === 1 ? "piece" : "pieces"}`
                        : "Delete tool"
                      : hover.brick
                        ? hover.valid
                          ? "Ready to place"
                          : "Cannot place"
                        : "Build mode"}
              </strong>
              <span>{hover.reason}</span>
            </div>
            {hover.brick && tool === "build" && (
              <small>
                {hover.brick.x.toFixed(1)}, {Math.round(hover.brick.y / 0.4)},{" "}
                {hover.brick.z.toFixed(1)}
              </small>
            )}
          </div>
          <div className="camera-tools glass">
            <TooltipButton tooltipSide="left"
              title="Zoom in"
              aria-label="Zoom in"
              onClick={() => scene.current?.zoom(0.82)}
            >
              <Plus size={17} />
            </TooltipButton>
            <TooltipButton tooltipSide="left"
              title="Zoom out"
              aria-label="Zoom out"
              onClick={() => scene.current?.zoom(1.22)}
            >
              <Minus size={17} />
            </TooltipButton>
            <span />
            <TooltipButton tooltipSide="left"
              title={`Reset view (${shortcut("home")})`}
              aria-label="Reset view"
              onClick={() => scene.current?.home()}
            >
              <Expand size={17} />
            </TooltipButton>
          </div>
          <AxisWidget ref={axisWidget} />
        </section>
      </main>
      <ShortcutFooter bindings={bindings} />
      <input
        className="hidden"
        type="file"
        accept=".json,.brick.json"
        ref={file}
        onChange={importProject}
      />
      {notice && <MessageDialog message={notice} onClose={() => setNotice("")} />}
      <ProjectDialogs
        floatingCount={floatingCount}
        onDeleteFloating={() => {
          const current = latest.current;
          const grounded = groundedBrickIds(current.bricks, partLibrary);
          commit(current.bricks.filter((brick) => grounded.has(brick.id)));
          setSettings((settings) => ({ ...settings, allowFloating: false }));
          setModal(floatingReturnModal);
        }}
        onResetConfig={() => {
          setSettings((current) => applyUserConfig(current, defaultUserConfig));
          setCompactSidebars(false);
          try { localStorage.setItem("brick-studio-compact-sidebars", "false"); }
          catch { notify("Sidebar configuration could not be saved in this browser."); }
        }}
        pendingDeleteCount={pendingDelete?.count ?? 0}
        onConfirmSingleDelete={() => {
          if (!pendingDelete) return;
          commit(latest.current.bricks.filter((brick) => !pendingDelete.ids.includes(brick.id)));
          setSettings((s) => ({ ...s, allowFloating: true }));
          setPendingDelete(null);
          setModal(null);
        }}
        modal={modal}
        setModal={(next) => setModal(next === null && modal === "disable-floating" ? floatingReturnModal : next)}
        settings={settings}
        setting={setting}
        catalog={catalog}
        bricks={bricks}
        name={name}
        notify={notify}
        exportProject={exportProject}
        onReplacePair={(fromPart, fromColor, toPart, toColor) => {
          commit(bricks.map((brick) => brick.partId === fromPart && brick.colorId === fromColor ? { ...brick, partId: toPart, colorId: toColor } : brick));
          if (partId === fromPart && colorId === fromColor) {
            setPartId(toPart);
            setColorId(toColor);
          }
        }}
        onNew={(sample) => {
          commit(sample ? demoBuild() : []);
          setName(sample ? "Pavilion study" : "Untitled");
          setLayer(null);
          setTool("build");
          scene.current?.home();
          setModal(null);
        }}
      />
    </div>
  );
}
export default function App() {
  const [catalog, setCatalog] = useState<CatalogData | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/data/catalog.json")
      .then((r) => {
        if (!r.ok) throw Error("Catalog unavailable");
        return r.json();
      })
      .then(setCatalog)
      .catch((e) => setError(e.message));
  }, []);
  if (error)
    return (
      <div className="loading">
        <TriangleAlert />
        <h2>Couldn’t load the brick library</h2>
        <p>{error}</p>
        <button className="button" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  if (!catalog)
    return (
      <div className="loading">
        <Boxes size={36} />
        <h2>Opening the brick box…</h2>
        <p>Loading your library from Rebrickable.</p>
      </div>
    );
  return <Editor catalog={catalog} />;
}
