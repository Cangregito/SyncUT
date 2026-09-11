"use server";

import { redirect } from "next/navigation";

import { getDemoAccount, isDemoLoginEnabled } from "@/lib/auth/demo-accounts";
import { DEMO_QUICK_ACCESS_ROLES, isUserRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Inicia sesion con una cuenta de exhibicion sin exponer sus credenciales al
 * navegador. La contrasena vive solo en el servidor; el cliente unicamente
 * envia el rol solicitado.
 */
export async function signInWithDemoRole(role: string): Promise<{ error: string } | void> {
  if (!isDemoLoginEnabled()) {
    return { error: "El acceso de demostracion esta desactivado en este entorno." };
  }

  // Una Server Action es alcanzable por POST directo, no solo desde la UI:
  // la lista permitida se comprueba aqui, no en el cliente.
  if (!isUserRole(role) || !DEMO_QUICK_ACCESS_ROLES.includes(role)) {
    return { error: "Rol de demostracion no valido." };
  }

  const account = getDemoAccount(role);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (error) {
    return { error: "La cuenta de demostracion no esta disponible. Intenta con tus credenciales." };
  }

  await supabase.rpc("log_auth_event" as "get_teacher_directory", { p_action: "AUTH_LOGIN" } as never);

  redirect("/dashboard");
}
