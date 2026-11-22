import { sql } from "drizzle-orm";
import { db, scripts } from "@/db";
import type { ScriptGoal, ScriptMood, ScriptNode, ScriptOption } from "@/config/scripts";
import { GOALS, SEGMENTS } from "@/config/scripts";

/** Muda quando os textos de fábrica são reescritos: os scripts do time que ninguém editou são atualizados. */
const SEED_VERSION = 8;

type Tipo = "revenda" | "producao" | "servico";
/** O que cada tipo de cliente compra da Fey (fixadores) e o aperto que passa. `dor` completa "não ficar na mão com ___". */
const SEG: Record<string, { itens: string; um: string; dor: string; tipo: Tipo }> = {
  geral: { itens: "parafusos, porcas e grampos", um: "parafuso", dor: "o fixador certo em falta na hora de atender", tipo: "revenda" },
  distribuidor_fixadores: { itens: "parafusos, porcas, arruelas e grampos", um: "parafuso sextavado", dor: "ruptura de estoque nos itens de maior giro", tipo: "revenda" },
  distribuidor_industrial: { itens: "fixadores e componentes de manutenção industrial", um: "parafuso de alta resistência", dor: "cliente industrial esperando um item que faltou", tipo: "revenda" },
  parafusos: { itens: "parafusos, porcas e arruelas", um: "item de giro", dor: "o item de maior giro acabando no balcão", tipo: "revenda" },
  ferragens: { itens: "parafusos, porcas, arruelas e fixadores de balcão", um: "parafuso", dor: "cliente de balcão que vai embora porque o item acabou", tipo: "revenda" },
  material_construcao: { itens: "parafusos, buchas e fixadores para obra", um: "parafuso", dor: "obra parada esperando o fixador", tipo: "revenda" },
  ferramentas: { itens: "parafusos, porcas e arruelas de balcão", um: "fixador de giro rápido", dor: "item de giro rápido em falta e fornecedor sem suporte", tipo: "revenda" },
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

const FIRST = "R$ 3.500";
const NEXT = "R$ 2.500";
const o = (label: string, to: string | null, kind: ScriptOption["kind"] = "neutro", note?: string): ScriptOption => ({ label, to, kind, ...(note ? { note } : {}) });
/** Vocativo opcional: com o nome de quem fala, a pergunta vira “…, certo, Carlos?”; sem nome, sai igual. */
const NM = "[[contato?, {contato}|]]";
const CHAMA = /^(conf_(empresa|segmento|negocio|minimo)|enr_|visita|pitch|desc_itens)/;
const chama = (id: string, say: string) => (CHAMA.test(id) && say.endsWith("?") && !say.includes("{contato}") && !say.includes("[[contato") ? say.slice(0, -1) + NM + "?" : say);
const fala = (id: string, title: string, say: string, options: ScriptOption[], tip?: string, mood?: ScriptMood): ScriptNode => ({ id, type: "fala", title, say: chama(id, say), tip, mood, options });
const fim = (id: string, title: string, say: string, outcome: NonNullable<ScriptNode["outcome"]>): ScriptNode => ({ id, type: "fim", title, say, options: [], outcome });

/*
 * Base metodológica dos scripts (fontes abertas e testadas em campo):
 * - Gong Labs, 300 milhões de ligações: abertura que diz o motivo da ligação e pede licença com candura rende ~11% de sucesso;
 *   "Passei em mau momento?" e "Como vai o seu dia?" rendem menos (2% e 7,6%); declarar o motivo dobra a chance de reunião (2,1x).
 * - Gong Labs, 519 mil ligações de descoberta: 11 a 14 perguntas dirigidas, espalhadas na conversa, nunca um questionário.
 * - Gong Labs, rapport: quem lidera o ritmo e mantém a postura conquista mais que quem imita o cliente; a sintonia aparece lá pelo minuto 2 ou 3.
 * - Jeb Blount (Fanatical Prospecting / Objections): respostas prontas, esclarecer antes de responder, "manda por e-mail" é tentativa de se livrar,
 *   pedir o próximo passo de novo depois de resolver, e o "não" repetido duas vezes é "não" de verdade.
 * - Sandler: contrato inicial ("se não servir, eu mesmo te falo"), funil de dor (um assunto, "me conta mais", impacto) e negativo reverso.
 * - Chris Voss: rotular a emoção ("parece que...") e perguntas calibradas ("como", "o que") em vez de defender.
 * - BANT: orçamento (pedido mínimo), autoridade (quem decide), necessidade (problema e impacto) e prazo (próxima reposição).
 * - SPIN (Rackham): situação, problema, implicação e ganho, em versão leve: o nosso negócio é recorrente e transacional.
 * - Vender a reunião, não o produto: "você mesmo julga se faz sentido", duas opções de horário, cumprir o tempo prometido.
 * Tom: formal e limpo na abertura; vai ficando mais leve, humano e próximo conforme a conversa avança.
 */

const PAR = "Se a mesma objeção voltar duas vezes, é um “não” de verdade: agradeça e saia bem, sem insistir.";
const ONLINE = "Online é por ligação ou WhatsApp. Não ofereça videochamada: se o lead pedir, ele combina direto com o vendedor, por ligação ou WhatsApp.";
/** Como a Fey se apresenta: metalúrgica que fabrica, em frases curtas e naturais. */
const FEY = "Somos uma metalúrgica: fabricamos parafusos, porcas, grampos de mola, pinos de centro e peças especiais";
/** Para quem se fala: o contexto que aproxima ("atendemos empresas como a sua"). */
const PARES: Record<Tipo, string> = { revenda: "lojas e distribuidores que revendem fixadores", producao: "indústrias que usam fixadores na produção", servico: "oficinas e frotas que usam fixadores na manutenção" };

/** Recepção, pessoa errada e caixa postal: o caminho até falar com quem importa. */
function entrada(next: string, itens: string): ScriptNode[] {
  return [
    fala("secretaria", "Passar pela recepção", `Bom dia! Aqui é {meunome}, da Fey. Você poderia me ajudar? Preciso falar com quem cuida das compras de ${itens} aí na {empresa}. Quem seria essa pessoa?`, [o("Vai passar a ligação", "nome", "ok"), o("Perguntou qual é o assunto", "assunto"), o("O responsável não está", "horario"), o("Disse que não precisam", "obj_nao", "objecao")], "Peça ajuda, não permissão. Seja cordial, use o nome de quem atendeu se souber e nunca minta sobre quem você é: a recepção é aliada e lembra de você.", "ponte"),
    fala("assunto", "Dizer o assunto", `Claro! A Fey é uma metalúrgica e fabrica ${itens}. Estou ligando porque atendemos empresas parecidas com a {empresa} e queria ver se faz sentido apresentar nossa linha. É coisa rápida, e quem decide é quem vai julgar se interessa. Essa pessoa consegue falar agora?`, [o("Passou a ligação", "nome", "ok"), o("Anotou um recado", "horario"), o("Recusou", "obj_nao", "objecao")], "Dê um motivo curto e honesto. Quem conhece o assunto passa a ligação com mais facilidade.", "ponte"),
    fala("horario", "Combinar outro horário", "Sem problema! Pra eu não atrapalhar: qual o nome dessa pessoa e em que horário ela costuma estar por aí? Aí eu ligo bem nessa hora.", [o("Deu o nome e o horário", "@retorno", "ok", "Retornar no horário combinado com o decisor")], "Anote nome, horário e quem informou. Na volta, abra com “a recepção me indicou este horário”.", "apoio"),
    fala("quem", "Pessoa errada", "Ih, desculpa o engano, e obrigado pela paciência! Quem cuida das compras de fixadores aí na {empresa}? Posso falar direto com essa pessoa?", [o("Passou o contato", "nome", "ok"), o("Não sabe ou não passa", "@encerrar", "objecao")], undefined, "ponte"),
    fala("sem_resp", "Ninguém atendeu", "Se cair na caixa postal, deixe um recado curto e com motivo: “Oi, aqui é {meunome}, da Fey, uma metalúrgica de fixadores. Liguei por causa de reposição de parafusos e grampos. Volto a ligar mais tarde. Obrigado!”", [o("Tentativa registrada", "@retorno", "neutro", "Ninguém atendeu: tentar outro horário ou número")], "Faça pelo menos seis tentativas, em horários e dias diferentes, antes de desistir. Manhã cedo e fim da tarde costumam funcionar melhor.", "apoio"),
      fala("nome", "Com quem você fala", "[[contato?Só pra confirmar: estou falando com {contato}, certo?|Antes de seguir, me desculpe: não peguei o seu nome. Com quem eu falo, por favor?]]", [o("Disse ou confirmou o nome", next, "ok", "Nome de quem atendeu anotado"), o("Prefere não dizer o nome", next, "neutro")], "Escreva o nome no campo “Conversando atualmente com”, logo acima do roteiro: daí em diante as perguntas passam a chamar a pessoa pelo nome, o que aproxima e prende a atenção. Se o nome já aparecer lá, só confirme.", "ponte"),
  ];
}

/** 1. Confirmações: empresa e local, função do contato, segmento compatível. Conversadas, sem cara de formulário. */
function confirma(next: string, itens: string, tipo: Tipo): ScriptNode[] {
  const perfil = tipo === "revenda" ? "Cliente que revende fixadores é o perfil central: pergunte como atende o balcão e o que mais gira." : tipo === "producao" ? "Quem usa fixador na produção compra recorrente e valoriza prazo e padrão: vá por aí." : "Quem usa nos serviços e na manutenção sofre com parada: o valor está em ter o item na hora.";
  return [
    fala("conf_empresa", "Confirmar empresa e local", "Só pra eu não incomodar a empresa errada: aí é a {empresa_completa}, de {cidade}, certo?", [o("Confirmou", "conf_papel", "ok", "Empresa e local confirmados"), o("Mudou de nome ou de endereço", "conf_papel", "neutro", "Atenção: nome ou endereço diferente do cadastro"), o("Não é essa empresa", "@encerrar", "objecao", "Telefone não pertence à empresa")], "Soa como cortesia, não como checagem. Se mudou, anote o nome e o endereço novos na observação."),
    fala("conf_papel", "Quem decide a compra", `Perfeito. {contato}, quem costuma cuidar da compra de ${itens} aí na {empresa}: é você mesmo ou outra pessoa?`, [o("Decide a compra (decisor)", "conf_segmento", "ok", "Contato: decisor de compra"), o("Ajuda a decidir, mas não fecha sozinho (influenciador)", "conf_segmento", "neutro", "Contato: influenciador de compra"), o("Não mexe com compras (neutro)", "pedir_decisor", "neutro", "Contato: neutro, sem poder de compra")], "Você só registra o que ouviu. Decisor: compra e fecha. Influenciador: opina e tem peso. Neutro: não decide nada. Se tiver dúvida, pergunte: “e quem dá a palavra final?”."),
    fala("pedir_decisor", "Pedir ajuda para chegar ao decisor", `Entendi, obrigado por me contar! Você poderia me ajudar? Quem decide a compra de ${itens} aí e qual o melhor jeito de falar com essa pessoa?`, [o("Transferiu ou chamou a pessoa", "conf_papel", "ok"), o("Deu nome e horário", "horario", "neutro"), o("Não passa o contato", "@encerrar", "objecao", "Não passou o decisor")], "Quem não decide costuma ajudar se for tratado como parceiro: agradeça e deixe claro que será rápido.", "ponte"),
    fala("conf_segmento", "Entender como a empresa trabalha", "Legal! Me conta um pouco como a {empresa} trabalha com fixadores: vocês revendem, usam na produção, ou é mais pra manutenção e serviço?", [o("Revende (balcão, loja ou distribuidor)", "conf_negocio", "ok", "Segmento: revenda de fixadores"), o("Usa na produção ou montagem", "conf_negocio", "ok", "Segmento: usa na produção"), o("Usa na manutenção ou nos serviços", "conf_negocio", "ok", "Segmento: usa na manutenção ou serviços"), o("Não compra fixadores", "@encerrar", "objecao", "Fora do perfil: não compra fixadores")], perfil, "confirma"),
    fala("conf_negocio", "Conhecer a empresa", "Que bacana! E há quanto tempo a {empresa} está no mercado? Pergunto por curiosidade mesmo: dá pra sentir quando é uma casa tradicional.", [o("Mais de 10 anos", next, "ok", "Tempo de mercado: mais de 10 anos"), o("De 3 a 10 anos", next, "ok", "Tempo de mercado: 3 a 10 anos"), o("Menos de 3 anos", next, "ok", "Tempo de mercado: menos de 3 anos"), o("Prefere não dizer", next)], "Aqui a conversa fica mais leve. Ouça a história dele(a), comente com interesse de verdade e só então siga. É onde nasce a conexão.", "ponte"),
  ];
}

/** 2. Enriquecedores: o que a conversa descobre sobre o lead. Cada pergunta traz um porquê e permite pular. */
function enriquece(last: string, tipo: Tipo, kind: "sdr" | "vendas"): ScriptNode[] {
  const aplic = tipo === "revenda" ? [o("Balcão e varejo", "enr_freq", "ok", "Aplicação: balcão e varejo"), o("Oficinas e frotas", "enr_freq", "ok", "Aplicação: oficinas e frotas"), o("Indústrias e construtoras", "enr_freq", "ok", "Aplicação: indústrias e construtoras"), o("Um pouco de tudo", "enr_freq", "ok", "Aplicação: variada")]
    : tipo === "producao" ? [o("Montagem do produto final", "enr_freq", "ok", "Aplicação: montagem do produto final"), o("Manutenção das máquinas", "enr_freq", "ok", "Aplicação: manutenção das máquinas"), o("Reposição e assistência técnica", "enr_freq", "ok", "Aplicação: reposição e assistência"), o("Mais de uma aplicação", "enr_freq", "ok", "Aplicação: variada")]
    : [o("Manutenção da própria frota", "enr_freq", "ok", "Aplicação: manutenção de frota"), o("Serviço para clientes", "enr_freq", "ok", "Aplicação: serviços para clientes"), o("Reposição e estoque", "enr_freq", "ok", "Aplicação: reposição e estoque"), o("Mais de uma aplicação", "enr_freq", "ok", "Aplicação: variada")];
  const skip = o("Prefere não responder", "enr_freq", "neutro");
  return [
    ...(kind === "sdr" ? [fala("enr_conhece", "Conhece a Fey?", "Me tira uma curiosidade: você já conhecia a Fey, ou já chegou a comprar da gente, direto ou por algum distribuidor?", [o("É ou já foi cliente da Fey", "enr_mix", "ok", "Já é ou foi cliente Fey"), o("Compra Fey por um distribuidor", "enr_mix", "neutro", "Compra Fey por distribuidor (anotar qual)"), o("Compra de um concorrente", "enr_mix", "neutro", "Compra de concorrente (anotar qual)"), o("Não conhece a Fey", "enr_mix", "neutro", "Não conhece a Fey"), o("Prefere não responder", "enr_mix")], "Descubra de quem compra hoje (distribuidor ou concorrente) sem soar como interrogatório, e anote o nome. Se ele já conhece, pergunte o que achou. Pare para ouvir antes da próxima pergunta.")] : []),
    fala("enr_mix", "Quais produtos compra", "E o que vocês mais compram hoje? É um mix de vários itens ou mais uns específicos? Pergunto pra não te mandar nada que não sirva.", [o("Mix variado de itens", "enr_aplicacao", "ok", "Compra mix variado"), o("Poucos itens específicos", "enr_aplicacao", "ok", "Compra poucos itens específicos"), o("Só um item", "enr_aplicacao", "neutro", "Compra um item só"), o("Não soube dizer", "enr_aplicacao")], "Deixe falar. Anote os itens e como é o mix: isso vira a cotação do vendedor. “Me conta mais” é a melhor pergunta de continuação (Sandler)."),
    fala("enr_aplicacao", "Onde aplica", "Entendi! E onde isso entra no dia a dia de vocês? Pergunto porque a aplicação muda qual parafuso ou grampo faz mais sentido.", [...aplic, skip]),
    fala("enr_freq", "Frequência de compra", "E de quanto em quanto tempo vocês repõem isso? Toda semana, todo mês, ou só quando falta?", [o("Toda semana", "enr_func", "ok", "Compra toda semana"), o("Todo mês", "enr_func", "ok", "Compra todo mês"), o("A cada dois ou três meses", "enr_func", "neutro", "Compra a cada 2 ou 3 meses"), o("Só quando precisa", "enr_func", "neutro", "Compra só sob demanda")]),
    fala("enr_func", "Tamanho da empresa", "Quantas pessoas vocês são aí, mais ou menos? Só pra eu ter noção do tamanho da casa.", [o("Até 5", "enr_quando", "neutro", "Funcionários: até 5"), o("De 6 a 20", "enr_quando", "ok", "Funcionários: 6 a 20"), o("De 21 a 100", "enr_quando", "ok", "Funcionários: 21 a 100"), o("Mais de 100", "enr_quando", "ok", "Funcionários: mais de 100"), o("Não soube dizer", "enr_quando")], "Última pergunta antes da proposta. A Gong viu que 11 a 14 perguntas bem dirigidas funcionam melhor que um questionário completo."),
    fala("enr_quando", "Quando precisa", "E a próxima reposição, quando vocês costumam precisar? Pra eu já deixar tudo pronto no tempo certo.", [o("Esta semana", last, "ok", "Próxima compra: esta semana"), o("Neste mês", last, "ok", "Próxima compra: neste mês"), o("Nos próximos meses", last, "neutro", "Próxima compra: nos próximos meses"), o("Sem previsão", last, "neutro", "Próxima compra: sem previsão")], "Prazo (o T do BANT): é ele quem diz quando precisa. Orçamento está no pedido mínimo, autoridade em quem decide, necessidade no problema e no impacto."),
  ];
}

/** Pedido mínimo (confirmação) com os 25%. */
const minimo = (to: string): ScriptNode =>
  fala("conf_minimo", "Alinhar o pedido mínimo", `Olha, vou ser transparente desde já, pra não te fazer perder tempo: o primeiro pedido tem mínimo de ${FIRST}, e do segundo em diante é ${NEXT}. E em cima disso eu aplico 25% de desconto, então o valor do pedido continua o mesmo, só que você leva mais produto por ele. Isso cabe na rotina de vocês?`, [o("Cabe, comporta o pedido", to, "ok", `Comporta o pedido mínimo (${FIRST} e ${NEXT})`), o("Depende do mix", to, "neutro", "Pedido mínimo depende do mix"), o("Acha alto", "obj_minimo", "objecao"), o("Não soube dizer", to)], "Confirme a capacidade de compra: R$ 3.500 no primeiro pedido e R$ 2.500 do segundo em diante. O desconto de 25% reduz o preço por item sem baixar o mínimo.", "confirma");

/**
 * Objeções. Cada uma segue o mesmo caminho dos profissionais: reconhecer o que a pessoa sente, esclarecer com uma pergunta, responder e propor o próximo passo.
 * O tom é o mais humano da conversa: aqui a pessoa precisa se sentir ouvida. `back` é onde a conversa volta depois de resolvida.
 */
function objecoes(back: string, foco: "visita" | "venda"): ScriptNode[] {
  const dica = foco === "visita" ? "O foco é a conversa com o vendedor: preço fino fica com ele. Pode citar os 25% sem prometer valores." : "Ofereça 25% primeiro; só depois, se precisar, chegue a 26%. Escalone, não comece pelo máximo.";
  const ok = (l: string, note?: string) => o(l, back, "ok", note);
  const nao = (note?: string) => o("Continua firme na negativa", "@encerrar", "objecao", note);
  const outra = o("Levantou outra objeção", "obj_menu", "neutro");
  return [
    fala("obj_menu", "Qual foi a objeção?", "Entendi, obrigado por ser sincero comigo. O que mais pesa pra você agora? Assim eu te respondo o que realmente importa.", [o("Preço", "obj_preco", "objecao"), o("Prazo de entrega", "obj_prazo", "objecao"), o("Qualidade e garantia", "obj_qualidade", "objecao"), o("Forma de pagamento", "obj_pagamento", "objecao"), o("Frete", "obj_frete", "objecao"), o("Pedido mínimo", "obj_minimo", "objecao"), o("Outras objeções…", "obj_menu2", "neutro")], `Escute até o fim, sem interromper, e esclareça antes de responder: muitas vezes o que ele diz não é o que ele quer dizer (Blount). ${PAR}`, "objecao"),
    fala("obj_menu2", "Outras objeções", "Certo. E tem mais alguma coisa pesando aí, além disso?", [o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Compra por distribuidor", "obj_distribuidor", "objecao"), o("Concorrente mais barato", "obj_concorrente", "objecao"), o("Não conhece a Fey", "obj_confianca", "objecao"), o("Já teve experiência ruim", "obj_ruim", "objecao"), o("Precisa falar com sócio ou decisor", "obj_socio", "objecao"), o("Sem tempo agora", "obj_tempo", "objecao"), o("Manda por e-mail ou WhatsApp", "obj_enviar", "objecao"), o("Estoque cheio, sem necessidade agora", "obj_estoque", "objecao"), o("Sem interesse", "obj_nao", "objecao")], undefined, "objecao"),
    fala("obj_preco", "Acha caro", "Super justo você olhar o preço com cuidado. Posso te perguntar: caro comparado com o quê? Com o que vocês compram hoje, ou com o que esperavam? Eu pergunto porque a nossa linha é premium, e eu aplico 25% de desconto no pedido: o mínimo continua o mesmo, mas você leva mais.", [ok("Explicou a comparação e topou olhar"), o("Ainda acha caro", "obj_valor", "objecao"), outra], `${dica} Rotule antes de argumentar: “parece que o preço está pesando”. Não defenda o preço: descubra com o que ele compara (Voss).`),
    fala("obj_valor", "Mostrar o valor", "Entendo, de verdade. Só que, no fixador, o que pesa no bolso não é só o preço, é o que acontece quando ele falha: retrabalho, máquina ou veículo parado. Que tal eu montar uma comparação por item, com o que vocês já compram, e você mesmo confere se a conta fecha?", [ok("Aceitou a comparação", "Pediu comparação por item"), nao("Preço acima do mercado")], dica),
    fala("obj_prazo", "Prazo de entrega", "Prazo é uma das coisas que a gente mais leva a sério. Me diz uma coisa: em quantos dias você precisa receber pra ficar tranquilo? Aí eu já combino isso na cotação.", [ok("Informou o prazo que precisa", "Prazo de entrega é prioridade"), nao(), outra], "Não prometa um número de dias: o vendedor confirma o prazo exato por região, na cotação."),
    fala("obj_qualidade", "Qualidade e garantia", "Faz muito bem em perguntar. A gente fabrica, então responde pelo que produz. O que aconteceu com os fixadores que vocês usaram e deram problema? Se quiser, mando até uma amostra pra você testar do seu jeito.", [ok("Contou o problema que tem hoje", "Reclama da qualidade do fornecedor atual"), ok("Pediu amostra", "Pediu amostra"), nao(), outra], "Pergunte o que deu errado antes: é o que dá o argumento. Ofereça amostra se fizer sentido, sem prometer o que não pode."),
    fala("obj_pagamento", "Forma de pagamento", "Isso a gente acerta junto no pedido, conforme a análise de cadastro, e o vendedor busca a melhor opção pra vocês. Como a {empresa} costuma pagar os fornecedores?", [ok("Disse como prefere pagar", "Preferência de pagamento informada"), nao(), outra], "Não prometa prazo nem parcelamento: depende da análise."),
    fala("obj_frete", "Frete", "O frete a gente calcula na cotação, conforme a região e a transportadora. Pra onde seria a entrega?", [ok("Informou o local de entrega", "Frete: informou local de entrega"), nao(), outra], undefined),
    fala("obj_minimo", "Pedido mínimo alto", `Entendo. O mínimo é de ${FIRST} só no primeiro pedido e cai pra ${NEXT} do segundo em diante. Com os 25% de desconto, esse valor rende bastante produto. Quanto vocês costumam comprar por vez hoje?`, [ok("Aceitou montar o pedido"), o("Compra bem menos que isso", "obj_minimo2", "objecao"), outra], "Descubra o volume real antes de defender o mínimo: R$ 3.500 no primeiro e R$ 2.500 depois."),
    fala("obj_minimo2", "Volume abaixo do mínimo", "Olha, se a gente juntar o mix completo, ou reunir a compra de uns três meses, o valor chega mais fácil. Vale a gente olhar quais itens se encaixam?", [ok("Topou ver o mix", "Pode chegar ao mínimo com o mix completo"), nao("Volume abaixo do pedido mínimo")], undefined),
    fala("obj_fornecedor", "Já tem fornecedor", "Que bom, isso mostra que vocês levam a reposição a sério! Eu não quero que você troque ninguém. Só me conta: quando o seu fornecedor atual falha em prazo ou em algum item, o que vocês fazem? A ideia é ter a Fey como segunda opção de confiança e, nos itens em que formos melhores, a primeira.", [ok("Topou conhecer a Fey", "Tem fornecedor, topou conhecer"), nao("Mantém o fornecedor atual"), outra], "Nunca fale mal do concorrente. Pergunte o que acontece quando o fornecedor falha: é nesse ponto que a Fey entra. “Estou satisfeito” cai aqui também."),
    fala("obj_distribuidor", "Compra por distribuidor", "Que legal, então vocês já conhecem a Fey! Comprando direto da fábrica a condição melhora e o prazo fica mais firme. Qual distribuidor vocês usam hoje? Posso mostrar como ficaria comprando direto, só pra você comparar.", [ok("Informou o distribuidor e quer ver", "Compra por distribuidor (anotar qual)"), o("Prefere manter o distribuidor", "@encerrar", "objecao", "Prefere manter o distribuidor"), outra], "Anote qual é o distribuidor. Não force: se ele gosta do distribuidor, deixe a porta aberta."),
    fala("obj_concorrente", "Concorrente mais barato", "Faz sentido comparar! Só que preço de etiqueta não conta tudo: o que pesa é a durabilidade e quanto o item dá de retrabalho. A gente fabrica linha premium e, com os 25% de desconto, a conta por item fica bem competitiva. Posso montar uma comparação com o que você já compra?", [ok("Aceitou a comparação", "Concorrente mais barato: pediu comparação"), nao("Fechado com concorrente"), outra], dica),
    fala("obj_confianca", "Não conhece a Fey", "Faz total sentido, ninguém compra de quem não conhece. A Fey é uma metalúrgica e fabrica o que vende. Que tal você começar com uma amostra, ou só olhar a cotação sem compromisso, e decidir depois?", [ok("Topou amostra ou cotação", "Não conhecia a Fey: aceitou amostra ou cotação"), nao("Não confia sem conhecer"), outra], "Reduza o risco do primeiro passo: amostra ou cotação, nunca pressão. Ofereça só o que a Fey pode cumprir."),
    fala("obj_ruim", "Já teve experiência ruim", "Poxa, sinto muito por isso. O que aconteceu, se você não se importar de me contar? Quero entender pra não repetir com você.", [ok("Contou o que aconteceu", "Experiência ruim anterior: anotar o motivo"), nao(), outra], "Deixe falar sem interromper e rotule: “parece que isso te deixou na mão”. A queixa dele vira o seu argumento."),
    fala("obj_socio", "Precisa falar com o sócio", "Claro, faz todo sentido envolver quem decide junto. Que tal a gente marcar um horário em que vocês dois estejam livres? Assim eu apresento uma vez só e ninguém repete nada.", [o("Combinou com o decisor", "@retorno", "ok", "Conversa com o decisor agendada"), nao("Não passou o decisor")], undefined),
    fala("obj_tempo", "Sem tempo agora", "Sem problema, sei que te peguei no meio do trabalho! Em duas frases: a Fey é uma metalúrgica que fabrica parafusos e grampos, linha premium, com prazo firme. Se fizer sentido, eu ligo em outro horário. Quando é melhor, de manhã ou à tarde?", [o("Deu um horário", "@retorno", "ok", "Pediu retorno em outro horário"), o("Pediu pra não ligar mais", "@encerrar", "objecao", "Pediu para não ser contatado")], "Respeite o tempo: cumpra o que prometeu. Se ele deu horário, ligue exatamente nele. “Estou em reunião” costuma ser adiamento: peça um horário concreto."),
    fala("obj_enviar", "Manda por e-mail ou WhatsApp", "Mando sim! Pra não te encher de coisa que não serve, deixa eu te fazer duas perguntinhas rápidas: quais itens vocês mais compram e o que mais complica hoje? Aí mando só o que importa.", [o("Passou o contato e os itens", "@retorno", "ok", "Pediu material por e-mail ou WhatsApp"), ok("Aceitou conversar um pouco antes"), nao()], "“Manda por e-mail” é, quase sempre, tentativa de se livrar (Blount). Tente trinta segundos de conversa antes; se não rolar, combine o retorno: “te ligo depois de amanhã pra saber o que achou”."),
    fala("obj_estoque", "Estoque cheio", "Entendo, sem pressa. Quando o estoque começa a baixar, vocês costumam ser pegos de surpresa? Posso deixar a cotação pronta, pra vocês agirem rápido quando precisar.", [o("Combinou um retorno", "@retorno", "ok", "Estoque cheio: retornar mais tarde"), nao("Sem necessidade no momento")], undefined),
    fala("obj_nao", "Sem interesse", "Tudo bem, agradeço a sinceridade! Só pra eu entender, e pra não te incomodar à toa: é porque vocês já estão bem atendidos ou porque o assunto não faz sentido pra vocês? Pergunto sem compromisso mesmo.", [ok("Explicou o motivo e abriu espaço"), o("Encerrou a conversa", "@encerrar", "objecao", "Sem interesse")], `Pergunta de saída (negativo reverso, Sandler): ajuda a registrar o motivo real. ${PAR}`),
  ];
}

function sdr(s: (typeof SEG)[string]): { nodes: ScriptNode[]; startId: string } {
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", `Bom dia, {contato}? Aqui é {meunome}, da Fey. ${FEY}. Sei que liguei de surpresa, então vou direto ao motivo: atendemos ${PARES[s.tipo]} aqui da região, e queria entender se faz sentido apresentar nossa linha pra {empresa}. Posso te explicar em trinta segundos e você decide se vale continuar?`, [o("Pode falar", "nome", "ok"), o("Atendeu a recepção", "secretaria"), o("Não é essa pessoa", "quem", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Caixa postal ou ninguém atendeu", "sem_resp")], "Abertura limpa e profissional. A Gong mediu que abrir com o motivo, com candura, rende cerca de 11% de sucesso. Evite “como vai o dia?” e “estou atrapalhando?”. Fale com calma e sorria: sua voz leva o ritmo.", "abertura"),
    ...entrada("conf_empresa", s.itens),
    ...confirma("pitch", s.itens, s.tipo),
    fala("pitch", "Despertar interesse", `Então, vou te contar o que a gente mais ouve de quem trabalha com ${s.itens}: o problema de ${s.dor}. A gente fabrica direto, com linha premium e prazo de entrega firme, e isso tira essa dor. Soa familiar aí, ou vocês já têm isso redondo?`, [o("Reconheceu o problema ou contou como compra", "impl", "ok"), o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Disse que é caro", "obj_preco", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Não tem interesse", "obj_nao", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Fale do problema do cliente, não do seu produto. Depois da pergunta, escute: quem fala menos conduz mais a conversa. Uma pergunta por vez.", "proposta"),
    fala("impl", "Entender o impacto", "Poxa, imagino. E quando isso acontece, o que rola na prática? Fica cliente esperando, vocês saem correndo atrás em outro lugar, ou nem chega a ser um problema?", [o("Cliente espera ou desiste da venda", "ganho", "ok", "Impacto: cliente espera ou venda perdida"), o("Compra em outro lugar, mais caro", "ganho", "ok", "Impacto: compra de emergência mais cara"), o("Para o serviço ou a produção", "ganho", "ok", "Impacto: serviço ou produção parados"), o("Quase não acontece", "contrato", "neutro", "Pouco impacto percebido")], "Implicação (SPIN): deixe ele mesmo dizer o quanto isso pesa. Rotule: “parece que isso incomoda”. Não proponha solução ainda.", "pergunta"),
    fala("ganho", "O valor de resolver", "Entendi. E se vocês tivessem um fornecedor que entrega no prazo combinado e não deixa faltar o item de giro, isso mudaria alguma coisa pra vocês?", [o("Mudaria bastante", "contrato", "ok", "Vê valor em prazo firme e item de giro"), o("Ajudaria um pouco", "contrato", "neutro"), o("Já está resolvido", "contrato", "neutro", "Diz ter o assunto resolvido")], "Ganho (SPIN): é ele quem diz o valor, não você. Se ele descreve o benefício, o “sim” da reunião fica fácil.", "pergunta"),
    fala("contrato", "Pedir licença para perguntar", "Beleza! Posso te fazer umas perguntinhas rápidas, só pra eu ver se a Fey serve mesmo pra vocês? Se não servir, eu mesmo te falo, combinado?", [o("Pode perguntar", "enr_conhece", "ok"), o("Está com pouco tempo", "obj_tempo", "objecao")], "Contrato inicial (Sandler): alinha a expectativa e tira a pressão. Dar permissão para dizer “não” aumenta o “sim”.", "ponte"),
    ...enriquece("conf_minimo", s.tipo, "sdr"),
    minimo("visita"),
    fala("visita", "Marcar a conversa", "{contato}, pelo que a gente conversou, acho que vale você ver isso de perto. Seria um papo de uns vinte minutinhos com o nosso especialista, que já leva uma proposta pensada pra {empresa}, e você mesmo julga se faz sentido, sem compromisso. Prefere presencial, com nosso representante, ou online, por ligação ou WhatsApp? Terça de manhã ou quinta à tarde fica melhor?", [o("Visita presencial (representante)", "@visita", "ok", "Agendado: visita presencial"), o("Conversa online (vendedor SDR, por ligação ou WhatsApp)", "@visita", "ok", "Agendado: conversa online por ligação ou WhatsApp"), o("Prefere receber por e-mail ou WhatsApp", "digital"), o("Sem disponibilidade agora", "obj_tempo", "objecao"), o("Recusou", "obj_nao", "objecao")], `Venda a reunião, não o produto (“você mesmo julga”). Dê sempre duas opções de dia e horário, nunca “quer marcar?”. Peça a agenda: “você está com a agenda aí?”. ${ONLINE}`, "proposta"),
    fala("digital", "Seguir pelo digital", "Perfeito! Te mando agora um material curtinho, só com o que importa pro seu perfil. Posso te ligar depois de amanhã, uns cinco minutinhos, pra saber o que você achou? Se fizer sentido, a gente já marca a conversa.", [o("Concordou", "@retorno", "ok", "Enviar material e retornar em 2 dias"), o("Mesmo assim recusou", "obj_nao", "objecao")], "Combine o dia do retorno antes de desligar. Mensagem curta para o WhatsApp: “Oi! Aqui é [seu nome], da Fey, a metalúrgica de fixadores. Conforme conversamos, segue o material. Qualquer dúvida, é só chamar.”", "apoio"),
    ...objecoes("visita", "visita"),
  ];
  return { nodes, startId: "abertura" };
}

function vendas(s: (typeof SEG)[string]): { nodes: ScriptNode[]; startId: string } {
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", `Bom dia, {contato}? Aqui é {meunome}, da Fey. ${FEY}. Estou ligando porque atendemos ${PARES[s.tipo]} e queria te ajudar com a reposição de ${s.itens}. Você tem um minutinho pra eu te fazer duas perguntas e já montar uma cotação certa?`, [o("Pode falar", "nome", "ok"), o("Atendeu a recepção", "secretaria"), o("Não é essa pessoa", "quem", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Caixa postal ou ninguém atendeu", "sem_resp")], "Aqui o objetivo é cotar e vender. Seja consultivo: você quer ajudar a resolver a reposição, não empurrar produto.", "abertura"),
    ...entrada("conf_papel", s.itens),
    ...confirma("desc_itens", s.itens, s.tipo).filter((n) => n.id !== "conf_empresa" && n.id !== "conf_segmento" && n.id !== "conf_negocio").map((n) => (n.id === "conf_papel" ? { ...n, options: n.options.map((x) => (x.to === "conf_segmento" ? { ...x, to: "desc_itens" } : x)) } : n)),
    fala("desc_itens", "Descobrir a necessidade", "Show! Pra eu montar uma cotação certinha pra {empresa}: quais itens vocês mais compram e mais ou menos quanto por mês? Se tiver a lista dos de maior giro, já me ajuda bastante.", [o("Passou itens e quantidades", "enr_mix", "ok", "Passou itens e quantidades para a cotação"), o("Pediu a tabela de preços", "tabela"), o("Já tem fornecedor fechado", "obj_fornecedor", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Anote itens e quantidades: é isso que vira a cotação. Reaja ao que ele disser antes da próxima pergunta.", "pergunta"),
    fala("tabela", "Só a tabela", "Posso mandar a tabela, sim! Só que, sem saber o que vocês compram, ela vira um catálogo enorme e pouco útil. Se você me disser os três itens de maior giro, eu já te devolvo o valor com desconto ainda hoje. Pode ser?", [o("Passou os itens", "enr_mix", "ok"), o("Quer só a tabela mesmo", "@cotacao", "neutro", "Pediu somente a tabela")], undefined, "proposta"),
    ...enriquece("conf_minimo", s.tipo, "vendas"),
    minimo("proposta"),
    fala("proposta", "Apresentar a proposta", "Com o que você me passou, eu monto a cotação ainda hoje. É linha premium, com prazo de entrega firme, e eu aplico 25% de desconto no pedido: o valor mínimo continua o mesmo, só que você leva mais produto por ele. Prefere receber por e-mail ou por WhatsApp?", [o("Quer receber a cotação", "@cotacao", "ok", "Cotação enviada por e-mail ou WhatsApp"), o("Quer fechar já", "fechar", "ok"), o("Disse que é caro", "obj_preco", "objecao"), o("Quer pensar", "obj_pensar", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Ofereça 25% primeiro, e só depois, se precisar, 26%. Depois de pedir o próximo passo, fique em silêncio e deixe ele responder.", "proposta"),
    fala("fechar", "Fechar o pedido", "Perfeito! Vou confirmar com você: itens, quantidades, forma de pagamento e endereço de entrega. Se estiver tudo certo, já abro o pedido agora. Pode ser?", [o("Confirmou tudo", "venda_extra", "ok"), o("Faltou ajustar algo", "proposta", "neutro"), o("Quer pensar mais um pouco", "obj_pensar", "objecao")], "Repita itens, valores e prazo em voz alta antes de abrir o pedido. Resolvida a dúvida, peça o fechamento de novo (Blount).", "fechamento"),
    fala("venda_extra", "Incluir mais itens", "Aproveitando que o pedido está aberto: tem mais algum item que costuma faltar aí? Dá pra incluir agora e já entra no desconto.", [o("Incluiu mais itens", "@venda", "ok", "Pedido fechado com itens extras"), o("Só isso mesmo", "@venda", "ok", "Pedido confirmado na ligação")], "Quem acabou de decidir está aberto a complementar. Sugira um item ligado ao que ele comprou, sem insistir.", "fechamento"),
    fala("obj_pensar", "Quer pensar", "Claro, decisão importante a gente pensa mesmo! Pra eu te ajudar a decidir: o que você ainda precisa ver, o prazo, a condição de pagamento ou a garantia? Se quiser, a gente combina de conversar de novo daqui a dois dias.", [o("Combinou o retorno", "@retorno", "ok", "Combinado retorno em 2 dias"), o("Disse o que falta decidir", "obj_menu", "neutro"), o("Não quer retorno", "@encerrar", "objecao")], "“Vou pensar” quase sempre esconde uma dúvida: descubra qual é, com calma, sem pressionar.", "objecao"),
    ...objecoes("proposta", "venda"),
  ];
  return { nodes, startId: "abertura" };
}

function retorno(s: (typeof SEG)[string]): { nodes: ScriptNode[]; startId: string } {
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", "Bom dia, {contato}? Aqui é {meunome}, da Fey. Combinei de te ligar pra saber o que você achou da cotação que mandei pra {empresa}. Tem um minutinho?", [o("Já viu e está analisando", "duvidas", "ok"), o("Ainda não viu", "reenviar"), o("Quer fechar", "fechar", "ok"), o("Achou caro", "obj_preco", "objecao"), o("Fechou com outro", "motivo", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Ligue em até dois dias úteis depois do envio, no horário combinado. Quem cumpre o que prometeu ganha confiança.", "abertura"),
    fala("duvidas", "Tirar dúvidas", "Que bom! E o que ficou mais em aberto pra você: os itens, o prazo ou a forma de pagamento? Se quiser, eu ajusto a cotação agora, enquanto a gente conversa.", [o("Sem dúvidas, vai fechar", "fechar", "ok"), o("Pediu um ajuste", "@cotacao", "neutro", "Pediu ajuste na cotação"), o("Dúvida sobre o produto", "duvida_tec", "neutro"), o("Ainda vai decidir", "prazo", "neutro"), o("Levantou uma objeção", "obj_menu", "objecao")], "Pergunta aberta, e depois silêncio. Se ele disser “está tudo certo”, vá direto ao fechamento.", "pergunta"),
    fala("duvida_tec", "Dúvida sobre o produto", `Boa pergunta! Em qual aplicação você vai usar? Assim eu confirmo direitinho se o ${s.um} serve, ou peço pro nosso time técnico te responder ainda hoje.`, [o("Explicou a aplicação", "@retorno", "ok", "Dúvida técnica: confirmar com o time técnico e retornar"), o("Resolveu na hora", "fechar", "ok")], "Anote a aplicação com o máximo de detalhe. Nunca invente uma resposta técnica: confirme antes e retorne no prazo prometido.", "pergunta"),
    fala("reenviar", "Reenviar a cotação", "Sem problema! Reenvio agora, por e-mail e por WhatsApp. Posso te ligar daqui a dois dias, uns cinco minutinhos, pra gente conversar sobre ela?", [o("Combinado", "@retorno", "ok", "Cotação reenviada, retornar em 2 dias")], undefined, "apoio"),
    fala("fechar", "Fechar o pedido", "Que bom! Vou confirmar com você: itens, quantidades, forma de pagamento e endereço de entrega. Se estiver tudo certo, já abro o pedido agora.", [o("Confirmou tudo", "@venda", "ok", "Pedido confirmado na ligação"), o("Faltou ajustar algo", "duvidas", "neutro")], "Repita itens, valores e prazo em voz alta antes de abrir o pedido.", "fechamento"),
    fala("prazo", "Combinar o retorno", "Sem pressa! Quando você acha que consegue me dar uma resposta? Eu anoto e te ligo exatamente nesse dia.", [o("Deu uma data", "@retorno", "ok", "Retornar na data combinada")], undefined, "apoio"),
    fala("motivo", "Entender o motivo", "Obrigado por me avisar, é bom saber. Só pra eu melhorar: o que pesou mais, o preço, o prazo ou outra coisa? E posso te procurar de novo daqui a um mês?", [o("Contou o motivo e permitiu novo contato", "@retorno", "neutro", "Fechou com outro: procurar de novo em 1 mês"), o("Encerrou a conversa", "@encerrar", "objecao", "Fechou com outro fornecedor")], "Registre o motivo no sistema: ele ajuda o time inteiro. Saia bem, sem insistir.", "pergunta"),
    ...objecoes("fechar", "venda"),
  ];
  return { nodes, startId: "abertura" };
}

/** 3. Fidelizadores: quem já compra (Televendas). */
function fidelizar(s: (typeof SEG)[string]): { nodes: ScriptNode[]; startId: string } {
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", "Bom dia, {contato}? Aqui é {meunome}, da Fey. Não estou ligando pra vender nada agora: só queria saber como estão as coisas com a gente e se posso ajudar em alguma coisa. Tem um minutinho?", [o("Atendeu e quer conversar", "nome", "ok"), o("Atendeu a recepção", "secretaria"), o("Não é essa pessoa", "quem", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Caixa postal ou ninguém atendeu", "sem_resp")], "Cliente que compra precisa sentir que é lembrado, e não só cobrado. Abra com interesse sincero.", "fideliza"),
    ...entrada("fid_continua", s.itens),
    fala("fid_continua", "Continua comprando?", "Que bom falar com você! Me conta: vocês continuam comprando com a Fey? Como tem sido a experiência com os produtos e com a entrega?", [o("Sim, segue comprando normalmente", "fid_duvidas", "ok", "Continua comprando com a Fey"), o("Está comprando menos que antes", "fid_motivo", "neutro", "Reduziu as compras"), o("Parou de comprar", "fid_motivo", "objecao", "Parou de comprar"), o("Está comprando de outro fornecedor", "obj_concorrente", "objecao", "Comprando de outro fornecedor")], "Escute com atenção. Queixa bem recebida vira fidelidade; rotule o que ouvir: “parece que o prazo te incomodou”.", "fideliza"),
    fala("fid_motivo", "Entender a mudança", "Obrigado por contar, de verdade. O que mudou desde a última compra: foi preço, prazo, algum problema com o produto, ou o volume mesmo que caiu?", [o("Foi preço", "obj_preco", "objecao", "Motivo da queda: preço"), o("Foi prazo ou entrega", "obj_prazo", "objecao", "Motivo da queda: prazo de entrega"), o("Teve problema com produto", "fid_tecnica", "objecao", "Motivo da queda: problema com produto"), o("O volume caiu mesmo", "fid_reposicao", "neutro", "Motivo da queda: menos necessidade")], undefined, "fideliza"),
    fala("fid_duvidas", "Dúvidas pendentes", "Que bom ouvir isso! E tem alguma coisa pendente com a gente, sobre produto, pedido ou entrega? Se tiver, eu resolvo agora.", [o("Sem dúvidas", "fid_reposicao", "ok"), o("Dúvida sobre produto", "fid_tecnica", "neutro", "Dúvida sobre produto"), o("Dúvida sobre pedido ou entrega", "fid_pedido", "neutro", "Dúvida sobre pedido ou entrega")], undefined, "fideliza"),
    fala("fid_tecnica", "Dúvida ou problema técnico", "Pode me explicar em qual aplicação foi e o que aconteceu? Assim eu levo pro nosso time técnico e te retorno ainda hoje, sem enrolação.", [o("Explicou o caso", "@retorno", "ok", "Caso técnico: acionar o time técnico e retornar hoje"), o("Resolveu na hora", "fid_reposicao", "ok")], "Anote tudo e acione o time técnico. Nunca invente uma resposta técnica: confirme e retorne no prazo prometido.", "fideliza"),
    fala("fid_pedido", "Pedido ou entrega", "Me passa o número do pedido ou a data, que eu verifico agora e já te digo o que aconteceu.", [o("Passou os dados", "@retorno", "ok", "Verificar pedido ou entrega e retornar"), o("Resolveu na hora", "fid_reposicao", "ok")], undefined, "fideliza"),
    fala("fid_reposicao", "Oferecer reposição", `Pra você não ser pego de surpresa: quer que eu já monte a reposição dos itens que mais giram? Eu aplico 25% de desconto no pedido, e o mínimo é de ${NEXT} do segundo pedido em diante, então você leva bastante produto.`, [o("Quer repor agora", "fid_indica", "ok", "Reposição fechada na ligação"), o("Quer ver novidades do catálogo", "fid_catalogo", "ok"), o("Vai precisar mais pra frente", "fid_indica", "neutro", "Retornar para a próxima reposição"), o("Levantou uma objeção", "obj_menu", "objecao")], "Pergunte o que está acabando e sugira itens complementares: quem já compra tende a comprar mais.", "proposta"),
    fala("fid_catalogo", "Apresentar novidades", `Olha, temos ${s.itens} e peças especiais que combinam com o que vocês já compram. Posso te mandar o catálogo atualizado e uma sugestão de itens pro seu perfil. Prefere por e-mail ou por WhatsApp?`, [o("Quer receber o catálogo", "@retorno", "ok", "Enviar catálogo e sugestão de itens"), o("Quer um pedido com novidades", "@venda", "ok", "Pedido com itens novos"), o("Agora não", "@retorno", "neutro", "Retornar em outro momento")], undefined, "proposta"),
    fala("fid_indica", "Pedir indicação", "Antes de desligar, uma última coisa, e fica à vontade pra dizer que não: você conhece alguém, de outra empresa, que também sofre com falta de parafuso ou prazo? Se quiser, eu ligo e digo que foi você quem indicou.", [o("Indicou alguém", "@venda", "ok", "Indicação recebida: anotar nome e telefone"), o("Agora não lembra de ninguém", "@retorno", "neutro", "Retornar em outro momento"), o("Prefere não indicar", "@encerrar", "neutro")], "Indicação é o jeito mais barato de prospectar: cliente satisfeito indica. Peça com leveza e anote nome e telefone na observação.", "fideliza"),
    ...objecoes("fid_reposicao", "venda"),
  ];
  return { nodes, startId: "abertura" };
}

