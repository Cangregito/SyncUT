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
  title: z.string().trim().min(3, "El titulo debe tener minimo 3 caracteres."),
  area: z.string().trim().min(2, "El area es obligatoria."),
  description: z.string().trim().min(10, "La descripcion debe tener minimo 10 caracteres."),
  priority: z.enum(["alta", "media", "baja"]).default("media"),
});

const incidentSelect = `
  id,
  reported_by,
  assigned_to,
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
        details: authError?.message ?? "No se encontro usuario en la sesion o token.",
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
        details: error.message,
        code: error.code,
        hint: error.hint,
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
        details: authError?.message ?? "No se encontro usuario en la sesion o token.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createIncidentSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { data, error } = await supabase
    .from("incidents")
    .insert({
      reported_by: user.id,
      title: parsed.data.title,
      area: parsed.data.area,
      description: parsed.data.description,
      priority: parsed.data.priority,
    })
    .select(incidentSelect)
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: "Error creando incidencia",
        details: error.message,
        code: error.code,
        hint: error.hint,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}