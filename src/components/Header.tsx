"use client";

import { Roommate } from "../lib/domain/types";
import { User } from "lucide-react";

interface HeaderProps {
  activeRoommate?: Roommate;
  hero?: boolean;
}

export function Header({ activeRoommate, hero = false }: HeaderProps) {
  return (
    <header
      className={
        hero
          ? "relative isolate z-0 overflow-hidden bg-gradient-to-br from-[#07554f] via-[#0b7e72] to-[#159b80] pt-safe pb-[72px] text-white dark:from-[#052e33] dark:via-[#07554f] dark:to-[#0b7568]"
          : "sticky top-0 z-30 border-b border-slate-100 bg-white/95 pt-safe backdrop-blur-md transition-colors dark:border-slate-800/80 dark:bg-slate-900/95"
      }
    >
      {hero && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -right-12 -top-24 h-56 w-56 rounded-full border border-white/15 bg-white/[0.035]" />
          <div className="absolute -right-28 top-10 h-64 w-64 rounded-full border border-white/10" />
          <div className="absolute -bottom-32 -left-14 h-48 w-48 rounded-full bg-white/[0.055] blur-2xl" />
        </div>
      )}

      <div
        className={`relative z-10 mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 ${
          hero ? "pb-0" : "pb-3"
        }`}
      >
        <span
          className={`shrink-0 text-2xl font-extrabold tracking-tight ${
            hero ? "text-white" : "text-brand dark:text-brand-dark"
          }`}
        >
          FlatLoop
        </span>

        <div
          className={`flex min-w-0 max-w-[60%] items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
            hero
              ? "border-white/25 bg-white/10 text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] backdrop-blur-sm"
              : "border-slate-200/80 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          }`}
        >
          <User
            aria-hidden="true"
            className={`h-3.5 w-3.5 shrink-0 ${
              hero ? "text-white" : "text-brand dark:text-brand-dark"
            }`}
          />
          <span
            className="min-w-0 truncate"
            title={activeRoommate ? activeRoommate.name : "Coinquilino"}
          >
            {activeRoommate ? activeRoommate.name : "Coinquilino"}
          </span>
        </div>
      </div>
    </header>
  );
}
