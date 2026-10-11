"use client";

import { Home, ShoppingBag, Settings } from "lucide-react";

export type TabType = "cleanings" | "shopping" | "settings" | "history";

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  pendingCount?: number;
}

export function Navigation({ currentTab, onSelectTab, pendingCount = 0 }: NavigationProps) {
  const tabs = [
    { id: "cleanings" as TabType, label: "Pulizie", icon: Home, hasBadge: pendingCount > 0 },
    { id: "shopping" as TabType, label: "Spesa", icon: ShoppingBag, hasBadge: false },
    { id: "settings" as TabType, label: "Impostazioni", icon: Settings, hasBadge: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/60 dark:border-slate-800/60 pb-safe transition-colors">
      <div className="max-w-md mx-auto grid grid-cols-3 px-3 py-1.5 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id || (tab.id === "cleanings" && currentTab === "history");
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all relative border border-transparent outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 select-none active:scale-[0.98] ${isActive
                  ? "bg-brand-light dark:bg-brand-darkBg text-brand dark:text-brand-dark font-semibold"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
                }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
                {tab.hasBadge && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-950">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
