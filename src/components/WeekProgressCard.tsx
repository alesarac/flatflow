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
    <div className="space-y-3.5 rounded-[24px] border border-slate-100/90 bg-white p-4 shadow-[0_18px_42px_-22px_rgba(9,58,61,0.30)] transition-colors dark:border-white/10 dark:bg-slate-800 dark:shadow-[0_18px_42px_-22px_rgba(0,0,0,0.60)]">
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-lightBorder bg-brand-light text-brand dark:border-brand-darkBorder dark:bg-brand-darkBg dark:text-brand-dark">
          <Calendar className="h-5 w-5 stroke-[2]" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block break-words text-lg font-bold leading-snug tracking-tight text-slate-900 dark:text-white">
            {fullLabel}
          </span>
        </div>
      </div>

      <div className="space-y-2.5 border-t border-slate-100 pt-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
            Pulizie settimanali
          </span>
          <span className="shrink-0 text-[13px] font-bold text-slate-900 dark:text-white">
            {completedCount} di 3
          </span>
        </div>

        {/* I tre segmenti rispettano la logica originale. */}
        <div
          className="grid grid-cols-3 gap-2.5"
          aria-label={`${completedCount} pulizie completate su 3`}
        >
          {segments.map((isDone, idx) => (
            <div
              key={idx}
              data-testid={`progress-segment-${idx}`}
              className={`h-2 rounded-full transition-colors duration-300 ${
                isDone ? "bg-status-success-accent" : "bg-slate-200 dark:bg-slate-600"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
