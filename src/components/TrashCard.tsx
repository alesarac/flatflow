"use client";

import { Roommate, TrashTask } from "../lib/domain/types";
import { Trash2, AlertCircle, AlertTriangle, CheckCircle2, Hand, Loader2 } from "lucide-react";

interface TrashCardProps {
  openTask: TrashTask | null;
  trashQueue: number[];
  roommates: Roommate[];
  myRoommateId: number | null;
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
  isSubmitting = false,
  onReport,
  onDecline,
  onComplete,
  onClaim,
}: TrashCardProps) {
  const assignedRoommate =
    openTask?.assignedTo !== null && openTask?.assignedTo !== undefined
      ? roommates.find((r) => r.id === openTask.assignedTo)
      : null;

  const isAssignedToMe = myRoommateId !== null && openTask?.assignedTo === myRoommateId;
  const isUnassigned = Boolean(openTask && openTask.assignedTo === null);
  const canReport = !openTask && myRoommateId !== null;
  const canClaim = isUnassigned && myRoommateId !== null;

  // Prossimo in coda se la spazzatura è chiusa
  const nextInQueueId = trashQueue[0];
  const nextInQueue = roommates.find((r) => r.id === nextInQueueId);

  const hasBottomActions = openTask ? isAssignedToMe || canClaim : canReport;

  // Stato enfatizzato da icone e bordi, senza colorare l'intera scheda.
  const getCardStyle = () => {
    if (isUnassigned) return "border-amber-200/80 dark:border-amber-800/50";
    if (openTask) return "border-rose-200/80 dark:border-rose-800/40";
    return "border-slate-200/80 dark:border-slate-700/70";
  };

  const getIconStyle = () => {
    if (isUnassigned) return "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400";
    if (openTask) return "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400";
    return "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300";
  };

  return (
    <div
      className={`rounded-[22px] border bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,65,67,0.45)] transition-colors dark:bg-slate-800/95 dark:shadow-[0_12px_28px_-22px_rgba(0,0,0,0.85)] ${getCardStyle()}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${getIconStyle()}`}>
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-bold leading-snug text-slate-900 dark:text-white">Spazzatura</h3>
            <p className="mt-0.5 text-xs leading-normal text-slate-500 dark:text-slate-400 break-words">
              {openTask ? (
                assignedRoommate ? (
                  isAssignedToMe ? "Tocca a te" : <>Tocca a <span className="font-medium text-slate-700 dark:text-slate-200">{assignedRoommate.name}</span></>
                ) : (
                  "Nessun incaricato"
                )
              ) : (
                <>Prossimo: <span className="font-medium text-slate-700 dark:text-slate-200">{nextInQueue?.name || "In attesa"}</span></>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pt-1">
          {openTask ? (
            isUnassigned ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/60 px-2.5 py-0.5 rounded-full shadow-sm">
                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Da coprire</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/60 px-2.5 py-0.5 rounded-full shadow-sm">
                <AlertCircle className="w-3 h-3 text-rose-500" />
                <span>Piena</span>
              </span>
            )
          ) : (
            <span className="inline-flex items-center text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2.5 py-0.5 rounded-full">
              <span>A posto</span>
            </span>
          )}
        </div>
      </div>

      {/* Azioni disponibili per la spazzatura */}
      {hasBottomActions && (
        <div className="mt-3.5 border-t border-slate-100 pt-3.5 dark:border-slate-700/60">
          {openTask ? (
            <div>
              {isAssignedToMe ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onComplete(myRoommateId)}
                    disabled={isSubmitting}
                    type="button"
                    className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 active:scale-[0.98] text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Ho buttato</span>
                  </button>

                  <button
                    onClick={() => onDecline(myRoommateId!)}
                    disabled={isSubmitting}
                    type="button"
                    className="min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 font-semibold text-xs transition-all active:scale-[0.98] shrink-0 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    Non posso
                  </button>
                </div>
              ) : canClaim ? (
                <button
                  onClick={() => onClaim(myRoommateId!)}
                  disabled={isSubmitting}
                  type="button"
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-[0.98] text-amber-900 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800/70 font-semibold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Hand className="w-4 h-4 text-action dark:text-slate-300" />
                  )}
                  <span>Me ne occupo io</span>
                </button>
              ) : null}
            </div>
          ) : canReport ? (
            <button
              onClick={onReport}
              disabled={isSubmitting}
              type="button"
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-teal-200 bg-teal-50/70 hover:bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:border-teal-800/70 dark:text-teal-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Segnala spazzatura piena</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
