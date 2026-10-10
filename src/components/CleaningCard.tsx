"use client";

import { AREAS, CleaningTask, Roommate } from "../lib/domain/types";
import {
  UtensilsCrossed,
  Sparkles,
  DoorOpen,
  Check,
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
}: CleaningCardProps) {
  const area = AREAS.find((a) => a.id === task.areaId) || AREAS[0];
  const assignedRoommate = roommates.find((r) => r.id === task.assignedTo);
  const isAssignedToMe = myRoommateId !== null && task.assignedTo === myRoommateId;
  const isUnassigned = task.assignedTo === null;
  const canClaim = isUnassigned && myRoommateId !== null;

  // Consenti l'annullamento solo al profilo che ha registrato il completamento via ID stabile
  const myRoommate = myRoommateId !== null ? roommates.find((r) => r.id === myRoommateId) : undefined;
  const canUndo = Boolean(
    task.isCompleted &&
      myRoommateId !== null &&
      (task.completedBy !== null && task.completedBy !== undefined
        ? task.completedBy === myRoommateId
        : myRoommate && task.completedByName === myRoommate.name)
  );

  // Stili e palette pastello specifici dello stato
  const getCardStyle = () => {
    if (task.isCompleted) {
      return "bg-[#EAF9F1] border-[#C6EED8] dark:bg-emerald-950/20 dark:border-emerald-900/40";
    }
    if (isUnassigned) {
      return "bg-[#FFFAE8] border-[#F5E9B7] dark:bg-amber-950/20 dark:border-amber-900/40";
    }
    return "bg-[#EFF6FF] border-[#D9E7F5] dark:bg-blue-950/20 dark:border-blue-900/40";
  };

  const getIconStyle = () => {
    if (task.isCompleted) {
      return {
        box: "bg-emerald-100/70 border-emerald-200/60 dark:bg-emerald-950/50 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400",
      };
    }
    if (isUnassigned) {
      return {
        box: "bg-amber-100/70 border-amber-200/60 dark:bg-amber-950/50 dark:border-amber-800/40 text-amber-600 dark:text-amber-400",
      };
    }
    return {
      box: "bg-blue-100/70 border-blue-200/60 dark:bg-blue-950/50 dark:border-blue-800/40 text-blue-600 dark:text-blue-400",
    };
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
      className={`rounded-2xl border shadow-sm p-4 transition-colors ${getCardStyle()}`}
    >
      {/* Intestazione compatta e coerente: icona a sinistra, titolo e descrizione accanto, elemento di stato a destra */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div
            className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${iconStyle.box}`}
          >
            {renderIcon()}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug break-normal">
              {area.name}
            </h3>
            {task.isCompleted ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal break-normal">
                Completata da{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {task.completedByName || "Coinquilino"}
                </span>
              </p>
            ) : !isUnassigned && !isAssignedToMe ? (
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
            />
          </div>
        ) : isUnassigned ? (
          <div className="flex items-center shrink-0 pt-0.5">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/60 px-3 py-1 rounded-full shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Da coprire</span>
            </span>
          </div>
        ) : null}
      </div>

      {/* Azione Annulla: solo per chi ha completato l'attività, su riga separata in basso a destra per non comprimere il titolo */}
      {task.isCompleted && canUndo && onUncomplete && (
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

      {/* Azioni disponibili per attività non completate */}
      {hasBottomActions && (
        <div className="mt-3">
          {isAssignedToMe ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onComplete(task.id)}
                disabled={isSubmitting}
                type="button"
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-[#365672] hover:bg-[#2c475e] active:scale-[0.98] text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
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
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#EDF2F7] hover:bg-[#E2E8F0] active:scale-[0.98] text-[#365672] dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Hand className="w-4 h-4 text-[#365672] dark:text-slate-300" />
              )}
              <span>Me ne occupo io</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
