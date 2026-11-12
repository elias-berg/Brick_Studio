export function ViewOrbitIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 16V5m0 11 9 5m-9-5-9 5" />
      <path d="M5 11a10 6 0 0 1 18 0m-3-3 3 3-4 1" opacity=".8" />
      <g
        fill="currentColor"
        stroke="none"
        fontFamily="sans-serif"
        fontSize="6"
        fontWeight="600"
      >
        <text x="12" y="5">
          Y
        </text>
        <text x="23" y="25">
          X
        </text>
        <text x="1" y="25">
          Z
        </text>
      </g>
    </svg>
  );
}
