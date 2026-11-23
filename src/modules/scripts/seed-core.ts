import type { ScriptMood, ScriptNode, ScriptOption } from "@/config/scripts";

export type Tipo = "revenda" | "producao" | "servico";
/** O que cada tipo de cliente compra da Fey (fixadores) e o aperto que passa. `dor` completa "não ficar na mão com ___". */
export const SEG: Record<string, { itens: string; um: string; dor: string; tipo: Tipo }> = {
  geral: { itens: "parafusos, porcas e grampos", um: "parafuso", dor: "falta do fixador certo na hora de atender", tipo: "revenda" },
  distribuidor_fixadores: { itens: "parafusos, porcas, arruelas e grampos", um: "parafuso sextavado", dor: "ruptura de estoque nos itens de maior giro", tipo: "revenda" },
  distribuidor_industrial: { itens: "fixadores e componentes de manutenção industrial", um: "parafuso de alta resistência", dor: "cliente industrial esperando um item que faltou", tipo: "revenda" },
  parafusos: { itens: "parafusos, porcas e arruelas", um: "item de giro", dor: "item de maior giro acabando no balcão", tipo: "revenda" },
  ferragens: { itens: "parafusos, porcas, arruelas e fixadores de balcão", um: "parafuso", dor: "cliente de balcão que vai embora porque o item acabou", tipo: "revenda" },
  material_construcao: { itens: "parafusos, buchas e fixadores para obra", um: "parafuso", dor: "obra parada esperando o fixador", tipo: "revenda" },
  ferramentas: { itens: "parafusos, porcas e arruelas de giro rápido", um: "fixador de giro rápido", dor: "item de giro rápido em falta e fornecedor sem suporte", tipo: "revenda" },
  autopecas: { itens: "parafusos, porcas e fixadores automotivos", um: "parafuso de roda", dor: "cliente de oficina esperando uma peça simples", tipo: "revenda" },
  autopecas_atacado: { itens: "fixadores e kits automotivos", um: "kit de fixação", dor: "lojista cobrando por entrega que atrasa", tipo: "revenda" },
  posto_molas: { itens: "grampos de mola, pinos centrais, parafusos e porcas de suspensão", um: "grampo de mola", dor: "caminhão parado esperando grampo ou pino", tipo: "servico" },
  auto_center: { itens: "parafusos e porcas de roda e de suspensão", um: "parafuso de roda", dor: "retrabalho com parafuso que afrouxa ou quebra", tipo: "servico" },
  oficina_pesados: { itens: "fixadores para caminhão e ônibus, como parafusos de roda, grampos e pinos", um: "parafuso de roda", dor: "veículo parado na oficina por falta de fixador", tipo: "servico" },
  concessionaria: { itens: "fixadores de reposição para a oficina", um: "parafuso", dor: "carro parado esperando um parafuso", tipo: "servico" },
  transportadora_frota: { itens: "fixadores de roda, suspensão e carroceria para a frota", um: "parafuso de roda", dor: "caminhão parado na manutenção por falta de fixador", tipo: "servico" },
  implementos: { itens: "parafusos, grampos, pinos e porcas para carretas e implementos", um: "grampo", dor: "montagem parada esperando fixador", tipo: "producao" },
  carrocerias: { itens: "fixadores para carrocerias e ônibus", um: "parafuso", dor: "montagem atrasada por falta de fixador", tipo: "producao" },
  maquinas_agricolas: { itens: "fixadores de alta resistência para máquinas e implementos", um: "parafuso de alta resistência", dor: "máquina parada na safra", tipo: "producao" },
  industria: { itens: "fixadores para manutenção e produção", um: "fixador", dor: "máquina parada por causa de um fixador em falta", tipo: "producao" },
  metalurgica: { itens: "fixadores para montagem e usinagem", um: "fixador", dor: "produção parada esperando fixador", tipo: "producao" },
  serralheria: { itens: "parafusos, porcas e fixadores para estruturas", um: "parafuso", dor: "obra de estrutura atrasada por falta de fixador", tipo: "producao" },
  moveis: { itens: "parafusos e fixadores de montagem", um: "parafuso", dor: "linha de montagem parada por falta de fixador", tipo: "producao" },
  eletro_energia: { itens: "fixadores para estruturas e equipamentos", um: "fixador", dor: "equipamento parado esperando fixador", tipo: "producao" },
  construcao_pesada: { itens: "fixadores de alta resistência para obra e manutenção de máquinas", um: "parafuso de alta resistência", dor: "máquina parada na obra", tipo: "servico" },
};

export const FIRST = "R$ 3.500";
export const NEXT = "R$ 2.500";

/** Uma fala nos três tons: normal, formal e solto. */
export type Tri = { n: string; f: string; s: string };
export type Say = string | Tri;
export const T = (n: string, f: string, s: string): Tri => ({ n, f, s });
const tri = (x: Say): Tri => (typeof x === "string" ? { n: x, f: x, s: x } : x);
/** Aplica uma função de texto a cada tom. */
export const mapT = (x: Say, fn: (t: string) => string): Tri => { const t = tri(x); return { n: fn(t.n), f: fn(t.f), s: fn(t.s) }; };
export const cat = (...xs: Say[]): Tri => ({ n: xs.map((x) => tri(x).n).join(""), f: xs.map((x) => tri(x).f).join(""), s: xs.map((x) => tri(x).s).join("") });

