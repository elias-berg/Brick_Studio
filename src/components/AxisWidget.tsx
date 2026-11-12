import { forwardRef, useImperativeHandle, useState } from "react";
import type { AxisDirection } from "../engine/orientation";

export interface AxisWidgetHandle { update: (axes: AxisDirection[]) => void }

/** Local state keeps camera animation from rerendering the editor or catalog. */
export const AxisWidget = forwardRef<AxisWidgetHandle>(function AxisWidget(_, ref) {
  const [axes, setAxes] = useState<AxisDirection[]>([]);
  useImperativeHandle(ref, () => ({ update: setAxes }), []);
  return <div className="axis-widget camera-axis-widget" aria-label="World axes matching camera orientation">
    <svg viewBox="0 0 104 104" role="img" aria-label="Positive and negative world x, y and z directions">
      <circle cx="52" cy="52" r="3" fill="#929d88" />
      {axes.map((axis) => {
        const x = 52 + axis.x * 35, y = 52 + axis.y * 35;
        return <g key={axis.label} data-axis={axis.label}>
          <line x1="52" y1="52" x2={x} y2={y} stroke={axis.color} strokeWidth={axis.negative ? 1 : 1.8} strokeDasharray={axis.negative ? "2 2" : undefined} opacity={axis.negative ? 0.6 : 1} />
          <circle cx={x} cy={y} r="10" fill="#f8faf3" stroke={axis.color} strokeWidth={axis.negative ? 1 : 1.5} />
          <text x={x} y={y} fill={axis.color} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight={axis.negative ? 500 : 700}>{axis.label}</text>
        </g>;
      })}
    </svg>
    <small>WORLD</small>
  </div>;
});
