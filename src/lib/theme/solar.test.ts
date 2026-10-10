import { describe, it, expect } from "vitest";
import {
  getSunTimes,
  isDaytime,
  resolveTheme,
  formatSunTime,
  Coordinates,
} from "./solar";

describe("solar calculations and theme resolution", () => {
  // Coordinate Roma (41.9028, 12.4964)
  const romeCoords: Coordinates = {
    latitude: 41.9028,
    longitude: 12.4964,
    updatedAt: "2026-10-10T00:00:00.000Z",
  };

  describe("getSunTimes", () => {
    it("calcola correttamente alba e tramonto per il solstizio d'estate", () => {
      const summerDate = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
      const times = getSunTimes(summerDate, romeCoords.latitude, romeCoords.longitude);

      expect(times.sunrise).not.toBeNull();
      expect(times.sunset).not.toBeNull();

      // Nel solstizio estivo a Roma l'alba è intorno alle 03:30 UTC (~05:30 locali)
      const sunriseUtcHours = times.sunrise!.getUTCHours();
      expect(sunriseUtcHours).toBe(3);

      // Il tramonto è intorno alle 18:45 UTC (~20:45 locali)
      const sunsetUtcHours = times.sunset!.getUTCHours();
      expect(sunsetUtcHours).toBe(18);
    });

    it("calcola correttamente alba e tramonto per il solstizio d'inverno", () => {
      const winterDate = new Date(Date.UTC(2026, 11, 21, 12, 0, 0));
      const times = getSunTimes(winterDate, romeCoords.latitude, romeCoords.longitude);

      expect(times.sunrise).not.toBeNull();
      expect(times.sunset).not.toBeNull();

      // Nel solstizio invernale a Roma l'alba è intorno alle 06:30 UTC (~07:30 locali)
      const sunriseUtcHours = times.sunrise!.getUTCHours();
      expect(sunriseUtcHours).toBe(6);

      // Il tramonto è intorno alle 15:40 UTC (~16:40 locali)
      const sunsetUtcHours = times.sunset!.getUTCHours();
      expect(sunsetUtcHours).toBe(15);
    });

    it("gestisce coordinate non valide senza lanciare eccezioni", () => {
      expect(getSunTimes(new Date(), NaN, 12)).toEqual({ sunrise: null, sunset: null });
      expect(getSunTimes(new Date(), 95, 12)).toEqual({ sunrise: null, sunset: null });
      expect(getSunTimes(new Date(), 41, 200)).toEqual({ sunrise: null, sunset: null });
    });
  });

  describe("isDaytime con coordinate", () => {
    it("riconosce il giorno tra alba e tramonto calcolati", () => {
      const date = new Date(Date.UTC(2026, 9, 10, 12, 0, 0)); // Mezzogiorno UTC
      expect(isDaytime(date, romeCoords)).toBe(true);
    });

    it("riconosce la notte prima dell'alba o dopo il tramonto", () => {
      const night = new Date(Date.UTC(2026, 9, 10, 23, 0, 0)); // Notte fonda
      expect(isDaytime(night, romeCoords)).toBe(false);

      const earlyMorning = new Date(Date.UTC(2026, 9, 10, 3, 0, 0)); // 03:00 UTC (prima dell'alba)
      expect(isDaytime(earlyMorning, romeCoords)).toBe(false);
    });
  });

  describe("isDaytime fallback (senza coordinate)", () => {
    it("usa le 07:00 - 19:00 locali come giorno", () => {
      const morning = new Date();
      morning.setHours(7, 0, 0, 0);
      expect(isDaytime(morning, null)).toBe(true);

      const afternoon = new Date();
      afternoon.setHours(18, 59, 59, 999);
      expect(isDaytime(afternoon, null)).toBe(true);
    });

    it("usa gli orari al di fuori di 07:00 - 19:00 come notte", () => {
      const before7 = new Date();
      before7.setHours(6, 59, 59, 999);
      expect(isDaytime(before7, null)).toBe(false);

      const at19 = new Date();
      at19.setHours(19, 0, 0, 0);
      expect(isDaytime(at19, null)).toBe(false);

      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      expect(isDaytime(midnight, null)).toBe(false);
    });
  });

  describe("resolveTheme", () => {
    it("rispetta la scelta forzata Chiaro / Scuro indipendentemente dall'orario", () => {
      const day = new Date();
      day.setHours(12, 0, 0, 0);
      const night = new Date();
      night.setHours(23, 0, 0, 0);

      expect(resolveTheme("light", romeCoords, night)).toBe("light");
      expect(resolveTheme("dark", romeCoords, day)).toBe("dark");
    });

    it("in modalità 'auto' segue giorno/notte solare se con coordinate", () => {
      const midday = new Date(Date.UTC(2026, 9, 10, 12, 0, 0));
      expect(resolveTheme("auto", romeCoords, midday)).toBe("light");

      const midnight = new Date(Date.UTC(2026, 9, 10, 23, 0, 0));
      expect(resolveTheme("auto", romeCoords, midnight)).toBe("dark");
    });

    it("in modalità 'auto' segue il fallback orario se senza coordinate", () => {
      const time10 = new Date();
      time10.setHours(10, 0, 0, 0);
      expect(resolveTheme("auto", null, time10)).toBe("light");

      const time22 = new Date();
      time22.setHours(22, 0, 0, 0);
      expect(resolveTheme("auto", null, time22)).toBe("dark");
    });
  });

  describe("formatSunTime", () => {
    it("formatta correttamente l'ora a due cifre", () => {
      const d = new Date();
      d.setHours(7, 5, 0, 0);
      expect(formatSunTime(d)).toBe("07:05");
      expect(formatSunTime(null)).toBe("--:--");
    });
  });
});
