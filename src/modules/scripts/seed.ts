import { sql } from "drizzle-orm";
import { db, scripts } from "@/db";
import type { ScriptGoal, ScriptNode, ScriptOption } from "@/config/scripts";
import { GOALS, SEGMENTS } from "@/config/scripts";

/** O que cada tipo de estabelecimento compra e onde dói: alimenta as falas dos scripts de fábrica. */
const SEG: Record<string, { itens: string; dor: string }> = {
  geral: { itens: "peças de reposição", dor: "ficar sem a peça certa na hora de atender o cliente" },
  posto_molas: { itens: "molas, feixes e peças de suspensão", dor: "cliente parado esperando peça e fornecedor que atrasa" },
  auto_center: { itens: "peças de suspensão e freio", dor: "retrabalho por peça que não dura e prazo de entrega longo" },
  parafusos: { itens: "parafusos, porcas e fixadores especiais", dor: "ruptura de estoque nos itens de maior giro" },
  ferramentas: { itens: "ferramentas e consumíveis", dor: "linha que não gira e fornecedor sem suporte" },
  concessionaria: { itens: "peças originais e de reposição", dor: "veículo parado na oficina por falta de peça" },
  industria: { itens: "componentes de manutenção industrial", dor: "parada de máquina por componente em falta" },
  implementos: { itens: "componentes para implementos e carretas", dor: "carreta parada e entrega que não cumpre prazo" },
};

const o = (label: string, to: string | null, kind: ScriptOption["kind"] = "neutro"): ScriptOption => ({ label, to, kind });
const fala = (id: string, title: string, say: string, options: ScriptOption[], tip?: string): ScriptNode => ({ id, type: "fala", title, say, tip, options });
const fim = (id: string, title: string, say: string, outcome: NonNullable<ScriptNode["outcome"]>): ScriptNode => ({ id, type: "fim", title, say, options: [], outcome });

