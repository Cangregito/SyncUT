import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRequestClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

const createCommentSchema = z.object({
  comment: z.string().trim().min(2, "El comentario debe tener minimo 2 caracteres."),
});

async function getIncidentId(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

function validationError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "Datos invalidos",
      details: error.flatten().fieldErrors,
    },
    { status: 400 },
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const incidentId = await getIncidentId(context);

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
  const parsed = createCommentSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { data: incident, error: incidentError } = await supabase
    .from("incidents")
    .select("id")
    .eq("id", incidentId)
    .single();

  if (incidentError || !incident) {
    return NextResponse.json(
      {
        error: "Incidencia no encontrada o sin permiso",
        details: incidentError?.message,
      },
      { status: 404 },
    );
  }

  const { data, error } = await supabase
    .from("incident_comments")
    .insert({
      incident_id: incidentId,
      author_id: user.id,
      comment: parsed.data.comment,
    })
    .select("id, incident_id, author_id, comment, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: "Error creando comentario",
        details: error.message,
        code: error.code,
        hint: error.hint,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}