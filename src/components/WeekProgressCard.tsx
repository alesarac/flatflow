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
    <div className="bg-white dark:bg-slate-850/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
          <Calendar className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            SETTIMANA IN CORSO
          </span>
          <span className="block text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
            {fullLabel}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-600 dark:text-slate-300">Pulizie settimanali</span>
          <span className="text-slate-900 dark:text-white">
            {completedCount} su 3 completate
          </span>
        </div>

        {/* Barra di progresso a 3 segmenti distinti */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className={`h-2 rounded-full transition-colors duration-300 ${
              isArea0Done
                ? "bg-emerald-500"
                : "bg-slate-200 dark:bg-slate-700/80"
            }`}
          />
          <div
            className={`h-2 rounded-full transition-colors duration-300 ${
              isArea1Done
                ? "bg-emerald-500"
                : "bg-slate-200 dark:bg-slate-700/80"
            }`}
          />
          <div
            className={`h-2 rounded-full transition-colors duration-300 ${
              isArea2Done
                ? "bg-emerald-500"
                : "bg-slate-200 dark:bg-slate-700/80"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
