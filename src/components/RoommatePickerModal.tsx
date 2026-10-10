"use client";

import { Roommate } from "../lib/domain/types";
import { UserCheck, Sparkles } from "lucide-react";

interface RoommatePickerModalProps {
  roommates: Roommate[];
  currentId: number | null;
  onSelect: (id: number) => void;
  onClose?: () => void;
}

export function RoommatePickerModal({
  roommates,
  currentId,
  onSelect,
  onClose,
}: RoommatePickerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom-6 duration-200 transition-colors">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-1">
            <UserCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Chi sei?</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Seleziona il tuo nome per mettere in evidenza i tuoi turni su questo dispositivo.
          </p>
        </div>

        <div className="space-y-2.5">
          {roommates.map((r) => {
            const isSelected = currentId === r.id;
            return (
              <button
                key={r.id}
                onClick={() => {
                  onSelect(r.id);
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl text-left font-medium transition-all ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-[1.01]"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 active:scale-[0.99] border dark:border-slate-700/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isSelected ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700 dark:bg-slate-700/80 dark:text-indigo-300"
                    }`}
                  >
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-base font-semibold">{r.name}</span>
                </div>
                {isSelected && <Sparkles className="w-4 h-4 text-indigo-200" />}
              </button>
            );
          })}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 text-center font-medium"
          >
            Chiudi
          </button>
        )}
      </div>
    </div>
  );
}
