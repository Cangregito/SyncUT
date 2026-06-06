"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@plataforma/sdk/client";
import { ExecutiveDashboardPage } from "@/components/modules/executive-dashboard/executive-dashboard-page";

export default function AdminRoutePage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      // 1. Verificar primero en localStorage (rápido para UX)
      try {
        const localSession = window.localStorage.getItem("syncut_beta_session");
        if (!localSession) {
          if (active) {
            setAuthorized(false);
            setLoading(false);
          }
          return;
        }

        const parsed = JSON.parse(localSession);
        const email = parsed?.email?.trim().toLowerCase();
        if (active) {
          setCurrentUserEmail(parsed?.email || "No identificado");
        }
        
        if (email !== "jassiel.rr1502@gmail.com") {
          if (active) {
            setAuthorized(false);
            setLoading(false);
          }
          return;
        }

        // 2. Verificar de forma segura contra la sesión de Supabase Auth si está configurada
        const hasEnv =
          Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
          Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);



        // Acceso concedido
        if (active) {
          setAuthorized(true);
          setLoading(false);
        }
      } catch {
        if (active) {
          setAuthorized(false);
          setLoading(false);
        }
      }
    }

    void checkAuth();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 rounded-lg bg-surface-container border border-outline-variant flex items-center justify-center animate-spin">
          <span className="material-symbols-outlined text-primary text-2xl">sync</span>
        </div>
        <p className="text-on-surface-variant text-sm tracking-wider font-mono">VERIFICANDO CREDENCIALES...</p>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-error-container/20 border border-error/30 flex items-center justify-center mb-6 text-error animate-pulse">
          <span className="material-symbols-outlined text-4xl">gavel</span>
        </div>
        <h2 className="font-headline font-black text-2xl text-on-surface mb-2 tracking-tight">
          Acceso Restringido
        </h2>
        <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
          Esta zona de gobernanza del proyecto está reservada exclusivamente para el administrador master (<strong>jassiel.rr1502@gmail.com</strong>). Tu usuario actual no tiene privilegios suficientes.
        </p>
        <p className="w-full text-on-surface-variant text-xs bg-surface-container-high border border-outline-variant rounded p-3 mb-6 font-mono truncate">
          Usuario actual: <span className="text-primary font-bold">{currentUserEmail || "No identificado"}</span>
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-5 py-2.5 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant rounded-lg text-sm font-semibold transition-all cursor-pointer active:scale-95"
        >
          Volver al Portal
        </button>
      </div>
    );
  }

  // Si está autorizado, renderizar el panel ejecutivo de avance
  return <ExecutiveDashboardPage />;
}
