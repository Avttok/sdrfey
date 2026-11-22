import { sql } from "drizzle-orm";
import { db, scripts } from "@/db";
import type { ScriptGoal, ScriptMood, ScriptNode, ScriptOption } from "@/config/scripts";
import { GOALS, SEGMENTS } from "@/config/scripts";

/** Muda quando os textos de fábrica são reescritos: os scripts do time que ninguém editou são atualizados. */
const SEED_VERSION = 3;

/** O que cada tipo de estabelecimento compra da Fey (fixadores) e o aperto que passa. `dor` completa "ajuda a não passar aperto com ___". */
const SEG: Record<string, { itens: string; um: string; dor: string }> = {
  geral: { itens: "parafusos, porcas e grampos", um: "parafuso", dor: "o fixador certo em falta na hora de atender" },
  posto_molas: { itens: "grampos de mola, pinos centrais, parafusos e porcas", um: "grampo de mola", dor: "cliente esperando e fornecedor atrasando o grampo" },
  auto_center: { itens: "parafusos e porcas de roda e de suspensão", um: "parafuso de roda", dor: "retrabalho com parafuso que afrouxa ou quebra" },
  parafusos: { itens: "parafusos, porcas e arruelas", um: "item de giro", dor: "o item de maior giro acabando no balcão" },
  ferramentas: { itens: "parafusos, porcas e arruelas de balcão", um: "fixador de giro rápido", dor: "item de giro em falta e fornecedor sem suporte" },
  concessionaria: { itens: "fixadores de reposição para a oficina", um: "parafuso", dor: "carro parado na oficina esperando um parafuso" },
  industria: { itens: "fixadores para manutenção", um: "fixador", dor: "máquina parada por causa de um fixador em falta" },
  implementos: { itens: "parafusos, grampos e porcas para carreta e implemento", um: "grampo", dor: "carreta parada esperando o fixador certo" },
};

const o = (label: string, to: string | null, kind: ScriptOption["kind"] = "neutro"): ScriptOption => ({ label, to, kind });
const fala = (id: string, title: string, say: string, options: ScriptOption[], tip?: string, mood?: ScriptMood): ScriptNode => ({ id, type: "fala", title, say, tip, mood, options });
const fim = (id: string, title: string, say: string, outcome: NonNullable<ScriptNode["outcome"]>): ScriptNode => ({ id, type: "fim", title, say, options: [], outcome });

