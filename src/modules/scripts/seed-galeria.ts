import type { ScriptNode } from "@/config/scripts";
import type { ScriptTask } from "@/config/tasks";
import { PARES, SEG, T, fala, o } from "./seed-core";

type Seg = (typeof SEG)[string];
const VOLTA = "§voltar";
const tk = (kind: ScriptTask["kind"], title: string, days: number): ScriptTask => ({ kind, title, days });
const ok = (label: string, note?: string, tasks?: ScriptTask[]) => ({ ...o(label, VOLTA, "ok", note), ...(tasks ? { tasks } : {}) });
const meh = (label: string, note?: string) => o(label, VOLTA, "neutro", note);
const no = (label: string, note?: string) => o(label, VOLTA, "objecao", note);

/**
 * Galeria: módulos extras que não fazem parte do caminho de fábrica, mas que o sistema sugere durante a ligação
 * (ou que a pessoa chama) quando encaixam. Cada módulo é independente e, ao terminar, volta ao passo de onde se saiu.
 * Base: estudo de técnicas de vendas e cold call em conteúdo brasileiro (SPIN, perguntas de concordância, prova social,
 * custo total, reciprocidade, próximo passo com silêncio, cadência de WhatsApp e despedida). Veja claude/scripts-estudo-vendas.md.
 */