export const o = (label: string, to: string | null, kind: ScriptOption["kind"] = "neutro", note?: string): ScriptOption => ({ label, to, kind, ...(note ? { note } : {}) });
/** Vocativo opcional: com o nome de quem fala, a pergunta vira “…, certo, Carlos?”; sem nome, sai igual. */
const NM = "[[contato?, {contato}|]]";
const CHAMA = /^(conf_(empresa|segmento|negocio|minimo)|enr_|visita|pitch|desc_itens|p_(socio|compras|gestor|operacao|alcada)|fid_nps)/;
const chama = (id: string, say: string) => (CHAMA.test(id) && say.endsWith("?") && !say.includes("{contato}") && !say.includes("[[contato") ? say.slice(0, -1) + NM + "?" : say);

export const fala = (id: string, title: string, say: Say, options: ScriptOption[], tip?: string, mood?: ScriptMood): ScriptNode => {
  const t = tri(say);
  const v = { formal: chama(id, t.f), solto: chama(id, t.s) };
  return { id, type: "fala", title, say: chama(id, t.n), ...(t.f === t.n && t.s === t.n ? {} : { v }), tip, mood, options };
};
export const fim = (id: string, title: string, say: Say, outcome: NonNullable<ScriptNode["outcome"]>): ScriptNode => {
  const t = tri(say);
  return { id, type: "fim", title, say: t.n, ...(t.f === t.n && t.s === t.n ? {} : { v: { formal: t.f, solto: t.s } }), options: [], outcome };
};

/*
 * Base metodológica dos scripts (fontes abertas e testadas em campo):
 * - Gong Labs, 300 milhões de ligações: abertura que dá contexto, assume que é uma ligação fria e pede licença com candura (~11,2%) e a de “já ouviu falar de nós?”
 *   com prova social (~11,2%) superam “como vai o dia?” (7,6%) e “peguei num mau momento?” (2,2%). Declarar o motivo dobra a chance de reunião.
 * - Gong Labs, 519 mil ligações de descoberta: 11 a 14 perguntas dirigidas, espalhadas na conversa, nunca um questionário.
 * - Gong Labs, rapport: quem lidera o ritmo e mantém a postura conquista mais que quem imita o cliente.
 * - Jeb Blount (Fanatical Prospecting / Objections): respostas prontas, esclarecer antes de responder, “manda por e-mail” é tentativa de se livrar,
 *   pedir o próximo passo de novo depois de resolver, e o “não” repetido duas vezes é “não” de verdade.
 * - Mike Weinberg (New Sales. Simplified.): identificar-se, uma frase de credibilidade específica e uma pergunta aberta que faça a pessoa falar; depois, silêncio.
 * - Josh Braun: abordagem sem pressão (“faz sentido ou não?”), dar permissão para dizer não e perguntar o que pesa antes de insistir.
 * - Sandler: contrato inicial (“se não servir, eu mesmo te falo”), funil de dor (um assunto, “me conta mais”, impacto) e negativo reverso.
 * - Chris Voss: rotular a emoção (“parece que...”) e perguntas calibradas (“como”, “o que”) em vez de defender.
 * - BANT e SPIN (Rackham), em versão leve: o nosso negócio é recorrente e transacional.
 * - Recepção (Close, Cognism, Apollo, Spotio): pedir ajuda em vez de permissão, nunca inventar projeto nem indicação, nunca dizer “barreira”, e sair sempre com um próximo passo (nome, horário ou e-mail endereçado).
 * - Reunião agendada (Rework, Pipedrive, Agendor): duas opções de horário, pauta de uma linha, convite enviado durante a ligação e cumprir o tempo prometido.
 * - Caixa postal: recado de uns vinte segundos, com motivo, e o telefone repetido; combinar com uma mensagem de WhatsApp logo depois.
 * Tons: Normal (equilíbrio), Formal (polido, sem exagero) e Solto (amigável e cordial). O caminho é o mesmo nos três.
 */

export const PAR = "Se a mesma objeção voltar duas vezes, é um “não” de verdade: agradeça e saia bem, sem insistir.";
export const ONLINE = "Online é por ligação ou WhatsApp. Não ofereça videochamada: se o lead pedir, ele combina direto com o vendedor, por ligação ou WhatsApp.";
/** Como a Fey se apresenta: metalúrgica que fabrica, em frases curtas e naturais. */
export const FEY = T(
  "Somos uma metalúrgica: fabricamos parafusos, porcas, grampos de mola, pinos de centro e peças especiais",
  "A Fey é uma metalúrgica e fabrica parafusos, porcas, grampos de mola, pinos de centro e peças especiais",
  "A gente é uma metalúrgica e fabrica parafuso, porca, grampo de mola, pino de centro e peça especial",
);
/** Para quem se fala: o contexto que aproxima (“atendemos empresas como a sua”). */
export const PARES: Record<Tipo, string> = { revenda: "lojas e distribuidores da região que revendem fixadores", producao: "indústrias da região que usam fixadores na produção", servico: "oficinas e frotas da região que usam fixadores na manutenção" };

/** Por objetivo: quem queremos alcançar e por que ligamos, em cada tom. */
export type Alvo = { /** quem queremos alcançar, em uma frase ("quem cuida das compras de parafusos") */ quem: string; /** por que ligamos, curto e verdadeiro, para qualquer pessoa ouvir */ motivo: Tri; /** o que queremos tratar com essa pessoa ("pra apresentar nossa linha") */ para?: Tri; /** frase que apresenta a Fey a quem não conhece (padrão: quem atendemos) */ gk?: Tri; /** fecho do pedido de transferência na recepção */ fecha?: Tri };
