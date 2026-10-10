"use client";

import { Calendar } from "lucide-react";
import { CleaningTask } from "../lib/domain/types";
import { formatFullWeekLabel, getWeeklyProgressBarSegments } from "../lib/domain/logic";

interface WeekProgressCardProps {
  weekKey: string;
  cleanings: CleaningTask[];
}

export function WeekProgressCard({ weekKey, cleanings }: WeekProgressCardProps) {
  const completedCount = cleanings.filter((c) => c.isCompleted).length;
  const fullLabel = formatFullWeekLabel(weekKey);
  const segments = getWeeklyProgressBarSegments(cleanings);

  return (
    <div className="bg-white dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5 transition-colors">
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-100/70 dark:border-indigo-900/40 flex items-center justify-center text-[#4355EC] dark:text-indigo-400 shrink-0">
          <Calendar className="w-5 h-5 stroke-[2]" />
        </div>
        <div className="min-w-0">
          <span className="block text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate">
            {fullLabel}
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-slate-600 dark:text-slate-400">
            Pulizie settimanali
          </span>
          <span className="text-[13px] font-bold text-slate-900 dark:text-white">
            {completedCount} di 3
          </span>
        </div>

        {/* Barra di progresso a 3 segmenti che si riempie rigorosamente da sinistra verso destra */}
        <div className="grid grid-cols-3 gap-2.5">
          {segments.map((isDone, idx) => (
            <div
              key={idx}
              data-testid={`progress-segment-${idx}`}
              className={`h-2 rounded-full transition-colors duration-300 ${
                isDone
                  ? "bg-[#10B981]"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

