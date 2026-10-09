import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flatflow — Pulizie e Spazzatura",
  description: "Lavagna digitale per le pulizie e la spazzatura in una casa di tre coinquilini",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Flatflow",
  },
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        <main className="mx-auto max-w-md min-h-screen flex flex-col relative pb-24 shadow-2xl bg-slate-900 border-x border-slate-800/80">
          {children}
        </main>
      </body>
    </html>
  );
}
