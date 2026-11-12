import { memo, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Catalog as CatalogData, Part } from "../engine/types";
import { preferredParts, shapeFor } from "../engine/parts";
import { isBuildingPart, normalizePartSearch } from "../engine/catalog";
import { PartIcon } from "./PartIcon";
export const Catalog = memo(function Catalog({
  catalog,
  selected,
  onSelect,
}: {
  catalog: CatalogData;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [all, setAll] = useState(false),
    [family, setFamily] = useState("All"),
    [page, setPage] = useState(0),
    [inspect, setInspect] = useState<Part | null>(null);
  const buildingParts = useMemo(
    () => catalog.parts.filter(isBuildingPart),
    [catalog],
  );
  const supported = useMemo(
    () => buildingParts.filter((p) => shapeFor(p)),
    [buildingParts],
  );
  const filtered = useMemo(() => {
    const q = normalizePartSearch(query);
    return (all ? buildingParts : supported)
      .filter(
        (p) =>
          (!q || normalizePartSearch(`${p.id} ${p.name}`).includes(q)) &&
          (family === "All" ||
            (family === "Round"
              ? shapeFor(p)?.kind === "round"
              : p.name.startsWith(family + " "))),
      )
      .sort((a, b) => {
        if (q) {
          if (a.id === q) return -1;
          if (b.id === q) return 1;
        }
        const ap = preferredParts.indexOf(a.id),
          bp = preferredParts.indexOf(b.id);
        return (
          (ap < 0 ? 1000 : ap) - (bp < 0 ? 1000 : bp) ||
          a.name.localeCompare(b.name)
        );
      });
  }, [buildingParts, supported, query, all, family]);
  return (
    <aside className="catalog panel">
      <div className="panel-heading">
        <div>
          <h2>Brick library</h2>
        </div>
        <span className="live-dot" title="Rebrickable CSV catalog loaded" />
      </div>
      <div className="catalog-tabs">
        <button
          className={!all ? "active" : ""}
          onClick={() => {
            setAll(false);
            setPage(0);
          }}
        >
          Buildable
        </button>
        <button
          className={all ? "active" : ""}
          onClick={() => {
            setAll(true);
            setPage(0);
          }}
        >
          All building parts
        </button>
      </div>
      <label className="search">
        <Search size={16} />
        <input
          aria-label="Search bricks"
          placeholder="Find a brick or part number…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
      </label>
      <div className="filters">
        {["All", "Brick", "Plate", "Tile", "Round"].map((f) => (
          <button
            className={family === f ? "active" : ""}
            key={f}
            onClick={() => {
              setFamily(f);
              setPage(0);
            }}
          >
            {f === "All" ? "All parts" : f + "s"}
          </button>
        ))}
      </div>
      <div className="catalog-scroll">
        <div className="result-label">
          {filtered.length.toLocaleString()}{" "}
          {all ? "building parts" : "ready to build"}
          <span>PART / SIZE</span>
        </div>
        {all && (
          <div className="catalog-note">
            Parts marked "Catalog only" still need geometry and connection
            definitions before placement.
          </div>
        )}
        <div className="part-grid">
          {filtered.slice(page * 40, page * 40 + 40).map((p) => {
            const shape = shapeFor(p),
              active = p.id === selected;
            return (
              <button
                className={`part-card ${active ? "selected" : ""} ${!shape ? "unsupported" : ""}`}
                key={p.id}
                onClick={() => (shape ? onSelect(p.id) : setInspect(p))}
                title={p.name}
              >
                <span className="part-number">{p.id}</span>
                {active && (
                  <span className="selected-check">
                    <Check size={11} />
                  </span>
                )}
                <PartIcon part={p} />
                <strong>
                  {shape
                    ? `${shape.width} × ${shape.depth}`
                    : p.name}
                </strong>
                <span className="part-type">
                  {shape
                    ? shape.kind === "round"
                      ? "Round " + (shape.height === 3 ? "brick" : "plate")
                      : shape.kind
                    : "Catalog only"}
                </span>
              </button>
            );
          })}
        </div>
        {!filtered.length && (
          <div className="empty">
            No matching parts.
            <br />
            <small>Try a part number or another category.</small>
          </div>
        )}
        {filtered.length > 40 && (
          <div className="pagination">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {page + 1} / {Math.ceil(filtered.length / 40)}
            </span>
            <button
              disabled={(page + 1) * 40 >= filtered.length}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="catalog-credit">
        <span>
          Catalog by{" "}
          <a
            href="https://rebrickable.com/downloads/"
            target="_blank"
            rel="noreferrer"
          >
            Rebrickable <ArrowUpRight size={11} />
          </a>
        </span>
        <small>
          {new Date(catalog.fetched).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </small>
      </div>
      {inspect && createPortal(
        <div className="modal-backdrop" onClick={() => setInspect(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={inspect.name} onClick={(e) => e.stopPropagation()}>
            <span className="eyebrow">CATALOG PART · {inspect.id}</span>
            <h2>{inspect.name}</h2>
            <p>
              This part is in Rebrickable’s catalog. Its collision geometry and
              connectors haven’t been modeled in this version, so it cannot be
              placed yet.
            </p>
            <div className="modal-actions">
            <a
              className="button"
              href={`https://rebrickable.com/parts/${encodeURIComponent(inspect.id)}/`}
              target="_blank"
              rel="noreferrer"
            >
              View on Rebrickable <ArrowUpRight size={14} />
            </a>
            <button className="button primary" onClick={() => setInspect(null)}>
              Back to building
            </button>
            </div>
          </div>
        </div>, document.body
      )}
    </aside>
  );
});
