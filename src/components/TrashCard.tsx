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

  // Palette e stili pastello conformi allo stato
  const getCardStyle = () => {
    if (openTask) {
      if (isUnassigned) {
        return "bg-status-warning-bg border-status-warning-border dark:bg-status-warning-darkBg dark:border-status-warning-darkBorder";
      }
      return "bg-status-danger-bg border-status-danger-border dark:bg-status-danger-darkBg dark:border-status-danger-darkBorder";
    }
    return "bg-white border-slate-200/80 dark:bg-slate-850/90 dark:border-slate-800";
  };

  const getIconColor = () => {
    if (openTask) {
      if (isUnassigned) return "text-amber-600 dark:text-amber-400";
      return "text-rose-500 dark:text-rose-400";
    }
    return "text-slate-500 dark:text-slate-400";
  };

  return (
    <div
      className={`rounded-2xl border shadow-sm p-4 transition-colors ${getCardStyle()}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Trash2 className={`w-4 h-4 shrink-0 ${getIconColor()}`} />
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm leading-tight truncate">
            {openTask ? (
              assignedRoommate ? (
                <>Tocca a {assignedRoommate.name}</>
              ) : (
                <>Nessun incaricato</>
              )
            ) : (
              <>Prossimo: {nextInQueue?.name || "In attesa"}</>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
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
              <span>In ordine</span>
            </span>
          )}
        </div>
      </div>

      {/* Azioni disponibili per la spazzatura */}
      {hasBottomActions && (
        <div className="mt-3.5">
          {openTask ? (
            <div>
              {isAssignedToMe ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onComplete(myRoommateId)}
                    disabled={isSubmitting}
                    type="button"
                    className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-action hover:bg-action-hover active:scale-[0.98] text-action-text font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-action"
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
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-action-secondary hover:bg-action-secondary-hover active:scale-[0.98] text-action-secondary-text dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-action"
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
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400 font-semibold text-xs flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
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
