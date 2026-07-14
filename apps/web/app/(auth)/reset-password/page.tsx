"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@plataforma/sdk/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setHasSession(Boolean(data.session));
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!password || !confirmPassword) {
      setErrorMsg("Completa ambos campos para continuar.");
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

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setSuccessMsg("Contraseña actualizada correctamente. Redirigiendo al dashboard...");
      setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 900);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "No fue posible actualizar la contraseña.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-8 flex flex-col items-center justify-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container">
          <span className="material-symbols-outlined text-3xl text-primary">password</span>
        </div>
        <h1 className="mt-2 font-headline text-2xl font-black tracking-tighter text-on-surface">
          Nueva contraseña
        </h1>
        <p className="text-center text-xs uppercase tracking-wider text-on-surface-variant">
          Sesión de recuperación verificada
        </p>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface-container p-6 sm:p-8">
        {hasSession === false ? (
          <div className="space-y-4">
            <div className="rounded border border-error/40 bg-error-container/20 p-3 text-xs font-medium text-on-error-container">
              El enlace no tiene una sesión válida o ya expiró. Solicita uno nuevo.
            </div>
            <Link
              href="/forgot-password"
              className="flex w-full items-center justify-center gap-2 rounded border border-transparent bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition-all hover:bg-surface-tint focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            >
              Solicitar nuevo enlace
            </Link>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-on-surface-variant" htmlFor="password">
                Contraseña nueva
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="material-symbols-outlined text-[20px] text-outline">lock</span>
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="block w-full rounded border border-outline-variant bg-surface py-2.5 pl-10 pr-10 text-sm text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline transition-colors hover:text-on-surface-variant"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-on-surface-variant" htmlFor="confirm-password">
                Confirmar contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="block w-full rounded border border-outline-variant bg-surface px-3 py-2.5 text-sm text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              />
            </div>

            <p className="text-xs text-on-surface-variant">Usa al menos 8 caracteres. No reutilices contraseñas de otros servicios.</p>

            {errorMsg ? (
              <div className="flex items-center gap-1.5 text-error">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <p className="text-xs font-medium">{errorMsg}</p>
              </div>
            ) : null}

            {successMsg ? (
              <div className="rounded border border-tertiary/40 bg-tertiary-container/20 p-3 text-xs font-medium text-on-tertiary-container">
                {successMsg}
              </div>
            ) : null}

            <button
              className="flex w-full items-center justify-center gap-2 rounded border border-transparent bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition-all duration-150 hover:bg-surface-tint focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98]"
              type="submit"
              disabled={isSubmitting || hasSession === null}
            >
              {isSubmitting ? "Actualizando..." : "Actualizar contraseña"}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
