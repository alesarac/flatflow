import type { Config } from "tailwindcss";
import { colors } from "./src/lib/theme/colors";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 1. Identità visiva e brand FlatLoop (Verde Petrolio)
        brand: colors.brand,

        // 2. Azioni & Bottoni operativi (Blu Ardesia)
        action: {
          DEFAULT: colors.action.primary.DEFAULT,
          hover: colors.action.primary.hover,
          active: colors.action.primary.active,
          text: colors.action.primary.text,
          secondary: colors.action.secondary.DEFAULT,
          "secondary-hover": colors.action.secondary.hover,
          "secondary-text": colors.action.secondary.text,
          "secondary-darkBg": colors.action.secondary.darkBg,
          "secondary-darkHover": colors.action.secondary.darkHover,
          "secondary-darkText": colors.action.secondary.darkText,
        },

        // 3. Stati delle schede attività (Pulizie e Spazzatura)
        status: {
          "success-bg": colors.status.success.bg,
          "success-border": colors.status.success.border,
          "success-accent": colors.status.success.accent,
          "success-darkBg": colors.status.success.darkBg,
          "success-darkBorder": colors.status.success.darkBorder,

          "info-bg": colors.status.info.bg,
          "info-border": colors.status.info.border,
          "info-accent": colors.status.info.accent,
          "info-darkBg": colors.status.info.darkBg,
          "info-darkBorder": colors.status.info.darkBorder,

          "warning-bg": colors.status.warning.bg,
          "warning-border": colors.status.warning.border,
          "warning-accent": colors.status.warning.accent,
          "warning-darkBg": colors.status.warning.darkBg,
          "warning-darkBorder": colors.status.warning.darkBorder,

          "danger-bg": colors.status.danger.bg,
          "danger-border": colors.status.danger.border,
          "danger-accent": colors.status.danger.accent,
          "danger-darkBg": colors.status.danger.darkBg,
          "danger-darkBorder": colors.status.danger.darkBorder,
        },

        // 4. Storico
        history: {
          bg: colors.history.bg,
          border: colors.history.border,
          darkBg: colors.history.darkBg,
          darkBorder: colors.history.darkBorder,
        },

        // 5. Toni scuri e superfici specifiche
        slate: {
          850: colors.history.darkBg,
        },
      },
    },
  },
  plugins: [],
};

export default config;
