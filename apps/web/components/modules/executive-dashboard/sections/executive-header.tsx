import { motion } from "framer-motion";
import { ChevronRight, Download, Moon, Sun, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExecutiveHeaderProps {
  onExport: () => void;
  hasLiveSource: boolean;
  syncLabel: string;
  header: {
    projectName: string;
    status: string;
    version: string;
    updatedAt: string;
    environment: string;
    leader: string;
    leaderRole: string;
    online: boolean;
  };
}

export function ExecutiveHeader({
  onExport,
  hasLiveSource,
  syncLabel,
  header,
}: ExecutiveHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-container border border-outline-variant rounded-lg px-4 py-4 md:px-6 md:py-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <span>Inicio</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>Centro Ejecutivo</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-on-surface font-semibold">Avance Proyecto</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">{header.environment}</Badge>
          <Badge variant={header.online ? "success" : "danger"}>
            {header.online ? "Sistema online" : "Sistema degradado"}
          </Badge>
          <Badge variant={hasLiveSource ? "success" : "warning"}>
            {hasLiveSource ? `Sync Supabase ${syncLabel}` : "Mock fallback"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface tracking-tight md:text-3xl">{header.projectName}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Estado global {header.status} · Versión {header.version} · Actualización {header.updatedAt}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onExport} className="border-outline-variant text-on-surface hover:bg-surface-container-high">
            <Download className="h-4 w-4 mr-1.5" /> Exportar reporte
          </Button>
          <Button variant="secondary" className="bg-surface-container-highest text-on-surface hover:bg-outline-variant/20">
            <Target className="h-4 w-4 mr-1.5" /> Ver roadmap
          </Button>
          <div className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">
              {header.leader.substring(0,2).toUpperCase()}
            </div>
            <div className="text-xs leading-tight">
              <p className="font-semibold text-on-surface">{header.leader}</p>
              <p className="text-on-surface-variant text-[10px]">{header.leaderRole}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
