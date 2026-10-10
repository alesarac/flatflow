"use client";

import { useState } from "react";
import { Roommate } from "../lib/domain/types";
import {
  Users,
  LogOut,
  Check,
  Smartphone,
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
  onSelectMyId: (id: number) => void;
  onUpdateRoommateName: (id: number, name: string) => Promise<boolean>;
  onLogout: () => void;
}

export function SettingsView({
  roommates,
  myRoommateId,
  onSelectMyId,
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

  const hasChanges = roommates.some(
    (r) => names[r.id] !== undefined && names[r.id].trim() !== r.name
  );

  const handleNameChange = (id: number, newName: string) => {
    setNames((prev) => ({ ...prev, [id]: newName }));
    setSavedSuccess(false);
    setSaveError(null);
  };

  const handleSaveNames = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;
    setSaving(true);
    setSavedSuccess(false);
    setSaveError(null);

    try {
      let anyFailed = false;
      for (const r of roommates) {
        if (names[r.id] && names[r.id].trim() !== r.name) {
          const ok = await onUpdateRoommateName(r.id, names[r.id].trim());
          if (!ok) {
            anyFailed = true;
            break;
          }
        }
      }

      if (anyFailed) {
        setSaveError("Errore durante il salvataggio dei nomi sul server. Riprova.");
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
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Impostazioni</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Profilo locale, aspetto e configurazione casa
        </p>
      </div>

      {/* 1. Selezione profilo attivo */}
      <div className="bg-white dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Chi usa questo telefono?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              I compiti assegnati a questo profilo verranno mostrati in home.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-0.5">
          {roommates.map((r) => {
            const isSelected = myRoommateId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectMyId(r.id)}
                className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center truncate ${
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750"
                }`}
              >
                {r.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Sezione Tema e Aspetto */}
      <div className="bg-white dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SunMedium className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Tema e aspetto
            </h3>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {resolvedTheme === "light" ? "Aspetto: Chiaro" : "Aspetto: Scuro"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setMode("auto")}
            className={`py-3 px-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1.5 ${
              mode === "auto"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750"
            }`}
          >
            <span
              className={`w-5 h-5 flex items-center justify-center font-bold text-xs border rounded-full ${
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
            className={`py-3 px-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1.5 ${
              mode === "light"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750"
            }`}
          >
            <Sun className={`w-5 h-5 ${mode === "light" ? "text-white" : "text-amber-500"}`} />
            <span>Chiaro</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("dark")}
            className={`py-3 px-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1.5 ${
              mode === "dark"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750"
            }`}
          >
            <Moon className={`w-5 h-5 ${mode === "dark" ? "text-white" : "text-indigo-400"}`} />
            <span>Scuro</span>
          </button>
        </div>

        {/* Dettagli modalità automatica */}
        {mode === "auto" && (
          <div className="pt-2 space-y-2.5 border-t border-slate-100 dark:border-slate-800/80">
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
              className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 dark:border-slate-700 text-xs font-medium border transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {locationLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
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

      {/* 3. Modifica dei tre coinquilini */}
      <form
        onSubmit={handleSaveNames}
        className="bg-white dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Nomi dei 3 coinquilini
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Se cambia un coinquilino, aggiorna qui il suo nome.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {roommates.map((r) => (
            <div key={r.id} className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                COINQUILINO {r.id + 1}
              </label>
              <input
                type="text"
                value={names[r.id] ?? r.name}
                onChange={(e) => handleNameChange(r.id, e.target.value)}
                maxLength={30}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
          ))}
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Nomi aggiornati con successo!</span>
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
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-sm shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Salvataggio in corso...</span>
            </>
          ) : (
            <span>Salva modifiche nomi</span>
          )}
        </button>
      </form>

      {/* 4. Installazione PWA */}
      <div className="bg-white dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Uso da smartphone (PWA)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Installa Flatflow come una vera app sul tuo telefono per un accesso rapido.
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pt-0.5 pl-12 border-t border-slate-100 dark:border-slate-800/80">
          <p>
            <strong className="text-slate-900 dark:text-white">iPhone (Safari):</strong> tocca{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">Condividi</span> &gt;{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">Aggiungi a schermata Home</span>.
          </p>
          <p>
            <strong className="text-slate-900 dark:text-white">Android (Chrome):</strong> apri il menu dei tre puntini e seleziona{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">Installa applicazione</span>.
          </p>
        </div>
      </div>

      {/* 5. Accesso casa / Logout */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-3 px-4 rounded-xl bg-rose-50/70 hover:bg-rose-100/80 text-rose-600 border border-rose-200/80 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/20 font-medium text-xs flex items-center justify-center gap-2 transition-colors active:scale-98"
        >
          <LogOut className="w-4 h-4" />
          <span>Disconnetti questo dispositivo</span>
        </button>
      </div>
    </div>
  );
}
