import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";
import { resolveAccent } from "@/config/theme";
import { getCurrentUser } from "@/modules/auth/guard";

export const metadata: Metadata = {
  title: { default: "SDR Fey", template: "%s · SDR Fey" },
  description: "Sorteio e acompanhamento de leads",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Aplica o tema antes da primeira pintura para não piscar branco no modo noturno.
const themeScript = `try{var t=localStorage.getItem('theme');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const accent = resolveAccent(user?.accent, user?.roles ?? ["user"]);

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      style={{ "--accent": accent.hex, "--on-accent": accent.onAccent } as CSSProperties}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
