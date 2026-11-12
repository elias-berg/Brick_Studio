import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { createPortal } from "react-dom";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  tooltipSide?: "left" | "right";
};
type Anchor = { left: number; right: number; top: number; bottom: number };

/** A viewport-positioned tooltip cannot resize or be clipped by a scrolling panel. */
export function TooltipButton({ title, tooltipSide = "right", children, className = "", onPointerEnter, onPointerLeave, onFocus, onBlur, ...props }: Props) {
  const id = useId();
  const tooltip = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const show = (button: HTMLButtonElement) => {
    const { left, right, top, bottom } = button.getBoundingClientRect();
    setAnchor({ left, right, top, bottom });
  };
  useEffect(() => {
    if (!anchor) return;
    const hide = () => setAnchor(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("keydown", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("keydown", hide);
    };
  }, [anchor]);
  useLayoutEffect(() => {
    if (!anchor || !tooltip.current) return;
    const { width, height } = tooltip.current.getBoundingClientRect();
    const onRight = anchor.right + 12;
    const onLeft = anchor.left - width - 12;
    let left = tooltipSide === "right" ? onRight : onLeft;
    if (left + width > window.innerWidth - 8) left = onLeft;
    if (left < 8) left = onRight;
    setPosition({
      left: Math.max(8, Math.min(window.innerWidth - width - 8, left)),
      top: Math.max(8, Math.min(window.innerHeight - height - 8, (anchor.top + anchor.bottom - height) / 2)),
    });
  }, [anchor, tooltipSide, title]);
  return (
    <>
      <button {...props} className={`tooltip-button ${className}`} aria-describedby={anchor ? id : undefined}
        onPointerEnter={(event) => { show(event.currentTarget); onPointerEnter?.(event); }}
        onPointerLeave={(event) => { setAnchor(null); onPointerLeave?.(event); }}
        onFocus={(event) => { show(event.currentTarget); onFocus?.(event); }}
        onBlur={(event) => { setAnchor(null); onBlur?.(event); }}
      >{children}</button>
      {anchor && createPortal(<span ref={tooltip} id={id} role="tooltip" className="button-tooltip portal-button-tooltip" style={position}>{title}</span>, document.body)}
    </>
  );
}