function build(goal: ScriptGoal, segment: string): { nodes: ScriptNode[]; startId: string } {
  const s = SEG[segment] ?? SEG.geral;
  if (goal === "sdr") {
    const nodes: ScriptNode[] = [
      fala("abertura", "Abertura", "Oi, bom dia! Aqui é {meunome}, da Fey. Falo com {contato} da {empresa}?", [o("Era a pessoa certa", "pitch", "ok"), o("Atendeu a recepção", "secretaria"), o("Não é essa pessoa", "quem", "objecao"), o("Caixa postal ou ninguém atendeu", "sem_resp")], "Sorria enquanto fala: a voz muda. Agora seu único objetivo é abrir a conversa."),
      fala("secretaria", "Passar pela recepção", `Oi, tudo bem? Quem cuida das compras de ${s.itens} aí na {empresa}? Preciso falar rapidinho com essa pessoa sobre reposição.`, [o("Vai passar a ligação", "pitch", "ok"), o("Perguntou qual é o assunto", "assunto"), o("O responsável não está", "horario"), o("Disse que não precisam", "obj_nao", "objecao")], "Fale com naturalidade, sem pedir licença demais. A recepção é sua aliada: trate bem."),
      fala("assunto", "Dizer o assunto", `É sobre uma linha de ${s.itens} com entrega rápida. São só dois minutinhos com quem decide. Essa pessoa consegue me atender agora?`, [o("Passou a ligação", "pitch", "ok"), o("Anotou um recado", "horario"), o("Recusou", "obj_nao", "objecao")]),
      fala("horario", "Combinar outro horário", "Sem problema! Qual o nome dessa pessoa e qual o melhor horário pra eu ligar de novo? Assim eu não atrapalho o atendimento.", [o("Deu o nome e o horário", null, "ok")], "Anote nome, horário e observação no sistema. Ligue de novo exatamente no horário combinado.", "apoio"),
      fala("pitch", "Despertar interesse", `{contato}, vou ser direto pra não tomar seu tempo: a Fey ajuda lojas como a {empresa} a não passar aperto com ${s.dor}. Nossa linha de ${s.itens} é premium e a entrega tem prazo firme. Hoje, como vocês resolvem essa reposição?`, [o("Mostrou interesse ou contou como compra", "perguntas", "ok"), o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Disse que é caro", "obj_preco", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Não tem interesse", "obj_nao", "objecao")], "Depois da pergunta, escute. Quem fala menos conduz mais a conversa."),
      fala("perguntas", "Escutar e perguntar", `Que legal! Me conta: quais fixadores vocês mais repõem? É todo mês ou de vez em quando? Já perderam venda por falta de ${s.um}? E o que mais incomoda no fornecedor de hoje?`, [o("Respondeu e abriu o problema", "visita", "ok"), o("Respostas curtas, meio evasivo", "visita"), o("Está sem tempo", "obj_tempo", "objecao")], "Anote as respostas na observação: elas viram a pauta da visita."),
      fala("visita", "Propor a visita", "Pelo que você me contou, vale muito a gente se conhecer pessoalmente. Um representante nosso passa aí, sem compromisso, leva amostras e já traz uma proposta pensada pra {empresa}. Fica melhor terça de manhã ou quinta à tarde?", [o("Aceitou a visita", null, "ok"), o("Prefere receber por e-mail ou WhatsApp", "digital"), o("Recusou", "obj_nao", "objecao")], "Dê sempre duas opções de dia e horário. Evite perguntar “quer que eu marque?”."),
      fala("digital", "Seguir pelo digital", "Perfeito! Te mando agora um material curtinho. Posso te ligar depois de amanhã pra saber o que você achou? Se fizer sentido, a gente já marca a visita.", [o("Concordou", null, "ok"), o("Mesmo assim recusou", "obj_nao", "objecao")]),
      fala("obj_fornecedor", "Já tem fornecedor", "Que bom, isso mostra que vocês levam a reposição a sério. Eu não quero que você troque ninguém. A ideia é a Fey ser a segunda opção nos dias em que o atual falhar. Vale a gente se conhecer, sem compromisso?", [o("Topou conhecer", "visita", "ok"), o("Manteve a posição", null, "objecao")], "Nunca fale mal do concorrente. Posicione a Fey como reserva de confiança."),
      fala("obj_preco", "Disse que é caro", "Entendo, e vou ser transparente: o nosso custa um pouco mais que o do mercado. É linha premium, dura mais e evita retrabalho. Quem compra de nós costuma fazer a conta pelo custo total. Deixa eu te mostrar isso numa visita rápida?", [o("Aceitou ver", "visita", "ok"), o("Insistiu no preço", null, "objecao")], "Seu foco aqui é a visita. Não fale de desconto: isso é com o vendedor."),
      fala("obj_tempo", "Sem tempo agora", `Claro, imagino como a rotina é corrida. Em duas frases: entrega rápida e linha premium de ${s.itens}. Qual o melhor horário pra eu te ligar com calma, uns cinco minutinhos?`, [o("Deu um horário", null, "ok"), o("Pediu pra não ligar mais", null, "objecao")]),
      fala("obj_nao", "Sem interesse", "Tudo bem, agradeço a atenção! Só pra eu entender: é porque vocês já estão bem atendidos ou porque o momento não é bom? Pergunto pra não te incomodar à toa.", [o("Explicou o motivo e abriu espaço", "pitch", "ok"), o("Encerrou a conversa", null, "objecao")], "Essa pergunta de saída ajuda a registrar o motivo. Se for um “não” firme, agradeça e saia bem."),
      fala("quem", "Pessoa errada", "Ah, desculpa o engano! Quem cuida das compras aí na {empresa}? Posso ligar direto pra essa pessoa?", [o("Passou o contato", "pitch", "ok"), o("Não sabe ou não passa", null, "objecao")]),
      fala("sem_resp", "Ninguém atendeu", "Se cair na caixa postal, deixe um recado curto: “Oi, aqui é {meunome}, da Fey. Ligo de novo mais tarde, obrigado!”", [o("Tentativa registrada", null)], "Registre a tentativa. Na próxima, mude o horário (manhã cedo ou fim da tarde costumam funcionar melhor) ou teste outro número do cadastro.", "apoio"),
    ];
    return { nodes, startId: "abertura" };
  }
  if (goal === "vendas") {
    const nodes: ScriptNode[] = [
      fala("abertura", "Abertura", `Oi, bom dia! Aqui é {meunome}, da Fey. Falo com {contato} da {empresa}? Tô ligando pra entender o que vocês compram de ${s.itens} e ver como a gente pode ajudar.`, [o("Era a pessoa certa", "descoberta", "ok"), o("Atendeu a recepção", "secretaria"), o("Não é a pessoa", null, "objecao")], "Aqui o objetivo é cotar e vender. Seja direto e consultivo, como quem quer ajudar."),
      fala("secretaria", "Chegar a quem compra", `Oi, tudo bem? Preciso falar com quem faz a cotação de ${s.itens}. É pra mandar uma proposta de reposição. Essa pessoa está por aí?`, [o("Passou a ligação", "descoberta", "ok"), o("Não está agora", null)]),
      fala("descoberta", "Descobrir a necessidade", "Pra eu montar algo certinho pra {empresa}: quais itens vocês mais compram? Em que quantidade por mês? E o que mais pesa no fornecedor de hoje: preço, prazo ou atendimento?", [o("Passou itens e quantidades", "proposta", "ok"), o("Pediu pra mandar a tabela", "tabela"), o("Já tem fornecedor fechado", "obj_fornecedor", "objecao")], "Anote itens e quantidades: é isso que vira a cotação."),
      fala("proposta", "Apresentar a proposta", "Com esses itens eu consigo montar uma cotação ainda hoje. A nossa linha é premium, com entrega firme, e se vocês fecharem o pedido completo eu consigo uma condição especial. Prefere receber por e-mail ou por WhatsApp?", [o("Quer receber a cotação", null, "ok"), o("Disse que é caro", "obj_preco", "objecao"), o("Quer pensar", "obj_pensar", "objecao")]),
      fala("tabela", "Só a tabela", "Posso mandar a tabela, sim. Mas a cotação sob medida costuma sair melhor pra vocês. Se você me confirmar os três itens de maior giro, já te devolvo o valor hoje. Pode ser?", [o("Passou os itens", null, "ok"), o("Quer só a tabela mesmo", null)]),
      fala("obj_preco", "Preço acima do mercado", "Entendo, e sei que o nosso é premium, então o preço fica acima da média. Em troca o produto rende mais e evita retrabalho. Posso trabalhar uma condição: quanto maior o pedido, melhor o desconto. Vamos olhar o pedido completo?", [o("Aceitou negociar", "desconto", "ok"), o("Continua achando caro", null, "objecao")], "Seu desconto vai até 26% e, mesmo assim, o preço continua acima do mercado. Vá aos poucos: nunca comece pelo máximo."),
      fala("desconto", "Conduzir o desconto", "Fechando hoje o pedido completo, eu consigo melhorar o valor pra você. Que tal começarmos por essa condição? Se ela resolver, a gente já formaliza agora mesmo.", [o("Fechou", null, "ok"), o("Pediu mais desconto", null, "objecao")], "Troque cada concessão por algo: volume maior, pagamento antecipado ou fechamento hoje."),
      fala("obj_fornecedor", "Fornecedor fechado", "Perfeito, eu não vou te pedir pra trocar de fornecedor. Que tal eu te passar uma cotação só pra você comparar? Se algum item sair melhor, você compra só ele de nós.", [o("Topou comparar", "proposta", "ok"), o("Não quis", null, "objecao")]),
      fala("obj_pensar", "Quer pensar", "Claro, sem pressa. Pra eu te ajudar a decidir: o que você ainda precisa ver, o prazo, a condição de pagamento ou a garantia? A gente combina um retorno daqui a dois dias?", [o("Combinou o retorno", null, "ok")]),
    ];
    return { nodes, startId: "abertura" };
  }
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", "Oi, {contato}, tudo bem? Aqui é {meunome}, da Fey. Te liguei pra saber o que você achou da cotação que mandei pra {empresa}.", [o("Já viu e está analisando", "duvidas", "ok"), o("Ainda não viu", "reenviar"), o("Achou caro", "obj_preco", "objecao"), o("Fechou com outro", "motivo", "objecao"), o("Quer fechar", null, "ok")], "Ligue em até dois dias úteis depois de enviar a cotação."),
    fala("duvidas", "Tirar dúvidas", "Ficou alguma dúvida sobre os itens, o prazo ou a forma de pagamento? Se quiser, eu ajusto a cotação agora, enquanto a gente conversa.", [o("Sem dúvidas, vai fechar", null, "ok"), o("Pediu um ajuste", null), o("Ainda vai decidir", "prazo")], undefined, "pergunta"),
    fala("reenviar", "Reenviar a cotação", "Sem problema! Reenvio agora por e-mail e WhatsApp. Posso te ligar daqui a dois dias pra gente conversar?", [o("Combinado", null, "ok")], undefined, "apoio"),
    fala("obj_preco", "Achou caro", "Entendo. Posso trabalhar uma condição pra você: quanto maior o pedido, melhor o desconto. Mas sendo transparente, o nosso é linha premium e fica acima do mercado, em troca de durar mais. Que valor faria você fechar hoje?", [o("Aceitou negociar", null, "ok"), o("Continua achando caro", "motivo", "objecao")], "Seu desconto vai até 26%. Escalone aos poucos e nunca ofereça o máximo de primeira."),
    fala("prazo", "Combinar o retorno", "Quando você consegue me dar uma resposta? Eu anoto aqui e te ligo nesse dia, pra não te cobrar fora de hora.", [o("Deu uma data", null, "ok")], undefined, "apoio"),
    fala("motivo", "Entender o motivo", "Obrigado por me avisar! Só pra eu melhorar: foi preço, prazo ou outra coisa? Posso te procurar de novo mês que vem?", [o("Contou o motivo e deixou novo contato", null, "neutro"), o("Encerrou a conversa", null, "objecao")], "Registre o motivo no sistema: ele ajuda o time inteiro.", "pergunta"),
  ];
  return { nodes, startId: "abertura" };
}

