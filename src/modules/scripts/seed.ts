import { sql } from "drizzle-orm";
import { db, scripts } from "@/db";
import type { ScriptGoal, ScriptMood, ScriptNode, ScriptOption } from "@/config/scripts";
import { GOALS, SEGMENTS } from "@/config/scripts";

/** Muda quando os textos de fábrica são reescritos: os scripts do time que ninguém editou são atualizados. */
const SEED_VERSION = 4;

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
const fala = (id: string, title: string, say: string, options: ScriptOption[], tip?: string, mood?: ScriptMood): ScriptNode => ({ id, type: "fala", title, say, tip, mood, options });
const fim = (id: string, title: string, say: string, outcome: NonNullable<ScriptNode["outcome"]>): ScriptNode => ({ id, type: "fim", title, say, options: [], outcome });

/* ───────── blocos reaproveitados pelas quatro fases ───────── */

/** Recepção, pessoa errada e caixa postal: o caminho até falar com quem importa. */
function entrada(next: string, itens: string): ScriptNode[] {
  return [
    fala("secretaria", "Passar pela recepção", `Oi, tudo bem? Quem cuida das compras de ${itens} aí na {empresa}? Preciso falar rapidinho com essa pessoa sobre reposição.`, [o("Vai passar a ligação", next, "ok"), o("Perguntou qual é o assunto", "assunto"), o("O responsável não está", "horario"), o("Disse que não precisam", "obj_nao", "objecao")], "Fale com naturalidade, sem pedir licença demais. A recepção é sua aliada: trate bem.", "ponte"),
    fala("assunto", "Dizer o assunto", `É sobre uma linha de ${itens} direto da fábrica, com entrega firme. São só dois minutinhos com quem decide. Essa pessoa consegue me atender agora?`, [o("Passou a ligação", next, "ok"), o("Anotou um recado", "horario"), o("Recusou", "obj_nao", "objecao")], undefined, "ponte"),
    fala("horario", "Combinar outro horário", "Sem problema! Qual o nome dessa pessoa e qual o melhor horário pra eu ligar de novo? Assim eu não atrapalho o atendimento.", [o("Deu o nome e o horário", "@retorno", "ok", "Retornar no horário combinado com o decisor")], "Anote nome, horário e observação. Ligue de novo exatamente no horário combinado.", "apoio"),
    fala("quem", "Pessoa errada", "Ah, desculpa o engano! Quem cuida das compras aí na {empresa}? Posso ligar direto pra essa pessoa?", [o("Passou o contato", next, "ok"), o("Não sabe ou não passa", "@encerrar", "objecao")], undefined, "ponte"),
    fala("sem_resp", "Ninguém atendeu", "Se cair na caixa postal, deixe um recado curto: “Oi, aqui é {meunome}, da Fey. Ligo de novo mais tarde, obrigado!”", [o("Tentativa registrada", "@retorno", "neutro", "Ninguém atendeu: tentar outro horário ou número")], "Registre a tentativa. Na próxima, mude o horário (manhã cedo ou fim da tarde costumam funcionar melhor) ou teste outro número do cadastro.", "apoio"),
  ];
}

