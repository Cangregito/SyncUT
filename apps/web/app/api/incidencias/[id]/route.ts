import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasPermission, toUserRole } from "@/lib/auth/roles";
import { createSupabaseRequestClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

type IncidentUpdatePayload = {
  priority?: "alta" | "media" | "baja";
  status?: "abierta" | "en_proceso" | "resuelta" | "cerrada";
  assigned_to?: string | null;
  resolution_summary?: string | null;
  updated_at: string;
  resolved_at?: string | null;
};

const updateIncidentSchema = z
  .object({
    priority: z.enum(["alta", "media", "baja"]).optional(),
    status: z.enum(["abierta", "en_proceso", "resuelta", "cerrada"]).optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    resolution_summary: z.string().trim().min(15).nullable().optional(),
  })
  .refine((value) => !["resuelta", "cerrada"].includes(value.status ?? "") || Boolean(value.resolution_summary), {
    message: "Resolver o cerrar requiere un resumen de al menos 15 caracteres.",
    path: ["resolution_summary"],
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debes enviar al menos un campo para actualizar.",
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
  resolved_at,
  resolution_summary
`;

async function getIncidentId(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

async function requireIncidentResolver(
  supabase: Awaited<ReturnType<typeof createSupabaseRequestClient>>["supabase"],
  userId: string,
  incidentId: string,
  nextStatus?: IncidentUpdatePayload["status"],
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return false;
  }

  const role = toUserRole(data.role);
  if (hasPermission(role, "incidents:resolve")) {
    return true;
  }

  if (role !== "tutor" || nextStatus !== "cerrada") {
    return false;
  }

  const { data: incident } = await supabase
    .from("incidents")
    .select("reported_by")
    .eq("id", incidentId)
    .maybeSingle();

  if (!incident) {
    return false;
  }

  const { data: assignment } = await supabase
    .from("tutorship_assignments")
    .select("id")
    .eq("tutor_id", userId)
    .eq("student_id", incident.reported_by)
    .eq("status", "active")
    .maybeSingle();

  return Boolean(assignment);
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

export async function GET(request: NextRequest, context: RouteContext) {
  const id = await getIncidentId(context);

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

  const { data: incident, error: incidentError } = await supabase
    .from("incidents")
    .select(incidentSelect)
    .eq("id", id)
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

  const { data: comments, error: commentsError } = await supabase
    .from("incident_comments")
    .select("id, incident_id, author_id, comment, created_at")
    .eq("incident_id", id)
    .order("created_at", { ascending: true });

  if (commentsError) {
    return NextResponse.json(
      {
        error: "Error consultando comentarios",
        details: commentsError.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: {
      ...incident,
      comments: comments ?? [],
    },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = await getIncidentId(context);

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
  const parsed = updateIncidentSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const canResolveIncident = await requireIncidentResolver(supabase, user.id, id, parsed.data.status);

  if (!canResolveIncident) {
    return NextResponse.json(
      {
        error: "Solo administracion o el tutor directo puede cerrar incidencias de su alumno",
      },
      { status: 403 },
    );
  }

  const updatePayload: IncidentUpdatePayload = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.status) {
    updatePayload.resolved_at = ["resuelta", "cerrada"].includes(parsed.data.status)
      ? new Date().toISOString()
      : null;
    updatePayload.resolution_summary = ["resuelta", "cerrada"].includes(parsed.data.status)
      ? parsed.data.resolution_summary ?? null
      : null;
  }

  const { data, error } = await supabase
    .from("incidents")
    .update(updatePayload)
    .eq("id", id)
    .select(incidentSelect)
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: "Error actualizando incidencia",
        details: error.message,
        code: error.code,
        hint: error.hint,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
}
