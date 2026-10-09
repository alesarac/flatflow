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
    <header className="px-5 pt-safe pb-4 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
              Flatflow
            </span>
          </div>
          {weekLabel && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Settimana: {weekLabel}</span>
            </div>
          )}
        </div>

        <button
          onClick={onOpenPicker}
          className={`flex items-center gap-2 py-1.5 px-3 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
            activeRoommate
              ? "bg-indigo-600/15 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/25"
              : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <User className="w-3.5 h-3.5 text-indigo-400" />
          <span className="max-w-[100px] truncate">
            {activeRoommate ? activeRoommate.name : "Chi sei?"}
          </span>
          {activeRoommate && <Sparkles className="w-3 h-3 text-indigo-400/70" />}
        </button>
      </div>
    </header>
  );
}
