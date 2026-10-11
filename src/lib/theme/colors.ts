/**
 * ==============================================================================
 * FLATLOOP — CONFIGURAZIONE CENTRALIZZATA DEI COLORI
 * ==============================================================================
 * Questo file è l'UNICO punto di configurazione di TUTTI i colori dell'applicazione.
 *
 * Tutte le componenti dell'interfaccia, il tema Tailwind, i metadati della PWA
 * e le modalità chiaro/scuro fanno capo alle definizioni contenute in questo file.
 *
 * Per modificare o personalizzare l'aspetto visivo di FlatLoop, modifica
 * i valori esadecimali o rgba qui sotto: le modifiche si propagheranno
 * automaticamente in tutta l'applicazione.
 * ==============================================================================
 */

export const colors = {
  // ----------------------------------------------------------------------------
  // 1. BRAND & IDENTITÀ VISIVA (FlatLoop Verde Petrolio)
  // ----------------------------------------------------------------------------
  brand: {
    // Colore primario FlatLoop (logo nell'header, accenti principali, tab attiva)
    DEFAULT: "#0F766E",
    // Stato hover sui bottoni del brand (es. pulsante "+" lista della spesa)
    hover: "#115E59",
    // Stato attivo / click su elementi del brand
    active: "#134E4A",
    // Sfondo chiaro pastello (badge, pulsanti secondari brand, pillola attiva)
    light: "#F0FDFA",
    // Hover sullo sfondo chiaro
    lightHover: "#CCFBF1",
    // Bordo leggero per badge ed elementi brand chiari
    lightBorder: "#99F6E4",
    // Accento chiaro per il tema scuro (testo logo, icone in dark mode con contrasto elevato)
    dark: "#2DD4BF",
    // Hover per elementi brand in tema scuro
    darkHover: "#5EEAD4",
    // Sfondo per tab attiva o pillole in tema scuro
    darkBg: "rgba(19, 78, 74, 0.4)",
    // Bordo per elementi brand in tema scuro
    darkBorder: "rgba(45, 212, 191, 0.2)",
  },

  // ----------------------------------------------------------------------------
  // 2. AZIONI E BOTTONI OPERATIVI (Blu Ardesia Elegante)
  // ----------------------------------------------------------------------------
  action: {
    // Azione principale ("Ho pulito", "Ho buttato", "Salva modifiche", profilo attivo)
    primary: {
      DEFAULT: "#365672",
      hover: "#2C475E",
      active: "#243A4D",
      text: "#FFFFFF",
    },
    // Azione secondaria / volontaria ("Me ne occupo io", bottoni secondari)
    secondary: {
      DEFAULT: "#EDF2F7",
      hover: "#E2E8F0",
      text: "#365672",
      darkBg: "#1E293B",
      darkHover: "#334155",
      darkText: "#E2E8F0",
    },
  },

  // ----------------------------------------------------------------------------
  // 3. STATI DELLE ATTIVITÀ (Schede Pulizie e Turni Spazzatura)
  // ----------------------------------------------------------------------------
  status: {
    // Completato (Verde pastello menta)
    success: {
      bg: "#EAF9F1",
      border: "#C6EED8",
      accent: "#10B981",
      darkBg: "rgba(6, 78, 59, 0.2)",
      darkBorder: "rgba(6, 95, 70, 0.4)",
    },
    // In corso / Da fare (Azzurro pastello)
    info: {
      bg: "#EFF6FF",
      border: "#D9E7F5",
      accent: "#3B82F6",
      darkBg: "rgba(23, 37, 84, 0.2)",
      darkBorder: "rgba(30, 58, 138, 0.4)",
    },
    // Da coprire / Rinuncia coinquilino (Giallo pastello ambra)
    warning: {
      bg: "#FFFAE8",
      border: "#F5E9B7",
      accent: "#F59E0B",
      darkBg: "rgba(69, 26, 3, 0.2)",
      darkBorder: "rgba(120, 53, 15, 0.4)",
    },
    // Spazzatura piena / Urgente (Rosa pastello)
    danger: {
      bg: "#FFF1F2",
      border: "#FECDD3",
      accent: "#EF4444",
      darkBg: "rgba(76, 5, 25, 0.2)",
      darkBorder: "rgba(136, 19, 55, 0.4)",
    },
  },

  // ----------------------------------------------------------------------------
  // 4. STORICO ATTIVITÀ (Cronologia e schede attività passate)
  // ----------------------------------------------------------------------------
  history: {
    bg: "#F4F7FB",
    border: "#E2E8F0",
    darkBg: "#172033",
    darkBorder: "#1E293B",
  },

  // ----------------------------------------------------------------------------
  // 5. SUPERFICI, SFONDI E CONTENITORI
  // ----------------------------------------------------------------------------
  surface: {
    // Sfondo principale dell'app
    bgLight: "#F8FAFC",
    bgDark: "#090D16",
    // Sfondo per card e contenitori
    cardLight: "#FFFFFF",
    cardDark: "#1E293B",
    // Header e navigazione inferiore con sfocatura
    headerLight: "rgba(255, 255, 255, 0.95)",
    headerDark: "rgba(15, 23, 42, 0.95)",
    // Bordi generici per schede e divisori
    borderLight: "#E2E8F0",
    borderDark: "#334155",
  },

  // ----------------------------------------------------------------------------
  // 6. TESTI E TIPOGRAFIA
  // ----------------------------------------------------------------------------
  text: {
    light: {
      primary: "#0F172A",
      muted: "#64748B",
      subtle: "#94A3B8",
    },
    dark: {
      primary: "#F8FAFC",
      muted: "#94A3B8",
      subtle: "#64748B",
    },
  },
} as const;

export type ThemeColors = typeof colors;
