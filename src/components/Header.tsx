"use client";

import { Roommate } from "../lib/domain/types";
import { User, ChevronDown } from "lucide-react";

interface HeaderProps {
  activeRoommate?: Roommate;
  onOpenPicker: () => void;
}

export function Header({ activeRoommate, onOpenPicker }: HeaderProps) {
  return (
    <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="max-w-md mx-auto px-4 pt-safe pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xl tracking-tight text-indigo-600 dark:text-indigo-400">
            Flatflow
          </span>
        </div>

        <button
          onClick={onOpenPicker}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
            activeRoommate
              ? "bg-indigo-50 border-indigo-200/80 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-600/15 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-600/25"
              : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="max-w-[110px] truncate">
            {activeRoommate ? activeRoommate.name : "Chi sei?"}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
        </button>
      </div>
    </header>
  );
}
