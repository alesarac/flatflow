"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import {
  Coordinates,
  ResolvedTheme,
  ThemeMode,
  SolarTimes,
  getSunTimes,
  resolveTheme,
} from "./solar";

const THEME_MODE_KEY = "flatflow_theme_mode";
const COORDS_KEY = "flatflow_coords";

interface ThemeContextType {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  coords: Coordinates | null;
  sunTimes: SolarTimes | null;
  locationLoading: boolean;
  locationMessage: { type: "success" | "error"; text: string } | null;
  setMode: (mode: ThemeMode) => void;
  requestLocation: () => Promise<boolean>;
  clearLocationMessage: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function applyThemeClass(theme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Aggiorna anche il meta theme-color per la status bar dei dispositivi mobili (PWA)
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", theme === "dark" ? "#090d16" : "#ffffff");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Inizializzazione sicura (legge da localStorage se presente, altrimenti default)
  const [mode, setModeState] = useState<ThemeMode>("auto");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Lettura iniziale da localStorage al montaggio del client
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;
      if (savedMode === "auto" || savedMode === "light" || savedMode === "dark") {
        setModeState(savedMode);
      }

      const savedCoordsStr = localStorage.getItem(COORDS_KEY);
      if (savedCoordsStr) {
        const parsed = JSON.parse(savedCoordsStr);
        if (
          parsed &&
          typeof parsed.latitude === "number" &&
          typeof parsed.longitude === "number"
        ) {
          setCoords(parsed);
        }
      }
    } catch {
      // Ignora errori di parsing o localStorage disabilitato
    }
  }, []);

  // Calcola alba e tramonto attuali se le coordinate sono salvate
  const sunTimes = useMemo<SolarTimes | null>(() => {
    if (!coords) return null;
    return getSunTimes(new Date(), coords.latitude, coords.longitude);
  }, [coords]);

  // Aggiorna il tema effettivo applicando la classe CSS all'elemento html
  const updateResolvedTheme = useCallback(() => {
    const current = resolveTheme(mode, coords, new Date());
    setResolvedTheme(current);
    applyThemeClass(current);
  }, [mode, coords]);

  // Aggiorna immediatamente quando cambiano mode o coordinate
  useEffect(() => {
    updateResolvedTheme();
  }, [updateResolvedTheme]);

  // Timer per aggiornare il tema mentre l'app rimane aperta (cambio giorno/notte)
  useEffect(() => {
    if (mode !== "auto") return;

    // Controlla ogni 30 secondi
    const interval = setInterval(() => {
      updateResolvedTheme();
    }, 30000);

    // Controlla al ritorno dell'utente sulla scheda/app
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateResolvedTheme();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mode, updateResolvedTheme]);

  // Modifica della modalità scelta dall'utente
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(THEME_MODE_KEY, newMode);
    } catch {}
  }, []);

  // Richiesta esplicita della geolocalizzazione (SOLO su azione utente in Impostazioni)
  const requestLocation = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      setLocationMessage({
        type: "error",
        text: "Geolocalizzazione non supportata dal tuo browser.",
      });
      return false;
    }

    setLocationLoading(true);
    setLocationMessage(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoords: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            updatedAt: new Date().toISOString(),
          };
          setCoords(newCoords);
          try {
            localStorage.setItem(COORDS_KEY, JSON.stringify(newCoords));
          } catch {}

          const times = getSunTimes(
            new Date(),
            newCoords.latitude,
            newCoords.longitude
          );
          let detail = "Posizione rilevata con successo!";
          if (times.sunrise && times.sunset) {
            const sr = `${String(times.sunrise.getHours()).padStart(2, "0")}:${String(
              times.sunrise.getMinutes()
            ).padStart(2, "0")}`;
            const ss = `${String(times.sunset.getHours()).padStart(2, "0")}:${String(
              times.sunset.getMinutes()
            ).padStart(2, "0")}`;
            detail = `Posizione aggiornata! Alba: ${sr}, Tramonto: ${ss}`;
          }

          setLocationMessage({
            type: "success",
            text: detail,
          });
          setLocationLoading(false);
          resolve(true);
        },
        (error) => {
          let errorMsg = "Impossibile rilevare la posizione.";
          if (error.code === error.PERMISSION_DENIED) {
            errorMsg =
              "Permesso di localizzazione negato. Verrà utilizzato l'orario predefinito 07:00 – 19:00.";
          } else if (error.code === error.TIMEOUT) {
            errorMsg =
              "Tempo scaduto per il rilevamento della posizione. Riprova più tardi.";
          }
          setLocationMessage({
            type: "error",
            text: errorMsg,
          });
          setLocationLoading(false);
          resolve(false);
        },
        { timeout: 10000, maximumAge: 3600000 }
      );
    });
  }, []);

  const clearLocationMessage = useCallback(() => {
    setLocationMessage(null);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        resolvedTheme,
        coords,
        sunTimes,
        locationLoading,
        locationMessage,
        setMode,
        requestLocation,
        clearLocationMessage,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve essere utilizzato all'interno di ThemeProvider.");
  }
  return context;
}
