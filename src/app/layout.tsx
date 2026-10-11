import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "../lib/theme/ThemeContext";

export const metadata: Metadata = {
  title: "FlatLoop — Pulizie, spesa e turni",
  description: "Web app mobile-first per la gestione condivisa di pulizie, spazzatura e lista della spesa",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FlatLoop",
  },
  icons: {
    icon: [
      { url: "/icons/flatloop-192.svg", type: "image/svg+xml" },
      { url: "/icons/flatloop-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/flatloop-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F766E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var mode = localStorage.getItem('flatloop_theme_mode') || 'auto';
    var isDark = true;
    if (mode === 'light') {
      isDark = false;
    } else if (mode === 'dark') {
      isDark = true;
    } else {
      var coordsStr = localStorage.getItem('flatloop_coords');
      var now = new Date();
      var isDay = false;
      if (coordsStr) {
        try {
          var c = JSON.parse(coordsStr);
          if (c && typeof c.latitude === 'number' && typeof c.longitude === 'number') {
            var d = now;
            var N = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
            var lngH = c.longitude / 15;
            function cTime(isRise) {
              var t = isRise ? N + ((6 - lngH)/24) : N + ((18 - lngH)/24);
              var M = (0.9856 * t) - 3.289;
              var Mr = M * Math.PI / 180;
              var L = (M + 1.916 * Math.sin(Mr) + 0.02 * Math.sin(2 * Mr) + 282.634) % 360;
              if (L < 0) L += 360;
              var RA = (Math.atan(0.91764 * Math.tan(L * Math.PI / 180)) * 180 / Math.PI) % 360;
              if (RA < 0) RA += 360;
              RA = (RA + Math.floor(L/90)*90 - Math.floor(RA/90)*90)/15;
              var sinDec = 0.39782 * Math.sin(L * Math.PI / 180);
              var cosDec = Math.cos(Math.asin(sinDec));
              var cosH = (Math.cos(90.833 * Math.PI / 180) - sinDec * Math.sin(c.latitude * Math.PI / 180)) / (cosDec * Math.cos(c.latitude * Math.PI / 180));
              if (cosH > 1 || cosH < -1) return null;
              var H = (isRise ? 360 - Math.acos(cosH)*180/Math.PI : Math.acos(cosH)*180/Math.PI)/15;
              var UT = ((H + RA - 0.06571 * t - 6.622 - lngH) % 24 + 24) % 24;
              return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) + UT * 3600000;
            }
            var sr = cTime(true);
            var ss = cTime(false);
            if (sr && ss) {
              var tNow = d.getTime();
              isDay = (tNow >= sr && tNow < ss);
            } else {
              var h = d.getHours();
              isDay = (h >= 7 && h < 19);
            }
          } else {
            var h = now.getHours();
            isDay = (h >= 7 && h < 19);
          }
        } catch(e) {
          var h = now.getHours();
          isDay = (h >= 7 && h < 19);
        }
      } else {
        var h = now.getHours();
        isDay = (h >= 7 && h < 19);
      }
      isDark = !isDay;
    }
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch(e) {}
})();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white transition-colors duration-200">
        <div className="mx-auto max-w-md min-h-screen flex flex-col relative shadow-2xl bg-white dark:bg-slate-900 border-x border-slate-200/80 dark:border-slate-800/80 transition-colors duration-200">
          <ThemeProvider>{children}</ThemeProvider>
        </div>
      </body>
    </html>
  );
}
