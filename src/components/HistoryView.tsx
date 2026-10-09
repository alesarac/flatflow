"use client";

import { useEffect, useState } from "react";
import { HistoryItem } from "../lib/domain/types";
import { CheckCircle2, XCircle, Trash2, Sparkles, RefreshCw } from "lucide-react";

export function HistoryView() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/house/history", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setHistory(json.history || []);
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
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
          onClick={fetchHistory}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 active:scale-95 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
        </button>
      </div>

      {loading && history.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">
          Caricamento storico in corso...
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
        </div>
      )}
    </div>
  );
}
