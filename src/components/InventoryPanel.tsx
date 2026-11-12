import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Download } from "lucide-react";
import type { Brick, Catalog } from "../engine/types";
import { inventory } from "../engine/physics";
import { csvInventory, download } from "../engine/storage";
import {
  elementKey,
  legoBatches,
  legoCsv,
  legoJson,
  loadElementIndex,
  resolveLegoList,
  replacementPairs,
} from "../engine/legoExport";
import type { ElementIndex } from "../engine/legoExport";

export function InventoryPanel({
  bricks,
  catalog,
  name,
  onReplacePair,
}: {
  bricks: Brick[];
  catalog: Catalog;
  name: string;
  onReplacePair: (fromPart: string, fromColor: number, toPart: string, toColor: number) => void;
}) {
  const [index, setIndex] = useState<ElementIndex | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [allowPartial, setAllowPartial] = useState(false),
    [batch, setBatch] = useState(0);
  const groups = useMemo(() => inventory(bricks), [bricks]);
  useEffect(() => {
    let active = true;
    setError("");
    loadElementIndex()
      .then((data) => {
        if (active) setIndex(data);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const resolved = useMemo(
    () => (index ? resolveLegoList(bricks, index, {}) : null),
    [bricks, index],
  );
  const batches = useMemo(() => legoBatches(resolved?.rows ?? []), [resolved]);
  const currentBatch = Math.min(batch, Math.max(0, batches.length - 1));
  useEffect(() => setAllowPartial(false), [bricks]);
  const ready = !!resolved && (!resolved.missing.length || allowPartial) && batches.length > 0;
  const includedCount = resolved?.rows.reduce((sum, row) => sum + row.quantity, 0) ?? 0;
  const exportLego = (format: "csv" | "json") => {
    if (!ready) return;
    const rows = batches[currentBatch],
      suffix =
        batches.length > 1 ? `-${currentBatch + 1}-of-${batches.length}` : "";
    download(
      `${name || "build"}-lego${resolved?.missing.length ? "-mapped-only" : ""}${suffix}.${format}`,
      format === "csv" ? legoCsv(rows) : legoJson(rows),
      format === "csv" ? "text/csv;charset=utf-8" : "application/json",
    );
  };
  return (
    <>
      <h2>
        Your parts list <span className="count">{bricks.length}</span>
      </h2>
      <p>
        {groups.length} distinct part/color pairs in {name || "your build"}.
        LEGO upload files are prepared automatically. Availability is checked by LEGO when you upload.
      </p>
      <div className="inventory-table">
        <table>
          <thead>
            <tr>
              <th>PART</th>
              <th>COLOR</th>
              <th>LEGO UPLOAD</th>
              <th>QTY</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const part = catalog.parts.find((p) => p.id === group.partId)!,
                color = catalog.colors.find((c) => c.id === group.colorId)!;
              const key = elementKey(group.partId, group.colorId),
                options = index?.pairs[key] ?? [],
                selected = options[0] ?? "";
              const alternatives = index ? replacementPairs(group.partId, group.colorId, index, catalog) : [];
              return (
                <tr key={key}>
                  <td>
                    <strong>{part.name}</strong>
                    <small>{part.id}</small>
                  </td>
                  <td>
                    <span
                      className="table-swatch"
                      style={{ background: `#${color.rgb}` }}
                    />
                    {color.name}
                    <small>#{color.id}</small>
                  </td>
                  <td className="element-cell">
                    {!index ? (
                      <small>{error ? "Unavailable" : "Loading…"}</small>
                    ) : options.length ? (
                      <div className="inventory-resolution">
                        <span>Included</span>
                        <small>Element {selected}</small>
                        <a href={`https://www.lego.com/pick-and-build/pick-a-brick?query=${selected}`} target="_blank" rel="noopener noreferrer">Find on LEGO ↗</a>
                      </div>
                    ) : (
                      <div className="inventory-resolution">
                        <strong>No LEGO catalog match</strong>
                        <small>This version/color has no known LEGO upload ID.</small>
                        {alternatives.length > 0 && <select aria-label={`Replace ${part.name}, ${color.name}`} value="" onChange={(event) => {
                          const alternative = alternatives.find((item) => `${item.partId}:${item.colorId}` === event.target.value);
                          if (alternative) onReplacePair(group.partId, group.colorId, alternative.partId, alternative.colorId);
                        }}>
                          <option value="" disabled>Choose a replacement…</option>
                          {alternatives.map((item) => <option key={`${item.partId}:${item.colorId}`} value={`${item.partId}:${item.colorId}`}>{item.label}</option>)}
                        </select>}
                        <a href={`https://rebrickable.com/parts/${encodeURIComponent(part.id)}/`} target="_blank" rel="noopener noreferrer">Find this exact part on Rebrickable ↗</a>
                      </div>
                    )}
                  </td>
                  <td>
                    <b>{group.quantity}</b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!bricks.length && (
          <p className="empty">Your first brick starts the list.</p>
        )}
      </div>
      {error ? (
        <div className="catalog-note">
          {error}{" "}
          <button
            className="text-button"
            onClick={() => setRetry((r) => r + 1)}
          >
            Retry
          </button>
        </div>
      ) : resolved?.missing.length ? (
        <div className="catalog-note">
          {bricks.length - includedCount} pieces have no LEGO catalog match. Choose a replacement in their rows, or use Rebrickable to find the exact version. Replacements update all matching bricks in your build; Undo restores them.
          {includedCount > 0 && <label className="partial-export"><input type="checkbox" checked={allowPartial} onChange={(event) => setAllowPartial(event.target.checked)} />Export only the {includedCount} mapped pieces; exclude the other {bricks.length - includedCount} pieces from the LEGO file.</label>}
        </div>
      ) : (
        <div className="catalog-note">
          Upload the LEGO CSV or JSON with “Upload list” on Pick a Brick. The
          files match LEGO’s templates. Catalog element IDs do not guarantee
          current stock; LEGO checks availability.
        </div>
      )}
      {batches.length > 1 && (
        <label className="lego-batch">
          Export file{" "}
          <select
            value={currentBatch}
            onChange={(e) => setBatch(+e.target.value)}
          >
            {batches.map((rows, i) => (
              <option key={i} value={i}>
                {i + 1} of {batches.length} · {rows.length} different pieces
              </option>
            ))}
          </select>
          <small>
            Files contain at most 200 different element IDs. Download each file
            separately.
          </small>
        </label>
      )}
      <div className="modal-actions lego-actions">
        <button
          className="button"
          disabled={!ready}
          onClick={() => exportLego("csv")}
        >
          <Download size={15} />
          LEGO CSV
        </button>
        <button
          className="button"
          disabled={!ready}
          onClick={() => exportLego("json")}
        >
          <Download size={15} />
          LEGO JSON
        </button>
        <a
          className="button primary"
          href="https://www.lego.com/pick-and-build/pick-a-brick"
          target="_blank"
          rel="noreferrer"
        >
          LEGO Pick a Brick <ArrowUpRight size={15} />
        </a>
      </div>
      <button
        className="text-button"
        disabled={!bricks.length}
        onClick={() =>
          download(
            `${name || "build"}-inventory.csv`,
            csvInventory(bricks, catalog),
            "text/csv;charset=utf-8",
          )
        }
      >
        Download detailed inventory CSV (Rebrickable IDs; not for LEGO upload)
      </button>
    </>
  );
}
