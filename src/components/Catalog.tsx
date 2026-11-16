import { memo, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  ArrowUpRight,
} from "lucide-react";
import type { Catalog as CatalogData, Part } from "../engine/types";
import { preferredParts, shapeFor } from "../engine/parts";
import { isBuildingPart, normalizePartSearch } from "../engine/catalog";
import { VirtualPartGrid } from "./VirtualPartGrid";
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
    [inspect, setInspect] = useState<Part | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Build the search/sort index once for each catalog revision, not on scroll.
  const index = useMemo(() => {
    const priority = new Map(preferredParts.map((id, order) => [id, order]));
    return catalog.parts.filter(isBuildingPart).map((part) => ({
      part, shape: shapeFor(part), search: normalizePartSearch(`${part.id} ${part.name}`),
    })).sort((a, b) => (priority.get(a.part.id) ?? 1000) - (priority.get(b.part.id) ?? 1000) || a.part.name.localeCompare(b.part.name));
  }, [catalog]);
  const filtered = useMemo(() => {
    const q = normalizePartSearch(query);
    const matches = index.filter(({ part, shape, search }) =>
      (all || shape) && (!q || search.includes(q)) &&
      (family === "All" || (family === "Round" ? shape?.kind === "round" : part.name.startsWith(family + " ")))
    ).map(({ part }) => part);
    const exact = matches.findIndex((part) => part.id === q);
    if (exact > 0) matches.unshift(...matches.splice(exact, 1));
    return matches;
  }, [index, query, all, family]);
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
          }}
        >
          Buildable
        </button>
        <button
          className={all ? "active" : ""}
          onClick={() => {
            setAll(true);
          }}
        >
          All
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
              }}
          >
            {f === "All" ? "All parts" : f + "s"}
          </button>
        ))}
      </div>
      <div className="catalog-scroll" ref={scrollRef}>
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
        <VirtualPartGrid parts={filtered} selected={selected} scrollRef={scrollRef} onSelect={onSelect} onInspect={setInspect} />
        {!filtered.length && (
          <div className="empty">
            No matching parts.
            <br />
            <small>Try a part number or another category.</small>
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
