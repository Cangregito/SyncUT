"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

type NavigationItem = {
  href: string;
  label: string;
  icon: string;
  squad?: string;
};

const navigationLinks: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/justificaciones", label: "Justificaciones", icon: "gavel", squad: "Squad 1" },
  { href: "/citas", label: "Citas con Tutor", icon: "calendar_month", squad: "Squad 3" },
  { href: "/notificaciones", label: "Notificaciones", icon: "notifications", squad: "Squad 4" },
  { href: "/incidencias", label: "Reportes Incidencias", icon: "rule", squad: "Squad 5" },
  { href: "/chatbot", label: "Asistente Chatbot", icon: "chat", squad: "Squad 6" },
  { href: "/admin", label: "Panel Gobernanza", icon: "monitoring", squad: "Admin Master" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("syncut_beta_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        setSessionEmail(parsed?.email || "usuario@syncut.io");
      }
    } catch {
      setSessionEmail("usuario@syncut.io");
    }
  }, []);

  const isMasterAdmin = sessionEmail?.trim().toLowerCase() === "jassiel.rr1502@gmail.com";

  function handleLogout() {
    window.localStorage.removeItem("syncut_beta_session");
    router.push("/login");
  }

  return (
    <div className="bg-background text-on-background font-body antialiased min-h-screen flex">
      {/* ==================== DESKTOP SIDEBAR ==================== */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-surface-container border-r border-outline-variant z-40 py-4">
        {/* Header */}
        <div className="px-6 mb-8 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center font-headline font-bold">
            S
          </div>
          <div>
            <h1 className="text-lg font-headline font-black text-on-surface leading-tight tracking-tight">SyncUT</h1>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Portal Académico</p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 px-3 space-y-1">
          {navigationLinks
            .filter((item) => item.href !== "/admin" || isMasterAdmin)
            .map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between p-3 rounded text-sm font-medium transition-all duration-150 active:scale-98 ${
                    isActive
                      ? "text-primary bg-surface-container-highest border-r-2 border-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ fontVariationSettings: isActive ? "'FILL' 1" : undefined }}
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.squad && (
                    <span className="text-[9px] bg-outline-variant/50 text-on-surface-variant px-1.5 py-0.5 rounded font-mono">
                      {item.squad}
                    </span>
                  )}
                </Link>
              );
            })}
        </div>

        {/* Footer Links */}
        <div className="px-3 mt-auto space-y-1">
          <div className="p-3 border-t border-outline-variant flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-xs font-bold text-primary border border-outline-variant">
              {sessionEmail ? sessionEmail.substring(0, 2).toUpperCase() : "US"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-on-surface truncate">{sessionEmail || "Invitado"}</p>
              <p className="text-[9px] text-on-surface-variant">Sesión activa</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-error p-3 flex items-center gap-3 hover:bg-error-container/20 rounded text-sm font-medium transition-all duration-150 text-left"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Cerrar Sesión
          </button>
        </div>
      </nav>

      {/* ==================== MOBILE DRAWER MENU ==================== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          ></div>

          {/* Drawer Content */}
          <div className="relative flex flex-col w-64 max-w-xs bg-surface-container border-r border-outline-variant p-4 z-50">
            {/* Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* Header */}
            <div className="px-2 mb-8 flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center font-headline font-bold">
                S
              </div>
              <div>
                <h1 className="text-lg font-headline font-black text-on-surface leading-tight">SyncUT</h1>
                <p className="text-[10px] text-on-surface-variant">Portal Académico</p>
              </div>
            </div>

            {/* Links */}
            <div className="flex-1 space-y-1">
              {navigationLinks
                .filter((item) => item.href !== "/admin" || isMasterAdmin)
                .map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between p-3 rounded text-sm font-medium transition-all ${
                        isActive
                          ? "text-primary bg-surface-container-highest border-r-2 border-primary"
                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="material-symbols-outlined text-[20px]"
                          style={{ fontVariationSettings: isActive ? "'FILL' 1" : undefined }}
                        >
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
            </div>

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-outline-variant space-y-2">
              <div className="flex items-center gap-2 px-2">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-xs font-bold text-primary">
                  {sessionEmail ? sessionEmail.substring(0, 2).toUpperCase() : "US"}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-on-surface truncate">{sessionEmail}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-error p-3 flex items-center gap-3 hover:bg-error-container/20 rounded text-sm font-medium text-left"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MAIN CONTENT WRAPPER ==================== */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* TopAppBar Component */}
        <header className="sticky top-0 w-full z-30 flex justify-between items-center px-6 h-16 bg-surface border-b border-outline-variant font-body text-on-surface tracking-tight">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden text-on-surface-variant hover:text-on-surface mr-4 cursor-pointer"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>

          {/* Brand (Mobile only) */}
          <div className="md:hidden text-xl font-headline font-bold text-primary tracking-tighter mr-auto">
            SyncUT Portal
          </div>

          {/* Spacer for desktop */}
          <div className="hidden md:block flex-1"></div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                search
              </span>
              <input
                className="bg-surface-container border border-outline-variant rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface placeholder:text-on-surface-variant w-48 focus:w-64"
                placeholder="Buscar en el portal..."
                type="text"
              />
            </div>

            {/* Notifications */}
            <button className="text-on-surface-variant hover:text-on-surface transition-colors duration-200 cursor-pointer relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full"></span>
            </button>

            {/* Settings */}
            <button className="text-on-surface-variant hover:text-on-surface transition-colors duration-200 cursor-pointer">
              <span className="material-symbols-outlined">settings</span>
            </button>

            {/* Profile Avatar */}
            <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant ml-2 bg-surface-container-highest flex items-center justify-center text-xs font-bold text-primary">
              {sessionEmail ? sessionEmail.substring(0, 2).toUpperCase() : "US"}
            </div>
          </div>
        </header>

        {/* Main Canvas */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-background text-on-background">
          {children}
        </main>
      </div>
    </div>
  );
}
