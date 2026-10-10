"use client";

import { AREAS, CleaningTask, Roommate } from "../lib/domain/types";
import { UtensilsCrossed, Sparkles, DoorOpen, CheckCircle2, AlertTriangle, Loader2, Undo2 } from "lucide-react";

interface CleaningCardProps {
  task: CleaningTask;
  roommates: Roommate[];
  myRoommateId: number | null;
  isAbsentThisWeek: boolean;
  isSubmitting?: boolean;
  onComplete: (taskId: string) => void;
  onDecline: (taskId: string, roommateId: number) => void;
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
  onUncomplete,
}: CleaningCardProps) {
  const area = AREAS.find((a) => a.id === task.areaId) || AREAS[0];
  const assignedRoommate = roommates.find((r) => r.id === task.assignedTo);
  const isAssignedToMe = myRoommateId !== null && task.assignedTo === myRoommateId;
  const isUnassigned = task.assignedTo === null;
  const canClaim = isUnassigned && myRoommateId !== null && !isAbsentThisWeek && !task.declinedBy.includes(myRoommateId);

  // Consenti l'annullamento solo al profilo che ha registrato il completamento
  const myRoommate = myRoommateId !== null ? roommates.find((r) => r.id === myRoommateId) : undefined;
  const canUndo = Boolean(task.isCompleted && myRoommate && task.completedByName === myRoommate.name);

  const renderIcon = () => {
    switch (task.areaId) {
      case 0:
        return <UtensilsCrossed className="w-5 h-5 text-indigo-400" />;
      case 1:
        return <Sparkles className="w-5 h-5 text-sky-400" />;
      case 2:
        return <DoorOpen className="w-5 h-5 text-emerald-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-indigo-400" />;
    }
  };

  const hasBottomActions = !task.isCompleted && (isAssignedToMe || canClaim || isUnassigned);

  return (
    <div
      className={`rounded-2xl p-4 transition-all border ${
        task.isCompleted
          ? "bg-slate-50/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-90"
          : isAssignedToMe
          ? "bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-500/50 shadow-md shadow-indigo-100 dark:shadow-indigo-950/50"
          : "bg-white dark:bg-slate-850/90 border-slate-200 dark:border-slate-800 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center shrink-0">
            {renderIcon()}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-base leading-tight">{area.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {task.isCompleted ? (
                <>
                  Completata da <span className="font-medium text-slate-800 dark:text-slate-200">{task.completedByName || "Coinquilino"}</span>
                </>
              ) : task.assignedTo !== null ? (
                <>
                  Tocca a <span className={`font-medium ${isAssignedToMe ? "text-indigo-600 dark:text-indigo-400 font-semibold" : "text-slate-800 dark:text-slate-200"}`}>{assignedRoommate?.name || task.assignedToName || `Coinquilino ${task.assignedTo + 1}`}</span>
                </>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Nessun incaricato disponibile</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {task.isCompleted ? (
            <>
              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Fatta</span>
              </div>
              {canUndo && onUncomplete && (
                <button
                  type="button"
                  onClick={() => onUncomplete(task.id)}
                  disabled={isSubmitting}
                  className="text-xs px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all flex items-center gap-1 disabled:opacity-50 font-medium shadow-sm"
                  title="Annulla completamento"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Undo2 className="w-3 h-3" />
                  )}
                  <span>Annulla</span>
                </button>
              )}
            </>
          ) : isAssignedToMe ? (
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-300 dark:border-indigo-500/40 px-2.5 py-1 rounded-full animate-pulse">
              Tocca a te!
            </span>
          ) : isUnassigned ? (
            <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Da coprire
            </span>
          ) : null}
        </div>
      </div>

      {/* Azioni disponibili per attività non completate */}
      {hasBottomActions && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          {isAssignedToMe ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onComplete(task.id)}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-sm shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Ho pulito</span>
              </button>

              <button
                onClick={() => onDecline(task.id, myRoommateId)}
                disabled={isSubmitting}
                className="py-3 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 font-medium text-xs border transition-all shrink-0 disabled:opacity-50"
              >
                Non posso pulire
              </button>
            </div>
          ) : canClaim ? (
            <button
              onClick={() => onComplete(task.id)}
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-semibold text-sm shadow-md shadow-amber-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Ho pulito io (prende in carico)</span>
            </button>
          ) : isUnassigned ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 py-1 text-center">
              Tutti i coinquilini risultano assenti o hanno rinunciato a quest&apos;area.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
