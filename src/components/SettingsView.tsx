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
  CheckCircle2,
  Circle,
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
    <div className="p-4 space-y-5 max-w-md mx-auto">
      <div>
        <h2 className="text-[22px] font-bold text-slate-900 dark:text-white leading-tight">
          Impostazioni
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Gestisci il tuo profilo e le preferenze dell'app.
        </p>
      </div>

      {/* 1. SEZIONE: COINQUILINI */}
      <div className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,65,67,0.45)] transition-colors dark:border-slate-700/70 dark:bg-slate-800/95 dark:shadow-[0_12px_28px_-22px_rgba(0,0,0,0.85)] space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
              Coinquilini
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              I membri della casa
            </p>
          </div>
        </div>

        {/* Elenco coinquilini: modifica abilitata solo per il proprio profilo */}
        <form onSubmit={handleSaveNames} className="space-y-3 pt-1">
          <div className="space-y-2.5">
            {roommates.map((r) => {
              const isMe = r.id === myRoommateId;
              return isMe ? (
                <div key={r.id} className="space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <label
                      htmlFor={"roommate-name-" + r.id}
                      className="text-xs font-semibold text-teal-700 dark:text-teal-300"
                    >
                      Il tuo profilo
                    </label>
                    <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />
                  </div>
                  <input
                    id={"roommate-name-" + r.id}
                    type="text"
                    value={names[r.id] ?? r.name}
                    onChange={(e) => handleNameChange(r.id, e.target.value)}
                    maxLength={30}
                    required
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-teal-300/80 dark:border-teal-700/80 text-slate-900 dark:text-white text-base font-semibold focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
                  />
                </div>
              ) : (
                <div
                  key={r.id}
                  className="min-h-[44px] flex items-center rounded-xl bg-slate-50/90 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 px-3.5 py-2.5"
                >
                  <span className="text-base font-semibold text-slate-700 dark:text-slate-200 break-words">{r.name}</span>
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
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 active:scale-[0.98] text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
      <div className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,65,67,0.45)] transition-colors dark:border-slate-700/70 dark:bg-slate-800/95 dark:shadow-[0_12px_28px_-22px_rgba(0,0,0,0.85)] space-y-3.5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
            <SunMedium className="w-5 h-5" />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">Aspetto</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Scegli come visualizzare FlatLoop</p>
          </div>
        </div>

        <div className="space-y-2" role="group" aria-label="Modalità aspetto">
          {([
            { id: "auto" as const, label: "Automatico", description: "Si adatta al giorno e alla notte", Icon: SunMedium },
            { id: "light" as const, label: "Chiaro", description: "Aspetto luminoso", Icon: Sun },
            { id: "dark" as const, label: "Scuro", description: "Aspetto scuro", Icon: Moon },
          ]).map(({ id, label, description, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className={
                "min-h-[64px] w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-brand " +
                (mode === id
                  ? "bg-teal-50/80 border-teal-400/80 dark:bg-teal-950/50 dark:border-teal-700 text-slate-900 dark:text-white"
                  : "bg-white border-slate-200/90 hover:bg-slate-50 dark:bg-slate-900/30 dark:border-slate-700/70 dark:hover:bg-slate-700/40 text-slate-900 dark:text-white")
              }
            >
              <span className={
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 " +
                (mode === id
                  ? "bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300")
              }>
                <Icon className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold leading-snug">{label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 leading-normal mt-0.5">{description}</span>
              </span>
              {mode === id ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-teal-700 dark:text-teal-300" aria-hidden="true" />
              ) : (
                <Circle className="w-5 h-5 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>

        {/* Dettagli modalità automatica */}
        {mode === "auto" && (
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-2.5 dark:border-slate-700/60 dark:bg-slate-900/40">
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
              className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-white hover:bg-teal-50 text-teal-800 border border-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-teal-300 dark:border-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 shadow-sm"
            >
              {locationLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
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
      <div className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_-22px_rgba(15,65,67,0.45)] transition-colors dark:border-slate-700/70 dark:bg-slate-800/95 dark:shadow-[0_12px_28px_-22px_rgba(0,0,0,0.85)] space-y-3.5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
              Account
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gestisci la sessione sul dispositivo
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300 font-semibold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98] outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <LogOut className="w-4 h-4" />
          <span>Esci</span>
        </button>
      </div>
    </div>
  );
}
