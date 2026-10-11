"use client";

import { useEffect, useState } from "react";
import { KeyRound, ShieldAlert, ArrowRight, Loader2, UserCheck } from "lucide-react";
import { Roommate } from "@/lib/domain/types";

interface AuthGateProps {
  onSuccess: () => void;
}

export function AuthGate({ onSuccess }: AuthGateProps) {
  const [code, setCode] = useState("");
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [selectedRoommateId, setSelectedRoommateId] = useState<number | null>(null);
  const [loadingRoommates, setLoadingRoommates] = useState(true);
  const [roommatesError, setRoommatesError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoommates = async () => {
    setLoadingRoommates(true);
    setRoommatesError(null);
    try {
      const res = await fetch("/api/auth/roommates");
      if (!res.ok) {
        throw new Error("Impossibile caricare i coinquilini");
      }
      const data = await res.json();
      if (Array.isArray(data.roommates) && data.roommates.length > 0) {
        setRoommates(data.roommates);
      } else {
        throw new Error("Nessun coinquilino configurato");
      }
    } catch {
      setRoommatesError("Errore nel recupero dei coinquilini dal server");
    } finally {
      setLoadingRoommates(false);
    }
  };

  useEffect(() => {
    fetchRoommates();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || selectedRoommateId === null || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          roommateId: selectedRoommateId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Accesso non riuscito");
        return;
      }

      onSuccess();
    } catch {
      setError("Errore di connessione al server");
    } finally {
      setLoading(false);
    }
  };

  const selectedRoommate =
    selectedRoommateId !== null
      ? roommates.find((r) => r.id === selectedRoommateId)
      : undefined;

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-12">
      <div className="w-full max-w-sm mx-auto text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 mb-2">
          <KeyRound className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            FlatLoop
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Inserisci il codice della casa e seleziona il tuo profilo per accedere.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          {/* 1. Codice Casa */}
          <div>
            <label
              htmlFor="code"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
            >
              Codice Casa
            </label>
            <input
              id="code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Inserisci il codice"
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-lg tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm"
            />
          </div>

          {/* 2. Selezione Profilo Coinquilino */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Chi sei?
              </label>
              {selectedRoommate && (
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {selectedRoommate.name}
                </span>
              )}
            </div>

            {loadingRoommates ? (
              <div className="flex items-center justify-center p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-400 text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span>Caricamento profili dalla casa...</span>
              </div>
            ) : roommatesError ? (
              <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
                <span>{roommatesError}</span>
                <button
                  type="button"
                  onClick={fetchRoommates}
                  className="underline font-semibold"
                >
                  Riprova
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {roommates.map((r) => {
                  const isSelected = selectedRoommateId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoommateId(r.id)}
                      className={`min-h-[44px] py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center truncate outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        isSelected
                          ? "bg-[#365672] text-white border-transparent shadow-sm"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750"
                      }`}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim() || selectedRoommateId === null}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-medium shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:pointer-events-none transition-all text-base"
          >
            {loading ? (
              <span>Verifica in corso...</span>
            ) : (
              <>
                <span>
                  {selectedRoommate ? `Accedi come ${selectedRoommate.name}` : "Accedi alla Casa"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
          Il profilo selezionato resterà collegato a questo dispositivo fino alla disconnessione.
        </p>
      </div>
    </div>
  );
}
