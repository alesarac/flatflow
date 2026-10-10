export type ThemeMode = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export interface Coordinates {
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export interface SolarTimes {
  sunrise: Date | null;
  sunset: Date | null;
}

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function rad2deg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Calcola l'ora locale di alba e tramonto tramite algoritmo solare NOAA.
 * Non richiede connessioni di rete, API esterne o servizi a pagamento.
 */
export function getSunTimes(date: Date, lat: number, lng: number): SolarTimes {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    isNaN(lat) ||
    isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return { sunrise: null, sunset: null };
  }

  const zenith = 90.833; // Zenith astronomico ufficiale (include rifrazione atmosferica)
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const N = Math.floor(
    (Date.UTC(year, month, day) - Date.UTC(year, 0, 0)) / 86400000
  );
  const lngHour = lng / 15;

  function calcTime(isSunrise: boolean): Date | null {
    const t = isSunrise ? N + ((6 - lngHour) / 24) : N + ((18 - lngHour) / 24);
    const M = 0.9856 * t - 3.289;
    const Mrad = deg2rad(M);
    let L = M + 1.916 * Math.sin(Mrad) + 0.02 * Math.sin(2 * Mrad) + 282.634;
    L = ((L % 360) + 360) % 360;

    let RA = rad2deg(Math.atan(0.91764 * Math.tan(deg2rad(L))));
    RA = ((RA % 360) + 360) % 360;
    const Lquadrant = Math.floor(L / 90) * 90;
    const RAquadrant = Math.floor(RA / 90) * 90;
    RA = (RA + (Lquadrant - RAquadrant)) / 15;

    const sinDec = 0.39782 * Math.sin(deg2rad(L));
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH =
      (Math.cos(deg2rad(zenith)) - sinDec * Math.sin(deg2rad(lat))) /
      (cosDec * Math.cos(deg2rad(lat)));

    // Notte polare (cosH > 1) o sole di mezzanotte (cosH < -1)
    if (cosH > 1 || cosH < -1) {
      return null;
    }

    const H = isSunrise ? 360 - rad2deg(Math.acos(cosH)) : rad2deg(Math.acos(cosH));
    const Hhour = H / 15;
    const T = Hhour + RA - 0.06571 * t - 6.622;
    let UT = T - lngHour;
    UT = ((UT % 24) + 24) % 24;

    const utcMidnight = Date.UTC(year, month, day);
    return new Date(utcMidnight + UT * 3600 * 1000);
  }

  return {
    sunrise: calcTime(true),
    sunset: calcTime(false),
  };
}

/**
 * Determina se al momento specificato è giorno o notte:
 * - Se le coordinate sono disponibili: usa alba e tramonto calcolati astronomicamente.
 * - In assenza di coordinate: fallback giorno dalle 07:00 alle 19:00 (ora locale).
 */
export function isDaytime(now: Date, coords: Coordinates | null): boolean {
  if (coords && typeof coords.latitude === "number" && typeof coords.longitude === "number") {
    const sun = getSunTimes(now, coords.latitude, coords.longitude);
    if (sun.sunrise && sun.sunset) {
      const nowMs = now.getTime();
      return nowMs >= sun.sunrise.getTime() && nowMs < sun.sunset.getTime();
    }
  }

  // Fallback senza geolocalizzazione: giorno dalle 07:00 alle 19:00 ora locale
  const hours = now.getHours();
  return hours >= 7 && hours < 19;
}

/**
 * Risolve il tema effettivo ("light" | "dark") in base alla preferenza utente,
 * alle coordinate e alla data/ora corrente.
 */
export function resolveTheme(
  mode: ThemeMode,
  coords: Coordinates | null,
  now: Date = new Date()
): ResolvedTheme {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return isDaytime(now, coords) ? "light" : "dark";
}

/**
 * Formatta un orario per la visualizzazione nelle impostazioni (es. "07:16").
 */
export function formatSunTime(date: Date | null): string {
  if (!date) return "--:--";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
