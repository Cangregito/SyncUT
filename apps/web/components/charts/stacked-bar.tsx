/**
 * Barra horizontal apilada con leyenda. HTML/CSS puro: sirve para
 * descomponer un total (por ejemplo, de que se compone un score) sin
 * cargar una libreria de graficas en la ruta.
 */
export type StackedSegment = {
  label: string;
  value: number;
  color: string;
  /** Texto corto que acompana al valor en la leyenda, p. ej. "×2". */
  hint?: string;
};

export function StackedBar({
  segments,
  emptyLabel = "Sin datos en el periodo",
  className = "",
}: {
  segments: StackedSegment[];
  emptyLabel?: string;
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);

  return (
    <div className={className}>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-outline-variant/40"
        role="img"
        aria-label={segments.map((segment) => `${segment.label}: ${segment.value}`).join(", ")}
      >
        {total > 0
          ? segments
              .filter((segment) => segment.value > 0)
              .map((segment) => (
                <span
                  key={segment.label}
                  className="chart-grow h-full"
                  style={{ width: `${(segment.value / total) * 100}%`, backgroundColor: segment.color }}
                  title={`${segment.label}: ${segment.value}`}
                />
              ))
          : null}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant">
        {total === 0 ? <li>{emptyLabel}</li> : null}
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden />
            <span>{segment.label}</span>
            <span className="font-semibold text-on-surface">{segment.value}</span>
            {segment.hint ? <span className="opacity-70">{segment.hint}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
