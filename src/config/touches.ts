/** Contatos feitos (ligação, WhatsApp, e-mail) e os resultados possíveis de cada um. Sem banco: navegador e servidor usam. */
export type TouchChannel = "call" | "whatsapp" | "email";
export type Outcome = { key: string; label: string; hint?: string; /** foi falado/respondido por alguém: pergunta com quem */ reached?: boolean; /** o número/e-mail não serve */ wrong?: boolean; tone: "ok" | "warn" | "bad" | "info" };

export const CHANNELS: Record<TouchChannel, { label: string; verb: string; question: string; outcomes: Outcome[] }> = {
  call: {
    label: "Ligação", verb: "Ligou para", question: "Como foi a ligação?",
    outcomes: [
      { key: "atendeu", label: "Falei com o contato", hint: "Atendeu e conversamos", reached: true, tone: "ok" },
      { key: "recado", label: "Outra pessoa atendeu", hint: "Deixei recado ou me passaram outro contato", reached: true, tone: "info" },
      { key: "nao_atendeu", label: "Não atendeu", tone: "warn" },
      { key: "caixa_postal", label: "Caixa postal", tone: "warn" },
      { key: "ocupado", label: "Ocupado / caiu", tone: "warn" },
      { key: "numero_errado", label: "Número errado", hint: "Marca o número como inválido", wrong: true, tone: "bad" },
    ],
  },
  whatsapp: {
    label: "WhatsApp", verb: "Enviou WhatsApp para", question: "O que aconteceu com a mensagem?",
    outcomes: [
      { key: "respondeu", label: "Respondeu", reached: true, tone: "ok" },
      { key: "recebida", label: "Recebida, sem resposta", hint: "Chegou (visto/entregue)", tone: "info" },
      { key: "ignorada", label: "Ignorada", hint: "Sem visualização nem resposta", tone: "warn" },
      { key: "sem_whatsapp", label: "Sem WhatsApp", hint: "Marca o número como inválido", wrong: true, tone: "bad" },
    ],
  },
  email: {
    label: "E-mail", verb: "Enviou e-mail para", question: "O que aconteceu com o e-mail?",
    outcomes: [
      { key: "respondeu", label: "Respondeu", reached: true, tone: "ok" },
      { key: "recebido", label: "Recebido, sem resposta", hint: "Abriu ou foi entregue", tone: "info" },
      { key: "ignorado", label: "Ignorado", tone: "warn" },
      { key: "voltou", label: "Voltou (e-mail inválido)", hint: "Marca o e-mail como inválido", wrong: true, tone: "bad" },
    ],
  },
};

export const outcomeOf = (channel: TouchChannel, key: string | null | undefined): Outcome | null => CHANNELS[channel]?.outcomes.find((o) => o.key === key) ?? null;
export const outcomeLabel = (channel: TouchChannel, key: string | null | undefined): string => (key ? outcomeOf(channel, key)?.label ?? key : "Sem resultado");
export const isTouchChannel = (v: unknown): v is TouchChannel => v === "call" || v === "whatsapp" || v === "email";
export const validOutcome = (channel: TouchChannel, key: string): boolean => CHANNELS[channel].outcomes.some((o) => o.key === key);

export type TouchRow = { id: number; channel: TouchChannel; target: string; outcome: string | null; personId: number | null; personName: string | null; note: string | null; durationSec: number | null; at: string; userName: string | null; runId: string | null };
export type TargetStat = { channel: TouchChannel; target: string; attempts: number; lastOutcome: string | null; lastAt: string; reached: number };
