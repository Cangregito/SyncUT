"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTheme(currentTheme()); setMounted(true); }, []);

  function toggleTheme() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem("syncut-theme", next);
    setTheme(next);
  }

  const isDark = !mounted || theme === "dark";
  return <button type="button" onClick={toggleTheme} aria-label={isDark ? "Activar tema claro" : "Activar tema oscuro"} title={isDark ? "Tema claro" : "Tema oscuro"} className={compact ? "grid h-9 w-9 place-items-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" : "flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"}>
    <span className="material-symbols-outlined text-[19px]">{isDark ? "light_mode" : "dark_mode"}</span>
    {!compact ? <span>{isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}</span> : null}
  </button>;
}
