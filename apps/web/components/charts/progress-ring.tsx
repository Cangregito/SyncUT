/**
 * Anillo de progreso (completadas / total). SVG puro, apto para servidor.
 */
const R = 18;
const CIRC = 2 * Math.PI * R;

export function ProgressRing({
  value,
  total,
  size = 56,
  color = "var(--primary)",
  label,
}: {
  value: number;
  total: number;
  size?: number;
  color?: string;
  /** Texto accesible; por defecto "value de total". */
  label?: string;
}) {
  const fraction = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  const percent = Math.round(fraction * 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      role="img"
      aria-label={label ?? `${value} de ${total}`}
      className="shrink-0"
    >
      <circle cx={22} cy={22} r={R} fill="none" stroke="var(--outline-variant)" strokeWidth={5} />
      {fraction > 0 ? (
        <circle
          cx={22}
          cy={22}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
          className="chart-draw"
          style={{
            ["--chart-len" as string]: CIRC,
            strokeDasharray: CIRC,
            strokeDashoffset: CIRC * (1 - fraction),
          }}
        />
      ) : null}
      <text x={22} y={22} dy={4} textAnchor="middle" fill="var(--on-surface)" fontSize={11} fontWeight={800}>
        {percent}%
      </text>
    </svg>
  );
}
