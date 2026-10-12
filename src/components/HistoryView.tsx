"use client";

import { useEffect, useState, useMemo } from "react";
import { HistoryItem } from "../lib/domain/types";
import { formatHistoryWeekLabel, getWeekKey, parseWeekKey } from "../lib/domain/logic";
import {
  Trash2,
  UtensilsCrossed,
  Sparkles,
  DoorOpen,
  RefreshCw,
  Loader2,
  ArrowDown,
  ArrowLeft,
  CalendarDays,
  CircleDot,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface WeekGroup {
  weekKey: string;
  weekLabel: string;
  items: HistoryItem[];
}

interface MonthGroup {
  monthKey: string;
  monthLabel: string;
  weeks: WeekGroup[];
}

function groupHistoryByMonthAndWeek(items: HistoryItem[]): MonthGroup[] {
  const monthsIt = [
    "GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO",
    "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"
  ];

  const monthMap = new Map<string, { monthKey: string; monthLabel: string; weekMap: Map<string, WeekGroup> }>();

  for (const item of items) {
    // Per le pulizie usa la settimana dell'attività; per la spazzatura la data di completamento (in Europe/Rome)
    const weekKey =
      item.type === "cleaning" && item.weekKey
        ? item.weekKey
        : getWeekKey(new Date(item.date));

    // Le settimane a cavallo di due mesi restano unite sotto il mese del lunedì
    const { monday } = parseWeekKey(weekKey);
    const monthKey = `${monday.year}-${String(monday.month).padStart(2, "0")}`;
    const monthLabel = `${monthsIt[monday.month - 1]} ${monday.year}`;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        monthKey,
        monthLabel,
        weekMap: new Map(),
      });
    }

    const mGroup = monthMap.get(monthKey)!;
    if (!mGroup.weekMap.has(weekKey)) {
      mGroup.weekMap.set(weekKey, {
        weekKey,
        weekLabel: formatHistoryWeekLabel(weekKey),
        items: [],
      });
    }

    mGroup.weekMap.get(weekKey)!.items.push(item);
  }

  // Converti e ordina (dal più recente)
  const monthGroups: MonthGroup[] = Array.from(monthMap.values()).map((m) => {
    const weeks: WeekGroup[] = Array.from(m.weekMap.values());
    // Settimane ordinate dal più recente
    weeks.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
    // Attività all'interno della settimana ordinate dal più recente
    for (const w of weeks) {
      w.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return {
      monthKey: m.monthKey,
      monthLabel: m.monthLabel,
      weeks,
    };
  });

  // Mesi ordinati dal più recente
  monthGroups.sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  return monthGroups;
}

interface HistoryViewProps {
  onBack?: () => void;
}

export function HistoryView({ onBack }: HistoryViewProps = {}) {
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

  const getBadgeText = (item: HistoryItem) => {
    if (item.type === "trash") {
      return "Buttata";
    }
    if (item.status === "completed") {
      return "Completata";
    }
    return "Incompleta";
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

  const monthGroups = useMemo(() => groupHistoryByMonthAndWeek(history), [history]);

  return (
    <div className="p-4 space-y-5">
      {/* Intestazione Storico */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-2xl bg-white dark:bg-slate-850/90 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-800 shadow-sm inline-flex items-center justify-center active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand"
              title="Torna alle pulizie"
              aria-label="Torna alle pulizie"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-[22px] font-bold text-slate-900 dark:text-white leading-tight">
              Storico attività
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pulizie e spazzatura registrate
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchHistory(0)}
          disabled={loading || loadingMore}
          type="button"
          className="min-h-[44px] min-w-[44px] p-2.5 rounded-2xl bg-white dark:bg-slate-850/90 text-slate-500 hover:text-slate-900 border border-slate-200/80 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200 active:scale-95 transition-all disabled:opacity-50 shadow-sm inline-flex items-center justify-center outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-action"
          title="Aggiorna storico"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-action dark:text-slate-300" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl">
          {error}
        </div>
      )}

      {loading && history.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-action dark:text-slate-300 animate-spin" />
          <span>Caricamento storico in corso...</span>
        </div>
      ) : history.length === 0 ? (
        <div className="py-10 text-center space-y-2 bg-white dark:bg-slate-800/95 rounded-[22px] border border-slate-200/80 dark:border-slate-700/70 px-6 shadow-[0_10px_28px_-22px_rgba(15,65,67,0.45)]">
          <p className="text-sm font-bold text-slate-900 dark:text-white">Nessuna attività registrata</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Le attività registrate appariranno qui cronologicamente.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {monthGroups.map((group) => (
            <section key={group.monthKey} className="space-y-4">
              {/* Ogni mese è un blocco principale con intestazione ben distinguibile. */}
              <h3 className="flex items-center gap-2.5 rounded-2xl bg-teal-50 px-3.5 py-3 text-sm font-bold tracking-wide text-teal-800 dark:bg-teal-950/50 dark:text-teal-200">
                <CalendarDays className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                <span>{group.monthLabel}</span>
              </h3>

              <div className="space-y-5">
                {group.weeks.map((week) => (
                  <section key={week.weekKey} className="space-y-2.5 border-l-2 border-teal-200/80 pl-3 dark:border-teal-800/70">
                    {/* Le settimane sono sottogruppi del mese, con linea guida e separatore. */}
                    <h4 className="flex items-center gap-2">
                      <CircleDot className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-300" aria-hidden="true" />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {week.weekLabel}
                      </span>
                      <span className="h-px min-w-0 flex-1 bg-slate-200/80 dark:bg-slate-700/80" aria-hidden="true" />
                    </h4>

                    <div className="space-y-2.5">
                      {week.items.map((item) => {
                        const badgeText = getBadgeText(item);
                        const isCompleted = item.type === "trash" || item.status === "completed";

                        return (
                          <div
                            key={item.id}
                            className="rounded-[22px] border border-slate-200/80 bg-white p-3 shadow-[0_10px_28px_-22px_rgba(15,65,67,0.45)] transition-colors dark:border-slate-700/70 dark:bg-slate-800/95 dark:shadow-[0_12px_28px_-22px_rgba(0,0,0,0.85)]"
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                                  {renderItemIcon(item)}
                                </div>
                                <div className="min-w-0 flex-1 pt-0.5">
                                  <div className="text-base font-bold leading-snug text-slate-900 break-words dark:text-white">
                                    {getCleanTitle(item)}
                                  </div>
                                  <div className="mt-0.5 text-xs leading-normal text-slate-500 break-words dark:text-slate-400">
                                    {item.personName}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 text-right pt-0.5">
                                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                  {formatDate(item.date)}
                                </div>
                                <span className={`mt-1.5 inline-flex items-center justify-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${isCompleted
                                  ? "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300"
                                  : "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300"
                                }`}>
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  ) : (
                                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                  )}
                                  {badgeText}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))}

          {hasMore && (
            <div className="pt-2 text-center">
              <button
                onClick={() => fetchHistory(history.length)}
                disabled={loadingMore}
                type="button"
                className="min-h-[44px] py-2.5 px-5 rounded-xl bg-white hover:bg-teal-50 text-teal-800 dark:bg-slate-800/95 dark:hover:bg-slate-700 dark:text-teal-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold active:scale-95 transition-all inline-flex items-center gap-2 disabled:opacity-50 shadow-sm outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                {loadingMore ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
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