function build(goal: ScriptGoal, segment: string) {
  const s = SEG[segment] ?? SEG.geral;
  return goal === "sdr" ? sdr(s) : goal === "vendas" ? vendas(s) : goal === "retorno" ? retorno(s) : fidelizar(s);
}

/** Cada final aponta para o desfecho do objetivo (um nó "fim" por resultado). Torna a árvore fechada e sem becos. */
function close(goal: ScriptGoal, nodes: ScriptNode[], startId: string) {
  const ends: Record<string, ScriptNode> = {
    visita: fim("fim_visita", "Conversa agendada", "Boa! Confirme o dia, o horário e o formato (presencial ou online) e registre a visita no sistema.", "visita"),
    cotacao: fim("fim_cotacao", "Cotação a enviar", "Boa! Envie a cotação ainda hoje e deixe o retorno combinado.", "cotacao"),
    venda: fim("fim_venda", "Venda fechada", "Excelente! Confirme itens, condições e prazo, e abra o pedido.", "venda"),
    retorno: fim("fim_retorno", "Retorno combinado", "Combinado! Anote o dia e o horário do retorno na observação.", "retorno"),
    encerrar: fim("fim_encerrar", "Conversa encerrada", "Tudo bem, faz parte. Agradeça, registre o motivo e passe para o próximo lead.", "encerrar"),
  };
  const used = new Set<string>();
  const fixed = nodes.map((n) => ({ ...n, options: n.options.map((x) => {
    const k = x.to === null ? "encerrar" : x.to.startsWith("@") ? x.to.slice(1) : null;
    if (!k || !ends[k]) return x;
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
