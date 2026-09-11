import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRequestClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const incidentQuerySchema = z.object({
  priority: z.enum(["alta", "media", "baja"]).optional(),
  status: z.enum(["abierta", "en_proceso", "resuelta", "cerrada"]).optional(),
  mine: z.enum(["true", "false"]).optional(),
});

const createIncidentSchema = z.object({
  title: z.string().trim().min(5, "El titulo debe tener minimo 5 caracteres.").max(120),
  area: z.string().trim().min(3, "El area debe tener minimo 3 caracteres.").max(120),
  description: z.string().trim().min(15, "La descripcion debe tener minimo 15 caracteres."),
  priority: z.enum(["alta", "media", "baja"]).default("media"),
});

const incidentSelect = `
  id,
  reported_by,
  assigned_to,
  team_id,
  title,
  area,
  description,
  priority,
  status,
  created_at,
  updated_at,
  resolved_at
`;

function validationError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "Datos invalidos",
      details: error.flatten().fieldErrors,
    },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const { supabase, user, error: authError } =
    await createSupabaseRequestClient(request);

  if (authError || !user) {
    return NextResponse.json(
      {
        error: "No autenticado",
        details: "Inicia sesion para continuar.",
      },
      { status: 401 },
    );
  }

  const parsed = incidentQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  let query = supabase
    .from("incidents")
    .select(incidentSelect)
    .order("created_at", { ascending: false });

  if (parsed.data.priority) {
    query = query.eq("priority", parsed.data.priority);
  }

  if (parsed.data.status) {
    query = query.eq("status", parsed.data.status);
  }

  if (parsed.data.mine === "true") {
    query = query.eq("reported_by", user.id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      {
        error: "Error consultando incidencias",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const { supabase, user, error: authError } =
    await createSupabaseRequestClient(request);

  if (authError || !user) {
    return NextResponse.json(
      {
        error: "No autenticado",
        details: "Inicia sesion para continuar.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createIncidentSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  // La politica de insercion exige `team_id` y comprueba que quien reporta sea
  // miembro activo de ese equipo. Se resuelve en el servidor: si llegara desde
  // el cliente podria venir vacio o apuntar a un equipo ajeno.
  const { data: membership } = await supabase
    .from("tutor_team_members")
    .select("team_id")
    .eq("student_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership?.team_id) {
    return NextResponse.json(
      {
        error: "Sin equipo tutorial",
        details: "Unete a tu equipo tutorial antes de reportar una incidencia.",
      },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      reported_by: user.id,
      team_id: membership.team_id,
      title: parsed.data.title,
      area: parsed.data.area,
      description: parsed.data.description,
      priority: parsed.data.priority,
    } as never)
    .select(incidentSelect)
    .single();

  if (error) {
    // El detalle de Postgres (message/code/hint) se queda en el servidor.
    console.error("POST /api/incidencias", error);
    return NextResponse.json(
      { error: "No fue posible registrar la incidencia." },
      { status: 500 },
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
