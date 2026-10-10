"use client";

import { Roommate, TrashTask } from "../lib/domain/types";
import { Trash2, AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

interface TrashCardProps {
  openTask: TrashTask | null;
  trashQueue: number[];
  roommates: Roommate[];
  myRoommateId: number | null;
  isAbsentThisWeek: boolean;
  isSubmitting?: boolean;
  onReport: () => void;
  onDecline: (roommateId: number) => void;
  onComplete: (roommateId: number) => void;
  onClaim?: (roommateId: number) => void;
}

export function TrashCard({
  openTask,
  trashQueue,
  roommates,
  myRoommateId,
  isAbsentThisWeek,
  isSubmitting = false,
  onReport,
  onDecline,
  onComplete,
  onClaim,
}: TrashCardProps) {
  const assignedRoommate =
    openTask && openTask.assignedTo !== null
      ? roommates.find((r) => r.id === openTask.assignedTo)
      : null;

  const isAssignedToMe =
    openTask && myRoommateId !== null && openTask.assignedTo === myRoommateId;

  const isUnassigned = openTask && openTask.assignedTo === null;
  const canClaimOrComplete = isUnassigned && myRoommateId !== null && !isAbsentThisWeek;

  // Prossimo in coda se la spazzatura è chiusa
  const nextInQueueId = trashQueue[0];
  const nextInQueue = roommates.find((r) => r.id === nextInQueueId);

  return (
    <div
      className={`rounded-2xl p-4 transition-all border ${
        openTask
          ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/40 shadow-md shadow-rose-100 dark:shadow-rose-950/40"
          : "bg-white dark:bg-slate-850/90 border-slate-200 dark:border-slate-800 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              openTask
                ? "bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30"
                : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-850 dark:text-slate-400 dark:border-slate-700/60"
            }`}
          >
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-base leading-tight">Spazzatura</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {openTask ? (
                assignedRoommate ? (
                  <>
                    Tocca a <span className={`font-medium ${isAssignedToMe ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-slate-800 dark:text-slate-200"}`}>{assignedRoommate.name}</span>
                  </>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Nessun incaricato disponibile</span>
                )
              ) : (
                `Prossimo di turno: ${nextInQueue?.name || "In attesa"}`
              )}
            </p>
          </div>
        </div>

        {openTask ? (
          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/40 px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Piena
          </span>
        ) : (
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-full">
            A posto
          </span>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        {openTask ? (
          <div>
            {isAssignedToMe ? (
              // P1-02: Mostra i pulsanti SOLO all'assegnatario
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onComplete(myRoommateId)}
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-semibold text-sm shadow-md shadow-rose-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Ho buttato la spazzatura</span>
                </button>

                <button
                  onClick={() => onDecline(myRoommateId)}
                  disabled={isSubmitting}
                  className="py-3 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 font-medium text-xs border transition-all shrink-0 disabled:opacity-50"
                >
                  Non posso
                </button>
              </div>
            ) : canClaimOrComplete ? (
              // Tutti indisponibili: un coinquilino presente può prenderla in carico
              <button
                onClick={() => onComplete(myRoommateId)}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-semibold text-sm shadow-md shadow-amber-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Ho buttato la spazzatura (prendi in carico)</span>
              </button>
            ) : isUnassigned ? (
              <div className="text-xs text-slate-500 dark:text-slate-400 py-1 text-center">
                Tutti i coinquilini risultano assenti o hanno rifiutato.
              </div>
            ) : null}
          </div>
        ) : (
          <button
            onClick={onReport}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 dark:border-slate-700 font-semibold text-sm border transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            )}
            <span>Segnala spazzatura piena</span>
          </button>
        )}
      </div>
    </div>
  );
}
