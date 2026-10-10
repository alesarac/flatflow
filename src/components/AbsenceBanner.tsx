"use client";

import { Roommate } from "../lib/domain/types";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface AbsenceBannerProps {
  roommates: Roommate[];
  absentRoommates: number[];
  myRoommateId: number | null;
  onToggleAbsence: (roommateId: number, isAbsent: boolean) => void;
  onOpenPicker: () => void;
}

export function AbsenceBanner({
  roommates,
  absentRoommates,
  myRoommateId,
  onToggleAbsence,
  onOpenPicker,
}: AbsenceBannerProps) {
  const isMeAbsent = myRoommateId !== null && absentRoommates.includes(myRoommateId);
  const otherAbsentNames = roommates
    .filter((r) => absentRoommates.includes(r.id) && r.id !== myRoommateId)
    .map((r) => r.name);

  return (
    <div className="bg-white dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm transition-colors">
      {myRoommateId !== null ? (
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                isMeAbsent
                  ? "bg-amber-50 text-amber-600 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50"
                  : "bg-emerald-100/70 text-emerald-600 border-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50"
              }`}
            >
              {isMeAbsent ? (
                <AlertCircle className="w-4.5 h-4.5" />
              ) : (
                <CheckCircle2 className="w-4.5 h-4.5 fill-emerald-600 text-white dark:fill-emerald-400 dark:text-slate-900" />
              )}
            </div>

            <div className="min-w-0">
              <span className="block font-bold text-slate-900 dark:text-white text-[13px] leading-tight whitespace-nowrap">
                {isMeAbsent ? "Assente questa settimana" : "Presente questa settimana"}
              </span>
              <span className="block text-[11px] text-slate-400 dark:text-slate-400 mt-0.5 whitespace-nowrap">
                {isMeAbsent ? "Non riceverai nuovi incarichi" : "Puoi ricevere incarichi"}
              </span>
            </div>
          </div>

          <button
            onClick={() => onToggleAbsence(myRoommateId, !isMeAbsent)}
            type="button"
            className={`text-xs font-semibold py-2 px-3 rounded-xl border transition-all active:scale-95 shrink-0 shadow-sm outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isMeAbsent
                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50"
                : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200/90 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 dark:border-slate-700"
            }`}
          >
            {isMeAbsent ? "Sono presente" : "Sono assente"}
          </button>
        </div>
      ) : (
        <button
          onClick={onOpenPicker}
          type="button"
          className="w-full text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 py-2.5 px-3 rounded-xl text-center transition-colors outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Seleziona il tuo profilo per gestire la presenza
        </button>
      )}

      {otherAbsentNames.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-amber-700 dark:text-amber-300">
          Altri assenti questa settimana: <strong>{otherAbsentNames.join(", ")}</strong>
        </div>
      )}
    </div>
  );
}
