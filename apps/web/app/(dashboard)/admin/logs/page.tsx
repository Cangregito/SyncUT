import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, Database, Download, ShieldAlert, UserRound } from "lucide-react";

import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogsFilterBar } from "./logs-filter-bar";

type Params = { q?: string; action?: string; result?: string; severity?: string; from?: string; to?: string };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default async function AdminLogsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const db = await createSupabaseServerClient();
  const [{ data: rows, error }, { data: profiles }] = await Promise.all([
    db.from("audit_logs").select("id,user_id,action,table_name,record_id,old_values,new_values,created_at,result,reason,severity,ip_address,user_agent,request_id").order("created_at", { ascending: false }).limit(500),
    db.from("profiles").select("id,full_name,email,role"),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, `${p.full_name} (${p.email})`]));
  const q = (params.q ?? "").trim().toLowerCase();
  const from = params.from ? new Date(`${params.from}T00:00:00`).getTime() : null;
  const to = params.to ? new Date(`${params.to}T23:59:59.999`).getTime() : null;
  const filtered = (rows ?? []).filter((row) => {
    const haystack = [row.action, row.table_name, row.reason, row.record_id, names.get(row.user_id ?? ""), JSON.stringify(row.new_values)].join(" ").toLowerCase();
    const timestamp = new Date(row.created_at).getTime();
    return (!q || haystack.includes(q)) && (!params.action || row.action === params.action) && (!params.result || row.result === params.result) && (!params.severity || row.severity === params.severity) && (!from || timestamp >= from) && (!to || timestamp <= to);
  });
  const actions = [...new Set((rows ?? []).map((row) => row.action))].sort();
  const critical = filtered.filter((row) => row.severity === "critical").length;
  const failed = filtered.filter((row) => row.result !== "success").length;
  const actors = new Set(filtered.map((row) => row.user_id).filter(Boolean)).size;
  const actionCounts = actions.map((action) => ({ action, count: filtered.filter((row) => row.action === action).length })).filter((item) => item.count).sort((a,b) => b.count-a.count).slice(0,6);
  const maxCount = Math.max(1, ...actionCounts.map((item) => item.count));
  const csv = [
    ["fecha","resultado","severidad","accion","actor","tabla","registro","motivo","antes","despues"].map(csvCell).join(","),
    ...filtered.map((row) => [row.created_at,row.result,row.severity,row.action,names.get(row.user_id ?? "") ?? "Sistema",row.table_name,row.record_id,row.reason,JSON.stringify(row.old_values),JSON.stringify(row.new_values)].map(csvCell).join(",")),
  ].join("\n");

  return <main className="mx-auto flex max-w-[1500px] flex-col gap-6 pb-12">
    <section className="rounded-2xl border border-violet-400/15 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,.2),transparent_40%),linear-gradient(135deg,#15131b,#0d0d10)] p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300">Centro de observabilidad</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Auditoría y análisis de eventos</h1><p className="mt-3 max-w-3xl text-sm text-zinc-400">Evidencia trazable para seguridad, cumplimiento y análisis operativo. Los registros son inmutables.</p></div><a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={`syncut-auditoria-${new Date().toISOString().slice(0,10)}.csv`} className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-bold text-white"><Download size={17}/> Exportar {filtered.length} eventos</a></div>
    </section>
    {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">No fue posible consultar la auditoría: {error.message}</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Eventos analizados", filtered.length, Activity, "text-violet-300 bg-violet-400/10"],
      ["Eventos críticos", critical, ShieldAlert, "text-red-300 bg-red-400/10"],
      ["Fallidos o denegados", failed, AlertTriangle, "text-amber-300 bg-amber-400/10"],
      ["Actores únicos", actors, UserRound, "text-sky-300 bg-sky-400/10"],
    ].map(([label,value,Icon,tone]) => { const MetricIcon = Icon as typeof Activity; return <article key={String(label)} className="rounded-2xl border border-white/[.07] bg-zinc-950/60 p-5"><div className="flex justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{String(label)}</p><p className="mt-2 text-3xl font-bold text-white">{String(value)}</p></div><div className={`grid size-10 place-items-center rounded-xl ${tone}`}><MetricIcon size={20}/></div></div></article>})}</section>
    <section className="grid gap-6 xl:grid-cols-[1.5fr_.7fr]">
      <LogsFilterBar actions={actions}/>
      <article className="rounded-2xl border border-white/[.07] bg-zinc-950/60 p-5"><h2 className="text-sm font-bold text-white">Acciones más frecuentes</h2><div className="mt-4 space-y-3">{actionCounts.map(item=><div key={item.action}><div className="mb-1 flex justify-between text-xs"><span className="truncate text-zinc-400">{item.action}</span><span className="font-bold text-zinc-200">{item.count}</span></div><div className="h-1.5 rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-violet-400" style={{width:`${item.count/maxCount*100}%`}}/></div></div>)}</div></article>
    </section>
    <section className="overflow-hidden rounded-2xl border border-white/[.07] bg-zinc-950/60"><div className="flex items-center justify-between border-b border-white/[.07] p-5"><div><h2 className="font-bold text-white">Registro detallado</h2><p className="mt-1 text-xs text-zinc-500">{filtered.length} resultados de los últimos {rows?.length ?? 0} eventos disponibles</p></div><span className="flex items-center gap-2 text-xs text-emerald-300"><CheckCircle2 size={15}/> Evidencia inmutable</span></div><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left"><thead className="bg-white/[.025] text-[10px] uppercase tracking-wider text-zinc-500"><tr><th className="px-5 py-3">Fecha</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Acción y actor</th><th className="px-4 py-3">Recurso</th><th className="px-4 py-3">Motivo</th><th className="px-5 py-3">Cambios</th></tr></thead><tbody className="divide-y divide-white/[.06]">{filtered.map(row=><tr key={row.id} className="align-top hover:bg-white/[.02]"><td className="whitespace-nowrap px-5 py-4 text-xs text-zinc-500">{dateLabel(row.created_at)}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.result==='success'?'bg-emerald-400/10 text-emerald-300':row.result==='denied'?'bg-amber-400/10 text-amber-300':'bg-red-400/10 text-red-300'}`}>{row.result.toUpperCase()}</span><p className="mt-2 text-[10px] uppercase text-zinc-600">{row.severity}</p></td><td className="px-4 py-4"><p className="text-xs font-bold text-zinc-200">{row.action}</p><p className="mt-1 max-w-[240px] truncate text-xs text-zinc-500">{names.get(row.user_id ?? '') ?? 'Sistema'}</p></td><td className="px-4 py-4 text-xs"><p className="flex items-center gap-1 text-zinc-300"><Database size={12}/>{row.table_name}</p><p className="mt-1 max-w-[150px] truncate font-mono text-[10px] text-zinc-600">{row.record_id ?? '—'}</p></td><td className="max-w-xs px-4 py-4 text-xs text-zinc-400">{row.reason ?? 'Sin motivo documentado'}</td><td className="px-5 py-4"><details className="text-xs"><summary className="cursor-pointer font-semibold text-violet-300">Ver evidencia</summary><div className="mt-2 grid gap-2"><pre className="max-w-xs overflow-auto rounded bg-black/30 p-2 text-[10px] text-red-200">Antes: {JSON.stringify(row.old_values,null,2)}</pre><pre className="max-w-xs overflow-auto rounded bg-black/30 p-2 text-[10px] text-emerald-200">Después: {JSON.stringify(row.new_values,null,2)}</pre></div></details></td></tr>)}{filtered.length===0&&<tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-zinc-500">No hay eventos que coincidan con estos filtros.</td></tr>}</tbody></table></div></section>
    <p className="text-center text-xs text-zinc-600">Para consultar gobernanza de usuarios vuelve al <Link href="/admin" className="text-violet-300 hover:underline">Panel Gobernanza</Link>.</p>
  </main>;
}
