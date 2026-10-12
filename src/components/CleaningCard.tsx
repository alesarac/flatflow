"use client";

import { AREAS, CleaningTask, Roommate } from "../lib/domain/types";
import { canUndoCleaningDecline } from "../lib/domain/logic";
import {
  UtensilsCrossed,
  Sparkles,
  DoorOpen,
  Check,
  CircleDot,
  CheckCircle2,
  AlertTriangle,
  Hand,
  Loader2,
  Undo2,
} from "lucide-react";

interface CleaningCardProps {
  task: CleaningTask;
  roommates: Roommate[];
  myRoommateId: number | null;
  isSubmitting?: boolean;
  onComplete: (taskId: string) => void;
  onDecline: (taskId: string, roommateId: number) => void;
  onClaim: (taskId: string, roommateId: number) => void;
  onUncomplete?: (taskId: string) => void;
  onUndoDecline?: (taskId: string, roommateId: number) => void;
}

export function CleaningCard({
  task,
  roommates,
  myRoommateId,
  isSubmitting = false,
  onComplete,
  onDecline,
  onClaim,
  onUncomplete,
  onUndoDecline,
}: CleaningCardProps) {
  const area = AREAS.find((a) => a.id === task.areaId) || AREAS[0];
  const assignedRoommate = roommates.find((r) => r.id === task.assignedTo);
  const isAssignedToMe = myRoommateId !== null && task.assignedTo === myRoommateId;
  const isUnassigned = task.assignedTo === null;

  // Consenti l'annullamento solo al profilo che ha registrato il completamento via ID stabile
  const myRoommate = myRoommateId !== null ? roommates.find((r) => r.id === myRoommateId) : undefined;
  const canUndoComplete = Boolean(
    task.isCompleted &&
      myRoommateId !== null &&
      (task.completedBy !== null && task.completedBy !== undefined
        ? task.completedBy === myRoommateId
        : myRoommate && task.completedByName === myRoommate.name)
  );

  const canUndoDecline = Boolean(
    !task.isCompleted &&
      myRoommateId !== null &&
      canUndoCleaningDecline(task, myRoommateId)
  );

  const canClaim = isUnassigned && myRoommateId !== null && !canUndoDecline;

  // Le superfici rimangono neutre; lo stato è segnalato dagli accenti.
  const getCardStyle = () => {
    if (task.isCompleted) return "border-emerald-200/70 dark:border-emerald-800/40";
    if (isUnassigned) return "border-amber-200/80 dark:border-amber-800/50";
    if (isAssignedToMe) return "border-teal-200/80 dark:border-teal-800/60";
    return "border-slate-200/80 dark:border-slate-700/70";
  };

  const getIconStyle = () => {
    if (task.isCompleted) return "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400";
    if (isUnassigned) return "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400";
    if (isAssignedToMe) return "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300";
    return "bg-slate-100 text-slate-500 dark:bg-slate-700/70 dark:text-slate-300";
  };

  const renderIcon = () => {
    switch (task.areaId) {
      case 0:
        return <UtensilsCrossed className="w-5 h-5" />;
      case 1:
        return <Sparkles className="w-5 h-5" />;
      case 2:
        return <DoorOpen className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  const iconStyle = getIconStyle();
  const hasBottomActions = !task.isCompleted && (isAssignedToMe || canClaim);

  return (
    <div
      className={`rounded-[22px] border bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,65,67,0.45)] transition-colors dark:bg-slate-800/95 dark:shadow-[0_12px_28px_-22px_rgba(0,0,0,0.85)] ${getCardStyle()}`}
    >
      {/* Intestazione compatta e coerente: icona a sinistra, titolo e descrizione accanto, elemento di stato a destra */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${iconStyle}`}
          >
            {renderIcon()}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug break-words">
              {area.name}
            </h3>
            {task.isCompleted ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal break-normal">
                Completata da{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {task.completedByName || "Coinquilino"}
                </span>
              </p>
            ) : isAssignedToMe ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300">
                <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
                Tocca a te
              </p>
            ) : !isUnassigned ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal break-normal">
                Tocca a{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {assignedRoommate?.name || task.assignedToName || `Coinquilino ${task.assignedTo! + 1}`}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        {/* Elemento a destra: solo spunta verde per completate, badge Da coprire per non assegnate, nessun badge per Da pulire */}
        {task.isCompleted ? (
          <div className="flex items-center shrink-0 pt-1">
            <Check
              className="w-5 h-5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]"
              aria-label="Completata"
              role="img"
            />
          </div>
        ) : isUnassigned ? (
          <div className="flex items-center shrink-0 pt-0.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Da coprire</span>
            </span>
          </div>
        ) : null}
      </div>

      {/* Azione Annulla: solo per chi ha completato l'attività, su riga separata in basso a destra per non comprimere il titolo */}
      {task.isCompleted && canUndoComplete && onUncomplete && (
        <div className="mt-2.5 flex justify-end">
          <button
            type="button"
            onClick={() => onUncomplete(task.id)}
            disabled={isSubmitting}
            className="min-h-[44px] min-w-[44px] px-3 py-2 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium inline-flex items-center justify-center gap-1.5 transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
            title="Annulla completamento"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Undo2 className="w-4 h-4 text-slate-400 dark:text-slate-400" />
            )}
            <span>Annulla</span>
          </button>
        </div>
      )}

      {/* Azione Annulla: solo per chi ha effettuato la rinuncia e nessun altro ha agito */}
      {!task.isCompleted && canUndoDecline && onUndoDecline && (
        <div className="mt-2.5 flex justify-end">
          <button
            type="button"
            onClick={() => onUndoDecline(task.id, myRoommateId!)}
            disabled={isSubmitting}
            className="min-h-[44px] min-w-[44px] px-3 py-2 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium inline-flex items-center justify-center gap-1.5 transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
            title="Annulla rinuncia"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Undo2 className="w-4 h-4 text-slate-400 dark:text-slate-400" />
            )}
            <span>Annulla</span>
          </button>
        </div>
      )}

      {/* Azioni disponibili per attività non completate */}
      {hasBottomActions && (
        <div className="mt-3.5 border-t border-slate-100 pt-3.5 dark:border-slate-700/60">
          {isAssignedToMe ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onComplete(task.id)}
                disabled={isSubmitting}
                type="button"
                className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 active:scale-[0.98] text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
                className="min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 font-semibold text-xs transition-all active:scale-[0.98] shrink-0 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Non posso
              </button>
            </div>
          ) : canClaim ? (
            <button
              onClick={() => onClaim(task.id, myRoommateId!)}
              disabled={isSubmitting}
              type="button"
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-teal-50 hover:bg-teal-100 active:scale-[0.98] text-teal-800 dark:bg-teal-950/40 dark:hover:bg-teal-950/60 dark:text-teal-200 border border-teal-200 dark:border-teal-800/70 font-semibold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
      )}
    </div>
  );
}
