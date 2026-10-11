"use client";

import { Roommate } from "../lib/domain/types";
import { User } from "lucide-react";

interface HeaderProps {
  activeRoommate?: Roommate;
}

export function Header({ activeRoommate }: HeaderProps) {
  return (
    <header className="border-b border-slate-100 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-30 transition-colors pt-safe">
      <div className="max-w-md mx-auto px-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-2xl tracking-tight text-[#4355EC] dark:text-indigo-400">
            FlatLoop
          </span>
        </div>

        <div className="flex items-center gap-2 py-1.5 px-3.5 rounded-full text-xs font-semibold border bg-white border-slate-200/80 dark:bg-slate-800 dark:border-slate-700 shadow-sm">
          <User className="w-3.5 h-3.5 text-[#4355EC] dark:text-indigo-400" />
          <span className="max-w-[120px] truncate text-slate-700 dark:text-slate-200">
            {activeRoommate ? activeRoommate.name : "Coinquilino"}
          </span>
        </div>
      </div>
    </header>
  );
}
