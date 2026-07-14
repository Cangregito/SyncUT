"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@plataforma/sdk/client";
import { getAuthRedirectUrl } from "@/lib/auth/urls";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg("Ingresa tu correo institucional para enviar el enlace.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: getAuthRedirectUrl("/auth/callback?next=/reset-password"),
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setSuccessMsg("Si el correo existe, recibirás un enlace para restablecer tu contraseña.");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "No fue posible enviar el enlace.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-8 flex flex-col items-center justify-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container">
          <span className="material-symbols-outlined text-3xl text-primary">lock_reset</span>
        </div>
        <h1 className="mt-2 font-headline text-2xl font-black tracking-tighter text-on-surface">
          Recuperar contraseña
        </h1>
        <p className="text-center text-xs uppercase tracking-wider text-on-surface-variant">
          Acceso seguro SyncUT
        </p>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface-container p-6 sm:p-8">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-on-surface-variant" htmlFor="email">
              Correo electrónico
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="material-symbols-outlined text-[20px] text-outline">mail</span>
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="block w-full rounded border border-outline-variant bg-surface py-2.5 pl-10 text-sm text-on-surface transition-all placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              />
            </div>
          </div>

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
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enviando..." : "Enviar enlace"}
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </form>
      </div>

      <div className="mt-6 text-center text-sm text-on-surface-variant">
        <Link href="/login" className="font-medium text-primary transition-colors hover:text-primary-fixed">
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
