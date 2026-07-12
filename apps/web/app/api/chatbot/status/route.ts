import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth/session";
import { checkAiProvider } from "@/lib/chatbot/ai";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const status = await checkAiProvider();
  return NextResponse.json(status, {
    status: status.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
