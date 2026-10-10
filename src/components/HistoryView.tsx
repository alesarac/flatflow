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

  const renderItemIcon = (item: HistoryItem) => {
    if (item.type === "trash") {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40">
          <Trash2 className="w-4 h-4" />
        </div>
      );
    }

    const titleLower = item.title.toLowerCase();
    if (item.areaId === 0 || titleLower.includes("cucina")) {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-indigo-50 text-indigo-500 border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/40">
          <UtensilsCrossed className="w-4 h-4" />
        </div>
      );
    }

    if (item.areaId === 1 || titleLower.includes("bagno")) {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-sky-50 text-sky-500 border-sky-100 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/40">
          <Sparkles className="w-4 h-4" />
        </div>
      );
    }

    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40">
        <DoorOpen className="w-4 h-4" />
      </div>
    );
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
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Storico attività</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Pulizie e spazzatura degli ultimi mesi</p>
        </div>
        <button
          onClick={() => fetchHistory(0)}
          disabled={loading || loadingMore}
          className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:border-slate-700/60 active:scale-95 transition-all disabled:opacity-50"
          title="Aggiorna storico"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600 dark:text-indigo-400" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl">
          {error}
        </div>
      )}

      {loading && history.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-500 animate-spin" />
          <span>Caricamento storico in corso...</span>
        </div>
      ) : history.length === 0 ? (
        <div className="py-12 text-center space-y-2 bg-white dark:bg-slate-850/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Nessuna attività registrata</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Le pulizie completate o incomplete e la spazzatura appariranno qui cronologicamente.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {monthGroups.map((group) => (
            <div key={group.monthKey} className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                {group.monthLabel}
              </h3>

              <div className="space-y-2">
                {group.items.map((item) => {
                  const isCompleted = item.status === "completed";

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-850/90 border border-slate-200 dark:border-slate-800 shadow-sm text-sm transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {renderItemIcon(item)}

                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs leading-tight truncate">
                            {getCleanTitle(item)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {item.personName}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-2">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDate(item.date)}
                        </div>
                        <div className="mt-0.5">
                          {isCompleted ? (
                            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              Completata
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              Incompleta
                            </span>
                          )}
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
                className="py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-indigo-600 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-indigo-400 dark:border-slate-700/80 text-xs font-semibold active:scale-95 transition-all inline-flex items-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {loadingMore ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5" />
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