/** 1. Confirmações: empresa e local, função do contato, segmento compatível. */
function confirma(next: string, itens: string, tipo: Tipo): ScriptNode[] {
  const perfil = tipo === "revenda" ? "Revender para clientes é o esperado aqui." : tipo === "producao" ? "Uso na produção ou montagem é o esperado aqui." : "Uso nos serviços e na manutenção é o esperado aqui.";
  return [
    fala("conf_empresa", "Confirmar empresa e local", "Antes de tudo, só pra confirmar: aí é a {empresa_completa}, em {cidade}, certo?", [o("Confirmou", "conf_papel", "ok", "Empresa e local confirmados"), o("Mudou de nome ou de endereço", "conf_papel", "neutro", "Atenção: nome ou endereço diferente do cadastro"), o("Não é essa empresa", "@encerrar", "objecao", "Telefone não pertence à empresa")], "Se mudou, anote o nome e o endereço novos na observação."),
    fala("conf_papel", "Confirmar o contato", "E qual é a sua função por aí? Você participa das compras?", [o("Decide a compra (decisor)", "conf_segmento", "ok", "Contato: decisor de compra"), o("Opina e tem peso na decisão (influenciador)", "conf_segmento", "neutro", "Contato: influenciador de compra"), o("Sem peso na compra (recepção ou funcionário)", "pedir_decisor", "neutro", "Contato: neutro, sem poder de compra")], "Decisor compra. Influenciador pesa na decisão. Neutro não decide nada: peça para falar com o decisor."),
    fala("pedir_decisor", "Pedir o decisor", `Entendi, obrigado! Quem decide as compras de ${itens} aí? Consigo falar com essa pessoa rapidinho?`, [o("Transferiu ou chamou a pessoa", "conf_papel", "ok"), o("Deu nome e horário", "horario", "neutro"), o("Não passa o contato", "@encerrar", "objecao", "Não passou o decisor")], undefined, "ponte"),
    fala("conf_segmento", "Confirmar o segmento", "Pra eu te atender direito: a {empresa} revende fixadores, usa na produção ou na manutenção e nos serviços?", [o("Revende (balcão, loja ou distribuidor)", "pitch", "ok", "Segmento: revenda de fixadores"), o("Usa na produção ou montagem", "pitch", "ok", "Segmento: usa na produção"), o("Usa na manutenção ou nos serviços", "pitch", "ok", "Segmento: usa na manutenção ou serviços"), o("Não compra fixadores", "@encerrar", "objecao", "Fora do perfil: não compra fixadores")], perfil, "confirma"),
  ];
}

/** 2. Enriquecedores: o que a conversa precisa descobrir sobre o lead. Todas deixam pular. */
function enriquece(last: string, tipo: Tipo, kind: "sdr" | "vendas"): ScriptNode[] {
  const aplic = tipo === "revenda" ? [o("Balcão e varejo", "enr_freq", "ok", "Aplicação: balcão e varejo"), o("Oficinas e frotas", "enr_freq", "ok", "Aplicação: oficinas e frotas"), o("Indústrias e construtoras", "enr_freq", "ok", "Aplicação: indústrias e construtoras"), o("Um pouco de tudo", "enr_freq", "ok", "Aplicação: variada")]
    : tipo === "producao" ? [o("Montagem do produto final", "enr_freq", "ok", "Aplicação: montagem do produto final"), o("Manutenção das máquinas", "enr_freq", "ok", "Aplicação: manutenção das máquinas"), o("Reposição e assistência técnica", "enr_freq", "ok", "Aplicação: reposição e assistência"), o("Mais de uma aplicação", "enr_freq", "ok", "Aplicação: variada")]
    : [o("Manutenção da própria frota", "enr_freq", "ok", "Aplicação: manutenção de frota"), o("Serviço para clientes", "enr_freq", "ok", "Aplicação: serviços para clientes"), o("Reposição e estoque", "enr_freq", "ok", "Aplicação: reposição e estoque"), o("Mais de uma aplicação", "enr_freq", "ok", "Aplicação: variada")];
  const skip = o("Prefere não responder", "enr_freq", "neutro");
  return [
    ...(kind === "sdr" ? [fala("enr_conhece", "Conhece a Fey?", "Você já conhece os produtos da Fey? Já foi ou é cliente nosso?", [o("É ou já foi cliente da Fey", "enr_mix", "ok", "Já é ou foi cliente Fey"), o("Compra Fey por um distribuidor", "enr_mix", "neutro", "Compra Fey por distribuidor (anotar qual)"), o("Compra de um concorrente", "enr_mix", "neutro", "Compra de concorrente (anotar qual)"), o("Não conhece a Fey", "enr_mix", "neutro", "Não conhece a Fey"), o("Prefere não responder", "enr_mix")], "Se compra de distribuidor ou concorrente, pergunte qual e anote o nome na observação.")] : []),
    fala("enr_mix", "Quais produtos compra", "Quais produtos vocês mais compram? É um mix, com vários itens, ou só alguns específicos?", [o("Mix variado de itens", "enr_aplicacao", "ok", "Compra mix variado"), o("Poucos itens específicos", "enr_aplicacao", "ok", "Compra poucos itens específicos"), o("Só um item", "enr_aplicacao", "neutro", "Compra um item só"), o("Não soube dizer", "enr_aplicacao")], "Anote os itens e como é a composição do mix: isso vira a cotação do vendedor."),
    fala("enr_aplicacao", "Onde aplica", "E onde vocês aplicam esses produtos no dia a dia?", [...aplic, skip]),
    fala("enr_freq", "Frequência de compra", "Com que frequência vocês compram?", [o("Toda semana", "enr_func", "ok", "Compra toda semana"), o("Todo mês", "enr_func", "ok", "Compra todo mês"), o("A cada dois ou três meses", "enr_func", "neutro", "Compra a cada 2 ou 3 meses"), o("Só quando precisa", "enr_func", "neutro", "Compra só sob demanda")]),
    fala("enr_func", "Tamanho da empresa", "Mais ou menos quantas pessoas trabalham aí?", [o("Até 5", last, "neutro", "Funcionários: até 5"), o("De 6 a 20", last, "ok", "Funcionários: 6 a 20"), o("De 21 a 100", last, "ok", "Funcionários: 21 a 100"), o("Mais de 100", last, "ok", "Funcionários: mais de 100"), o("Não soube dizer", last)]),
  ];
}

