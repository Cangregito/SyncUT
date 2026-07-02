"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@plataforma/sdk/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!fullName || !email || !password || !confirmPassword) {
      setErrorMsg("Completa todos los campos para continuar.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("La confirmación de la contraseña no coincide.");
      return;
    }
    if (!termsAccepted) {
      setErrorMsg("Debes aceptar los Términos de Servicio y la Política de Privacidad.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setSuccessMsg(
        "Cuenta creada. Revisa tu correo para confirmar el registro."
      );
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al registrar la cuenta."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isPasswordStrong = password.length >= 8;

  return (
    <div className="w-full max-w-md">
      {/* Brand / Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface-container border border-outline-variant mb-4 shadow-lg shadow-black/50">
          <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            security
          </span>
        </div>
        <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface mb-2">Crear una cuenta</h1>
        <p className="text-on-surface-variant text-sm">Regístrate en SyncUT para proteger tu identidad digital académica.</p>
      </div>

      {/* Form Card */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-8 shadow-2xl shadow-black/80">
        <form className="space-y-6" onSubmit={handleSignup}>
          {/* Full Name Field */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2" htmlFor="name">
              Nombre Completo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">person</span>
              </div>
              <input
                className="block w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all sm:text-sm"
                id="name"
                placeholder="Juan Pérez"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2" htmlFor="email">
              Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">mail</span>
              </div>
              <input
                className="block w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all sm:text-sm"
                id="email"
                placeholder="nombre@universidad.edu.mx"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password Field with Strength Indicator */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2" htmlFor="password">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">lock</span>
              </div>
              <input
                className="block w-full pl-10 pr-10 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all sm:text-sm"
                id="password"
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-on-surface transition-colors"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>

            {/* Password Strength Meter */}
            <div className="mt-3">
              <div className="flex gap-1.5 h-1.5 w-full">
                <div
                  className={`flex-1 rounded-full transition-all duration-300 ${
                    password.length > 0 ? "bg-tertiary" : "bg-surface-container-highest"
                  }`}
                ></div>
                <div
                  className={`flex-1 rounded-full transition-all duration-300 ${
                    password.length >= 4 ? "bg-tertiary" : "bg-surface-container-highest"
                  }`}
                ></div>
                <div
                  className={`flex-1 rounded-full transition-all duration-300 ${
                    password.length >= 8 ? "bg-tertiary" : "bg-surface-container-highest"
                  }`}
                ></div>
                <div
                  className={`flex-1 rounded-full transition-all duration-300 ${
                    password.length >= 10 ? "bg-tertiary" : "bg-surface-container-highest"
                  }`}
                ></div>
              </div>
              <div className="flex justify-between items-center mt-1.5">
                <span className="text-xs text-on-surface-variant">Mínimo 8 caracteres</span>
                <span
                  className={`text-xs font-semibold tracking-wide uppercase ${
                    isPasswordStrong ? "text-tertiary" : "text-on-surface-variant"
                  }`}
                >
                  {isPasswordStrong ? "Fuerte" : "Débil"}
                </span>
              </div>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2" htmlFor="confirm_password">
              Confirmar Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">lock_reset</span>
              </div>
              <input
                className="block w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all sm:text-sm"
                id="confirm_password"
                placeholder="••••••••"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                className="w-4 h-4 rounded bg-surface-container-low border-outline-variant text-primary focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-colors cursor-pointer"
                id="terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
            </div>
            <div className="ml-3 text-sm">
              <label className="font-medium text-on-surface-variant cursor-pointer select-none" htmlFor="terms">
                Acepto los{" "}
                <a className="text-primary hover:text-primary-fixed underline decoration-primary/30 underline-offset-2 transition-colors" href="#">
                  Términos de Servicio
                </a>{" "}
                y la{" "}
                <a className="text-primary hover:text-primary-fixed underline decoration-primary/30 underline-offset-2 transition-colors" href="#">
                  Política de Privacidad
                </a>
                .
              </label>
            </div>
          </div>

          {/* Notifications and Errors */}
          {errorMsg && (
            <div className="flex items-center gap-1.5 text-error">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <p className="text-xs font-semibold">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-1.5 text-tertiary">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <p className="text-xs font-semibold">{successMsg}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-on-primary bg-primary hover:bg-primary-fixed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-all active:scale-[0.98]"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creando cuenta..." : "Crear Cuenta"}
          </button>
        </form>
      </div>

      {/* Footer Link */}
      <p className="mt-8 text-center text-sm text-on-surface-variant">
        ¿Ya tienes una cuenta?{" "}
        <Link className="font-medium text-primary hover:text-primary-fixed transition-colors" href="/login">
          Inicia sesión en SyncUT
        </Link>
      </p>
    </div>
  );
}
