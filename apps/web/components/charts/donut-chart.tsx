"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { chartSeries, chartTooltipItemStyle, chartTooltipStyle } from "./chart-theme";

export type DonutSlice = {
  label: string;
  value: number;
  color?: string;
};

/**
 * Dona con total al centro y leyenda a un lado. Las rebanadas en cero se
 * omiten del trazo pero siguen en la leyenda para que el vacio sea explicito.
 */
export function DonutChart({
  slices,
  centerLabel,
  size = 150,
  emptyLabel = "Sin registros",
}: {
  slices: DonutSlice[];
  centerLabel?: string;
  size?: number;
  emptyLabel?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const colored = slices.map((slice, index) => ({ ...slice, color: slice.color ?? chartSeries[index % chartSeries.length] }));
  const drawn = colored.filter((slice) => slice.value > 0);

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        {total === 0 ? (
          <div className="absolute inset-0 rounded-full border-[14px] border-outline-variant/40" aria-hidden />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={drawn}
                dataKey="value"
                nameKey="label"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={drawn.length > 1 ? 3 : 0}
                cornerRadius={4}
                stroke="none"
              >
                {drawn.map((slice) => (
                  <Cell key={slice.label} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} itemStyle={chartTooltipItemStyle} />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black text-on-surface">{total}</span>
          {centerLabel ? <span className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">{centerLabel}</span> : null}
        </div>
      </div>
      <ul className="min-w-[10rem] flex-1 space-y-1.5 text-xs">
        {total === 0 ? <li className="text-on-surface-variant">{emptyLabel}</li> : null}
        {colored.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-on-surface-variant">
              <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
              <span className="leading-tight">{slice.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-on-surface">
              {slice.value}
              {total > 0 ? <span className="ml-1 font-normal text-on-surface-variant">{Math.round((slice.value / total) * 100)}%</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
