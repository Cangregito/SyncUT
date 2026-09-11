import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getModulesForRole, toUserRole } from "@/lib/auth/roles";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const protectedPrefixes = [
  "/dashboard",
  "/admin",
  "/justificaciones",
  "/citas",
  "/notificaciones",
  "/incidencias",
  "/chatbot",
  "/equipo",
  // Faltaba: la bandeja docente solo estaba protegida por la propia pagina.
  "/docente",
];

function matchesModule(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const authRoutes = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabasePublicConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  );
  const isAuthRoute = authRoutes.includes(request.nextUrl.pathname);

  const { data: profile } = user
    ? await supabase.from("profiles").select("role,account_status").eq("id", user.id).maybeSingle()
    : { data: null };

  if (user && profile?.account_status !== "active" && isProtected) {
    await supabase.auth.signOut();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "account_inactive");
    return NextResponse.redirect(loginUrl);
  }

  // Antes esto era un caso especial solo para `admin`. Ahora la tabla de
  // permisos de lib/auth/roles decide el acceso de cualquier rol, que es la
  // misma fuente que dibuja la navegacion.
  if (user) {
    const role = toUserRole(profile?.role);
    const allowedModules = getModulesForRole(role);
    const home = allowedModules[0]?.href ?? "/dashboard";
    const isAllowed = allowedModules.some((item) =>
      matchesModule(request.nextUrl.pathname, item.href),
    );

    const shouldLandOnHome =
      isAuthRoute || request.nextUrl.pathname === "/" || (isProtected && !isAllowed);

    if (shouldLandOnHome && !matchesModule(request.nextUrl.pathname, home)) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = home;
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }
  }

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
