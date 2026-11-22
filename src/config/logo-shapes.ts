/**
 * Geometria da logo animada (FEY ⇄ SDR). Sem React nem DOM: só números, para testar e reaproveitar.
 * Os dois logos ocupam o mesmo quadrado 1248×1248 e são desenhados como uma única forma (sem linhas entre as peças).
 */
export type Rect = { x: number; y: number; w: number; h: number };
export type LogoAnim = "morph" | "wave";
export const BOX = 1248;
const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** Marca da FEY: peças originais; só a altura é esticada 4,3% para fechar o quadrado perfeito (1197 → 1248). */
const K = BOX / 1197;
export const FEY: Rect[] = ([[0, 90, 1248, 108], [0, 198, 108, 1089], [216, 306, 1032, 108], [216, 523, 108, 547], [324, 523, 383, 108], [324, 740, 383, 109], [324, 957, 383, 113], [815, 525, 108, 443], [815, 968, 324, 102], [1139, 525, 109, 654], [216, 1179, 1032, 108]] as const).map(([x, y, w, h]) => R(x, (y - 90) * K, w, h * K));

/**
 * SDR: um S feito de dois colchetes que se encaixam (“[” em cima à esquerda, “]” embaixo à direita, unidos pela barra do meio),
 * com o D grande no vão de cima e o R grande no vão de baixo. Grade de 13×13, tudo com o mesmo traço (96, perto dos 108 da FEY).
 */
const G = BOX / 13;
const g = (a: number[][]) => a.map(([c, r, w, h]) => R(c * G, r * G, w * G, h * G));
export const SDR: Rect[] = g([
  [0, 0, 5, 1], [0, 1, 1, 5], [0, 6, 13, 1], [12, 7, 1, 5], [8, 12, 4, 1],              // S: braço de cima, coluna, barra do meio, coluna, braço de baixo
  [6, 0, 1, 5], [7, 0, 5, 1], [7, 4, 5, 1], [12, 1, 1, 3],                                // D
  [0, 8, 1, 5], [1, 8, 6, 1], [6, 9, 1, 1], [1, 10, 6, 1], [5, 11, 1, 1], [6, 12, 1, 1], // R
]);

const SLOTS = 16;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const cl = (t: number) => Math.max(0, Math.min(1, t));
const cx = (r: Rect): [number, number] => [r.x + r.w / 2, r.y + r.h / 2];
const d2 = (a: Rect, b: Rect) => { const [p, q] = cx(a), [s, t] = cx(b); return (p - s) ** 2 + (q - t) ** 2; };

/** Liga cada peça à mais próxima do destino; as que sobram encolhem (ou nascem) no lugar certo. */
export function plan(from: Rect[], to: Rect[]): [Rect[], Rect[]] {
  const F = from.map((r) => ({ ...r })), pairs: [number, number, number][] = [];
  F.forEach((f, i) => { if (f.w * f.h > 0) to.forEach((v, j) => pairs.push([d2(f, v), i, j])); });
  pairs.sort((a, b) => a[0] - b[0]);
  const out: (Rect | null)[] = Array(F.length).fill(null), uF = new Set<number>(), uV = new Set<number>();
  for (const [, i, j] of pairs) { if (uF.has(i) || uV.has(j)) continue; uF.add(i); uV.add(j); out[i] = to[j]; }
  F.forEach((f, i) => { if (f.w * f.h > 0 && !uF.has(i)) { let b = to[0]; to.forEach((v) => { if (d2(f, v) < d2(f, b)) b = v; }); const [p, q] = cx(b); out[i] = R(p, q, 0, 0); } });
  const left = to.map((_, j) => j).filter((j) => !uV.has(j));
  for (let i = 0; i < F.length && left.length; i++) if (!out[i]) { const j = left.shift()!; out[i] = to[j]; const [p, q] = cx(to[j]); F[i] = R(p, q, 0, 0); }
  for (let i = 0; i < F.length; i++) if (!out[i]) { const [p, q] = cx(F[i]); out[i] = R(p, q, 0, 0); }
  return [F, out as Rect[]];
}
const padTo = (a: Rect[]) => { const o = a.map((r) => ({ ...r })); while (o.length < SLOTS) o.push(R(0, 0, 0, 0)); return o; };
const PL = { fs: plan(padTo(FEY), SDR) as [Rect[], Rect[]], sf: null as unknown as [Rect[], Rect[]] };
PL.sf = plan(PL.fs[1], FEY);
const lerp = (a: Rect, b: Rect, p: number) => R(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, a.w + (b.w - a.w) * p, a.h + (b.h - a.h) * p);

function morph(fw: boolean, p: number): Rect[] {
  const [A, B] = fw ? PL.fs : PL.sf;
  return A.map((a, i) => lerp(a, B[i], ease(cl((p - i * 0.015) / 0.7))));
}
function wave(fw: boolean, p: number): Rect[] {
  const from = fw ? FEY : SDR, to = fw ? SDR : FEY;
  const sc = (r: Rect, s: number) => { const [x, y] = cx(r); return R(x - (r.w * s) / 2, y - (r.h * s) / 2, r.w * s, r.h * s); };
  const dly = (r: Rect) => { const [x, y] = cx(r); return ((x + y) / (2 * BOX)) * 0.3; };
  const a = from.map((r) => sc(r, 1 - ease(cl((p - dly(r)) / 0.4))));
  const b = to.map((r) => sc(r, ease(cl((p - 0.5 - dly(r)) / 0.4))));
  return [...a, ...b].filter((r) => r.w * r.h > 0);
}

/** Tempos (ms) por ritmo: 0 calmo, 1 normal, 2 ágil. */
export const PACES = [{ hold: 1400, move: 2600 }, { hold: 1000, move: 2000 }, { hold: 700, move: 1400 }] as const;

/** Peças do logo no instante `ms` (ciclo FEY → SDR → FEY, sem parar). */
export function logoFrame(ms: number, kind: LogoAnim, pace = 1): Rect[] {
  const { hold, move } = PACES[pace] ?? PACES[1], tt = 2 * (hold + move);
  const t = ((ms % tt) + tt) % tt, fw = t < tt / 2, tl = fw ? t : t - tt / 2;
  if (tl < hold) return fw ? FEY : SDR;
  const p = cl((tl - hold) / move);
  if (p >= 1) return fw ? SDR : FEY;
  return kind === "wave" ? wave(fw, p) : morph(fw, p);
}

/** Uma única forma: todas as peças no mesmo caminho (não aparecem fios entre elas) e 0,4 de sobreposição. */
export function rectsPath(rs: Rect[]): string {
  return rs.filter((r) => r.w * r.h > 0.5).map((r) => { const e = 0.4, x = r.x - e, y = r.y - e, w = r.w + 2 * e, h = r.h + 2 * e; return `M${x.toFixed(1)} ${y.toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h${(-w).toFixed(1)}z`; }).join("");
}
export const FEY_PATH = rectsPath(FEY);
