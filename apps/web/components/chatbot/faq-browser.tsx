"use client";

import { useId, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

type Faq = { id: string; category: string; question: string; answer: string };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

export function FaqBrowser({ faqs }: { faqs: Faq[] }) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(6);
  const term = normalize(query.trim());
  const filtered = faqs.filter((faq) => normalize(`${faq.category} ${faq.question} ${faq.answer}`).includes(term));

  return (
    <section className="min-w-0 rounded-xl border border-outline-variant bg-surface-container p-5">
      <h2 className="text-base font-semibold text-on-surface">Preguntas frecuentes</h2>
      <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">Abre una pregunta para consultar la orientación publicada.</p>
      <label htmlFor={searchId} className="mt-4 block text-sm font-medium text-on-surface">Buscar una pregunta</label>
      <div className="relative mt-2">
        <Search aria-hidden="true" className="absolute left-3 top-3 h-5 w-5 text-on-surface-variant" />
        <input id={searchId} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(6); }} placeholder="Ej. citas, faltas o acceso" className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface py-2 pl-10 pr-3 text-sm text-on-surface" />
      </div>
      <p role="status" className="mt-3 text-xs text-on-surface-variant">{filtered.length} {filtered.length === 1 ? "pregunta disponible" : "preguntas disponibles"}</p>
      <div className="mt-3 space-y-2">
        {filtered.slice(0, limit).map((faq) => (
          <details key={faq.id} className="group rounded-lg border border-outline-variant bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-xs font-medium text-primary">{faq.category}</span>
                <span className="mt-1 block break-words text-sm font-medium text-on-surface">{faq.question}</span>
              </span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-on-surface-variant transition-transform group-open:rotate-180" />
            </summary>
            <p className="whitespace-pre-wrap break-words border-t border-outline-variant p-3 text-sm leading-relaxed text-on-surface-variant">{faq.answer}</p>
          </details>
        ))}
      </div>
      {filtered.length === 0 && <p className="mt-4 text-sm text-on-surface-variant">{faqs.length ? "No encontramos esa pregunta. Prueba con otra palabra o consulta a Lumi." : "Todavía no hay preguntas publicadas. Puedes consultar a Lumi o a tu tutor."}</p>}
      {filtered.length > limit && <button type="button" onClick={() => setLimit((value) => value + 6)} className="mt-4 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-container-high">Ver más preguntas ({filtered.length - limit})</button>}
    </section>
  );
}