function build(goal: ScriptGoal, segment: string): { nodes: ScriptNode[]; startId: string } {
  const s = SEG[segment] ?? SEG.geral;
  if (goal === "sdr") {
    const nodes: ScriptNode[] = [
      fala("abertura", "Abertura", "Bom dia! Aqui é {meunome}, da Fey. Falo com {contato} da {empresa}?", [o("Atendeu o responsável", "pitch", "ok"), o("Atendeu a recepção / secretária", "secretaria"), o("Não é essa pessoa", "quem", "objecao"), o("Caixa postal / ninguém atende", "sem_resp")], "Sorria ao falar: a voz muda. Seu único objetivo é abrir a conversa."),
      fala("secretaria", "Passar pela recepção", `Tudo bem? Preciso falar com quem cuida das compras de ${s.itens}. É sobre condições de reposição para a {empresa}. Ele(a) está?`, [o("Vai passar", "pitch", "ok"), o("Pergunta qual é o assunto", "assunto"), o("Responsável não está", "horario"), o("Diz que não precisam", "obj_nao", "objecao")], "Seja natural e educado, sem pedir licença demais. Trate a recepção como aliada."),
      fala("assunto", "Dizer o assunto", `Estou apresentando uma linha de ${s.itens} com entrega rápida, para quem não pode ficar sem peça. Leva 2 minutos e quem decide poderá avaliar. Ele(a) consegue falar agora?`, [o("Passou a ligação", "pitch", "ok"), o("Anotou recado", "horario"), o("Recusou", "obj_nao", "objecao")]),
      fala("horario", "Combinar melhor horário", "Sem problema. Qual o nome dele(a) e qual o melhor horário para eu retornar? Assim não incomodo no meio do atendimento.", [o("Deu nome e horário", null, "ok")], "Anote nome, horário e a observação no sistema. Ligue de novo exatamente no horário."),
      fala("pitch", "Despertar interesse", `{contato}, vou direto: ajudamos lojas como a {empresa} a não sofrer com ${s.dor}. A Fey trabalha com ${s.itens} de linha premium, com prazo de entrega firme. Hoje, como vocês resolvem a reposição?`, [o("Demonstrou interesse / contou como compra", "perguntas", "ok"), o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Acha caro / preço", "obj_preco", "objecao"), o("Sem tempo agora", "obj_tempo", "objecao"), o("Não tem interesse", "obj_nao", "objecao")], "Faça perguntas e escute: quem fala menos conduz mais."),
      fala("perguntas", "Perguntas certas", `Quais itens vocês mais repõem? Com que frequência? Já aconteceu de perder venda por falta de ${s.itens.split(",")[0]}? Qual o maior problema com o fornecedor de hoje?`, [o("Respondeu e abriu o problema", "visita", "ok"), o("Respostas curtas / evasivo", "visita"), o("Sem tempo", "obj_tempo", "objecao")], "Anote as respostas na observação: elas viram a pauta da visita."),
      fala("visita", "Propor a visita", "Pelo que você me contou, vale a pena um representante nosso passar aí, sem compromisso, com amostras e uma proposta sob medida. Terça de manhã ou quinta à tarde fica melhor?", [o("Aceitou a visita", null, "ok"), o("Prefere receber por e-mail / WhatsApp", "digital"), o("Recusou", "obj_nao", "objecao")], "Ofereça duas opções de dia e horário. Nunca pergunte 'quer que eu marque?'."),
      fala("digital", "Seguir pelo digital", "Perfeito, te mando agora um material curto. Posso ligar depois de amanhã para ver o que achou e, se fizer sentido, agendamos a visita?", [o("Concordou", null, "ok"), o("Mesmo assim recusou", "obj_nao", "objecao")]),
      fala("obj_fornecedor", "Já tem fornecedor", "Ótimo, isso mostra que você leva a reposição a sério. Não quero que troque nada: a ideia é ser a segunda opção para os dias em que o atual falha. Vale conhecer sem compromisso?", [o("Topou conhecer", "visita", "ok"), o("Mantém a posição", null, "objecao")], "Não critique o concorrente. Posicione-se como reserva confiável."),
      fala("obj_preco", "Acha caro", "Entendo. Nosso produto é premium: custa um pouco mais do que o do mercado, mas dura mais e evita o retrabalho. Quem compra de nós costuma fazer as contas pelo custo total. Posso mostrar isso numa visita rápida?", [o("Aceitou ver", "visita", "ok"), o("Insistiu no preço", null, "objecao")], "Aqui o foco é a visita. Não fale de desconto: isso é com o vendedor."),
      fala("obj_tempo", "Sem tempo", "Claro, sei como é corrida a rotina. Em duas frases: entrega rápida e linha premium. Qual o melhor horário para eu ligar com calma, uns 5 minutos?", [o("Deu um horário", null, "ok"), o("Pediu para não ligar", null, "objecao")]),
      fala("obj_nao", "Sem interesse", "Sem problema, agradeço a atenção. Só para eu entender: é porque já estão bem atendidos ou porque o momento não é bom? Assim não incomodo à toa.", [o("Respondeu o motivo e abriu espaço", "pitch", "ok"), o("Encerrou", null, "objecao")], "Uma pergunta de saída ajuda a registrar o motivo. Se for 'não', agradeça e vá embora bem."),
      fala("quem", "Pessoa errada", "Desculpe o engano. Quem cuida das compras aí na {empresa}? Posso ligar direto para ele(a)?", [o("Passou o contato", "pitch", "ok"), o("Não sabe / não passa", null, "objecao")]),
      fala("sem_resp", "Sem resposta", "Registre a tentativa. Tente outro número do cadastro ou, no próximo contato, outro horário (manhã cedo ou fim da tarde costumam funcionar melhor).", [o("Registrado", null)]),
    ];
    return { nodes: [...nodes.filter((n) => n.options.length || n.type === "fim")], startId: "abertura" };
  }
  if (goal === "vendas") {
    const nodes: ScriptNode[] = [
      fala("abertura", "Abertura", "Bom dia! Aqui é {meunome}, da Fey. Falo com {contato} da {empresa}? Estou ligando para entender o que vocês compram de " + s.itens + " e ver como podemos ajudar.", [o("Atendeu o responsável", "descoberta", "ok"), o("Atendeu a recepção", "secretaria"), o("Não é a pessoa", null, "objecao")], "Aqui seu objetivo é cotar e vender. Seja direto e consultivo."),
      fala("secretaria", "Chegar ao comprador", `Preciso falar com quem faz a cotação de ${s.itens}. Ele(a) está? É para enviar uma proposta de reposição.`, [o("Passou", "descoberta", "ok"), o("Não está", null)]),
      fala("descoberta", "Descobrir a necessidade", `Quais itens vocês mais compram hoje? Em que volume por mês? O que mais incomoda no fornecedor atual: preço, prazo ou ${s.dor}?`, [o("Passou os itens e volumes", "proposta", "ok"), o("Pediu para mandar tabela", "tabela"), o("Já tem fornecedor fechado", "obj_fornecedor", "objecao")], "Anote itens e quantidades: é o que vira a cotação."),
      fala("proposta", "Apresentar a proposta", "Com esses itens, consigo montar uma cotação ainda hoje. Nossa linha é premium, com entrega firme. Se fechar o pedido completo, consigo uma condição especial. Posso enviar por e-mail ou WhatsApp?", [o("Quer a cotação", null, "ok"), o("Fala que é caro", "obj_preco", "objecao"), o("Quer pensar", "obj_pensar", "objecao")]),
      fala("tabela", "Tabela sem cotação", "Posso mandar a tabela, mas a cotação sob medida sai mais barata. Me confirma só os 3 itens de maior giro e já te devolvo o valor.", [o("Passou os itens", null, "ok"), o("Só quer a tabela", null)]),
      fala("obj_preco", "Preço acima do mercado", "Entendo, nosso produto é de linha premium e custa mais que a média. Mas posso trabalhar uma condição: quanto maior o pedido, melhor o desconto. Vamos ver o fechamento por pedido completo?", [o("Aceitou negociar", "desconto", "ok"), o("Mantém que está caro", null, "objecao")], "Aviso: seu desconto vai até 26% e, mesmo assim, o preço continua acima do mercado. Escalone aos poucos, nunca comece pelo máximo."),
      fala("desconto", "Conduzir o desconto", "Se fecharmos hoje o pedido completo, consigo baixar o valor. Escalone: primeiro uma faixa pequena, depois outra só se ele condicionar o fechamento.", [o("Fechou", null, "ok"), o("Pediu mais desconto", null, "objecao")], "Troque cada concessão por algo: volume maior, pagamento antecipado ou fechamento hoje."),
      fala("obj_fornecedor", "Fornecedor fechado", "Perfeito, não vou pedir para trocar. Posso fazer uma cotação só para vocês compararem e, se algum item sair melhor, vocês compram só ele?", [o("Topou comparar", "proposta", "ok"), o("Não quer", null, "objecao")]),
      fala("obj_pensar", "Quer pensar", "Claro. Para te ajudar a decidir, o que você precisa ver: prazo, condição ou garantia? Combinamos um retorno em dois dias?", [o("Combinou retorno", null, "ok")]),
    ];
    return { nodes: nodes.map((n) => (n.options.some((x) => x.to === null) ? n : n)), startId: "abertura" };
  }
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", "Bom dia, {contato}! Aqui é {meunome}, da Fey. Liguei para saber o que você achou da cotação que enviei para a {empresa}.", [o("Já viu e está analisando", "duvidas", "ok"), o("Ainda não viu", "reenviar"), o("Achou caro", "obj_preco", "objecao"), o("Fechou com outro", "motivo", "objecao"), o("Quer fechar", null, "ok")], "Ligue em até 2 dias úteis depois de enviar a cotação."),
    fala("duvidas", "Tirar dúvidas", "Ficou alguma dúvida sobre itens, prazo ou condição de pagamento? Posso ajustar a cotação agora.", [o("Sem dúvidas, vai fechar", null, "ok"), o("Pediu ajuste", null), o("Ainda vai decidir", "prazo")]),
    fala("reenviar", "Reenviar a cotação", "Sem problema, reenvio agora por e-mail e WhatsApp. Te ligo daqui a dois dias para falarmos?", [o("Combinado", null, "ok")]),
    fala("obj_preco", "Achou caro", "Entendo. Posso trabalhar uma condição: quanto maior o pedido, melhor o desconto, que vai até 26% e ainda mantém nosso produto acima do mercado em qualidade. Qual valor deixaria você fechar hoje?", [o("Aceitou negociar", null, "ok"), o("Mantém que está caro", "motivo", "objecao")], "Escalone a concessão; nunca ofereça o máximo de primeira."),
    fala("prazo", "Combinar prazo", "Quando você consegue me dar um retorno? Marco aqui no sistema para eu te ligar nesse dia.", [o("Deu uma data", null, "ok")]),
    fala("motivo", "Entender o motivo", "Obrigado por avisar. Só para eu melhorar: foi preço, prazo ou outra coisa? Posso te procurar de novo no mês que vem?", [o("Deu o motivo e permitiu novo contato", null, "neutro"), o("Encerrou", null, "objecao")]),
  ];
  return { nodes, startId: "abertura" };
}

/** Cada final aponta para o desfecho do objetivo (um nó "fim" por resultado). Torna a árvore fechada e sem becos. */
function close(goal: ScriptGoal, nodes: ScriptNode[], startId: string) {
  const ends: Record<string, ScriptNode> = {
    visita: fim("fim_visita", "Visita marcada", "Ótimo! Confirme o dia, o horário e o endereço, e registre a visita no sistema.", "visita"),
    cotacao: fim("fim_cotacao", "Cotação a enviar", "Envie a cotação hoje e deixe o retorno combinado.", "cotacao"),
    venda: fim("fim_venda", "Venda fechada", "Confirme itens, condições e prazo, e abra o pedido.", "venda"),
    retorno: fim("fim_retorno", "Retorno combinado", "Anote dia e horário do retorno na observação.", "retorno"),
    encerrar: fim("fim_encerrar", "Encerrar", "Agradeça e registre o motivo do encerramento.", "encerrar"),
  };
  const good = goal === "sdr" ? "visita" : goal === "vendas" ? "cotacao" : "venda";
  const used = new Set<string>();
  const fixed = nodes.map((n) => ({ ...n, options: n.options.map((x) => {
    if (x.to !== null) return x;
    const RET = /retorno|combin|hor[aá]rio|prazo|ajuste|data|concordou|registrado|recado/i;
    const k: string = RET.test(x.label) ? "retorno" : x.kind === "ok" ? (goal !== "sdr" && /fechou|fechar/i.test(x.label) ? "venda" : good) : "encerrar";
    used.add(k);
    return { ...x, to: ends[k].id };
  }) }));
  return { nodes: [...fixed, ...[...used].map((k) => ends[k])], startId };
}

/** Todos os scripts de fábrica (para o banco e para os testes). */
export function buildAll() {
  const out: { key: string; goal: ScriptGoal; segment: string; nodes: ScriptNode[]; startId: string }[] = [];
  for (const goal of Object.keys(GOALS) as ScriptGoal[]) for (const segment of Object.keys(SEGMENTS)) {
    const b = build(goal, segment);
    out.push({ key: `${goal}:${segment}`, goal, segment, ...close(goal, b.nodes, b.startId) });
  }
  return out;
}

/** Cria (ou completa) os scripts de fábrica, um por objetivo e tipo de estabelecimento. Os do Adm editados na tela não são sobrescritos. */
export async function ensureGlobalScripts(): Promise<void> {
  const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from scripts where seed_key is not null`);
  const expected = Object.keys(GOALS).length * Object.keys(SEGMENTS).length;
  if (n >= expected) return;
  for (const b of buildAll()) await db.insert(scripts).values({ seedKey: b.key, ownerId: null, title: `${GOALS[b.goal].label.split(" (")[0]} · ${SEGMENTS[b.segment]}`, segment: b.segment, goal: b.goal, summary: GOALS[b.goal].hint, nodes: b.nodes, startId: b.startId }).onConflictDoNothing();
}
