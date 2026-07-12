"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, RotateCcw, Search } from "lucide-react";

export function LogsFilterBar({ actions }: { actions: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const firstRender = useRef(true);

  function update(name: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(name, value); else next.delete(name);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const timer = window.setTimeout(() => update("q", query.trim()), 350);
    return () => window.clearTimeout(timer);
    // searchParams intentionally stays outside: the debounce reacts only to typed text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const fieldClass = "rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-300 outline-none transition focus:border-violet-400/60";
  return <div className="relative grid gap-3 rounded-2xl border border-white/[.07] bg-zinc-950/60 p-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy={isPending}>
    <label className="relative"><Search size={15} className="absolute left-3 top-3 text-zinc-600"/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Actor, acción, registro o motivo…" className={`${fieldClass} w-full pl-9`}/></label>
    <select value={searchParams.get("action") ?? ""} onChange={(event)=>update("action",event.target.value)} className={fieldClass}><option value="">Todas las acciones</option>{actions.map(action=><option key={action}>{action}</option>)}</select>
    <select value={searchParams.get("result") ?? ""} onChange={(event)=>update("result",event.target.value)} className={fieldClass}><option value="">Todos los resultados</option><option value="success">Exitosos</option><option value="failed">Fallidos</option><option value="denied">Denegados</option></select>
    <select value={searchParams.get("severity") ?? ""} onChange={(event)=>update("severity",event.target.value)} className={fieldClass}><option value="">Todas las severidades</option><option value="info">Informativa</option><option value="warning">Advertencia</option><option value="critical">Crítica</option></select>
    <input type="date" value={searchParams.get("from") ?? ""} onChange={(event)=>update("from",event.target.value)} aria-label="Fecha inicial" className={fieldClass}/>
    <div className="flex gap-2"><input type="date" value={searchParams.get("to") ?? ""} onChange={(event)=>update("to",event.target.value)} aria-label="Fecha final" className={`${fieldClass} min-w-0 flex-1`}/><button type="button" onClick={()=>{setQuery(""); startTransition(()=>router.replace(pathname,{scroll:false}))}} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-400 hover:bg-white/[.05] hover:text-white" title="Limpiar filtros"><RotateCcw size={16}/></button></div>
    {isPending && <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-zinc-950/35 backdrop-blur-[1px]"><span className="flex items-center gap-2 rounded-full border border-violet-400/20 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-violet-300"><LoaderCircle size={14} className="animate-spin"/> Actualizando análisis</span></div>}
  </div>;
}
