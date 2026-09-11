"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@plataforma/sdk/client";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import * as Dialog from "@radix-ui/react-dialog";
import accessibility from "@/components/ui/accessibility.module.css";

import {
  getModulesForRole,
  ROLE_LABELS,
  type UserRole,
} from "@/lib/auth/roles";

export function DashboardShell({
  children,
  email,
  role,
  unreadCount = 0,
}: {
  children: React.ReactNode;
  email: string;
  role: UserRole;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const profileTrigger = useRef<HTMLButtonElement>(null);
  const [activeHeaderMenu, setActiveHeaderMenu] = useState<
    "settings" | "profile" | null
  >(null);
  const navigationLinks = getModulesForRole(role);
  const roleLabel = ROLE_LABELS[role];
  const initials = email ? email.substring(0, 2).toUpperCase() : "US";

  // Los destinos del header salen de los modulos del rol. Antes estaban fijos y
  // el proxy devolvia al administrador a /admin desde todos ellos.
  const homeLink = navigationLinks[0];
  const notificationsLink = navigationLinks.find((item) => item.href === "/notificaciones");
  const helpLink = navigationLinks.find((item) => item.href === "/chatbot");

  // Escape cierra el menu abierto, como espera cualquier usuario de teclado.
  useEffect(() => {
    if (!mobileMenuOpen && !activeHeaderMenu) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (activeHeaderMenu === "settings") settingsTrigger.current?.focus();
      if (activeHeaderMenu === "profile") profileTrigger.current?.focus();
      setMobileMenuOpen(false);
      setActiveHeaderMenu(null);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen, activeHeaderMenu]);

  // Con el drawer abierto el fondo ya no se desplaza detras.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  async function handleLogout() {
    setIsSigningOut(true);
    setActiveHeaderMenu(null);
    const supabase = createSupabaseBrowserClient();
    await supabase.rpc("log_auth_event" as "get_teacher_directory", { p_action: "AUTH_LOGOUT" } as never);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
    <div className={`${accessibility.root} bg-background text-on-background font-body antialiased min-h-screen flex`}>
      <a href="#contenido-principal" className={accessibility.skipLink}>Saltar al contenido</a>
      {/* ==================== DESKTOP SIDEBAR ==================== */}
      <nav aria-label="Navegación principal" className="overflow-y-auto hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-surface-container border-r border-outline-variant z-40 py-4">
        {/* Header */}
        <div className="px-6 mb-8 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center font-headline font-bold">
            S
          </div>
          <div>
            <p className="text-lg font-headline font-black text-on-surface leading-tight tracking-tight">SyncUT</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Portal Académico</p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 px-3 space-y-1">
          {navigationLinks
            .map((item) => {
              const isActive = pathname === item.href || (!["/dashboard", "/admin"].includes(item.href) && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center justify-between p-3 rounded text-sm font-medium transition-all duration-150 active:scale-98 ${
                    isActive
                      ? "text-primary bg-surface-container-highest border-r-2 border-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true"
                      className="material-symbols-outlined text-[20px]"
                      style={{ fontVariationSettings: isActive ? "'FILL' 1" : undefined }}
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {/* El reparto interno por squad es informacion del equipo de
                      desarrollo, no del alumno: solo se muestra en gobernanza. */}
                  {item.squad && role === "admin" && (
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
              {email ? email.substring(0, 2).toUpperCase() : "US"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-on-surface truncate">{email}</p>
              <p className="text-xs text-on-surface-variant">{roleLabel}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={isSigningOut}
            className="w-full text-error p-3 flex items-center gap-3 hover:bg-error-container/20 rounded text-sm font-medium transition-all duration-150 text-left"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">logout</span>
            {isSigningOut ? "Cerrando..." : "Cerrar Sesión"}
          </button>
        </div>
      </nav>

      {/* ==================== MOBILE DRAWER MENU ==================== */}
      {mobileMenuOpen && (
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 backdrop-blur-sm" style={{ backgroundColor: "rgb(0 0 0 / 0.55)" }} />

          {/* Drawer Content */}
          <Dialog.Content aria-describedby={undefined} className={`${accessibility.root} fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100%-2rem))] flex-col overflow-y-auto border-r border-outline-variant bg-surface-container p-4 text-on-surface`}>
            <Dialog.Title className="sr-only">Navegación principal</Dialog.Title>
            {/* Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Cerrar menú"
              className="absolute top-3 right-3 grid min-h-11 min-w-11 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            >
              <span aria-hidden="true" className="material-symbols-outlined">close</span>
            </button>

            {/* Header */}
            <div className="px-2 mb-8 flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center font-headline font-bold">
                S
              </div>
              <div>
                <p className="text-lg font-headline font-black text-on-surface leading-tight">SyncUT</p>
                <p className="text-[10px] text-on-surface-variant">Portal Académico</p>
              </div>
            </div>

            {/* Links */}
            <div className="flex-1 space-y-1">
              {navigationLinks
                .map((item) => {
                  const isActive = pathname === item.href || (!["/dashboard", "/admin"].includes(item.href) && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                  aria-current={isActive ? "page" : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between p-3 rounded text-sm font-medium transition-all ${
                        isActive
                          ? "text-primary bg-surface-container-highest border-r-2 border-primary"
                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true"
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
                  {email ? email.substring(0, 2).toUpperCase() : "US"}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-on-surface truncate">{email}</p>
                  <p className="text-xs text-on-surface-variant">{roleLabel}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={isSigningOut}
                className="w-full text-error p-3 flex items-center gap-3 hover:bg-error-container/20 rounded text-sm font-medium text-left"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">logout</span>
                {isSigningOut ? "Cerrando..." : "Cerrar Sesión"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      )}

      {/* ==================== MAIN CONTENT WRAPPER ==================== */}
      {/* min-w-0: sin el, la columna (flex item) no encoge por debajo del ancho
          de su contenido y a 390 px toda la pagina crecia a 468 px. */}
      <div className="flex-1 min-w-0 md:ml-64 flex flex-col min-h-screen">
        {/* TopAppBar Component */}
        <header className="sticky top-0 w-full z-30 flex justify-between items-center gap-2 px-3 md:px-6 h-16 bg-surface border-b border-outline-variant font-body text-on-surface tracking-tight">
          {/* Mobile Menu Toggle */}
          <Dialog.Trigger asChild>
            <button type="button" className="md:hidden grid min-h-11 min-w-11 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-high shrink-0" aria-label="Abrir menú">
              <span aria-hidden="true" className="material-symbols-outlined">menu</span>
            </button>
          </Dialog.Trigger>

          {/* Brand (Mobile only) */}
          <div className="md:hidden min-w-0 truncate text-lg font-headline font-bold text-primary tracking-tighter mr-auto">
            SyncUT Portal
          </div>

          {/* Spacer for desktop */}
          <div className="hidden md:block flex-1"></div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {activeHeaderMenu ? (
              <button
                type="button"
                aria-label="Cerrar menu superior"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setActiveHeaderMenu(null)}
                tabIndex={-1}
              />
            ) : null}

            {/* El buscador global se retiro: era un campo sin accion conectada.
                Vuelve cuando exista una busqueda real por modulo. */}

            <ThemeToggle compact />

            {notificationsLink ? (
              <Link
                href="/notificaciones?estado=no-leidas"
                aria-label={
                  unreadCount > 0
                    ? `Abrir ${unreadCount} notificaciones sin leer`
                    : "Abrir notificaciones"
                }
                title="Notificaciones"
                className="text-on-surface-variant hover:text-on-surface transition-colors duration-200 cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-primary rounded-full min-h-11 min-w-11 inline-flex items-center justify-center"
              >
                <span aria-hidden="true" className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 grid place-items-center rounded-full bg-primary text-[9px] font-bold text-on-primary">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            ) : null}

            {/* Settings */}
            <div className="relative">
              <button
                type="button"
                aria-label="Abrir configuracion"
                ref={settingsTrigger}
                aria-controls={activeHeaderMenu === "settings" ? "header-settings" : undefined}
                aria-expanded={activeHeaderMenu === "settings"}
                title="Configuracion"
                onClick={() =>
                  setActiveHeaderMenu((current) =>
                    current === "settings" ? null : "settings"
                  )
                }
                className="text-on-surface-variant hover:text-on-surface transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary rounded-full min-h-11 min-w-11 inline-flex items-center justify-center"
              >
                <span aria-hidden="true" className="material-symbols-outlined">settings</span>
              </button>

              {activeHeaderMenu === "settings" ? (
                <div id="header-settings" className="fixed right-4 top-20 z-50 w-[min(18rem,calc(100vw-2rem))] sm:absolute sm:right-0 sm:top-12 rounded-lg border border-outline-variant bg-surface-container shadow-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-outline-variant">
                    <p className="text-sm font-semibold text-on-surface">Configuracion rapida</p>
                    <p className="text-xs text-on-surface-variant">
                      Accesos directos del portal.
                    </p>
                  </div>
                  <div className="p-2">
                    <ThemeToggle />
                    {notificationsLink ? (
                      <Link
                        href="/notificaciones#preferencias"
                        onClick={() => setActiveHeaderMenu(null)}
                        className="flex items-center gap-3 rounded px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">tune</span>
                        Preferencias de notificaciones
                      </Link>
                    ) : null}
                    {homeLink ? (
                      <Link
                        href={homeLink.href}
                        onClick={() => setActiveHeaderMenu(null)}
                        className="flex items-center gap-3 rounded px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">dashboard_customize</span>
                        {homeLink.label}
                      </Link>
                    ) : null}
                    {helpLink ? (
                      <Link
                        href={helpLink.href}
                        onClick={() => setActiveHeaderMenu(null)}
                        className="flex items-center gap-3 rounded px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">support_agent</span>
                        Ayuda institucional
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Profile Avatar */}
            <div className="relative">
              <button
                type="button"
                aria-label="Abrir menu de perfil"
                ref={profileTrigger}
                aria-controls={activeHeaderMenu === "profile" ? "header-profile" : undefined}
                aria-expanded={activeHeaderMenu === "profile"}
                title="Perfil"
                onClick={() =>
                  setActiveHeaderMenu((current) =>
                    current === "profile" ? null : "profile"
                  )
                }
                className="w-11 h-11 rounded-full overflow-hidden border border-outline-variant bg-surface-container-highest flex items-center justify-center text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {initials}
              </button>

              {activeHeaderMenu === "profile" ? (
                <div id="header-profile" className="fixed right-4 top-20 z-50 w-[min(20rem,calc(100vw-2rem))] sm:absolute sm:right-0 sm:top-12 rounded-lg border border-outline-variant bg-surface-container shadow-xl overflow-hidden">
                  <div className="px-4 py-4 border-b border-outline-variant flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest border border-outline-variant flex items-center justify-center text-sm font-bold text-primary">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">{email}</p>
                      <p className="text-xs text-on-surface-variant">{roleLabel}</p>
                    </div>
                  </div>
                  <div className="p-2">
                    {homeLink ? (
                      <Link
                        href={homeLink.href}
                        onClick={() => setActiveHeaderMenu(null)}
                        className="flex items-center gap-3 rounded px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">account_circle</span>
                        {homeLink.label}
                      </Link>
                    ) : null}
                    {notificationsLink ? (
                      <Link
                        href="/notificaciones"
                        onClick={() => setActiveHeaderMenu(null)}
                        className="flex items-center gap-3 rounded px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">notifications</span>
                        Mis notificaciones
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isSigningOut}
                      className="w-full flex items-center gap-3 rounded px-3 py-2 text-sm text-error hover:bg-error-container/20 text-left disabled:opacity-60"
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">logout</span>
                      {isSigningOut ? "Cerrando..." : "Cerrar sesion"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {/* Main Canvas */}
        <main id="contenido-principal" tabIndex={-1} className="min-w-0 flex-1 p-4 sm:p-6 md:p-8 bg-background text-on-background">
          {children}
        </main>
      </div>
    </div>
    </Dialog.Root>
  );
}
