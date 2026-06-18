import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { ActivityItem } from "../types";

const activityColor: Record<string, string> = {
  merge: "bg-blue-500",
  deploy: "bg-emerald-500",
  validation: "bg-amber-500",
  hotfix: "bg-red-500",
  test: "bg-zinc-500",
  approval: "bg-indigo-500",
};

interface ActivityFeedSectionProps {
  search: string;
  onSearchChange: (value: string) => void;
  squadFilter: string;
  onSquadFilterChange: (value: string) => void;
  sprintFilter: string;
  onSprintFilterChange: (value: string) => void;
  moduleFilter: string;
  onModuleFilterChange: (value: string) => void;
  filteredActivity: ActivityItem[];
  allActivity: ActivityItem[];
}

export function ActivityFeedSection({
  search,
  onSearchChange,
  squadFilter,
  onSquadFilterChange,
  sprintFilter,
  onSprintFilterChange,
  moduleFilter,
  onModuleFilterChange,
  filteredActivity,
  allActivity,
}: ActivityFeedSectionProps) {
  return (
    <Card className="xl:col-span-3 bg-surface-container border border-outline-variant text-on-surface">
      <CardHeader>
        <CardTitle className="font-headline font-bold text-lg text-on-surface">Historial global de cambios</CardTitle>
        <CardDescription className="text-on-surface-variant text-xs">Feed profesional de commits y logs de auditoría en tiempo real.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-4">
          <Input 
            value={search} 
            onChange={(e) => onSearchChange(e.target.value)} 
            placeholder="Buscar actividad..." 
            className="bg-surface border-outline-variant text-on-surface placeholder:text-on-surface-variant"
          />
          <select
            className="h-10 rounded-lg border border-outline-variant bg-surface text-on-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            value={squadFilter}
            onChange={(e) => onSquadFilterChange(e.target.value)}
          >
            {["Todos", ...new Set(allActivity.map((i) => i.squad))].map((s) => (
              <option key={s} value={s} className="bg-surface text-on-surface">
                {s}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border border-outline-variant bg-surface text-on-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            value={sprintFilter}
            onChange={(e) => onSprintFilterChange(e.target.value)}
          >
            {["Todos", ...new Set(allActivity.map((i) => i.sprint))].map((s) => (
              <option key={s} value={s} className="bg-surface text-on-surface">
                {s}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border border-outline-variant bg-surface text-on-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            value={moduleFilter}
            onChange={(e) => onModuleFilterChange(e.target.value)}
          >
            {["Todos", ...new Set(allActivity.map((i) => i.module))].map((m) => (
              <option key={m} value={m} className="bg-surface text-on-surface">
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
          {filteredActivity.map((item) => (
            <div
              key={`${item.user}-${item.time}-${item.action}-${item.description}`}
              className="flex flex-wrap items-start gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3 hover:bg-surface-container-high transition-colors"
            >
              <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full shrink-0", activityColor[item.action] ?? "bg-zinc-500")} />
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-on-surface">{item.user}</span>
                  <Badge variant="outline" className="text-[10px] py-0 border-outline-variant text-on-surface-variant">{item.action}</Badge>
                  <span className="text-on-surface-variant font-medium">
                    {item.date} · {item.time}
                  </span>
                </div>
                <p className="text-sm font-medium text-on-surface leading-tight">{item.description}</p>
                <p className="text-xs text-on-surface-variant">
                  Módulo: {item.module} · Sprint: {item.sprint} · Estado: {item.status} · Impacto: {item.impact}
                </p>
              </div>
            </div>
          ))}
          {filteredActivity.length === 0 && (
            <p className="text-center py-8 text-sm text-on-surface-variant">No se encontró actividad reciente.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