/** Cada final aponta para o desfecho do objetivo (um nó "fim" por resultado). Torna a árvore fechada e sem becos. */
function close(goal: ScriptGoal, nodes: ScriptNode[], startId: string) {
  const ends: Record<string, ScriptNode> = {
    visita: fim("fim_visita", "Visita marcada", "Boa! Confirme com o lead o dia, o horário e o endereço, e registre a visita no sistema.", "visita"),
    cotacao: fim("fim_cotacao", "Cotação a enviar", "Boa! Envie a cotação ainda hoje e deixe o retorno combinado.", "cotacao"),
    venda: fim("fim_venda", "Venda fechada", "Excelente! Confirme itens, condições e prazo, e abra o pedido.", "venda"),
    retorno: fim("fim_retorno", "Retorno combinado", "Combinado! Anote o dia e o horário do retorno na observação.", "retorno"),
    encerrar: fim("fim_encerrar", "Conversa encerrada", "Tudo bem, faz parte. Agradeça, registre o motivo e passe para o próximo lead.", "encerrar"),
  };
  const good = goal === "sdr" ? "visita" : goal === "vendas" ? "cotacao" : "venda";
  const used = new Set<string>();
  const fixed = nodes.map((n) => ({ ...n, options: n.options.map((x) => {
    if (x.to !== null) return x;
    const RET = /retorno|combin|hor[aá]rio|prazo|ajuste|data|concordou|registrad|recado|tentativa|deixou/i;
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

/**
 * Cria os scripts de fábrica (um por objetivo e tipo de estabelecimento). Quando os textos de fábrica mudam (SEED_VERSION),
 * os que ninguém editou na tela são atualizados; os editados pelo Adm ficam como estão.
 */
export async function ensureGlobalScripts(): Promise<void> {
  const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from scripts where seed_key is not null`);
  const [{ v }] = await db.execute<{ v: number }>(sql`select coalesce((select (value #>> '{}')::int from settings where key = 'scripts_seed_v'), 0) as v`);
  const expected = Object.keys(GOALS).length * Object.keys(SEGMENTS).length;
  if (n >= expected && v >= SEED_VERSION) return;
  for (const b of buildAll()) {
    const title = `${GOALS[b.goal].label.split(" (")[0]} · ${SEGMENTS[b.segment]}`;
    await db.insert(scripts).values({ seedKey: b.key, ownerId: null, title, segment: b.segment, goal: b.goal, summary: GOALS[b.goal].hint, nodes: b.nodes, startId: b.startId }).onConflictDoNothing();
    if (v < SEED_VERSION) await db.execute(sql`update scripts set title = ${title}, summary = ${GOALS[b.goal].hint}, nodes = ${JSON.stringify(b.nodes)}::jsonb, start_id = ${b.startId} where seed_key = ${b.key} and updated_at <= created_at + interval '2 seconds'`);
  }
  await db.execute(sql`insert into settings (key, value) values ('scripts_seed_v', ${String(SEED_VERSION)}::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()`);
}
