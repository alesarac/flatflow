"use client";

import { useEffect, useState } from "react";
import { HistoryItem } from "../lib/domain/types";
import { CheckCircle2, XCircle, Trash2, RefreshCw, Loader2, ArrowDown } from "lucide-react";

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

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Storico attività</h2>
          <p className="text-xs text-slate-400">Pulizie e spazzatura registrate</p>
        </div>
        <button
          onClick={() => fetchHistory(0)}
          disabled={loading || loadingMore}
          className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 active:scale-95 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          {error}
        </div>
      )}

      {loading && history.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          <span>Caricamento storico in corso...</span>
        </div>
      ) : history.length === 0 ? (
        <div className="py-12 text-center space-y-2 bg-slate-850/50 rounded-2xl border border-slate-800 p-6">
          <p className="text-sm font-medium text-slate-300">Nessuna attività registrata</p>
          <p className="text-xs text-slate-500">
            Le pulizie completate o incomplete e i conferimenti della spazzatura appariranno qui.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {history.map((item) => {
            const isCleaning = item.type === "cleaning";
            const isCompleted = item.status === "completed";

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-850/90 border border-slate-800 text-sm"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                      isCompleted
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    {isCleaning ? (
                      isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-500" />
                      )
                    ) : (
                      <Trash2 className="w-4 h-4 text-indigo-400" />
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-slate-100 text-xs">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {item.personName}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-400">
                    {formatDate(item.date)}
                  </div>
                  <div className="mt-0.5">
                    {isCompleted ? (
                      <span className="text-[10px] font-semibold text-emerald-400">
                        Completata
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-500">
                        Incompleta
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div className="pt-2 text-center">
              <button
                onClick={() => fetchHistory(history.length)}
                disabled={loadingMore}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-indigo-300 border border-slate-700/80 active:scale-95 transition-all inline-flex items-center gap-2 disabled:opacity-50"
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
