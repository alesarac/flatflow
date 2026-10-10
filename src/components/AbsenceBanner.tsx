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
    <div className="bg-white dark:bg-slate-850/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm transition-colors space-y-2">
      {myRoommateId !== null ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                isMeAbsent
                  ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50"
                  : "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50"
              }`}
            >
              {isMeAbsent ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>

            <div className="min-w-0">
              <span className="block font-semibold text-slate-900 dark:text-white text-sm leading-tight truncate">
                {isMeAbsent ? "Assente questa settimana" : "Presente questa settimana"}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {isMeAbsent ? "Non riceverai nuovi incarichi" : "Puoi ricevere incarichi"}
              </span>
            </div>
          </div>

          <button
            onClick={() => onToggleAbsence(myRoommateId, !isMeAbsent)}
            className={`text-xs font-semibold py-2 px-3.5 rounded-xl border transition-all active:scale-95 shrink-0 shadow-sm ${
              isMeAbsent
                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:border-slate-700"
            }`}
          >
            {isMeAbsent ? "Sono presente" : "Sono assente"}
          </button>
        </div>
      ) : (
        <button
          onClick={onOpenPicker}
          className="w-full text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 py-2.5 px-3 rounded-xl text-center transition-colors"
        >
          Seleziona il tuo profilo per gestire la tua presenza
        </button>
      )}

      {otherAbsentNames.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/70 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <span className="font-medium">Altri assenti questa settimana:</span>
          <span className="truncate">{otherAbsentNames.join(", ")}</span>
        </div>
      )}
    </div>
  );
}
