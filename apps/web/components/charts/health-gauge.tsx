/**
 * Medidor semicircular para el indicador de salud del grupo.
 *
 * SVG puro: se renderiza en servidor, no carga Recharts y anima con CSS
 * (ver `.chart-draw` en globals.css). El anillo exterior marca las zonas con
 * los mismos umbrales con los que /equipo clasifica el score, asi el tutor ve
 * por que un grupo cae en "observacion" y no solo el color.
 */
export type HealthLevel = "green" | "yellow" | "red";

const LEVEL_COLOR: Record<HealthLevel, string> = {
  green: "var(--tertiary)",
  yellow: "var(--chart-amber)",
  red: "var(--error)",
};

const CX = 60;
const CY = 62;
const R = 40;
const R_ZONE = 52;
const HALF = Math.PI * R;

function point(fraction: number, radius: number) {
  const angle = Math.PI * (1 - fraction);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

function arc(from: number, to: number, radius: number) {
  const a = point(from, radius);
  const b = point(to, radius);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export function HealthGauge({
  score,
  level,
  max = 12,
  thresholds = [4, 8],
  className = "w-full",
}: {
  score: number;
  level: HealthLevel;
  /** Score a partir del cual el medidor se muestra lleno. */
  max?: number;
  /** Limites [observacion, atencion] en la misma escala que `score`. */
  thresholds?: [number, number];
  /** Controla el ancho; el alto se deriva del viewBox. */
  className?: string;
}) {
  const fraction = Math.max(0, Math.min(1, score / max));
  const [warn, danger] = thresholds.map((value) => Math.min(1, value / max));
  const marker = point(fraction, R);
  const color = LEVEL_COLOR[level];
  // Pequeno hueco entre zonas para que se lean como tramos y no como un arco continuo.
  const gap = 0.015;

  return (
    <svg
      viewBox="0 0 120 72"
      role="img"
      aria-label={`Score de salud ${score} de ${max}`}
      className={`block h-auto ${className}`}
    >
      <path d={arc(0, warn - gap, R_ZONE)} stroke="var(--tertiary)" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d={arc(warn + gap, danger - gap, R_ZONE)} stroke="var(--chart-amber)" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d={arc(danger + gap, 1, R_ZONE)} stroke="var(--error)" strokeWidth={3} fill="none" strokeLinecap="round" />

      <path d={arc(0, 1, R)} stroke="var(--outline-variant)" strokeWidth={10} fill="none" strokeLinecap="round" />
      {fraction > 0 ? (
        <path
          d={arc(0, 1, R)}
          stroke={color}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          className="chart-draw"
          style={{
            ["--chart-len" as string]: HALF,
            strokeDasharray: HALF,
            strokeDashoffset: HALF * (1 - fraction),
          }}
        />
      ) : null}
      <circle cx={marker.x} cy={marker.y} r={4.5} fill="var(--surface)" stroke={color} strokeWidth={3} />

      <text x={CX} y={CY - 6} textAnchor="middle" fill="var(--on-surface)" fontSize={26} fontWeight={800}>
        {score}
      </text>
      <text x={CX} y={CY + 6} textAnchor="middle" fill="var(--on-surface-variant)" fontSize={6.5} fontWeight={700} letterSpacing={0.9}>
        SCORE 30 DÍAS
      </text>
    </svg>
  );
}
