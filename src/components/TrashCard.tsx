"use client";

import { Roommate, TrashTask } from "../lib/domain/types";
import { Trash2, AlertCircle, CheckCircle2, Clock, Users } from "lucide-react";

interface TrashCardProps {
  openTask: TrashTask | null;
  trashQueue: number[];
  roommates: Roommate[];
  myRoommateId: number | null;
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
  onReport,
  onDecline,
  onComplete,
  onClaim,
}: TrashCardProps) {
  // Find current assignee
  const assignedRoommate =
    openTask && openTask.assignedTo !== null
      ? roommates.find((r) => r.id === openTask.assignedTo)
      : null;

  const isAssignedToMe =
    openTask && myRoommateId !== null && openTask.assignedTo === myRoommateId;

  // Next in line when trash is empty
  const nextInQueueId = trashQueue[0];
  const nextInQueue = roommates.find((r) => r.id === nextInQueueId);

  return (
    <div
      className={`rounded-2xl p-4 transition-all border ${
        openTask
          ? "bg-rose-950/30 border-rose-500/40 shadow-lg shadow-rose-950/40"
          : "bg-slate-850/90 border-slate-800"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              openTask
                ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                : "bg-slate-800/90 text-slate-400 border-slate-700/60"
            }`}
          >
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base leading-tight">Spazzatura</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {openTask
                ? "Segnalazione aperta"
                : `Prossimo di turno: ${nextInQueue?.name || "In attesa"}`}
            </p>
          </div>
        </div>

        {openTask ? (
          <span className="text-[11px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Piena
          </span>
        ) : (
          <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            A posto
          </span>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80">
        {openTask ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
              <span className="text-slate-400">Incaricato:</span>
              <span
                className={`font-semibold ${
                  isAssignedToMe ? "text-rose-400 text-sm font-bold" : "text-white"
                }`}
              >
                {isAssignedToMe
                  ? "Tocca a te!"
                  : assignedRoommate
                  ? assignedRoommate.name
                  : "Nessun incaricato disponibile"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onComplete(myRoommateId ?? openTask.assignedTo ?? 0)}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-semibold text-sm shadow-md shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Ho buttato la spazzatura</span>
              </button>

              {isAssignedToMe && (
                <button
                  onClick={() => onDecline(myRoommateId)}
                  className="py-3 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-300 font-medium text-xs border border-slate-700 transition-all shrink-0"
                >
                  Non posso
                </button>
              )}
            </div>

            {openTask.assignedTo === null && onClaim && myRoommateId !== null && (
              <button
                onClick={() => onClaim(myRoommateId)}
                className="w-full py-2 text-xs text-indigo-400 hover:text-indigo-300 font-medium text-center"
              >
                Prenditi in carico questo turno
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onReport}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-[0.98] text-slate-200 font-semibold text-sm border border-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>Segnala spazzatura piena</span>
          </button>
        )}
      </div>
    </div>
  );
}