/** Pedido mínimo (confirmação) e proposta com os 25%. */
const minimo = (to: string): ScriptNode =>
  fala("conf_minimo", "Confirmar o pedido mínimo", `Pra você ter uma ideia: o primeiro pedido tem mínimo de ${FIRST} e, do segundo em diante, ${NEXT}. E eu aplico 25% de desconto no pedido, então o valor mínimo continua o mesmo, mas você leva mais produto por ele. Isso cabe na realidade da {empresa}?`, [o("Cabe, comporta o pedido", to, "ok", `Comporta o pedido mínimo (${FIRST} e ${NEXT})`), o("Depende do mix", to, "neutro", "Pedido mínimo depende do mix"), o("Acha alto", "obj_minimo", "objecao"), o("Não soube dizer", to)], "Confirme a capacidade de compra: R$ 3.500 no primeiro pedido e R$ 2.500 do segundo em diante.", "confirma");

/** Objeções: cada uma tem a resposta e dois caminhos (aceitou ou insistiu). `back` é onde a conversa volta. */
function objecoes(back: string, foco: "visita" | "venda"): ScriptNode[] {
  const dica = foco === "visita" ? "O foco é a visita: detalhes de preço ficam com o vendedor. Pode citar o desconto de 25% sem prometer valores." : "Você pode chegar a 26% de desconto, mas ofereça 25% primeiro: escalone, não comece pelo máximo.";
  const ok = (l: string, note?: string) => o(l, back, "ok", note);
  const nao = (note?: string) => o("Continua firme na negativa", "@encerrar", "objecao", note);
  const outra = o("Levantou outra objeção", "obj_menu", "neutro");
  return [
    fala("obj_menu", "Qual foi a objeção?", "Entendi. Me conta qual é a principal dúvida ou preocupação, que eu te ajudo com isso.", [o("Preço", "obj_preco", "objecao"), o("Prazo de entrega", "obj_prazo", "objecao"), o("Qualidade e garantia", "obj_qualidade", "objecao"), o("Forma de pagamento", "obj_pagamento", "objecao"), o("Frete", "obj_frete", "objecao"), o("Pedido mínimo", "obj_minimo", "objecao"), o("Outras objeções…", "obj_menu2", "neutro")], "Escute até o fim antes de responder. Escolha a que mais pesou para o cliente.", "objecao"),
    fala("obj_menu2", "Outras objeções", "Certo. E tem mais alguma coisa que está pesando na decisão?", [o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Compra por distribuidor", "obj_distribuidor", "objecao"), o("Concorrente mais barato", "obj_concorrente", "objecao"), o("Precisa falar com sócio ou decisor", "obj_socio", "objecao"), o("Sem tempo agora", "obj_tempo", "objecao"), o("Manda por e-mail ou WhatsApp", "obj_enviar", "objecao"), o("Estoque cheio, sem necessidade agora", "obj_estoque", "objecao"), o("Sem interesse", "obj_nao", "objecao")], undefined, "objecao"),
    fala("obj_preco", "Acha caro", "Entendo, e vou ser transparente: o nosso custa um pouco mais que o do mercado, porque é linha premium e dura mais. Por isso eu aplico 25% de desconto no pedido: o valor mínimo continua o mesmo, mas você leva mais produto pelo mesmo dinheiro. Faz sentido olhar assim?", [ok("Aceitou olhar assim"), o("Ainda acha caro", "obj_valor", "objecao"), outra], dica),
    fala("obj_valor", "Mostrar o valor", "Quando o fixador dura mais e não dá retrabalho, a conta final sai a favor de vocês. Posso te mandar uma comparação por item, com os produtos que vocês já compram, pra você conferir com calma?", [ok("Aceitou a comparação", "Pediu comparação por item"), nao("Preço acima do mercado")], dica),
    fala("obj_prazo", "Prazo de entrega", "Prazo é um ponto forte nosso: a Fey trabalha com entrega firme, combinada na cotação, por região. Que prazo você precisa pra ficar tranquilo?", [ok("Informou o prazo que precisa", "Prazo de entrega é prioridade"), nao(), outra], "Não prometa um número de dias: o vendedor confirma o prazo exato na cotação."),
    fala("obj_qualidade", "Qualidade e garantia", "Faz bem em perguntar. A Fey é fabricante e a nossa linha é premium. Posso até mandar uma amostra pra você testar. O que costuma dar problema nos fixadores que vocês usam hoje?", [ok("Contou o problema que tem hoje", "Reclama da qualidade do fornecedor atual"), ok("Pediu amostra", "Pediu amostra"), nao(), outra], undefined),
    fala("obj_pagamento", "Forma de pagamento", "A condição de pagamento a gente combina no pedido, conforme a análise de cadastro, e o vendedor busca a melhor opção pra vocês. Qual forma costuma ser melhor pra {empresa}?", [ok("Disse como prefere pagar", "Preferência de pagamento informada"), nao(), outra], "Não prometa prazo ou parcelamento: depende da análise."),
    fala("obj_frete", "Frete", "O frete é calculado na cotação, conforme a região e a transportadora, e a gente trabalha com as principais. Em que cidade seria a entrega?", [ok("Informou o local de entrega", "Frete: informou local de entrega"), nao(), outra], undefined),
    fala("obj_minimo", "Pedido mínimo alto", `Entendo. O mínimo é de ${FIRST} só no primeiro pedido e cai pra ${NEXT} do segundo em diante. Com os 25% de desconto, esse valor rende bastante produto. Dá pra montar com os itens que vocês mais usam, num pedido só.`, [ok("Aceitou montar o pedido"), o("Compra bem menos que isso", "obj_minimo2", "objecao"), outra], "Confirme se o volume dele chega ao mínimo: R$ 3.500 no primeiro e R$ 2.500 depois."),
    fala("obj_minimo2", "Volume abaixo do mínimo", "Se a gente juntar o mix completo, ou reunir as compras de mais de uma unidade, o valor chega mais fácil. Vale ver quais itens se encaixam?", [ok("Topou ver o mix", "Pode chegar ao mínimo com o mix completo"), nao("Volume abaixo do pedido mínimo")], undefined),
    fala("obj_fornecedor", "Já tem fornecedor", "Que bom, isso mostra que vocês levam a reposição a sério. Eu não quero que você troque ninguém: a ideia é a Fey ser a segunda opção nos dias em que o atual falha, e quem sabe a primeira nos itens em que a gente for melhor.", [ok("Topou conhecer a Fey", "Tem fornecedor, topou conhecer"), nao("Mantém o fornecedor atual"), outra], "Nunca fale mal do concorrente. Posicione a Fey como reserva de confiança."),
    fala("obj_distribuidor", "Compra por distribuidor", "Isso é ótimo: então vocês já conhecem a Fey. Comprando direto da fábrica a condição melhora e o prazo fica mais firme. Qual distribuidor vocês usam hoje? Posso te mostrar como ficaria comprando direto.", [ok("Informou o distribuidor e quer ver", "Compra por distribuidor (anotar qual)"), o("Prefere manter o distribuidor", "@encerrar", "objecao", "Prefere manter o distribuidor"), outra], "Anote qual é o distribuidor. Não force: se ele gosta do distribuidor, deixe a porta aberta."),
    fala("obj_concorrente", "Concorrente mais barato", "Faz sentido comparar. A Fey é fabricante e não trabalha com o preço mais baixo: é produto premium. Com 25% de desconto no pedido a conta fica bem competitiva por item. Posso montar uma comparação com os itens que você já compra?", [ok("Aceitou a comparação", "Concorrente mais barato: pediu comparação"), nao("Fechado com concorrente"), outra], dica),
    fala("obj_socio", "Precisa falar com o sócio", "Claro, faz sentido envolver quem decide junto. Qual o melhor horário pra conversarmos os dois juntos?", [o("Combinou com o decisor", "@retorno", "ok", "Conversa com o decisor agendada"), nao("Não passou o decisor")], undefined),
    fala("obj_tempo", "Sem tempo agora", "Claro, imagino como a rotina é corrida. Em duas frases: fixadores direto da fábrica, linha premium e entrega firme. Qual o melhor horário pra eu te ligar com calma, uns cinco minutinhos?", [o("Deu um horário", "@retorno", "ok", "Pediu retorno em outro horário"), o("Pediu pra não ligar mais", "@encerrar", "objecao", "Pediu para não ser contatado")], undefined),
    fala("obj_enviar", "Manda por e-mail ou WhatsApp", "Mando sim! Pra ficar certeiro, me diz só o que vocês mais compram, assim já mando só o que interessa. Qual e-mail ou WhatsApp é melhor?", [o("Passou o contato e os itens", "@retorno", "ok", "Pediu material por e-mail ou WhatsApp"), ok("Aceitou conversar um pouco antes"), nao()], "Combine o retorno: “te ligo depois de amanhã pra saber o que achou”."),
    fala("obj_estoque", "Estoque cheio", "Entendo, sem pressa. Posso deixar tudo pronto pra quando o estoque baixar? Assim, quando precisar, vocês agem rápido.", [o("Combinou um retorno", "@retorno", "ok", "Estoque cheio: retornar mais tarde"), nao("Sem necessidade no momento")], undefined),
    fala("obj_nao", "Sem interesse", "Tudo bem, agradeço a atenção! Só pra eu entender: é porque vocês já estão bem atendidos ou porque o momento não é bom? Pergunto pra não te incomodar à toa.", [ok("Explicou o motivo e abriu espaço"), o("Encerrou a conversa", "@encerrar", "objecao", "Sem interesse")], "Essa pergunta de saída ajuda a registrar o motivo. Se for um “não” firme, agradeça e saia bem."),
  ];
}

function sdr(s: (typeof SEG)[string]): { nodes: ScriptNode[]; startId: string } {
  const pitchPor: Record<Tipo, string> = {
    revenda: `{contato}, vou ser direto pra não tomar seu tempo: a Fey é fábrica de fixadores e ajuda quem revende ${s.itens} a não ficar na mão com ${s.dor}. A nossa linha é premium e a entrega tem prazo firme. Hoje, como vocês repõem esses itens?`,
    producao: `{contato}, vou ser direto pra não tomar seu tempo: a Fey é fábrica de fixadores e ajuda quem usa ${s.itens} na produção a não ter ${s.dor}. A nossa linha é premium e a entrega tem prazo firme. Hoje, como vocês compram esses itens?`,
    servico: `{contato}, vou ser direto pra não tomar seu tempo: a Fey é fábrica de fixadores e ajuda quem trabalha com ${s.itens} a não ter ${s.dor}. A nossa linha é premium e a entrega tem prazo firme. Hoje, como vocês compram esses itens?`,
  };
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", "Oi, bom dia! Aqui é {meunome}, da Fey. Falo com {contato} da {empresa}?", [o("Era a pessoa certa", "conf_empresa", "ok"), o("Atendeu a recepção", "secretaria"), o("Não é essa pessoa", "quem", "objecao"), o("Caixa postal ou ninguém atendeu", "sem_resp")], "Sorria enquanto fala: a voz muda. Agora seu único objetivo é abrir a conversa."),
    ...entrada("conf_empresa", s.itens),
    ...confirma("pitch", s.itens, s.tipo),
    fala("pitch", "Despertar interesse", pitchPor[s.tipo], [o("Mostrou interesse ou contou como compra", "enr_conhece", "ok"), o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Disse que é caro", "obj_preco", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Não tem interesse", "obj_nao", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Depois da pergunta, escute. Quem fala menos conduz mais a conversa."),
    ...enriquece("conf_minimo", s.tipo, "sdr"),
    minimo("visita"),
    fala("visita", "Marcar a conversa", "Pelo que você me contou, vale muito a gente se conhecer. Um especialista nosso te mostra o catálogo e já leva uma proposta pensada pra {empresa}. Pode ser presencial, com um representante, ou online, por vídeo. Qual fica melhor pra você, e que dia e horário?", [o("Visita presencial (representante)", "@visita", "ok", "Agendado: visita presencial"), o("Reunião online (vendedor SDR)", "@visita", "ok", "Agendado: reunião online"), o("Prefere receber por e-mail ou WhatsApp", "digital"), o("Sem disponibilidade agora", "obj_tempo", "objecao"), o("Recusou", "obj_nao", "objecao")], "Dê sempre duas opções de dia e horário. Evite perguntar “quer que eu marque?”. Você agenda com o vendedor SDR ou com o representante.", "proposta"),
    fala("digital", "Seguir pelo digital", "Perfeito! Te mando agora um material curtinho. Posso te ligar depois de amanhã pra saber o que você achou? Se fizer sentido, a gente já marca a conversa.", [o("Concordou", "@retorno", "ok", "Enviar material e retornar em 2 dias"), o("Mesmo assim recusou", "obj_nao", "objecao")], undefined, "apoio"),
    ...objecoes("visita", "visita"),
  ];
  return { nodes, startId: "abertura" };
}

function vendas(s: (typeof SEG)[string]): { nodes: ScriptNode[]; startId: string } {
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", `Oi, bom dia! Aqui é {meunome}, da Fey. Falo com {contato} da {empresa}? Estou ligando pra entender melhor o que vocês compram de ${s.itens} e ver como a gente pode ajudar.`, [o("Era a pessoa certa", "conf_papel", "ok"), o("Atendeu a recepção", "secretaria"), o("Não é essa pessoa", "quem", "objecao"), o("Caixa postal ou ninguém atendeu", "sem_resp")], "Aqui o objetivo é cotar e vender. Seja direto e consultivo, como quem quer ajudar."),
    ...entrada("conf_papel", s.itens),
    ...confirma("desc_itens", s.itens, s.tipo).filter((n) => n.id !== "conf_empresa" && n.id !== "conf_segmento").map((n) => (n.id === "conf_papel" ? { ...n, options: n.options.map((x) => (x.to === "conf_segmento" ? { ...x, to: "desc_itens" } : x)) } : n)),
    fala("desc_itens", "Descobrir a necessidade", "Pra eu montar uma cotação certinha pra {empresa}: quais itens vocês mais compram e em que quantidade por mês?", [o("Passou itens e quantidades", "enr_mix", "ok", "Passou itens e quantidades para a cotação"), o("Pediu a tabela de preços", "tabela"), o("Já tem fornecedor fechado", "obj_fornecedor", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Anote itens e quantidades: é isso que vira a cotação.", "pergunta"),
    fala("tabela", "Só a tabela", "Posso mandar a tabela, sim. Mas a cotação sob medida costuma sair melhor pra vocês. Se você me confirmar os três itens de maior giro, já te devolvo o valor hoje. Pode ser?", [o("Passou os itens", "enr_mix", "ok"), o("Quer só a tabela mesmo", "@cotacao", "neutro", "Pediu somente a tabela")], undefined, "proposta"),
    ...enriquece("conf_minimo", s.tipo, "vendas"),
    minimo("proposta"),
    fala("proposta", "Apresentar a proposta", "Com esses itens eu monto sua cotação ainda hoje. A nossa linha é premium, com entrega firme, e eu aplico 25% de desconto no pedido: o valor mínimo continua o mesmo, mas você leva mais produto por ele. Prefere receber por e-mail ou por WhatsApp?", [o("Quer receber a cotação", "@cotacao", "ok", "Cotação enviada por e-mail ou WhatsApp"), o("Quer fechar já", "fechar", "ok"), o("Disse que é caro", "obj_preco", "objecao"), o("Quer pensar", "obj_pensar", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Você consegue chegar a 26%, mas ofereça 25% primeiro: escalone, não comece pelo máximo.", "proposta"),
    fala("fechar", "Fechar o pedido", "Perfeito! Vou confirmar com você: itens, quantidades, forma de pagamento e endereço de entrega. Posso abrir o pedido agora?", [o("Confirmou tudo", "@venda", "ok", "Pedido confirmado na ligação"), o("Faltou ajustar algo", "proposta", "neutro"), o("Quer pensar mais um pouco", "obj_pensar", "objecao")], "Repita itens, valores e prazo em voz alta antes de abrir o pedido.", "fechamento"),
    fala("obj_pensar", "Quer pensar", "Claro, sem pressa. Pra eu te ajudar a decidir: o que você ainda precisa ver, o prazo, a condição de pagamento ou a garantia? A gente combina um retorno daqui a dois dias?", [o("Combinou o retorno", "@retorno", "ok", "Combinado retorno em 2 dias"), o("Disse o que falta decidir", "obj_menu", "neutro"), o("Não quer retorno", "@encerrar", "objecao")], undefined, "objecao"),
    ...objecoes("proposta", "venda"),
  ];
  return { nodes, startId: "abertura" };
}

function retorno(s: (typeof SEG)[string]): { nodes: ScriptNode[]; startId: string } {
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", "Oi, {contato}, tudo bem? Aqui é {meunome}, da Fey. Te liguei pra saber o que você achou da cotação que mandei pra {empresa}.", [o("Já viu e está analisando", "duvidas", "ok"), o("Ainda não viu", "reenviar"), o("Quer fechar", "fechar", "ok"), o("Achou caro", "obj_preco", "objecao"), o("Fechou com outro", "motivo", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Ligue em até dois dias úteis depois de enviar a cotação."),
    fala("duvidas", "Tirar dúvidas", "Ficou alguma dúvida sobre os itens, o prazo ou a forma de pagamento? Se quiser, eu ajusto a cotação agora, enquanto a gente conversa.", [o("Sem dúvidas, vai fechar", "fechar", "ok"), o("Pediu um ajuste", "@cotacao", "neutro", "Pediu ajuste na cotação"), o("Dúvida sobre o produto", "duvida_tec", "neutro"), o("Ainda vai decidir", "prazo", "neutro"), o("Levantou uma objeção", "obj_menu", "objecao")], undefined, "pergunta"),
    fala("duvida_tec", "Dúvida sobre o produto", `Boa pergunta. Qual é a aplicação exata? Assim eu confirmo direitinho se o ${s.um} serve, ou peço pro nosso time técnico te responder ainda hoje.`, [o("Explicou a aplicação", "@retorno", "ok", "Dúvida técnica: confirmar com o time técnico e retornar"), o("Resolveu na hora", "fechar", "ok")], "Anote a aplicação com o máximo de detalhe. Nunca invente uma resposta técnica: confirme antes.", "pergunta"),
    fala("reenviar", "Reenviar a cotação", "Sem problema! Reenvio agora por e-mail e WhatsApp. Posso te ligar daqui a dois dias pra gente conversar?", [o("Combinado", "@retorno", "ok", "Cotação reenviada, retornar em 2 dias")], undefined, "apoio"),
    fala("fechar", "Fechar o pedido", "Que bom! Vou confirmar com você: itens, quantidades, forma de pagamento e endereço de entrega. Posso abrir o pedido agora?", [o("Confirmou tudo", "@venda", "ok", "Pedido confirmado na ligação"), o("Faltou ajustar algo", "duvidas", "neutro")], "Repita itens, valores e prazo em voz alta antes de abrir o pedido.", "fechamento"),
    fala("prazo", "Combinar o retorno", "Quando você consegue me dar uma resposta? Eu anoto aqui e te ligo nesse dia, pra não te cobrar fora de hora.", [o("Deu uma data", "@retorno", "ok", "Retornar na data combinada")], undefined, "apoio"),
    fala("motivo", "Entender o motivo", "Obrigado por me avisar! Só pra eu melhorar: foi preço, prazo ou outra coisa? Posso te procurar de novo mês que vem?", [o("Contou o motivo e permitiu novo contato", "@retorno", "neutro", "Fechou com outro: procurar de novo em 1 mês"), o("Encerrou a conversa", "@encerrar", "objecao", "Fechou com outro fornecedor")], "Registre o motivo no sistema: ele ajuda o time inteiro.", "pergunta"),
    ...objecoes("fechar", "venda"),
  ];
  return { nodes, startId: "abertura" };
}

/** 3. Fidelizadores: quem já compra (Televendas). */
function fidelizar(s: (typeof SEG)[string]): { nodes: ScriptNode[]; startId: string } {
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", "Oi, {contato}, tudo bem? Aqui é {meunome}, da Fey. Estou ligando pra saber como estão as coisas com a gente e ver se posso ajudar em alguma coisa.", [o("Atendeu e quer conversar", "fid_continua", "ok"), o("Atendeu a recepção", "secretaria"), o("Não é essa pessoa", "quem", "objecao"), o("Caixa postal ou ninguém atendeu", "sem_resp")], "Cliente que compra tem que sentir que é lembrado, e não só cobrado.", "fideliza"),
    ...entrada("fid_continua", s.itens),
    fala("fid_continua", "Continua comprando?", "Vocês continuam comprando com a Fey? Como tem sido a experiência com os produtos e com a entrega?", [o("Sim, segue comprando normalmente", "fid_duvidas", "ok", "Continua comprando com a Fey"), o("Está comprando menos que antes", "fid_motivo", "neutro", "Reduziu as compras"), o("Parou de comprar", "fid_motivo", "objecao", "Parou de comprar"), o("Está comprando de outro fornecedor", "obj_concorrente", "objecao", "Comprando de outro fornecedor")], "Escute com atenção: queixa bem recebida vira fidelidade.", "fideliza"),
    fala("fid_motivo", "Entender a mudança", "Obrigado por contar. O que mudou: foi preço, prazo, algum problema com o produto ou o volume mesmo que caiu?", [o("Foi preço", "obj_preco", "objecao", "Motivo da queda: preço"), o("Foi prazo ou entrega", "obj_prazo", "objecao", "Motivo da queda: prazo de entrega"), o("Teve problema com produto", "fid_tecnica", "objecao", "Motivo da queda: problema com produto"), o("O volume caiu mesmo", "fid_reposicao", "neutro", "Motivo da queda: menos necessidade")], undefined, "fideliza"),
    fala("fid_duvidas", "Precisa tirar dúvidas?", "Que bom! E ficou alguma dúvida pendente com a gente, sobre produto, pedido ou entrega? Se tiver, resolvo agora.", [o("Sem dúvidas", "fid_reposicao", "ok"), o("Dúvida sobre produto", "fid_tecnica", "neutro", "Dúvida sobre produto"), o("Dúvida sobre pedido ou entrega", "fid_pedido", "neutro", "Dúvida sobre pedido ou entrega")], undefined, "fideliza"),
    fala("fid_tecnica", "Dúvida ou problema técnico", "Pode me explicar com detalhes qual é a aplicação e o que aconteceu? Assim eu levo pro nosso time técnico e te retorno ainda hoje, sem enrolação.", [o("Explicou o caso", "@retorno", "ok", "Caso técnico: acionar o time técnico e retornar hoje"), o("Resolveu na hora", "fid_reposicao", "ok")], "Anote tudo e acione o time técnico. Nunca invente uma resposta técnica.", "fideliza"),
    fala("fid_pedido", "Pedido ou entrega", "Me passa o número do pedido ou a data, que eu verifico agora e já te digo o que aconteceu.", [o("Passou os dados", "@retorno", "ok", "Verificar pedido ou entrega e retornar"), o("Resolveu na hora", "fid_reposicao", "ok")], undefined, "fideliza"),
    fala("fid_reposicao", "Oferecer reposição", `Pra manter tudo em dia: quer que eu já monte a reposição dos itens que mais giram? Eu aplico 25% de desconto no pedido e o mínimo é de ${NEXT} do segundo pedido em diante, então você leva bastante produto.`, [o("Quer repor agora", "@venda", "ok", "Reposição fechada na ligação"), o("Quer ver novidades do catálogo", "fid_catalogo", "ok"), o("Vai precisar mais pra frente", "@retorno", "neutro", "Retornar para a próxima reposição"), o("Levantou uma objeção", "obj_menu", "objecao")], "Pergunte o que está acabando e já sugira itens complementares.", "proposta"),
    fala("fid_catalogo", "Apresentar novidades", `Temos ${s.itens} e peças especiais que combinam com o que vocês já compram. Posso te mandar o catálogo atualizado e já separar uma sugestão de itens pro seu perfil. Prefere por e-mail ou WhatsApp?`, [o("Quer receber o catálogo", "@retorno", "ok", "Enviar catálogo e sugestão de itens"), o("Quer um pedido com novidades", "@venda", "ok", "Pedido com itens novos"), o("Agora não", "@retorno", "neutro", "Retornar em outro momento")], undefined, "proposta"),
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
