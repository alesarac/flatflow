"use client";

import { useState } from "react";
import { Roommate } from "../lib/domain/types";
import {
  Users,
  LogOut,
  Check,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  SunMedium,
  MapPin,
} from "lucide-react";
import { useTheme } from "../lib/theme/ThemeContext";
import { formatSunTime } from "../lib/theme/solar";

interface SettingsViewProps {
  roommates: Roommate[];
  myRoommateId: number | null;
  onUpdateRoommateName: (id: number, name: string) => Promise<boolean>;
  onLogout: () => void;
}

export function SettingsView({
  roommates,
  myRoommateId,
  onUpdateRoommateName,
  onLogout,
}: SettingsViewProps) {
  const {
    mode,
    resolvedTheme,
    coords,
    sunTimes,
    locationLoading,
    locationMessage,
    setMode,
    requestLocation,
  } = useTheme();

  const [names, setNames] = useState<{ [id: number]: string }>(() => {
    const init: { [id: number]: string } = {};
    roommates.forEach((r) => {
      init[r.id] = r.name;
    });
    return init;
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const myRoommate = roommates.find((r) => r.id === myRoommateId);
  const hasChanges =
    myRoommateId !== null &&
    myRoommate !== undefined &&
    names[myRoommateId] !== undefined &&
    names[myRoommateId].trim().length > 0 &&
    names[myRoommateId].trim() !== myRoommate.name;

  const handleNameChange = (id: number, newName: string) => {
    setNames((prev) => ({ ...prev, [id]: newName }));
    setSavedSuccess(false);
    setSaveError(null);
  };

  const handleSaveNames = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || myRoommateId === null) return;
    setSaving(true);
    setSavedSuccess(false);
    setSaveError(null);

    try {
      const ok = await onUpdateRoommateName(myRoommateId, names[myRoommateId].trim());
      if (!ok) {
        setSaveError("Errore durante il salvataggio del nome sul server. Riprova.");
      } else {
        setSavedSuccess(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore durante il salvataggio";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <div>
        <h2 className="text-[19px] font-bold text-slate-900 dark:text-white leading-tight">
          Impostazioni
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Gestione coinquilini, preferenze di tema e account
        </p>
      </div>

      {/* 1. SEZIONE: COINQUILINI */}
      <div className="bg-white dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-[#365672] dark:text-slate-300 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Coinquilini
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
              Visualizza i coinquilini della casa e modifica il tuo nome
            </p>
          </div>
        </div>

        {/* Elenco coinquilini: modifica abilitata solo per il proprio profilo */}
        <form onSubmit={handleSaveNames} className="space-y-3 pt-1">
          <div className="space-y-2.5">
            {roommates.map((r) => {
              const isMe = r.id === myRoommateId;
              return (
                <div key={r.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
                      Coinquilino {r.id + 1}
                    </label>
                    {isMe && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                        Il tuo profilo
                      </span>
                    )}
                  </div>
                  {isMe ? (
                    <input
                      type="text"
                      value={names[r.id] ?? r.name}
                      onChange={(e) => handleNameChange(r.id, e.target.value)}
                      maxLength={30}
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#365672] transition-colors"
                    />
                  ) : (
                    <input
                      type="text"
                      value={r.name}
                      disabled
                      readOnly
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-sm font-medium cursor-not-allowed select-none"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {savedSuccess && (
            <div className="flex items-center gap-2 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Nome aggiornato con successo!</span>
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-2 p-2.5 text-xs text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !hasChanges}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#365672] hover:bg-[#2c475e] active:scale-[0.98] text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvataggio in corso...</span>
              </>
            ) : (
              <span>Cambia il tuo nome</span>
            )}
          </button>
        </form>
      </div>

      {/* 2. SEZIONE: PREFERENZE */}
      <div className="bg-white dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SunMedium className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Preferenze
            </h3>
          </div>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-400">
            {resolvedTheme === "light" ? "Aspetto: Chiaro" : "Aspetto: Scuro"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setMode("auto")}
            className={`min-h-[44px] py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              mode === "auto"
                ? "bg-[#365672] text-white border-transparent shadow-sm"
                : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750"
            }`}
          >
            <span
              className={`w-4 h-4 flex items-center justify-center font-bold text-[10px] border rounded-full ${
                mode === "auto" ? "border-white" : "border-slate-400 dark:border-slate-500"
              }`}
            >
              A
            </span>
            <span>Automatico</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("light")}
            className={`min-h-[44px] py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              mode === "light"
                ? "bg-[#365672] text-white border-transparent shadow-sm"
                : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750"
            }`}
          >
            <Sun className={`w-4 h-4 ${mode === "light" ? "text-white" : "text-amber-500"}`} />
            <span>Chiaro</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("dark")}
            className={`min-h-[44px] py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              mode === "dark"
                ? "bg-[#365672] text-white border-transparent shadow-sm"
                : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750"
            }`}
          >
            <Moon className={`w-4 h-4 ${mode === "dark" ? "text-white" : "text-slate-400"}`} />
            <span>Scuro</span>
          </button>
        </div>

        {/* Dettagli modalità automatica */}
        {mode === "auto" && (
          <div className="pt-2.5 space-y-2.5 border-t border-slate-100 dark:border-slate-800/80">
            <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {coords && sunTimes?.sunrise && sunTimes?.sunset ? (
                <p>
                  Posizione registrata. Alba alle{" "}
                  <strong className="text-slate-900 dark:text-slate-200">
                    {formatSunTime(sunTimes.sunrise)}
                  </strong>
                  , tramonto alle{" "}
                  <strong className="text-slate-900 dark:text-slate-200">
                    {formatSunTime(sunTimes.sunset)}
                  </strong>
                  .
                </p>
              ) : (
                <p>
                  Posizione non ancora autorizzata. Tema chiaro dalle{" "}
                  <strong className="text-slate-900 dark:text-slate-200">07:00</strong> alle{" "}
                  <strong className="text-slate-900 dark:text-slate-200">19:00</strong>, scuro negli altri orari.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => requestLocation()}
              disabled={locationLoading}
              className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:border-slate-700 text-xs font-semibold border transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 shadow-sm"
            >
              {locationLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-[#365672] dark:text-slate-300" />
              )}
              <span>
                {coords
                  ? "Aggiorna coordinate per alba/tramonto"
                  : "Rileva posizione per alba/tramonto precisi"}
              </span>
            </button>

            {locationMessage && (
              <div
                className={`p-2.5 text-xs rounded-xl border flex items-center gap-2 ${
                  locationMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
                    : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20"
                }`}
              >
                {locationMessage.type === "success" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                )}
                <span>{locationMessage.text}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. SEZIONE: ACCOUNT */}
      <div className="bg-white dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100/60 dark:border-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Account
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
              Disconnetti la sessione attiva su questo dispositivo.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-rose-200/80 bg-rose-50/60 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors active:scale-[0.98] outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <LogOut className="w-4 h-4" />
          <span>Esci</span>
        </button>
      </div>
    </div>
  );
}
