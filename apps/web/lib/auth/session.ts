import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toUserRole, type UserRole } from "./roles";

export type CurrentProfile = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  accountStatus: "active" | "suspended" | "deactivated";
};

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,account_status")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName:
      profile?.full_name ??
      String(user.user_metadata?.full_name ?? "Usuario SyncUT"),
    role: toUserRole(profile?.role),
    accountStatus: profile?.account_status === "suspended" || profile?.account_status === "deactivated" ? profile.account_status : "active",
  };
}

export async function requireProfile(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.accountStatus !== "active") {
    redirect("/login?error=account_inactive");
  }

  return profile;
}

export async function requireRole(
  allowedRoles: readonly UserRole[]
): Promise<CurrentProfile> {
  const profile = await requireProfile();

  if (!allowedRoles.includes(profile.role)) {
    redirect("/dashboard?error=forbidden");
  }

  return profile;
}
