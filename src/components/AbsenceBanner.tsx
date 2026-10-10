"use client";

import { Roommate } from "../lib/domain/types";
import { UserX, UserCheck, AlertCircle } from "lucide-react";

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
  const absentNames = roommates
    .filter((r) => absentRoommates.includes(r.id))
    .map((r) => r.name);

  return (
    <div className="bg-slate-50 dark:bg-slate-850/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Presenze settimana
          </span>
        </div>

        {absentNames.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
            <UserX className="w-3.5 h-3.5" />
            <span>Assenti: {absentNames.join(", ")}</span>
          </div>
        )}
      </div>

      {myRoommateId !== null ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {isMeAbsent ? (
              <span className="text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                Risulti assente per questa settimana
              </span>
            ) : (
              <span>Sei presente questa settimana</span>
            )}
          </div>

          <button
            onClick={() => onToggleAbsence(myRoommateId, !isMeAbsent)}
            className={`text-xs font-medium py-2 px-3.5 rounded-xl border transition-all active:scale-95 shrink-0 ${
              isMeAbsent
                ? "bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700"
                : "bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300 dark:bg-amber-600/15 dark:hover:bg-amber-600/25 dark:text-amber-300 dark:border-amber-500/30"
            }`}
          >
            {isMeAbsent ? "Revoca assenza" : "Sono assente questa settimana"}
          </button>
        </div>
      ) : (
        <button
          onClick={onOpenPicker}
          className="w-full text-xs text-slate-600 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 py-2 px-3 rounded-xl text-center"
        >
          Seleziona il tuo profilo per gestire la tua presenza
        </button>
      )}
    </div>
  );
}
