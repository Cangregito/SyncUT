import { NextResponse, type NextRequest } from "next/server";

import { checkAiProvider } from "@/lib/chatbot/ai";
import { createSupabaseRequestClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CachedStatus = {
  expiresAt: number;
  payload: Awaited<ReturnType<typeof checkAiProvider>>;
};

/**
 * Una sola comprobacion real por ventana: la sonda gasta cuota del proveedor,
 * asi que no puede dispararse una vez por peticion.
 */
const PROBE_TTL_MS = 60_000;
let cached: CachedStatus | null = null;
let inFlight: Promise<CachedStatus["payload"]> | null = null;

async function readStatus() {
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return { payload: cached.payload, fresh: false };
  }

  // Varias peticiones simultaneas comparten una unica sonda.
  if (!inFlight) {
    inFlight = checkAiProvider().finally(() => {
      inFlight = null;
    });
  }

  const payload = await inFlight;
  cached = { payload, expiresAt: Date.now() + PROBE_TTL_MS };

  return { payload, fresh: true };
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await createSupabaseRequestClient(request);

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { payload, fresh } = await readStatus();

  return NextResponse.json(
    { ...payload, cached: !fresh },
    {
      status: payload.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
