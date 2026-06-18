"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin@syncut.io");
  const [password, setPassword] = useState("hunter2");
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg("");

    if (!username || !password) {
      setErrorMsg("Por favor, ingresa tu usuario y contraseña.");
      return;
    }

    // Mock validation to match the mockup error state if they clear fields
    if (password !== "hunter2") {
      setErrorMsg("Contraseña incorrecta. Por favor intente de nuevo.");
      return;
    }

    const cleanUsername = username.trim();

    // Save session in local storage for mockup flow
    window.localStorage.setItem(
      "syncut_beta_session",
      JSON.stringify({
        email: cleanUsername,
        role: cleanUsername.toLowerCase() === "jassiel.rr1502@gmail.com" || cleanUsername.toLowerCase().includes("admin") ? "admin" : "student",
        loggedAt: new Date().toISOString(),
      })
    );

    router.push("/dashboard");
  }

  return (
    <div className="w-full max-w-[400px]">
      {/* Brand Header */}
      <div className="flex flex-col items-center justify-center mb-8 gap-2">
        <div className="h-12 w-12 bg-surface-container border border-outline-variant rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(167,139,250,0.1)]">
          <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            security
          </span>
        </div>
        <h1 className="font-headline font-black text-2xl tracking-tighter text-on-surface mt-2">SyncUT</h1>
        <p className="text-on-surface-variant text-xs tracking-wider uppercase">PORTAL DE ACCESO SEGURO</p>
      </div>

      {/* Login Box */}
      <div className="bg-surface-container border border-outline-variant rounded-lg p-6 sm:p-8">
        <form className="space-y-5" onSubmit={handleLogin}>
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1.5" htmlFor="username">
              Usuario o Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-outline text-[20px]">person</span>
              </div>
              <input
                className="block w-full pl-10 bg-surface border border-outline-variant rounded text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all py-2.5 placeholder:text-outline"
                id="username"
                type="text"
                placeholder="admin@syncut.io"
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
              <a
                className="text-xs text-primary hover:text-primary-fixed transition-colors font-medium focus:outline-none focus:underline focus:underline-offset-2"
                href="#"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-outline text-[20px]">lock</span>
              </div>
              <input
                className={`block w-full pl-10 pr-10 bg-surface border rounded text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background transition-all py-2.5 ${
                  errorMsg ? "border-error focus:border-error focus:ring-error" : "border-outline-variant focus:border-primary focus:ring-primary"
                }`}
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="flex items-center gap-1.5 mt-2 text-error">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  error
                </span>
                <p className="text-xs font-medium">{errorMsg}</p>
              </div>
            )}
          </div>

          {/* Remember me checkbox */}
          <div className="flex items-center pt-1 pb-3">
            <input
              className="h-4 w-4 rounded bg-surface border-outline-variant text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background cursor-pointer"
              id="remember-me"
              name="remember-me"
              type="checkbox"
            />
            <label
              className="ml-2 block text-sm text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors select-none"
              htmlFor="remember-me"
            >
              Recordar mi sesión en este dispositivo
            </label>
          </div>

          {/* Submit Button */}
          <button
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded text-sm font-bold text-on-primary bg-primary hover:bg-surface-tint focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98] transition-all duration-150"
            type="submit"
          >
            Iniciar Sesión
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
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

      {/* Footer Links */}
      <div className="mt-8 text-center text-xs text-outline flex items-center justify-center gap-4">
        <a className="hover:text-on-surface-variant transition-colors" href="#">Ayuda</a>
        <span className="h-3 w-px bg-outline-variant"></span>
        <a className="hover:text-on-surface-variant transition-colors" href="#">Privacidad</a>
        <span className="h-3 w-px bg-outline-variant"></span>
        <a className="hover:text-on-surface-variant transition-colors" href="#">Términos</a>
      </div>
    </div>
  );
}
