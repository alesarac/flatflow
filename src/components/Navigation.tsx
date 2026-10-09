"use client";

import { Home, History, Settings } from "lucide-react";

export type TabType = "home" | "history" | "settings";

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  pendingCount?: number;
}

export function Navigation({ currentTab, onSelectTab, pendingCount = 0 }: NavigationProps) {
  const tabs = [
    { id: "home" as TabType, label: "Home", icon: Home, hasBadge: pendingCount > 0 },
    { id: "history" as TabType, label: "Storico", icon: History, hasBadge: false },
    { id: "settings" as TabType, label: "Impostazioni", icon: Settings, hasBadge: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-3 px-2 py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-2xl transition-all relative ${
                isActive ? "text-indigo-400 font-semibold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.4]" : "stroke-[1.8]"}`} />
                {tab.hasBadge && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-950">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
