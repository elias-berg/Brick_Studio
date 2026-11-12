export function BrickIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="m16 7 10 5-10 5-10-5 10-5ZM6 12v12l10 5 10-5V12M16 17v12" />
      <path d="M12 9.5V12c0 2.7 8 2.7 8 0V9.5" />
      <ellipse cx="16" cy="9.5" rx="4" ry="2" />
    </svg>
  );
}
