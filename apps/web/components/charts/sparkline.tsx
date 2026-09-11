/**
 * Mini linea de tendencia para tarjetas KPI. SVG puro, apto para servidor.
 * Se estira al ancho disponible sin deformar el trazo.
 */
export function Sparkline({
  points,
  color = "var(--primary)",
  height = 36,
  className = "",
}: {
  points: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  if (points.length < 2) return null;

  const max = Math.max(...points, 1);
  const stepX = 100 / (points.length - 1);
  const coords = points.map((value, index) => {
    const x = index * stepX;
    const y = 30 - (value / max) * 26;
    return [x, y] as const;
  });
  const path = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      height={height}
      role="img"
      aria-label={`Tendencia: ${points.join(", ")}`}
      className={`block w-full ${className}`}
    >
      <polygon points={`0,32 ${path} 100,32`} fill={color} fillOpacity={0.12} />
      <polyline
        points={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
