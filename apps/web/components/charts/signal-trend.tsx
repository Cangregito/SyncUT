"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  chartAxisTick,
  chartGridStroke,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
  chartTooltipStyle,
} from "./chart-theme";

export type SignalSeries = {
  key: string;
  label: string;
  color: string;
};

export type SignalPoint = { label: string } & Record<string, number | string>;

/**
 * Columnas apiladas por periodo. Es la unica grafica de /equipo que carga
 * Recharts: aqui el tooltip por semana si aporta (que paso y cuando).
 */
export function SignalTrend({
  data,
  series,
  height = 200,
  emptyLabel = "Sin registros en el periodo.",
  stacked = true,
}: {
  data: SignalPoint[];
  series: SignalSeries[];
  height?: number;
  emptyLabel?: string;
  /** Con `false` las series se dibujan lado a lado en vez de apiladas. */
  stacked?: boolean;
}) {
  const total = data.reduce(
    (sum, point) => sum + series.reduce((inner, item) => inner + Number(point[item.key] ?? 0), 0),
    0,
  );

  return (
    <div style={{ height }} className="w-full">
      {total === 0 ? (
        <div className="flex h-full items-center justify-center rounded border border-dashed border-outline-variant text-xs text-on-surface-variant">
          {emptyLabel}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height }}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={chartGridStroke} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={chartAxisTick} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={chartAxisTick} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              cursor={{ fill: "var(--surface-container-highest)", opacity: 0.6 }}
              contentStyle={chartTooltipStyle}
              labelStyle={chartTooltipLabelStyle}
              itemStyle={chartTooltipItemStyle}
            />
            {series.map((item, index) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stackId={stacked ? "signals" : undefined}
                fill={item.color}
                maxBarSize={36}
                radius={!stacked || index === series.length - 1 ? [6, 6, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
