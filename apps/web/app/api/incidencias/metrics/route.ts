import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type IncidentPriority = "alta" | "media" | "baja";
type IncidentStatus = "abierta" | "en_proceso" | "resuelta" | "cerrada";

type IncidentMetricRow = {
  priority: IncidentPriority;
  status: IncidentStatus;
};

const prioritySeed: Record<IncidentPriority, number> = {
  alta: 0,
  media: 0,
  baja: 0,
};

const statusSeed: Record<IncidentStatus, number> = {
  abierta: 0,
  en_proceso: 0,
  resuelta: 0,
  cerrada: 0,
};

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("incidents")
    .select("priority, status");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as IncidentMetricRow[];

  const byPriority = { ...prioritySeed };
  const byStatus = { ...statusSeed };

  for (const row of rows) {
    byPriority[row.priority] += 1;
    byStatus[row.status] += 1;
  }

  const activeRows = rows.filter((row) =>
    ["abierta", "en_proceso"].includes(row.status),
  );

  const semaphore = {
    rojo: activeRows.filter((row) => row.priority === "alta").length,
    amarillo: activeRows.filter((row) => row.priority === "media").length,
    verde: rows.filter((row) => ["resuelta", "cerrada"].includes(row.status)).length,
  };

  return NextResponse.json({
    data: {
      total: rows.length,
      byPriority,
      byStatus,
      semaphore,
    },
  });
}