import type { CSSProperties } from "react";

/**
 * Estilos compartidos por las graficas de Recharts. Usan los tokens del tema
 * (globals.css) para que sigan la paleta institucional en claro y oscuro.
 */
export const chartTooltipStyle: CSSProperties = {
  background: "var(--surface-container-high)",
  border: "1px solid var(--outline-variant)",
  borderRadius: 10,
  boxShadow: "0 12px 32px rgb(0 0 0 / 0.18)",
  color: "var(--on-surface)",
  fontSize: 12,
  padding: "8px 12px",
};

export const chartTooltipLabelStyle: CSSProperties = {
  color: "var(--on-surface-variant)",
  fontWeight: 600,
  marginBottom: 4,
};

export const chartTooltipItemStyle: CSSProperties = {
  color: "var(--on-surface)",
  padding: 0,
};

export const chartAxisTick = { fill: "var(--on-surface-variant)", fontSize: 11 };

export const chartGridStroke = "var(--outline-variant)";

/** Serie de colores para categorias sin semantica propia. */
export const chartSeries = [
  "var(--primary)",
  "var(--tertiary)",
  "var(--chart-amber)",
  "var(--error)",
  "var(--chart-sky)",
  "var(--secondary)",
];
