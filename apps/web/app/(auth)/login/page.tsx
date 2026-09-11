"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@plataforma/sdk/client";

import { DEMO_QUICK_ACCESS_ROLES, ROLE_LABELS, type UserRole } from "@/lib/auth/roles";

import { signInWithDemoRole } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoRole, setDemoRole] = useState<UserRole | null>(null);

  // El proxy (cuenta inactiva) y el callback de recuperacion redirigen aqui con
  // `?error=`. Antes ese motivo nunca se mostraba y el usuario veia un login
  // limpio sin saber por que habia vuelto.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("error");
    if (!reason) return;
    const known: Record<string, string> = {
      account_inactive: "Tu cuenta está suspendida o desactivada. Contacta a tu tutor o a administración.",
    };
    setErrorMsg(known[reason] ?? reason);
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg("");

    if (!username || !password) {
      setErrorMsg("Por favor, ingresa tu usuario y contraseña.");
      return;
    }

    const cleanUsername = username.trim();
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanUsername,
        password,
      });

      if (error) {
        // Un 5xx o un timeout del proveedor no es culpa del usuario: decirle
        // "contraseña incorrecta" lo manda a cambiarla sin motivo.
        const serviceDown = (error.status ?? 0) >= 500 || error.name === "AuthRetryableFetchError";
        setErrorMsg(
          serviceDown
            ? "El servicio de acceso no responde en este momento. Intenta de nuevo en unos segundos."
            : "Correo o contraseña incorrectos.",
        );
        return;
      }

      await supabase.rpc("log_auth_event" as "get_teacher_directory", { p_action: "AUTH_LOGIN" } as never);

      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const safeNext =
        requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
          ? requestedNext
          : "/dashboard";

      router.replace(safeNext);
      router.refresh();
    } catch {
      setErrorMsg("No fue posible iniciar sesión. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoLogin(role: UserRole) {
    setErrorMsg("");
    setDemoRole(role);

    // Las credenciales viven solo en el servidor: aqui unicamente viaja el rol.
    const result = await signInWithDemoRole(role);

    if (result?.error) {
      setErrorMsg(result.error);
      setDemoRole(null);
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      {/* Brand Header */}
      <div className="flex flex-col items-center justify-center mb-8 gap-2">
        <div className="h-12 w-12 bg-surface-container border border-outline-variant rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(167,139,250,0.1)]">
          <span aria-hidden="true" className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            security
          </span>
        </div>
        <h1 className="font-headline font-black text-2xl tracking-tighter text-on-surface mt-2">SyncUT</h1>
        <p className="text-on-surface-variant text-xs tracking-wider uppercase">PORTAL DE ACCESO SEGURO</p>
      </div>

      {/* Login Box */}
      <div className="bg-surface-container border border-outline-variant rounded-lg p-6 sm:p-8">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-on-surface">Explorar la demostración</h2>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">Prueba una cuenta de ejemplo o inicia sesión con tu cuenta más abajo.</p>
        </div>
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DEMO_QUICK_ACCESS_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => handleDemoLogin(role)}
              disabled={demoRole !== null || isSubmitting}
              className="flex items-center justify-between rounded border border-outline-variant bg-surface px-3 py-2 text-left text-xs text-on-surface-variant hover:border-primary hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              <span>{ROLE_LABELS[role]}</span>
              <span className={`material-symbols-outlined text-[16px] ${demoRole === role ? "animate-spin" : ""}`}>
                {demoRole === role ? "progress_activity" : "login"}
              </span>
            </button>
          ))}
        </div>
        <form className="space-y-5" onSubmit={handleLogin}>
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5" htmlFor="username">
              Correo electrónico institucional
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span aria-hidden="true" className="material-symbols-outlined text-outline text-[20px]">person</span>
              </div>
              <input
                className="block w-full pl-10 bg-surface border border-outline-variant rounded text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all py-2.5 placeholder:text-outline"
                id="username"
                type="email"
                placeholder="nombre@syncut.test"
                autoComplete="email"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-on-surface-variant" htmlFor="password">
                Contraseña
              </label>
              <Link
                className="text-xs text-primary hover:text-primary-fixed transition-colors font-medium focus:outline-none focus:underline focus:underline-offset-2"
                href="/forgot-password"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span aria-hidden="true" className="material-symbols-outlined text-outline text-[20px]">lock</span>
              </div>
              <input
                className={`block w-full pl-10 pr-10 bg-surface border rounded text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background transition-all py-2.5 ${
                  errorMsg ? "border-error focus:border-error focus:ring-error" : "border-outline-variant focus:border-primary focus:ring-primary"
                }`}
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                aria-describedby={errorMsg ? "login-error" : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface-variant transition-colors"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                  {showPassword ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div id="login-error" role="alert" className="flex items-center gap-1.5 mt-2 text-error">
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  error
                </span>
                <p className="text-xs font-medium">{errorMsg}</p>
              </div>
            )}
          </div>

          {/* La casilla "Recordar mi sesion" se retiro: no alteraba la
              autenticacion. La sesion de Supabase ya persiste en el dispositivo. */}

          {/* Submit Button */}
          <button
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded text-sm font-bold text-on-primary bg-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98] transition-all duration-150"
            type="submit"
            disabled={isSubmitting || demoRole !== null}
            aria-busy={isSubmitting || demoRole !== null}
          >
            {isSubmitting ? "Iniciando..." : "Iniciar Sesión"}
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </form>
      </div>

      {/* Alternative actions */}
      <div className="mt-6 text-center text-sm text-on-surface-variant">
        ¿No tienes cuenta?{" "}
        <Link href="/signup" className="text-primary hover:text-primary-fixed transition-colors font-medium">
          Regístrate aquí
        </Link>
      </div>

      {/* Ayuda, Privacidad y Terminos apuntaban a "#". Se retiran hasta que
          existan esas paginas. */}
      <p className="mt-8 text-center text-xs text-outline">
        Universidad Tecnológica · Plataforma de acompañamiento tutorial
      </p>
    </div>
  );
}
