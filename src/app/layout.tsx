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
import { LogoCfgProvider } from "@/components/logo-morph";
import { BootSplash } from "@/components/boot-splash";
import { getSettings } from "@/modules/settings/get";

export const metadata: Metadata = {
  title: { default: "SDR", template: "SDR - %s" },
  description: "Sorteio e acompanhamento de leads",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Aplica o tema antes da primeira pintura para não piscar branco no modo noturno.
const themeScript = `try{var t=localStorage.getItem('theme');var d=t==='dark';document.documentElement.classList.toggle('dark',d)}catch(e){}try{if(window.top!==window.self)document.documentElement.classList.add('embed')}catch(e){document.documentElement.classList.add('embed')}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const cfg = await getSettings();
  const accent = resolveAccent(user?.accent, user?.roles ?? ["user"]);

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      style={{ "--accent": accent.hex, "--accent-2": accent.hex2 ?? `color-mix(in oklab, ${accent.hex} 78%, black)`, "--on-accent": accent.onAccent, "--app-font": fontCss(user?.font) } as CSSProperties}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body><LogoCfgProvider cfg={{ anim: cfg.logo_anim, pace: cfg.logo_pace, text: cfg.logo_text }}><BootSplash />{children}</LogoCfgProvider></body>
    </html>
  );
}
