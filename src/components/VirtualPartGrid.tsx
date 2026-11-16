import { memo, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Check } from "lucide-react";
import type { Part } from "../engine/types";
import { shapeFor } from "../engine/parts";
import { PartIcon } from "./PartIcon";

type Props = {
  parts: Part[];
  selected: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onInspect: (part: Part) => void;
};
const OVERSCAN = 2;

/** Fixed-height responsive rows keep scrolling independent of catalog size. */
export const VirtualPartGrid = memo(function VirtualPartGrid({ parts, selected, scrollRef, onSelect, onInspect }: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const [range, setRange] = useState({ start: 0, end: 0, columns: 2, height: 118, gap: 9 });
  useLayoutEffect(() => {
    const element = grid.current;
    // The child layout effect can run before the parent ref is attached.
    const scroller = scrollRef.current ?? element?.closest<HTMLDivElement>(".catalog-scroll");
    if (!element || !scroller) return;
    scroller.scrollTop = 0;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const css = getComputedStyle(element);
      const height = parseFloat(css.getPropertyValue("--catalog-card-height")) || 118;
      const gap = parseFloat(css.columnGap) || 0;
      const columns = Math.max(1, Math.min(2, Math.floor((element.clientWidth + gap) / (100 + gap))));
      const top = scroller.getBoundingClientRect().top + scroller.clientTop;
      const offset = Math.max(0, top - element.getBoundingClientRect().top);
      const rows = Math.ceil(parts.length / columns);
      const start = Math.min(Math.max(0, rows - 1), Math.max(0, Math.floor(offset / (height + gap)) - OVERSCAN));
      const end = Math.min(rows, Math.ceil((offset + scroller.clientHeight) / (height + gap)) + OVERSCAN);
      const next = { start, end, columns, height, gap };
      setRange((previous) => Object.keys(next).every((key) => next[key as keyof typeof next] === previous[key as keyof typeof next]) ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    observer.observe(element);
    // Layout mode changes can move the grid without changing its width.
    scroller.addEventListener("scroll", schedule, { passive: true });
    measure();
    return () => { observer.disconnect(); scroller.removeEventListener("scroll", schedule); cancelAnimationFrame(frame); };
  }, [parts, scrollRef]);
  useEffect(() => {
    if (pendingFocus.current === null) return;
    const button = grid.current?.querySelector<HTMLButtonElement>(`[data-part-index="${pendingFocus.current}"]`);
    if (button) { button.focus({ preventScroll: true }); pendingFocus.current = null; }
  }, [range]);
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-part-index]") : null;
    if (!target || !scrollRef.current || !grid.current) return;
    const current = Number(target.dataset.partIndex);
    const page = Math.max(1, Math.floor(scrollRef.current.clientHeight / (range.height + range.gap))) * range.columns;
    const destinations: Record<string, number> = {
      ArrowLeft: current - 1, ArrowRight: current + 1,
      ArrowUp: current - range.columns, ArrowDown: current + range.columns,
      Home: 0, End: parts.length - 1, PageUp: current - page, PageDown: current + page,
    };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    event.stopPropagation();
    const index = Math.max(0, Math.min(parts.length - 1, destinations[event.key]));
    const row = Math.floor(index / range.columns);
    pendingFocus.current = index;
    const scroller = scrollRef.current;
    const gridTop = scroller.scrollTop + grid.current.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientTop;
    const top = gridTop + row * (range.height + range.gap);
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (top + range.height > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = top + range.height - scroller.clientHeight;
    const visibleRows = Math.ceil(scroller.clientHeight / (range.height + range.gap));
    setRange((previous) => ({ ...previous, start: Math.max(0, row - visibleRows - OVERSCAN), end: Math.min(Math.ceil(parts.length / range.columns), row + visibleRows + OVERSCAN + 1) }));
  };
  const rows = Math.ceil(parts.length / range.columns);
  const stride = range.height + range.gap;
  return <div ref={grid} className="part-grid virtual-part-grid" style={{ height: Math.max(0, rows * stride - range.gap) }} aria-label="Brick catalog results" onKeyDown={navigate}>
    {Array.from({ length: Math.max(0, range.end - range.start) }, (_, i) => {
      const row = range.start + i;
      return <div className="virtual-part-row" key={row} style={{ top: row * stride, height: range.height, gridTemplateColumns: `repeat(${range.columns}, minmax(0, 1fr))`, gap: range.gap }}>
        {parts.slice(row * range.columns, (row + 1) * range.columns).map((part, column) => {
          const shape = shapeFor(part);
          return <button className={`part-card ${part.id === selected ? "selected" : ""} ${!shape ? "unsupported" : ""}`}
            data-part-index={row * range.columns + column} key={part.id} title={part.name} aria-label={`${part.id} ${part.name}${shape ? "" : " · Catalog only"}`}
            onClick={() => shape ? onSelect(part.id) : onInspect(part)}>
            <span className="part-number">{part.id}</span>
            {part.id === selected && <span className="selected-check"><Check size={11} /></span>}
            <PartIcon part={part} />
            <strong>{shape ? `${shape.width} × ${shape.depth}` : part.name}</strong>
            <span className="part-type">{shape ? shape.sideStuds?.length ? `${shape.sideStuds.length} side stud${shape.sideStuds.length === 1 ? "" : "s"}` : shape.kind === "round" ? "Round " + (shape.height === 3 ? "brick" : "plate") : shape.kind : "Catalog only"}</span>
          </button>;
        })}
      </div>;
    })}
  </div>;
});
