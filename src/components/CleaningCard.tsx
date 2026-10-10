"use client";

import { AREAS, CleaningTask, Roommate } from "../lib/domain/types";
import { UtensilsCrossed, Sparkles, DoorOpen, CheckCircle2, AlertTriangle, Loader2, Undo2, ArrowRight } from "lucide-react";

interface CleaningCardProps {
  task: CleaningTask;
  roommates: Roommate[];
  myRoommateId: number | null;
  isAbsentThisWeek: boolean;
  isSubmitting?: boolean;
  onComplete: (taskId: string) => void;
  onDecline: (taskId: string, roommateId: number) => void;
  onClaim: (taskId: string, roommateId: number) => void;
  onUncomplete?: (taskId: string) => void;
}

export function CleaningCard({
  task,
  roommates,
  myRoommateId,
  isAbsentThisWeek,
  isSubmitting = false,
  onComplete,
  onDecline,
  onClaim,
  onUncomplete,
}: CleaningCardProps) {
  const area = AREAS.find((a) => a.id === task.areaId) || AREAS[0];
  const assignedRoommate = roommates.find((r) => r.id === task.assignedTo);
  const isAssignedToMe = myRoommateId !== null && task.assignedTo === myRoommateId;
  const isUnassigned = task.assignedTo === null;
  const canClaim = isUnassigned && myRoommateId !== null && !isAbsentThisWeek;

  // Consenti l'annullamento solo al profilo che ha registrato il completamento via ID stabile
  const myRoommate = myRoommateId !== null ? roommates.find((r) => r.id === myRoommateId) : undefined;
  const canUndo = Boolean(
    task.isCompleted &&
      myRoommateId !== null &&
      (task.completedBy !== null && task.completedBy !== undefined
        ? task.completedBy === myRoommateId
        : myRoommate && task.completedByName === myRoommate.name)
  );

  const renderIcon = () => {
    switch (task.areaId) {
      case 0:
        return <UtensilsCrossed className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
      case 1:
        return <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
      case 2:
        return <DoorOpen className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
    }
  };

  const hasBottomActions = !task.isCompleted && (isAssignedToMe || canClaim);

  return (
    <div className="bg-white dark:bg-slate-850/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50/70 border border-indigo-100/60 dark:bg-indigo-950/50 dark:border-indigo-900/40 flex items-center justify-center shrink-0">
            {renderIcon()}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight truncate">
              {area.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {task.isCompleted ? (
                <>
                  Completata da <span className="font-medium text-slate-700 dark:text-slate-200">{task.completedByName || "Coinquilino"}</span>
                </>
              ) : task.assignedTo !== null ? (
                <>
                  Tocca a <span className={`font-semibold ${isAssignedToMe ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-200"}`}>{assignedRoommate?.name || task.assignedToName || `Coinquilino ${task.assignedTo + 1}`}</span>
                </>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px] sm:text-xs">Nessun incaricato disponibile</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {task.isCompleted ? (
            <>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 px-3 py-1 rounded-full shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Fatta</span>
              </div>
              {canUndo && onUncomplete && (
                <button
                  type="button"
                  onClick={() => onUncomplete(task.id)}
                  disabled={isSubmitting}
                  className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 font-semibold active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 text-xs shadow-sm outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title="Annulla completamento"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Undo2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  )}
                  <span>Annulla</span>
                </button>
              )}
            </>
          ) : isAssignedToMe ? (
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 px-3 py-1 rounded-full shadow-sm">
              Tocca a te!
            </span>
          ) : isUnassigned ? (
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5" />
              Da coprire
            </span>
          ) : null}
        </div>
      </div>

      {/* Azioni disponibili per attività non completate */}
      {hasBottomActions && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          {isAssignedToMe ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onComplete(task.id)}
                disabled={isSubmitting}
                type="button"
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Ho pulito</span>
              </button>

              <button
                onClick={() => onDecline(task.id, myRoommateId!)}
                disabled={isSubmitting}
                type="button"
                className="py-2.5 px-3 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-semibold text-xs transition-all active:scale-[0.98] shrink-0 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Non posso
              </button>
            </div>
          ) : canClaim ? (
            <button
              onClick={() => onClaim(task.id, myRoommateId!)}
              disabled={isSubmitting}
              type="button"
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Me ne occupo io</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
