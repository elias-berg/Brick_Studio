import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Check } from "lucide-react";
import type { Color } from "../engine/types";
import { groupPalette } from "../engine/colorPalette";
const popular = [
  14, 4, 1, 2, 15, 0, 19, 71, 72, 3, 25, 28, 70, 5, 6, 7, 27, 10, 11, 22, 23,
  26, 29, 30, 31, 40, 41, 42,
];
export function ColorPicker({
  colors,
  selected,
  onChange,
}: {
  colors: Color[];
  selected: number;
  onChange: (id: number) => void;
}) {
  const [query, setQuery] = useState(""),
    [all, setAll] = useState(false);
  const tooltipId = useId();
  const [tooltip, setTooltip] = useState<{color: Color; left: number; top: number; above: boolean} | null>(null);
  useEffect(() => {
    const hide = () => setTooltip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("keydown", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("keydown", hide);
    };
  }, []);
  const showTooltip = (element: HTMLButtonElement, color: Color) => {
    const rect = element.getBoundingClientRect();
    const above = rect.top > 75;
    setTooltip({color, left: Math.max(Math.min(168, window.innerWidth / 2), Math.min(window.innerWidth - Math.min(168, window.innerWidth / 2), rect.left + rect.width / 2)), top: above ? rect.top - 8 : rect.bottom + 8, above});
  };
  const groups = groupPalette(
    colors
      .filter((c) => all || popular.includes(c.id))
      .filter(
        (c) =>
          !all ||
          `${c.name} ${c.id}`.toLowerCase().includes(query.toLowerCase()),
      ),
  );
  const displayedGroups = all ? groups : [{ name: "", colors: groups.flatMap((group) => group.colors) }];
  const color = colors.find((c) => c.id === selected)!;
  return (
    <section className="color-section">
      <div className="section-title">
        <h3>Color palette</h3>
        <button className="text-button" onClick={() => setAll(!all)}>
          {all ? "Show common" : `All ${colors.length}`}
        </button>
      </div>
      {all && (
        <label className="search compact">
          <Search size={14} />
          <input
            aria-label="Search colors"
            placeholder="Find a color…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}
      {displayedGroups.map((group) => (
        <div className="color-family" key={group.name}>
          {group.name && <h4>{group.name}</h4>}
          <div className="swatches">
            {group.colors.map((c) => (
              <button
                key={c.id}
                aria-label={c.name}
                aria-describedby={tooltip?.color.id === c.id ? tooltipId : undefined}
                onPointerEnter={(event) => showTooltip(event.currentTarget, c)}
                onPointerLeave={() => setTooltip(null)}
                onFocus={(event) => showTooltip(event.currentTarget, c)}
                onBlur={() => setTooltip(null)}
                onClick={() => { setTooltip(null); onChange(c.id); }}
                className={`swatch ${selected === c.id ? "active" : ""} ${c.transparent ? "transparent" : ""}`}
                style={{ backgroundColor: `#${c.rgb}` }}
              >
                {selected === c.id && (
                  <Check
                    size={15}
                    color={
                      ["0", "1", "2", "4", "70", "72"].includes(String(c.id))
                        ? "white"
                        : "#222"
                    }
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
      {!groups.length && <small>No matching colors</small>}
      {tooltip && createPortal(
        <div id={tooltipId} role="tooltip" className="color-tooltip" style={{left: tooltip.left, top: tooltip.top, transform: tooltip.above ? "translate(-50%, -100%)" : "translateX(-50%)"}}>
          <strong>{tooltip.color.name}</strong>
          <span>#{tooltip.color.id}{tooltip.color.transparent ? " · Transparent" : ""}</span>
        </div>, document.body
      )}
      <div className="selected-color">
        <span style={{ background: `#${color.rgb}` }} />
        <strong>{color.name}</strong>
        <small>#{color.id}</small>
      </div>
      <p className="muted tiny">
        Catalog colors; part/color production availability is not verified.
      </p>
    </section>
  );
}
