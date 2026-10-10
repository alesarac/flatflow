"use client";

import { Roommate } from "../lib/domain/types";
import { Calendar, User, Sparkles } from "lucide-react";

interface HeaderProps {
  weekLabel?: string;
  activeRoommate?: Roommate;
  onOpenPicker: () => void;
}

export function Header({ weekLabel, activeRoommate, onOpenPicker }: HeaderProps) {
  return (
    <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="px-5 pt-safe pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-600 to-sky-600 dark:from-indigo-400 dark:to-sky-400 bg-clip-text text-transparent">
            Flatflow
          </span>
        </div>

        <button
          onClick={onOpenPicker}
          className={`flex items-center gap-2 py-1.5 px-3 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
            activeRoommate
              ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-600/15 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-600/25"
              : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="max-w-[100px] truncate">
            {activeRoommate ? activeRoommate.name : "Chi sei?"}
          </span>
          {activeRoommate && <Sparkles className="w-3 h-3 text-indigo-600/70 dark:text-indigo-400/70" />}
        </button>
      </div>

      {weekLabel && (
        <div className="px-5 py-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-950/40 flex items-center gap-2 text-xs">
          <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
            SETTIMANA IN CORSO
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
            {weekLabel}
          </span>
        </div>
      )}
    </header>
  );
}
