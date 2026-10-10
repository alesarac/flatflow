"use client";

import { useEffect, useState, useCallback } from "react";
import { ShoppingItem } from "../lib/domain/types";
import { formatTimeAgo } from "../lib/domain/logic";
import {
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Loader2,
  ChevronUp,
  ChevronDown,
  X,
  ShoppingBag,
} from "lucide-react";

export function ShoppingView() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [toBuyExpanded, setToBuyExpanded] = useState(true);
  const [boughtExpanded, setBoughtExpanded] = useState(true);

  const fetchItems = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/house/shopping", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Impossibile caricare la lista della spesa.");
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message || "Errore di connessione.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Caricamento iniziale e refresh al ritorno sull'app (focus / visibilitychange)
  useEffect(() => {
    fetchItems(false);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchItems(false);
      }
    };

    const handleFocus = () => {
      fetchItems(false);
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchItems]);

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed || isAdding) return;

    setIsAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/house/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", name: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante l'aggiunta.");
      }

      setNewItemName("");
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (id: string, isBought: boolean) => {
    if (actionLoadingId === id) return;
    setActionLoadingId(id);
    setError(null);

    // Aggiornamento ottimistico
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              isBought,
              boughtAt: isBought ? new Date().toISOString() : null,
            }
          : item
      )
    );

    try {
      const res = await fetch("/api/house/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id, isBought }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante l'aggiornamento.");
      }
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message);
      fetchItems(false);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (actionLoadingId === id) return;
    setActionLoadingId(id);
    setError(null);

    // Aggiornamento ottimistico
    setItems((prev) => prev.filter((item) => item.id !== id));

    try {
      const res = await fetch("/api/house/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore durante l'eliminazione.");
      }
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message);
      fetchItems(false);
    } finally {
      setActionLoadingId(null);
    }
  };

  const toBuyItems = items.filter((i) => !i.isBought);
  const boughtItems = items.filter((i) => i.isBought);
  const hasBoughtItems = boughtItems.length > 0;

  return (
    <div className="p-4 space-y-4">
      {/* 1. Intestazione: Titolo, sottotitolo e refresh */}
      <div className="flex items-center justify-between px-0.5">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900 dark:text-white leading-tight">
            Lista della spesa
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cose da comprare per la casa
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchItems(true)}
          disabled={loading || isRefreshing}
          className="min-h-[44px] min-w-[44px] p-2.5 rounded-2xl bg-white dark:bg-slate-850/90 text-slate-500 hover:text-slate-900 border border-slate-200/80 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200 active:scale-95 transition-all disabled:opacity-50 shadow-sm inline-flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          title="Aggiorna lista della spesa"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#4355EC] dark:text-indigo-400" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl">
          {error}
        </div>
      )}

      {/* 2. Campo di inserimento e pulsante + */}
      <form onSubmit={handleAdd} className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Aggiungi un elemento..."
            maxLength={80}
            className="w-full min-h-[44px] bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all pr-9 shadow-sm"
          />
          {newItemName.length > 0 && (
            <button
              type="button"
              onClick={() => setNewItemName("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              title="Cancella testo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!newItemName.trim() || isAdding}
          className="min-h-[44px] min-w-[44px] w-11 h-11 rounded-2xl bg-[#4355EC] hover:bg-[#3847cf] active:scale-95 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          title="Aggiungi prodotto"
        >
          {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5 stroke-[2.5]" />}
        </button>
      </form>

      {/* 3. Elenco prodotti */}
      {loading && items.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-[#4355EC] dark:text-indigo-400 animate-spin" />
          <span>Caricamento lista in corso...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center space-y-2 bg-white dark:bg-slate-850/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto mb-2">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Nessun elemento nella lista
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            Aggiungi qualcosa da comprare per la casa usando il campo qui sopra.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sezione: Da comprare */}
          <div className="space-y-2.5">
            {hasBoughtItems && (
              <button
                type="button"
                onClick={() => setToBuyExpanded((prev) => !prev)}
                className="w-full flex items-center justify-between px-0.5 text-left group"
              >
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Da comprare ({toBuyItems.length})
                </h2>
                <div className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                  {toBuyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
            )}

            {(!hasBoughtItems || toBuyExpanded) && (
              <div className="space-y-2.5">
                {toBuyItems.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Tutto comprato! Nessun prodotto in attesa.
                    </p>
                  </div>
                ) : (
                  toBuyItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-850/90 shadow-sm p-3.5 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Checkbox per completare */}
                        <button
                          type="button"
                          onClick={() => handleToggle(item.id, true)}
                          disabled={actionLoadingId === item.id}
                          className="min-h-[44px] min-w-[44px] -ml-2 -my-2 flex items-center justify-center shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95 transition-all"
                          aria-label={`Segna ${item.name} come comprato`}
                        >
                          <div className="w-5 h-5 rounded-lg border-2 border-slate-300 dark:border-slate-600 hover:border-[#4355EC] dark:hover:border-indigo-400 transition-colors flex items-center justify-center" />
                        </button>

                        {/* Nome e autore */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug break-words">
                            {item.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal break-words">
                            Aggiunto da {item.addedByName} · {formatTimeAgo(item.createdAt)}
                          </p>
                        </div>

                        {/* Pulsante elimina */}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={actionLoadingId === item.id}
                          className="min-h-[44px] min-w-[44px] -mr-2 -my-2 flex items-center justify-center shrink-0 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-95 transition-all"
                          title="Elimina prodotto"
                          aria-label={`Elimina ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Sezione: Comprati (visibile solo se esistono prodotti comprati) */}
          {hasBoughtItems && (
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => setBoughtExpanded((prev) => !prev)}
                className="w-full flex items-center justify-between px-0.5 text-left group"
              >
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Comprati ({boughtItems.length})
                </h2>
                <div className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                  {boughtExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {boughtExpanded && (
                <div className="space-y-2.5">
                  {boughtItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-50/60 dark:bg-slate-900/60 shadow-sm p-3.5 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Checkbox per togliere la spunta */}
                        <button
                          type="button"
                          onClick={() => handleToggle(item.id, false)}
                          disabled={actionLoadingId === item.id}
                          className="min-h-[44px] min-w-[44px] -ml-2 -my-2 flex items-center justify-center shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95 transition-all"
                          aria-label={`Riporta ${item.name} tra quelli da comprare`}
                        >
                          <div className="w-5 h-5 rounded-lg bg-[#4355EC] dark:bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </button>

                        {/* Nome barrato e dettagli compratore */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-slate-400 dark:text-slate-500 text-base leading-snug line-through break-words">
                            {item.name}
                          </h3>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-normal break-words">
                            Comprato da {item.boughtByName || "Coinquilino"} · {formatTimeAgo(item.boughtAt || item.createdAt)}
                          </p>
                        </div>

                        {/* Pulsante elimina */}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={actionLoadingId === item.id}
                          className="min-h-[44px] min-w-[44px] -mr-2 -my-2 flex items-center justify-center shrink-0 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-95 transition-all"
                          title="Elimina prodotto"
                          aria-label={`Elimina ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
