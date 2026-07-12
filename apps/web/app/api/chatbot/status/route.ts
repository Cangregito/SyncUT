import { NextResponse } from "next/server";

import { checkAiProvider } from "@/lib/chatbot/ai";

export async function GET() {
  const status = await checkAiProvider();
  return NextResponse.json(status, {
    status: status.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