export function galeria(s: Seg): ScriptNode[] {
  const pares = PARES[s.tipo];
  return [
    /* ───────── Descoberta com SPIN ───────── */
    fala("gx_spin_s", "Como compram hoje", T(
      `Me conta como funciona aí hoje. Quando falta ${s.um} ou outro fixador, vocês pedem pra quem e em quanto tempo costuma chegar?`,
      `Pode me contar como funciona hoje? Quando falta ${s.um} ou outro fixador, vocês pedem a quem e em quanto tempo costuma chegar?`,
      `Me conta como funciona aí hoje! Quando falta ${s.um} ou outro fixador, vocês pedem pra quem e em quanto tempo costuma chegar?`,
    ), [o("Contou como compra hoje", "gx_spin_p", "ok", "Contou como compra hoje e em quanto tempo chega"), meh("Não quis detalhar")],
    "Primeira pergunta do SPIN, de situação. É só para entender o jeito de comprar. Escute, não interrompa, e use o que ele disser nas próximas perguntas.", "pergunta"),
    fala("gx_spin_p", "O que dá errado", T(
      `E nessa rotina, o que mais te dá dor de cabeça? É item que falta, entrega que atrasa, peça que não bate com o pedido ou preço?`,
      `E nessa rotina, o que mais lhe causa transtorno? Item que falta, entrega que atrasa, peça que não corresponde ao pedido ou preço?`,
      `E nessa rotina, o que mais te dá dor de cabeça? Item que falta, entrega que atrasa, peça que vem diferente do pedido ou o preço?`,
    ), [o("Falta de item", "gx_spin_i", "ok", "Dor: falta de item"), o("Atraso na entrega", "gx_spin_i", "ok", "Dor: atraso na entrega"), o("Peça diferente do pedido", "gx_spin_i", "ok", "Dor: peça fora da especificação"), o("Preço", "gx_spin_i", "neutro", "Dor: preço"), no("Diz que nada dá problema")],
    "Pergunta de problema. Foque em uma ou duas dores. Se ele disser que nada dá problema, não discuta: volte ao roteiro.", "pergunta"),
    fala("gx_spin_i", "O que isso custa", T(
      `E quando isso acontece, o que fica parado do lado de vocês? Pensa em ${s.dor}. Em um mês normal, quanto isso pesa, mais ou menos?`,
      `E quando isso ocorre, o que fica parado do lado de vocês? Pense em ${s.dor}. Em um mês normal, quanto isso pesa, aproximadamente?`,
      `E quando isso acontece, o que fica parado aí do lado de vocês? Pensa em ${s.dor}. Num mês normal, quanto isso pesa, mais ou menos?`,
    ), [o("Contou o impacto", "gx_spin_n", "ok", "Contou o que a falha custa"), meh("Disse que pesa pouco")],
    "Pergunta de implicação. Aqui o lead sente o tamanho do problema com as próprias palavras. Se pesa pouco, não force: ele só precisa saber que existe uma segunda opção.", "pergunta"),
    fala("gx_spin_n", "Se resolvesse", T(
      `Se você tivesse um fornecedor que entregasse o item certo no prazo combinado, isso faria diferença pra vocês?`,
      `Se tivesse um fornecedor que entregasse o item certo no prazo combinado, isso faria diferença para vocês?`,
      `Se você tivesse um fornecedor que entregasse o item certo no prazo combinado, isso faria diferença aí?`,
    ), [ok("Disse que faria diferença", "Reconheceu a necessidade de um fornecedor confiável"), meh("Talvez, depende"), no("Disse que não faria diferença")],
    "Pergunta de necessidade. Deixe o lead dizer, com as palavras dele, o benefício. Só depois conecte com a Fey.", "pergunta"),

    /* ───────── Concordar critérios ───────── */
    fala("gx_conc", "Concordar critérios", T(
      `Posso te perguntar uma coisa? Pra vocês, ficar sem ${s.um} no meio do dia custa mais que o próprio parafuso, né? E ter alguém que entrega no prazo combinado vale mais que economizar uns centavos por peça?`,
      `Posso lhe perguntar algo? Para vocês, ficar sem ${s.um} em pleno expediente custa mais que o próprio parafuso, correto? E ter alguém que entregue no prazo combinado vale mais que economizar centavos por peça?`,
      `Posso te perguntar uma coisa? Pra vocês, ficar sem ${s.um} no meio do dia custa mais que o próprio parafuso, né? E ter alguém que entrega no prazo combinado vale mais que economizar uns centavos por peça?`,
    ), [ok("Concordou nos dois pontos", "Concordou que prazo e item certo valem mais que centavos"), meh("Concordou em um só"), no("Discordou")],
    "Duas perguntas que quase todo mundo responde “sim”. Servem para avançar ao próximo passo, não para fechar. Se ele discordar, escute e ajuste a conversa, sem insistir.", "confirma"),

    /* ───────── Prova social ───────── */
    fala("gx_prova", "Quem já compra da Fey", T(
      `A Fey já atende ${pares}, gente com uma rotina parecida com a sua. Por isso eu sei o que costuma apertar. Você conhece alguém aí da região que já compra da gente?`,
      `A Fey já atende ${pares}, com uma rotina semelhante à sua. Por isso sei o que costuma ser mais difícil. Você conhece alguém da região que já compre conosco?`,
      `A Fey já atende ${pares}, gente com uma rotina parecida com a sua. Por isso eu sei o que costuma apertar. Você conhece alguém aí da região que já compra da gente?`,
    ), [ok("Conhece quem já compra", "Conhece cliente da Fey na região"), ok("Ficou mais confiante"), meh("Quer referência de cliente", "Pediu referência de cliente"), no("Continua desconfiado")],
    "Prova social vale quando é verdade e verificável. Cite o tipo de cliente, nunca invente nome nem número. Nome de cliente só com a autorização dele.", "confirma"),

    /* ───────── Custo de ficar parado ───────── */
    fala("gx_custo", "Custo de ficar parado", T(
      `Posso te pedir pra olhar por outro lado? O parafuso custa centavos. Agora pensa em ${s.dor}. Isso custa muito mais que o pedido inteiro, não é? Por isso a gente trabalha com prazo combinado e o item certo, e não só com o menor preço da peça.`,
      `Posso lhe pedir que olhe por outro ângulo? O parafuso custa centavos. Agora pense em ${s.dor}. Isso custa muito mais que o pedido inteiro, não é? Por isso trabalhamos com prazo combinado e o item certo, e não apenas com o menor preço da peça.`,
      `Posso te pedir pra olhar por outro lado? O parafuso custa centavos. Agora pensa em ${s.dor}. Isso custa muito mais que o pedido inteiro, né? Por isso a gente trabalha com prazo combinado e o item certo, e não só com o menor preço da peça.`,
    ), [ok("Concordou que o custo total pesa mais", "Entendeu o custo total além do preço da peça"), ok("Contou um caso de parada", "Contou um caso de parada por falta de fixador"), no("Acha que não se aplica a ele")],
    "Funciona depois da objeção de preço. Compare o preço da peça com o custo de parar. Pergunte quanto custou a última parada, para ele mesmo fazer a conta.", "proposta"),

    /* ───────── Oferecer algo útil ───────── */
    fala("gx_util", "Oferecer algo útil", T(
      `Posso te mandar, sem compromisso, uma lista com os itens que mais giram pra ${s.tipo === "revenda" ? "quem revende" : s.tipo === "producao" ? "quem produz" : "quem faz manutenção"}? Não precisa comprar nada, é só pra você ter à mão. Prefere por WhatsApp ou por e-mail?`,
      `Posso lhe enviar, sem compromisso, uma lista com os itens de maior giro para ${s.tipo === "revenda" ? "quem revende" : s.tipo === "producao" ? "quem produz" : "quem faz manutenção"}? Não é preciso comprar nada, é apenas para consulta. Prefere por WhatsApp ou por e-mail?`,
      `Posso te mandar, sem compromisso, uma lista com os itens que mais giram pra ${s.tipo === "revenda" ? "quem revende" : s.tipo === "producao" ? "quem produz" : "quem faz manutenção"}? Não precisa comprar nada, é só pra você ter à mão. Prefere por WhatsApp ou por e-mail?`,
    ), [ok("Aceitou por WhatsApp", "Aceitou receber a lista de itens por WhatsApp", [tk("whatsapp", "Enviar a lista de itens de maior giro", 0), tk("ligar", "Ligar para saber se a lista ajudou", 2)]), ok("Aceitou por e-mail", "Aceitou receber a lista de itens por e-mail", [tk("email", "Enviar a lista de itens de maior giro", 0), tk("ligar", "Ligar para saber se a lista ajudou", 2)]), meh("Não quis receber")],
    "Reciprocidade: dar antes de pedir. Não condicione à compra e não cobre retorno logo depois. Se pedir para não mandar nada, aceite.", "apoio"),

    /* ───────── Fechar o próximo passo ───────── */
    fala("gx_prox", "Fechar o próximo passo", T(
      `Então, pra não deixar solto, faz sentido a gente combinar uma conversa curta de dez minutos com o representante, por ligação ou WhatsApp? Eu consigo amanhã de manhã ou depois de amanhã à tarde. Qual fica melhor pra você?`,
      `Então, para não deixarmos em aberto, faz sentido combinarmos uma conversa curta de dez minutos com o representante, por ligação ou WhatsApp? Consigo amanhã pela manhã ou depois de amanhã à tarde. Qual fica melhor para você?`,
      `Então, pra não deixar solto, faz sentido a gente combinar uma conversa curta de dez minutos com o representante, por ligação ou WhatsApp? Eu consigo amanhã de manhã ou depois de amanhã à tarde. Qual fica melhor pra você?`,
    ), [ok("Escolheu dia e período", "Próximo passo combinado com dia e período"), meh("Pediu outro dia", "Pediu outro dia para a conversa"), no("Não quer marcar agora")],
    "Faça o pedido com duas opções e fique em silêncio. Quem preenche o silêncio perde o combinado. Depois, confirme por escrito no WhatsApp.", "fechamento"),

    /* ───────── Ciclo de reposição ───────── */
    fala("gx_ciclo", "Ciclo de reposição", T(
      `Cada cliente tem o seu ritmo. De quanto em quanto tempo vocês repõem ${s.itens}? Se você quiser, eu anoto e te ligo uns dias antes de acabar, pra você não ficar na mão.`,
      `Cada cliente tem o seu ritmo. De quanto em quanto tempo vocês repõem ${s.itens}? Se desejar, anoto e ligo alguns dias antes de acabar, para você não ficar sem.`,
      `Cada cliente tem o seu ritmo! De quanto em quanto tempo vocês repõem ${s.itens}? Se você quiser, eu anoto e te ligo uns dias antes de acabar, pra você não ficar na mão.`,
    ), [ok("Contou o ritmo e topou o lembrete", "Ciclo de reposição anotado e lembrete combinado", [tk("ligar", "Ligar antes da próxima reposição", 20)]), meh("Não tem ritmo fixo", "Reposição sem ritmo fixo"), meh("Prefere ligar quando precisar")],
    "Venda recorrente: saber o ritmo de cada cliente vale mais que esperar o próximo pedido. Registre o ritmo na observação.", "fideliza"),

    /* ───────── Cadência de WhatsApp ───────── */
    fala("gx_cad", "Cadência de WhatsApp", T(
      `Escolha o toque certo para mandar no WhatsApp. A sequência é no dia da ligação, depois de dois ou três dias, depois de cinco a sete, de dez a catorze e, por último, de dezessete a dezenove. Mude o assunto a cada toque. Se a pessoa responder, pare a sequência e converse.`,
      `Escolha o toque adequado para enviar no WhatsApp. A sequência é no dia da ligação, depois de dois ou três dias, depois de cinco a sete, de dez a catorze e, por fim, de dezessete a dezenove, mudando o assunto a cada toque. Se a pessoa responder, interrompa a sequência e converse.`,
      `Escolha o toque certo pra mandar no WhatsApp. A sequência é no dia da ligação, depois de dois ou três dias, depois de cinco a sete, de dez a catorze e, por último, de dezessete a dezenove. Mude o assunto a cada toque. Se a pessoa responder, pare a sequência e converse.`,
    ), [o("1º toque, no dia da ligação", "gx_cad1", "neutro"), o("2º toque, de 2 a 3 dias depois", "gx_cad2", "neutro"), o("3º toque, de 5 a 7 dias depois", "gx_cad3", "neutro"), o("4º toque, de 10 a 14 dias depois", "gx_cad4", "neutro"), o("5º toque, o último", "gx_cad5", "neutro"), meh("Não tem WhatsApp")],
    "Uma intenção por mensagem, curta, sem áudio nem anexo antes de a pessoa responder. Se pedir para parar, registre e pare.", "apoio"),
    fala("gx_cad1", "WhatsApp, 1º toque", T(
      `Mande no WhatsApp “{saudacao}! Aqui é {meunome}, da Fey, uma metalúrgica especializada em fixadores. Tentei falar com a {empresa} sobre a reposição de ${s.itens}. Posso te mandar por aqui, bem resumido, como a gente trabalha?”`,
      `Envie no WhatsApp “{saudacao}. Aqui é {meunome}, da Fey, uma metalúrgica especializada em fixadores. Tentei contato com a {empresa} a respeito da reposição de ${s.itens}. Posso enviar por aqui, de forma resumida, como trabalhamos?”`,
      `Mande no WhatsApp “{saudacao}! Aqui é {meunome}, da Fey, uma metalúrgica especializada em fixadores. Tentei falar com a {empresa} sobre a reposição de ${s.itens}. Posso te mandar por aqui, bem resumido, como a gente trabalha?”`,
    ), [ok("Mensagem enviada", "WhatsApp enviado, 1º toque", [tk("whatsapp", "2º toque no WhatsApp com prova social", 3)]), meh("Não tem WhatsApp")], "Peça permissão para mandar mais. Mensagem curta e uma pergunta só.", "apoio"),
    fala("gx_cad2", "WhatsApp, 2º toque", T(
      `Mande no WhatsApp “Oi, {meunome} de novo, da Fey. A gente atende ${pares}. Se fizer sentido, te mando só os itens de maior giro pra você olhar, sem compromisso. Pode ser?”`,
      `Envie no WhatsApp “{saudacao}, aqui é {meunome} novamente, da Fey. Atendemos ${pares}. Se fizer sentido, envio apenas os itens de maior giro para sua avaliação, sem compromisso. Pode ser?”`,
      `Mande no WhatsApp “Oi, {meunome} de novo, da Fey. A gente atende ${pares}. Se fizer sentido, te mando só os itens de maior giro pra você olhar, sem compromisso. Pode ser?”`,
    ), [ok("Mensagem enviada", "WhatsApp enviado, 2º toque", [tk("whatsapp", "3º toque no WhatsApp com pergunta", 3)]), meh("Não tem WhatsApp")], "Segundo ângulo: prova social e oferta pequena. Não repita o texto do primeiro toque.", "apoio"),
    fala("gx_cad3", "WhatsApp, 3º toque", T(
      `Mande no WhatsApp “Uma pergunta rápida pra eu não te mandar coisa à toa. Hoje, quando falta um fixador aí, como vocês resolvem?”`,
      `Envie no WhatsApp “Uma pergunta objetiva, para eu não enviar conteúdo desnecessário. Hoje, quando falta um fixador, como vocês resolvem?”`,
      `Mande no WhatsApp “Uma pergunta rápida pra eu não te mandar coisa à toa. Hoje, quando falta um fixador aí, como vocês resolvem?”`,
    ), [ok("Mensagem enviada", "WhatsApp enviado, 3º toque", [tk("whatsapp", "4º toque no WhatsApp pedindo permissão", 5)]), meh("Não tem WhatsApp")], "Terceiro ângulo: diagnóstico. Uma pergunta que a pessoa responde em uma linha.", "apoio"),
    fala("gx_cad4", "WhatsApp, 4º toque", T(
      `Mande no WhatsApp “Posso te mandar um resumo de três linhas do que a gente faz? Se não for o momento, é só me falar que eu paro por aqui.”`,
      `Envie no WhatsApp “Posso enviar um resumo de três linhas sobre o que fazemos? Se não for o momento, basta me avisar que interrompo o contato.”`,
      `Mande no WhatsApp “Posso te mandar um resumo de três linhas do que a gente faz? Se não for o momento, é só me falar que eu paro por aqui.”`,
    ), [ok("Mensagem enviada", "WhatsApp enviado, 4º toque", [tk("whatsapp", "Último toque no WhatsApp", 5)]), meh("Não tem WhatsApp")], "Quarto ângulo: permissão e saída fácil. Quem recebe a opção de parar costuma responder.", "apoio"),
    fala("gx_cad5", "WhatsApp, 5º toque", T(
      `Mande no WhatsApp “{saudacao}, aqui é {meunome}, da Fey. Vou parar de te chamar por aqui pra não incomodar. Se mais pra frente quiser falar sobre ${s.itens}, é só me chamar. Um abraço!”`,
      `Envie no WhatsApp “{saudacao}, aqui é {meunome}, da Fey. Vou interromper as mensagens para não incomodar. Se mais adiante desejar tratar de ${s.itens}, fico à disposição. Um abraço!”`,
      `Mande no WhatsApp “{saudacao}, aqui é {meunome}, da Fey. Vou parar de te chamar por aqui pra não incomodar. Se mais pra frente quiser falar sobre ${s.itens}, é só me chamar. Um abraço!”`,
    ), [ok("Mensagem enviada", "WhatsApp enviado, último toque da sequência"), meh("Não tem WhatsApp")], "Último toque: despedida com a porta aberta. Depois dele, pause por trinta dias antes de voltar com um assunto novo.", "apoio"),

    /* ───────── Mensagem de despedida ───────── */
    fala("gx_desp", "Mensagem de despedida", T(
      `Escolha a despedida certa. Use quando já tentou várias vezes e não teve retorno. Pode pedir o motivo, deixar a porta aberta ou fazer a última tentativa.`,
      `Escolha a despedida adequada. Use quando já houve várias tentativas sem retorno. Pode pedir o motivo, deixar a porta aberta ou fazer a última tentativa.`,
      `Escolha a despedida certa. Use quando já tentou várias vezes e não teve retorno. Pode pedir o motivo, deixar a porta aberta ou fazer a última tentativa.`,
    ), [o("Pedir o motivo", "gx_desp_a", "neutro"), o("Deixar a porta aberta", "gx_desp_b", "neutro"), o("Última tentativa", "gx_desp_c", "neutro")],
    "Despedir bem transforma silêncio em informação ou em uma porta aberta. Não culpe o cliente por não ter respondido.", "apoio"),
    fala("gx_desp_a", "Despedida, pedir o motivo", T(
      `Mande no WhatsApp “Oi, {meunome}, da Fey. Como não tive retorno, imagino que agora não seja prioridade, e tá tudo bem. Me conta uma coisa, que eu quero melhorar. Foi o momento, o preço ou o assunto não faz sentido aí?”`,
      `Envie no WhatsApp “{saudacao}, {meunome}, da Fey. Como não houve retorno, imagino que agora não seja prioridade, e está tudo bem. Poderia me contar uma coisa para eu melhorar? Foi o momento, o preço ou o assunto não faz sentido para vocês?”`,
      `Mande no WhatsApp “Oi, {meunome}, da Fey. Como não tive retorno, imagino que agora não seja prioridade, e tá tudo bem. Me conta uma coisa, que eu quero melhorar. Foi o momento, o preço ou o assunto não faz sentido aí?”`,
    ), [ok("Mensagem enviada", "Despedida enviada pedindo o motivo"), meh("Não tem WhatsApp")], "Respeita a decisão e pergunta o motivo. A resposta, mesmo negativa, ensina o que ajustar.", "apoio"),
    fala("gx_desp_b", "Despedida, porta aberta", T(
      `Mande no WhatsApp “{saudacao}, {meunome}, da Fey. Vou deixar a conversa em pausa pra não incomodar. Se mais pra frente fizer sentido falar de ${s.itens}, é só me chamar por aqui. Um abraço!”`,
      `Envie no WhatsApp “{saudacao}, {meunome}, da Fey. Vou deixar a conversa em pausa para não incomodar. Se mais adiante fizer sentido tratar de ${s.itens}, é só me chamar por aqui. Um abraço!”`,
      `Mande no WhatsApp “{saudacao}, {meunome}, da Fey. Vou deixar a conversa em pausa pra não incomodar. Se mais pra frente fizer sentido falar de ${s.itens}, é só me chamar por aqui. Um abraço!”`,
    ), [ok("Mensagem enviada", "Despedida enviada com a porta aberta"), meh("Não tem WhatsApp")], "Fecha o ciclo com elegância e preserva a imagem da Fey.", "apoio"),
    fala("gx_desp_c", "Despedida, última tentativa", T(
      `Mande no WhatsApp “Última mensagem, prometo. Deixo aqui o meu contato pra quando precisarem de ${s.itens}. Se eu puder ajudar, é só chamar. Obrigado pela atenção!”`,
      `Envie no WhatsApp “Esta é a última mensagem. Deixo aqui o meu contato para quando precisarem de ${s.itens}. Se eu puder ajudar, basta chamar. Obrigado pela atenção!”`,
      `Mande no WhatsApp “Última mensagem, prometo! Deixo aqui o meu contato pra quando precisarem de ${s.itens}. Se eu puder ajudar, é só chamar. Valeu pela atenção!”`,
    ), [ok("Mensagem enviada", "Última mensagem enviada: encerrar a sequência"), meh("Não tem WhatsApp")], "Avisar que é a última dá ao cliente uma saída clara, e muita gente responde justo aqui.", "apoio"),
  ];
}
