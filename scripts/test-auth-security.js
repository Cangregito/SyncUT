import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

function getEnvValue(name) {
  const line = fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${name}=`));

  return line?.slice(name.length + 1).trim();
}

function getApiKeys() {
  const command =
    "pnpm dlx supabase@latest projects api-keys --project-ref vvbzhrxfshillhkyunje --output-format json";
  const result = spawnSync(
    process.platform === "win32" ? "cmd.exe" : "sh",
    process.platform === "win32"
      ? ["/d", "/s", "/c", command]
      : ["-c", command],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || "No fue posible obtener las API keys.");
  }

  const keys = JSON.parse(result.stdout).keys;
  return {
    publishable: keys.find((key) => key.type === "publishable")?.api_key,
  };
}

const url = getEnvValue("NEXT_PUBLIC_SUPABASE_URL");
const { publishable } = getApiKeys();
const secret = getEnvValue("SUPABASE_SECRET_KEY");

if (!url || !publishable) {
  throw new Error("Falta URL o publishable key para la prueba.");
}

const password = `SyncUT-${randomUUID()}-Aa1`;
const email = `security-test-${randomUUID()}@example.invalid`;
const publicClient = createClient(url, publishable, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: anonymousProfilesError } = await publicClient
  .from("profiles")
  .select("id")
  .limit(1);

if (!anonymousProfilesError) {
  throw new Error("El rol anónimo todavía puede consultar profiles.");
}

const { error: anonymousRpcError } = await publicClient.rpc("is_admin");

if (!anonymousRpcError) {
  throw new Error("El rol anónimo todavía puede ejecutar is_admin.");
}

console.log("✅ Usuario anónimo no puede consultar profiles.");
console.log("✅ Usuario anónimo no puede ejecutar RPC internos.");

if (!secret) {
  console.log(
    "ℹ️ Prueba administrativa omitida: configura SUPABASE_SECRET_KEY localmente para ejecutarla."
  );
  process.exit(0);
}

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId;

try {
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "Security Test",
        role: "admin",
      },
    });

  if (createError || !created.user) {
    throw createError ?? new Error("No se creó el usuario temporal.");
  }

  userId = created.user.id;

  const { data: initialProfile, error: initialProfileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (initialProfileError || initialProfile?.role !== "student") {
    throw new Error(
      `El registro no aplicó mínimo privilegio: ${initialProfileError?.message ?? initialProfile?.role}`
    );
  }

  const { error: signInError } = await publicClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw signInError;
  }

  const { error: escalationError } = await publicClient
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", userId);

  if (!escalationError) {
    throw new Error("La actualización directa de role fue aceptada.");
  }

  const { error: rpcError } = await publicClient.rpc("set_user_role", {
    target_user_id: userId,
    new_role: "admin",
  });

  if (!rpcError) {
    throw new Error("Un estudiante pudo ejecutar set_user_role.");
  }

  const { data: finalProfile, error: finalProfileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (finalProfileError || finalProfile?.role !== "student") {
    throw new Error("El usuario temporal dejó de tener rol student.");
  }

  console.log("✅ Registro ignora roles enviados por metadata.");
  console.log("✅ Usuario student no puede modificar su role.");
  console.log("✅ Usuario student no puede ejecutar set_user_role.");
} finally {
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
}
