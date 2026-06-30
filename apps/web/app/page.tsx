// apps/web/app/(citas)/page.tsx
import Link from 'next/link'
import { CitasCalendar } from '@/components/citas/CitasCalendar'

// Por ahora con datos vacíos hasta integrar auth
export default function CitasPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] p-6">
      {/* ... tu plantilla actual ... */}
      {/* Cuando tengas el userId del contexto de auth, pasa las citas reales */}
    </div>
  )
}
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const session = window.localStorage.getItem("syncut_beta_session");
      if (session) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-surface-container border border-outline-variant flex items-center justify-center animate-spin">
          <span className="material-symbols-outlined text-primary text-3xl">sync</span>
        </div>
        <p className="text-on-surface-variant text-sm tracking-wider font-mono">REDIRECCIONANDO...</p>
      </div>
    </div>
  );
}
