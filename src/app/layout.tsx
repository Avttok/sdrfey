import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/lexend";
import "./globals.css";
import { fontCss } from "@/config/fonts";
import { resolveAccent } from "@/config/theme";
import { getCurrentUser } from "@/modules/auth/guard";

export const metadata: Metadata = {
  title: { default: "SDR", template: "SDR - %s" },
  description: "Sorteio e acompanhamento de leads",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Aplica o tema antes da primeira pintura para não piscar branco no modo noturno.
const themeScript = `try{var t=localStorage.getItem('theme');var d=t==='dark';document.documentElement.classList.toggle('dark',d)}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const accent = resolveAccent(user?.accent, user?.roles ?? ["user"]);

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      style={{ "--accent": accent.hex, "--on-accent": accent.onAccent, "--app-font": fontCss(user?.font) } as CSSProperties}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
