/** The bolt mark and "Pop Quiz" wordmark from the canvas header. */
export function LogoMark({ size = 40, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${inverted ? "bg-white" : "bg-brand"}`}
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
      aria-hidden
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke={inverted ? "#4B2BB5" : "#FFFFFF"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 2 L4 14 h7 l-1 8 9-12 h-7 z" />
      </svg>
    </span>
  );
}

export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      <span className="font-display font-extrabold" style={{ fontSize: size * 0.7 }}>
        Pop Quiz
      </span>
    </span>
  );
}
