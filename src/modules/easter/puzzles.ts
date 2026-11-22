import "server-only";
import { createHmac } from "node:crypto";
import { EGG_COLORS } from "@/config/egg";

export const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/** As provas (todas fáceis). A cada tentativa sorteamos 5, em ordem aleatória, cada uma com palavras, números e cores novos. */
export const EGG_KINDS = ["simon", "cipher", "hold", "order", "seq", "odd", "count", "color"] as const;
export type EggKind = (typeof EGG_KINDS)[number];
const WORDS = ["FOGO", "LUA", "MESA", "BOLA", "SOL", "CASA", "OURO", "TREM", "LIVRO", "PEDRA", "MAR", "CAFE", "NUVEM", "VENTO", "GATO", "FLOR", "ROSA", "PRATA", "CHAVE", "PONTE", "TIGRE", "LAGO"];
const ODD_PAIRS = [["🍎", "🍅"], ["🐶", "🐺"], ["⭐", "🌟"], ["🌕", "🌝"], ["🍋", "🌽"], ["🐱", "🐯"], ["🔔", "🛎️"], ["🍩", "🧿"]] as const;

/** A resposta certa nunca vai para o navegador: no token vai só o carimbo (HMAC) dela, amarrado à pessoa e à etapa. */
type Round = { data: unknown; answer: unknown; min: number };
export function make(kind: EggKind): Round {
  switch (kind) {
    case "simon": { const pattern = Array.from({ length: rnd(4, 5) }, () => rnd(0, 3)); return { data: pattern, answer: pattern, min: 4 }; }
    case "cipher": { const word = pick(WORDS), shift = rnd(1, 3); const text = word.replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + shift) % 26) + 65)); return { data: { text, shift }, answer: word, min: 2 }; }
    case "hold": { const ms = rnd(20, 38) * 100; return { data: { ms }, answer: "held", min: ms / 1000 - 0.3 }; }
    case "order": { const nums = shuffle(Array.from({ length: 60 }, (_, i) => i + 1)).slice(0, 5); const dir = pick(["asc", "desc"] as const); return { data: { nums, dir }, answer: [...nums].sort((a, b) => (dir === "asc" ? a - b : b - a)), min: 1.5 }; }
    case "seq": {
      const d = rnd(2, 6), a = rnd(1, 12), hole = rnd(1, 4), full = Array.from({ length: 6 }, (_, i) => a + d * i), ans = full[hole];
      const opts = shuffle([...new Set([ans, ans + d, ans - d, ans + 1, ans - 1, ans + 2 * d])].filter((x) => x > 0)).slice(0, 5);
      if (!opts.includes(ans)) opts[0] = ans;
      return { data: { shown: full.map((v, i) => (i === hole ? null : v)), options: shuffle(opts) }, answer: ans, min: 1 };
    }
    case "odd": { const [base, odd] = pick(ODD_PAIRS), at = rnd(0, 15); return { data: { cells: Array.from({ length: 16 }, (_, i) => (i === at ? odd : base)) }, answer: at, min: 1 }; }
    case "count": { const n = rnd(3, 8); return { data: { n, options: shuffle([...new Set([n, n - 1, n + 1, n + 2, n - 2])].filter((x) => x > 0)).slice(0, 4).concat([]) }, answer: n, min: 3 }; }
    case "color": { const ink = pick(EGG_COLORS), word = pick(EGG_COLORS.filter((c) => c.key !== ink.key)); return { data: { word: word.name, ink: ink.hex, options: shuffle(EGG_COLORS.map((c) => c.key)) }, answer: ink.key, min: 1 }; }
  }
}
export const seal = (uid: number, i: number, answer: unknown) => createHmac("sha256", process.env.SESSION_SECRET || "chave-somente-para-desenvolvimento").update(`${uid}:${i}:${JSON.stringify(answer)}`).digest("hex");

