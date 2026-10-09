"use client";

import { useState } from "react";
import { Roommate } from "../lib/domain/types";
import { Users, LogOut, Check, Smartphone, Sparkles } from "lucide-react";

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
  const [names, setNames] = useState<{ [id: number]: string }>(() => {
    const init: { [id: number]: string } = {};
    roommates.forEach((r) => {
      init[r.id] = r.name;
    });
    return init;
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleNameChange = (id: number, newName: string) => {
    setNames((prev) => ({ ...prev, [id]: newName }));
    setSavedSuccess(false);
  };

  const handleSaveNames = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      for (const r of roommates) {
        if (names[r.id] && names[r.id].trim() !== r.name) {
          await onUpdateRoommateName(r.id, names[r.id].trim());
        }
      }
      setSavedSuccess(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Impostazioni</h2>
        <p className="text-xs text-slate-400">Profilo locale e configurazione casa</p>
      </div>

      {/* 1. Selezione profilo attivo */}
      <div className="bg-slate-850/90 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Chi usa questo telefono?</h3>
        </div>
        <p className="text-xs text-slate-400">
          I compiti assegnati a questo profilo verranno messi in risalto.
        </p>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {roommates.map((r) => {
            const isSelected = myRoommateId === r.id;
            return (
              <button
                key={r.id}
                onClick={() => onSelectMyId(r.id)}
                className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center truncate ${
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750"
                }`}
              >
                {r.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Modifica dei tre coinquilini */}
      <form
        onSubmit={handleSaveNames}
        className="bg-slate-850/90 border border-slate-800 rounded-2xl p-4 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Nomi dei 3 coinquilini</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Se cambia un coinquilino, aggiorna qui il suo nome.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {roommates.map((r) => (
            <div key={r.id} className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Coinquilino {r.id + 1}
              </label>
              <input
                type="text"
                value={names[r.id] ?? r.name}
                onChange={(e) => handleNameChange(r.id, e.target.value)}
                maxLength={30}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
          ))}
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 p-2.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Nomi aggiornati con successo!</span>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva modifiche nomi"}
        </button>
      </form>

      {/* 3. Installazione PWA */}
      <div className="bg-slate-850/50 border border-slate-800 rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            Uso da Smartphone (PWA)
          </h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Per aprirla come una vera app: su iPhone premi <span className="text-white font-medium">Condividi</span> &gt; <span className="text-white font-medium">Aggiungi a schermata Home</span>. Su Android seleziona <span className="text-white font-medium">Installa applicazione</span> dal menu del browser.
        </p>
      </div>

      {/* 4. Accesso casa / Logout */}
      <div className="pt-2">
        <button
          onClick={onLogout}
          className="w-full py-3 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-medium text-xs flex items-center justify-center gap-2 transition-colors active:scale-98"
        >
          <LogOut className="w-4 h-4" />
          <span>Disconnetti questo dispositivo</span>
        </button>
      </div>
    </div>
  );
}
