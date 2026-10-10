"use client";

import { useEffect, useState } from "react";
import { HistoryItem } from "../lib/domain/types";
import {
  Trash2,
  UtensilsCrossed,
  Sparkles,
  DoorOpen,
  RefreshCw,
  Loader2,
  ArrowDown,
} from "lucide-react";

interface MonthGroup {
  monthKey: string;
  monthLabel: string;
  items: HistoryItem[];
}

function groupHistoryByMonth(items: HistoryItem[]): MonthGroup[] {
  const monthsIt = [
    "GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO",
    "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"
  ];

  const groups: MonthGroup[] = [];
  const map = new Map<string, MonthGroup>();

  for (const item of items) {
    const d = new Date(item.date);
    const year = isNaN(d.getFullYear()) ? 2026 : d.getFullYear();
    const month = isNaN(d.getMonth()) ? 0 : d.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

    if (!map.has(monthKey)) {
      const group: MonthGroup = {
        monthKey,
        monthLabel: `${monthsIt[month]} ${year}`,
        items: [],
      };
      map.set(monthKey, group);
      groups.push(group);
    }

    map.get(monthKey)!.items.push(item);
  }

  return groups;
}

export function HistoryView() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async (offset = 0) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const res = await fetch(`/api/house/history?limit=30&offset=${offset}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Impossibile caricare lo storico dal server.");
      }
      const json = await res.json();
      const newItems: HistoryItem[] = json.items || [];
      setHasMore(Boolean(json.hasMore));

      if (offset === 0) {
        setHistory(newItems);
      } else {
        setHistory((prev) => {
          const ids = new Set(prev.map((i) => i.id));
          const filtered = newItems.filter((i) => !ids.has(i.id));
          return [...prev, ...filtered];
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore di connessione";
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchHistory(0);
  }, []);

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const months = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      return `${day} ${month}, ${hours}:${mins}`;
    } catch {
      return isoStr;
    }
  };

  const getItemStyle = (item: HistoryItem) => {
    if (item.type === "trash") {
      return {
        card: "bg-[#FFF1F2] border-[#FECDD3] dark:bg-rose-950/20 dark:border-rose-900/40",
        iconBox: "bg-rose-100/70 border-rose-200/60 text-rose-500 dark:bg-rose-900/30 dark:border-rose-800/40 dark:text-rose-400",
        badge: "text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-950/60 border-rose-200/80 dark:border-rose-800/60",
        badgeText: "Buttata",
      };
    }
    if (item.status === "completed") {
      return {
        card: "bg-[#EAF9F1] border-[#C6EED8] dark:bg-emerald-950/20 dark:border-emerald-900/40",
        iconBox: "bg-emerald-100/70 border-emerald-200/60 text-emerald-600 dark:bg-emerald-950/50 dark:border-emerald-800/40 dark:text-emerald-400",
        badge: "text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800/60",
        badgeText: "Completata",
      };
    }
    return {
      card: "bg-[#FFFAE8] border-[#F5E9B7] dark:bg-amber-950/20 dark:border-amber-900/40",
      iconBox: "bg-amber-100/70 border-amber-200/60 text-amber-600 dark:bg-amber-950/50 dark:border-amber-800/40 dark:text-amber-400",
      badge: "text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 border-amber-200/80 dark:border-amber-800/60",
      badgeText: "Incompleta",
    };
  };

  const renderItemIcon = (item: HistoryItem) => {
    if (item.type === "trash") {
      return <Trash2 className="w-5 h-5" />;
    }

    const titleLower = item.title.toLowerCase();
    if (item.areaId === 0 || titleLower.includes("cucina")) {
      return <UtensilsCrossed className="w-5 h-5" />;
    }

    if (item.areaId === 1 || titleLower.includes("bagno")) {
      return <Sparkles className="w-5 h-5" />;
    }

    return <DoorOpen className="w-5 h-5" />;
  };

  const getCleanTitle = (item: HistoryItem) => {
    if (item.type === "trash") return "Spazzatura";
    return item.title.replace(/^Pulizia\s+/i, "");
  };

  const monthGroups = groupHistoryByMonth(history);

  return (
    <div className="p-4 space-y-5">
      {/* Intestazione Storico */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[19px] font-bold text-slate-900 dark:text-white leading-tight">
            Storico attività
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Pulizie e spazzatura registrate
          </p>
        </div>
        <button
          onClick={() => fetchHistory(0)}
          disabled={loading || loadingMore}
          type="button"
          className="min-h-[44px] min-w-[44px] p-2.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 border border-slate-200/80 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200 active:scale-95 transition-all disabled:opacity-50 shadow-sm inline-flex items-center justify-center outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          title="Aggiorna storico"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#365672] dark:text-slate-300" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl">
          {error}
        </div>
      )}

      {loading && history.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-[#365672] dark:text-slate-300 animate-spin" />
          <span>Caricamento storico in corso...</span>
        </div>
      ) : history.length === 0 ? (
        <div className="py-12 text-center space-y-2 bg-white dark:bg-slate-850/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Nessuna attività registrata</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Le attività registrate appariranno qui cronologicamente.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {monthGroups.map((group) => (
            <div key={group.monthKey} className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 px-0.5 mt-3">
                {group.monthLabel}
              </h3>

              <div className="space-y-2.5">
                {group.items.map((item) => {
                  const style = getItemStyle(item);

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border shadow-sm transition-colors ${style.card}`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${style.iconBox}`}
                        >
                          {renderItemIcon(item)}
                        </div>

                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight truncate">
                            {getCleanTitle(item)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {item.personName}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-2">
                        <div className="text-xs font-medium text-slate-400 dark:text-slate-400">
                          {formatDate(item.date)}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`text-[11px] font-semibold border px-2.5 py-0.5 rounded-full inline-block shadow-sm ${style.badge}`}
                          >
                            {style.badgeText}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="pt-2 text-center">
              <button
                onClick={() => fetchHistory(history.length)}
                disabled={loadingMore}
                type="button"
                className="min-h-[44px] py-2.5 px-5 rounded-xl bg-white hover:bg-slate-50 text-[#365672] dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold active:scale-95 transition-all inline-flex items-center gap-2 disabled:opacity-50 shadow-sm outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                {loadingMore ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5 text-[#365672] dark:text-slate-300" />
                )}
                <span>Carica altre attività</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
