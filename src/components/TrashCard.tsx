"use client";

import { Roommate, TrashTask } from "../lib/domain/types";
import { Trash2, AlertCircle, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";

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
  onClaim: (roommateId: number) => void;
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
  const assignedRoommate = openTask?.assignedTo !== null && openTask?.assignedTo !== undefined
    ? roommates.find((r) => r.id === openTask.assignedTo)
    : null;

  const isAssignedToMe = myRoommateId !== null && openTask?.assignedTo === myRoommateId;
  const isUnassigned = Boolean(openTask && openTask.assignedTo === null);
  const canReport = !openTask && myRoommateId !== null;
  const canClaim = isUnassigned && myRoommateId !== null && !isAbsentThisWeek;

  // Prossimo in coda se la spazzatura è chiusa
  const nextInQueueId = trashQueue[0];
  const nextInQueue = roommates.find((r) => r.id === nextInQueueId);

  const hasBottomActions = openTask ? (isAssignedToMe || canClaim) : canReport;

  return (
    <div
      className={`rounded-2xl p-4 transition-all border shadow-sm ${
        openTask
          ? "bg-[#FFF5F5] dark:bg-rose-950/20 border-[#FEE2E2] dark:border-rose-900/40"
          : "bg-white dark:bg-slate-850/90 border-slate-200/80 dark:border-slate-800"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${
              openTask
                ? "bg-rose-100/70 text-rose-500 border-rose-200/60 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/40"
                : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/60"
            }`}
          >
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight truncate">
              Spazzatura
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {openTask ? (
                assignedRoommate ? (
                  <>
                    Tocca a <span className={`font-semibold ${isAssignedToMe ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-200"}`}>{assignedRoommate.name}</span>
                  </>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px] sm:text-xs">Nessun incaricato disponibile</span>
                )
              ) : (
                `Prossimo di turno: ${nextInQueue?.name || "In attesa"}`
              )}
            </p>
          </div>
        </div>

        {openTask ? (
          openTask.assignedTo === null ? (
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
              Da coprire
            </span>
          ) : (
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-white/90 dark:bg-rose-950/50 border border-rose-200/90 dark:border-rose-800/60 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              Piena
            </span>
          )
        ) : (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 px-3 py-1 rounded-full shrink-0">
            A posto
          </span>
        )}
      </div>

      {/* Azioni disponibili (mostrate solo se presenti per evitare linee vuote) */}
      {hasBottomActions && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          {openTask ? (
            <div>
              {isAssignedToMe ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onComplete(myRoommateId)}
                    disabled={isSubmitting}
                    type="button"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Ho buttato la spazzatura</span>
                  </button>

                  <button
                    onClick={() => onDecline(myRoommateId!)}
                    disabled={isSubmitting}
                    type="button"
                    className="py-2.5 px-3 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-semibold text-xs transition-all active:scale-[0.98] shrink-0 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    Non posso
                  </button>
                </div>
              ) : canClaim ? (
                <button
                  onClick={() => onClaim(myRoommateId!)}
                  disabled={isSubmitting}
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Me ne occupo io</span>
                </button>
              ) : null}
            </div>
          ) : canReport ? (
            <button
              onClick={onReport}
              disabled={isSubmitting}
              type="button"
              className="w-full py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50/80 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <Trash2 className="w-4 h-4" />
              <span>Segnala spazzatura piena</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
