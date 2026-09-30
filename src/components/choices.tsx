/**
 * Answer tiles: each choice has a colour and a shape, so students who can't
 * tell the colours apart can still match their phone to the big screen.
 * The first four match the canvas; five and six cover longer questions.
 */
export const CHOICE_STYLES = [
  { bg: "#C8382B", fg: "#FFFFFF", shape: "triangle", name: "Red triangle" },
  { bg: "#1F5FBF", fg: "#FFFFFF", shape: "diamond", name: "Blue diamond" },
  { bg: "#E8A317", fg: "#1E1B3A", shape: "circle", name: "Yellow circle" },
  { bg: "#1D7A4C", fg: "#FFFFFF", shape: "square", name: "Green square" },
  { bg: "#A3317A", fg: "#FFFFFF", shape: "hexagon", name: "Pink hexagon" },
  { bg: "#0E6F7A", fg: "#FFFFFF", shape: "star", name: "Teal star" },
] as const;

export function choiceStyle(index: number) {
  return CHOICE_STYLES[index % CHOICE_STYLES.length];
}

export function ChoiceShape({
  index,
  size = 48,
  color,
  className = "",
}: {
  index: number;
  size?: number;
  color?: string;
  className?: string;
}) {
  const style = choiceStyle(index);
  const fill = color ?? style.fg;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className={`shrink-0 ${className}`}>
      {style.shape === "triangle" && <path d="M20 5 L36 34 L4 34 Z" fill={fill} />}
      {style.shape === "diamond" && <path d="M20 3 L37 20 L20 37 L3 20 Z" fill={fill} />}
      {style.shape === "circle" && <circle cx="20" cy="20" r="16" fill={fill} />}
      {style.shape === "square" && <rect x="5" y="5" width="30" height="30" rx="3" fill={fill} />}
      {style.shape === "hexagon" && <path d="M12 5 L28 5 L37 20 L28 35 L12 35 L3 20 Z" fill={fill} />}
      {style.shape === "star" && (
        <path d="M20 3 L25 15 L38 15 L27.5 23 L31.5 36 L20 28 L8.5 36 L12.5 23 L2 15 L15 15 Z" fill={fill} />
      )}
    </svg>
  );
}

/** A small coloured chip with the choice's shape, for tables and lists. */
export function ChoiceBadge({ index, size = 22 }: { index: number; size?: number }) {
  const style = choiceStyle(index);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md"
      style={{ background: style.bg, width: size, height: size }}
      title={style.name}
    >
      <ChoiceShape index={index} size={size * 0.62} />
    </span>
  );
}
