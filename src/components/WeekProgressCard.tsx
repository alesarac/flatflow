"use client";

import { Calendar } from "lucide-react";
import { CleaningTask } from "../lib/domain/types";
import { formatFullWeekLabel } from "../lib/domain/logic";

interface WeekProgressCardProps {
  weekKey: string;
  cleanings: CleaningTask[];
}

export function WeekProgressCard({ weekKey, cleanings }: WeekProgressCardProps) {
  const completedCount = cleanings.filter((c) => c.isCompleted).length;
  const fullLabel = formatFullWeekLabel(weekKey);

  // Determina lo stato di completamento per ciascuna delle 3 attività
  const isArea0Done = cleanings.some((c) => c.areaId === 0 && c.isCompleted);
  const isArea1Done = cleanings.some((c) => c.areaId === 1 && c.isCompleted);
  const isArea2Done = cleanings.some((c) => c.areaId === 2 && c.isCompleted);

  return (
    <div className="bg-white dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5 transition-colors">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/70 border border-indigo-100/80 dark:border-indigo-800/60 flex items-center justify-center text-[#4355EC] dark:text-indigo-400 shrink-0">
          <Calendar className="w-6 h-6 stroke-[2]" />
        </div>
        <div className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
            SETTIMANA IN CORSO
          </span>
          <span className="block text-xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight truncate mt-0.5">
            {fullLabel}
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
            Pulizie settimanali
          </span>
          <span className="text-[13px] font-bold text-slate-900 dark:text-white">
            {completedCount} su 3 completate
          </span>
        </div>

        {/* Barra di progresso a 3 segmenti distinti */}
        <div className="grid grid-cols-3 gap-2.5">
          <div
            className={`h-2 rounded-full transition-colors duration-300 ${
              isArea0Done
                ? "bg-[#10B981]"
                : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
          <div
            className={`h-2 rounded-full transition-colors duration-300 ${
              isArea1Done
                ? "bg-[#10B981]"
                : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
          <div
            className={`h-2 rounded-full transition-colors duration-300 ${
              isArea2Done
                ? "bg-[#10B981]"
                : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
