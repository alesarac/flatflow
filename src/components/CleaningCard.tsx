"use client";

import { AREAS, CleaningTask, Roommate } from "../lib/domain/types";
import { UtensilsCrossed, Sparkles, DoorOpen, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

interface CleaningCardProps {
  task: CleaningTask;
  roommates: Roommate[];
  myRoommateId: number | null;
  onComplete: (taskId: string) => void;
  onDecline: (taskId: string, roommateId: number) => void;
}

export function CleaningCard({
  task,
  roommates,
  myRoommateId,
  onComplete,
  onDecline,
}: CleaningCardProps) {
  const area = AREAS.find((a) => a.id === task.areaId) || AREAS[0];
  const assignedRoommate = roommates.find((r) => r.id === task.assignedTo);
  const isAssignedToMe = myRoommateId !== null && task.assignedTo === myRoommateId;

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

  return (
    <div
      className={`rounded-2xl p-4 transition-all border ${
        task.isCompleted
          ? "bg-slate-900/60 border-slate-800 opacity-80"
          : isAssignedToMe
          ? "bg-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-950/50"
          : "bg-slate-850/90 border-slate-800"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center">
            {renderIcon()}
          </div>
          <div>
            <h3 className="font-semibold text-white text-base leading-tight">{area.name}</h3>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span>Incarico:</span>
              <span className={`font-medium ${isAssignedToMe ? "text-indigo-300 font-bold" : "text-slate-300"}`}>
                {task.assignedTo !== null
                  ? assignedRoommate?.name || `Coinquilino ${task.assignedTo + 1}`
                  : "Nessun incaricato"}
              </span>
            </div>
          </div>
        </div>

        {task.isCompleted ? (
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Fatta</span>
          </div>
        ) : isAssignedToMe ? (
          <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/40 px-2.5 py-1 rounded-full animate-pulse">
            Tocca a te!
          </span>
        ) : task.assignedTo === null ? (
          <span className="text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            Da assegnare
          </span>
        ) : null}
      </div>

      {/* Azioni */}
      <div className="mt-4 pt-3 border-t border-slate-800/80">
        {task.isCompleted ? (
          <p className="text-xs text-slate-400">
            Completata da <span className="font-semibold text-slate-200">{task.completedByName}</span>
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onComplete(task.id)}
              className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-sm shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Ho pulito</span>
            </button>

            {isAssignedToMe && (
              <button
                onClick={() => onDecline(task.id, myRoommateId)}
                className="py-3 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-300 font-medium text-xs border border-slate-700 transition-all shrink-0"
              >
                Non posso pulire
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
