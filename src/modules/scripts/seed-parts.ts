import type { ScriptNode, ScriptOption } from "@/config/scripts";
import { FEY, FIRST, NEXT, ONLINE, PAR, PARES, T, cat, fala, o, type Alvo, type Say, type Tipo, type Tri } from "./seed-core";

/**
 * Entrada da ligação, pensada para quem atendeu poder ser QUALQUER pessoa (dono, comprador, balcão, financeiro, recepção…).
 * Passos: abertura neutra (feita no objetivo) → nome → função da pessoa → caminho próprio de cada perfil.
 * Recepção, pessoa errada, transferência, caixa postal e WhatsApp também ficam aqui.
 */
export function entrada(nomeTo: string, itens: string, a: Alvo, tipo: Tipo): ScriptNode[] {
  const m = a.motivo;
  const tema = a.tema ?? T("sobre a reposição de parafusos e grampos", "sobre o fornecimento de parafusos e grampos", "sobre reposição de parafuso e grampo");
  const gk = a.gk ?? T(`Atendemos ${PARES[tipo]}, e é por isso que estou ligando.`, `Atendemos ${PARES[tipo]}, e esse é o motivo do contato.`, `Atende ${PARES[tipo]}, por isso estou ligando.`);
  const fecha = a.fecha ?? T("É coisa rápida, e quem cuida disso é quem decide se interessa. Essa pessoa consegue falar agora?", "É um assunto breve, e cabe a quem cuida disso decidir se há interesse. Essa pessoa poderia me atender agora?", "É rapidinho, e quem cuida disso é quem decide se vale a pena. Dá pra chamar essa pessoa?");
  /** "quem cuida das compras" → "a pessoa que cuida das compras" */
  const pessoa = a.quem.replace(/^quem /, "a pessoa que ");
  return [
    fala("secretaria", "Passar pela recepção", T(
      `Você poderia me ajudar? Preciso falar com ${a.quem} aí na {empresa}. Quem seria essa pessoa?`,
      `Poderia me ajudar, por gentileza? Gostaria de falar com ${a.quem} na {empresa}. Com quem eu devo falar?`,
      `Oi! Você me dá uma força? Tô procurando ${a.quem} aí na {empresa}. Quem é que cuida disso?`,
    ), [o("Vai passar a ligação", "transferido", "ok", "Recepção transferiu a ligação"), o("Perguntou qual é o assunto", "assunto"), o("O responsável não está", "horario"), o("Pediu para mandar e-mail", "rec_email"), o("Disse que não precisam", "obj_nao", "objecao")],
    "Peça ajuda, não permissão. A recepção não decide, mas abre ou fecha a porta: seja cordial, use o nome dela e nunca minta sobre quem você é nem invente projeto ou indicação. Pergunta aberta (“quem seria?”) funciona melhor que “posso falar com o responsável?”. Nunca use a palavra “barreira” em voz alta.", "ponte"),
    fala("assunto", "Dizer o assunto", T(
      `Claro! A Fey é uma metalúrgica e fabrica ${itens}. ${m.n} ${fecha.n}`,
      `Com certeza. A Fey é uma metalúrgica e fabrica ${itens}. ${m.f} ${fecha.f}`,
      `Claro! A Fey é uma metalúrgica, a gente fabrica ${itens}. ${m.s} ${fecha.s}`,
    ), [o("Passou a ligação", "transferido", "ok", "Recepção transferiu a ligação"), o("Perguntou quem é a Fey", "gk_quem"), o("Anotou um recado", "horario"), o("Pediu para mandar e-mail", "rec_email"), o("Recusou", "obj_nao", "objecao")],
    "Um motivo curto, honesto e sem jargão. Quem entende o assunto passa a ligação com mais facilidade. Não conte o pitch inteiro: a recepção não é quem decide.", "ponte"),
    fala("gk_quem", "Quem é a Fey", T(
      `Somos uma metalúrgica de fixadores: fabricamos ${itens}. ${gk.n} Quem cuida disso aí já pode ter ouvido falar da gente. Consegue me passar pra essa pessoa?`,
      `A Fey é uma metalúrgica de fixadores e fabrica ${itens}. ${gk.f} É possível que o responsável já tenha ouvido falar da empresa. Poderia me transferir para ele?`,
      `A Fey é uma metalúrgica de fixadores, a gente fabrica ${itens}. ${gk.s} Pode ser que o pessoal daí já tenha ouvido falar da gente. Me passa pra essa pessoa?`,
    ), [o("Passou a ligação", "transferido", "ok", "Recepção transferiu a ligação"), o("Anotou um recado", "horario"), o("Pediu para mandar e-mail", "rec_email"), o("Recusou", "obj_nao", "objecao")],
    "Prova social (Gong: a abertura “já ouviu falar de nós?” ficou entre as melhores, com cerca de 11% de sucesso): mostre que a Fey atende empresas parecidas. Seja específico e curto; não prometa o que não pode cumprir.", "ponte"),
    fala("horario", "Combinar outro horário", T(
      "Sem problema! Pra eu não atrapalhar: qual o nome dessa pessoa e em que horário ela costuma estar por aí? Aí eu ligo bem nessa hora.",
      "Sem problema algum. Para não atrapalhar, poderia me informar o nome dessa pessoa e o melhor horário para falar com ela? Retornarei exatamente nesse horário.",
      "Beleza! Pra eu não atrapalhar: como é o nome dessa pessoa e que horas ela costuma estar aí? Aí eu ligo bem nessa hora, combinado?",
    ), [o("Deu o nome e o horário", "@retorno", "ok", "Retornar no horário combinado com o decisor")], "Anote nome, horário e quem informou. Na volta, abra com “a recepção me indicou este horário”.", "apoio"),
    fala("rec_email", "Pedido de e-mail", T(
      "Claro, mando sim! Pra eu direcionar certo: pra quem fica endereçado, e qual o melhor e-mail? E já aproveito: posso te ligar depois de amanhã pra confirmar que chegou?",
      "Claro, enviarei com prazer. Para direcionar corretamente: a quem devo endereçar e qual o melhor e-mail? Posso também retornar a ligação depois de amanhã, para confirmar o recebimento?",
      "Claro, mando sim! Pra mandar pra pessoa certa: pra quem eu endereço e qual o melhor e-mail? E já aproveito: te ligo depois de amanhã só pra ver se chegou, pode ser?",
    ), [o("Passou nome e e-mail", "@retorno", "ok", "Enviar apresentação ao responsável de compras e ligar em 2 dias"), o("Só o e-mail geral da empresa", "@retorno", "neutro", "E-mail geral: pouca chance de chegar ao decisor, ligar de novo"), o("Não passa", "obj_nao", "objecao")], "E-mail para a caixa geral quase nunca chega ao decisor: sempre peça o NOME de quem vai ler e combine o dia da ligação. Se a pessoa recusar tudo, ofereça deixar um recado de trinta segundos para o responsável.", "apoio"),
    fala("transferido", "Transferiram a ligação", T(
      `{saudacao}! Aqui é {meunome}, da Fey. Quem me atendeu pediu que eu falasse com você, por causa das compras de fixadores. Com quem eu falo, por favor?`,
      `{saudacao}! Aqui é {meunome}, da Fey. Recebi o encaminhamento até você por causa das compras de fixadores. Com quem tenho o prazer de falar?`,
      `Oi! Aqui é {meunome}, da Fey. A pessoa que me atendeu me passou pra você, por causa das compras de fixadores. Com quem eu falo?`,
    ), [o("Disse o nome", "papel", "ok", "Chegou a outra pessoa por transferência"), o("Perguntou o assunto", "assunto"), o("Sem tempo agora", "obj_tempo", "objecao")], "Pessoa nova, conversa nova: reapresente-se em uma frase, diga quem passou a ligação (isso dá legitimidade) e pergunte o nome. Escreva o nome no campo “Conversando atualmente com”.", "ponte"),
    fala("quem", "Pessoa errada", T(
      `Ih, desculpa o engano, e agradeço a paciência! Quem é ${pessoa} aí na {empresa}? Posso falar direto com ela?`,
      `Peço desculpas pelo engano e agradeço a paciência. Poderia me dizer quem é ${pessoa} na {empresa}, para eu falar diretamente com ela?`,
      `Ih, foi mal o engano, e valeu pela paciência! Quem é ${pessoa} aí na {empresa}? Posso falar direto com ela?`,
    ), [o("Passou o contato", "transferido", "ok"), o("Não sabe ou não passa", "@encerrar", "objecao")], undefined, "ponte"),
    fala("sem_resp", "Ninguém atendeu", T(
      `Se cair na caixa postal, deixe um recado de uns vinte segundos, com motivo e o telefone repetido: “Oi, aqui é {meunome}, da Fey, metalúrgica de fixadores. Liguei ${tema.n}. Volto a ligar mais tarde, e se preferir é só me chamar neste número. Repito: [seu telefone]. Um abraço!”`,
      `Se cair na caixa postal, deixe um recado de cerca de vinte segundos, com o motivo e o telefone repetido: “{saudacao}. Aqui é {meunome}, da Fey, metalúrgica de fixadores. Entro em contato ${tema.f}. Retornarei a ligação mais tarde e, se preferir, pode me chamar neste número, que repito: [seu telefone]. Agradeço e desejo um ótimo dia.”`,
      `Se cair na caixa postal, deixe um recado de uns vinte segundos, com motivo e o telefone repetido: “Oi! Aqui é {meunome}, da Fey, a metalúrgica de fixadores. Liguei rapidinho ${tema.s}. Mais tarde eu tento de novo, e se quiser, me chama nesse número. Repito: [seu telefone]. Valeu, um abraço!”`,
    ), [o("Deixou o recado", "wa_msg", "neutro"), o("Não deu para deixar recado", "wa_msg", "neutro"), o("Tentativa registrada", "@retorno", "neutro", "Ninguém atendeu: tentar outro horário ou número")], "Faça pelo menos seis tentativas, em horários e dias diferentes, antes de desistir. Manhã cedo e fim da tarde costumam funcionar melhor. Recado curto (cerca de vinte segundos), com o motivo, e o número repetido duas vezes.", "apoio"),
    fala("wa_msg", "Mensagem de WhatsApp", T(
      `Mande no WhatsApp, logo depois da ligação: “Oi! Aqui é {meunome}, da Fey, a metalúrgica de fixadores. Acabei de tentar falar com você por telefone, ${tema.n}. Posso te ligar mais tarde ou, se preferir, me diga por aqui o melhor horário. Um abraço!”`,
      `Envie no WhatsApp, logo depois da ligação: “{saudacao}! Aqui é {meunome}, da Fey, metalúrgica de fixadores. Tentei contato por telefone ${tema.f}. Posso ligar em outro momento ou, se preferir, informe por aqui o melhor horário. Agradeço a atenção.”`,
      `Mande no WhatsApp, logo depois da ligação: “Oi, tudo bem? Aqui é {meunome}, da Fey, a metalúrgica de fixadores. Tentei te ligar agora há pouco, é ${tema.s}. Se quiser, me fala aqui o melhor horário que eu te ligo. Valeu!”`,
    ), [o("Mensagem enviada", "@retorno", "ok", "Recado na caixa postal e mensagem de WhatsApp enviados"), o("Não tem WhatsApp", "@retorno", "neutro", "Sem WhatsApp: tentar outro horário")], "Mensagem curta, sem anexo e sem preço na primeira vez: o objetivo é abrir a conversa. Quem vê duas tentativas (ligação e mensagem) lembra do nome.", "apoio"),
    fala("nome", "Com quem você fala", T(
      "[[contato?Só pra confirmar: estou falando com {contato}, certo?|Prazer! Me diz seu nome, por favor, que eu quero anotar certinho.]]",
      "[[contato?Só para confirmar: estou falando com {contato}, correto?|Muito prazer! Poderia me informar seu nome, por favor, para eu registrar corretamente?]]",
      "[[contato?Só pra confirmar: é com {contato} que eu falo, né?|Prazer! Qual é o seu nome? Quero anotar direitinho.]]",
    ), [o("Disse ou confirmou o nome", nomeTo, "ok", "Nome de quem atendeu anotado"), o("Prefere não dizer o nome", nomeTo, "neutro")], "Escreva o nome no campo “Conversando atualmente com”, logo abaixo: daí em diante as perguntas passam a chamar a pessoa pelo nome, o que aproxima e prende a atenção. Se o nome já aparecer lá, só confirme.", "ponte"),
    fala("pedir_decisor", "Pedir ajuda para chegar ao decisor", T(
      `Entendi, agradeço por me contar! Você poderia me ajudar? Preciso falar com ${a.quem}: pode me dizer quem é e qual o melhor jeito de falar com essa pessoa?`,
      `Entendi, agradeço a informação. Poderia me ajudar? Preciso falar com ${a.quem}. Poderia me dizer quem é e qual a melhor forma de contatá-la?`,
      `Entendi, valeu por me contar! Você me ajuda? Preciso falar com ${a.quem}: quem é essa pessoa e qual o melhor jeito de falar com ela?`,
    ), [o("Transferiu ou chamou a pessoa", "transferido", "ok"), o("Deu nome e horário", "horario", "neutro"), o("Não passa o contato", "@encerrar", "objecao", "Não passou o decisor")], "Quem não decide costuma ajudar se for tratado como parceiro: agradeça, peça o NOME e o melhor horário, e deixe claro que será rápido.", "ponte"),
    fala("papel", "Função de quem atende", T(
      "[[contato?Prazer, {contato}!|Prazer!]] Pra eu falar do jeito certo e não tomar seu tempo: qual é a sua função aí na {empresa}?",
      "[[contato?Muito prazer, {contato}!|Muito prazer!]] Para conversar da forma mais adequada e sem tomar seu tempo, poderia me dizer qual é a sua função na {empresa}?",
      "[[contato?Prazer, {contato}!|Prazer!]] Pra eu falar do jeito certo e não te tomar tempo: o que você faz aí na {empresa}?",
    ), [o("Dono, sócio ou diretor", "p_socio", "ok", "Contato: dono, sócio ou diretor"), o("Compras ou comprador", "p_compras", "ok", "Contato: compras"), o("Gerente, encarregado ou líder", "p_gestor", "ok", "Contato: gerente, encarregado ou líder"), o("Vendas, balcão ou atendimento", "p_balcao", "neutro", "Contato: vendas, balcão ou atendimento"), o("Estoque, manutenção, oficina ou produção", "p_operacao", "neutro", "Contato: estoque, manutenção, oficina ou produção"), o("Financeiro, administrativo ou RH", "p_admin", "neutro", "Contato: financeiro, administrativo ou RH"), o("Assistente ou secretária(o) de alguém", "p_assistente", "neutro", "Contato: assistente ou secretária(o)"), o("Recepção ou telefonista", "secretaria", "neutro", "Contato: recepção ou telefonista"), o("Prefere não dizer", "p_admin", "neutro")], "Esta é a pergunta que define a conversa: cada função tem um caminho diferente aqui embaixo. Escute o cargo e a entonação. Se disser só “trabalho aqui” ou “sou de tudo um pouco”, pergunte: “e quem costuma cuidar das compras?”.", "ponte"),
  ];
}

/**
 * Caminhos por perfil. Cada pessoa recebe a fala que combina com seu poder e interesse:
 * - decisores (dono, compras, gestor): vão ao motivo, com respeito ao tempo, e seguem a conversa;
 * - quem não decide (balcão, operação, financeiro, assistente): vira aliado, o objetivo é chegar a quem decide.
 */
export type Perfis = { itens: string; dor: string; tipo: Tipo; alvo: Alvo; /** onde o decisor segue */ next: string; falas: { socio: Say; compras: Say; gestor: Say }; /** respostas depois da fala do decisor */ alcada: boolean; ok: (note: string, to: string) => ScriptOption[]; tips: { socio: string; compras: string; gestor: string } };
export function perfis(p: Perfis): ScriptNode[] {
  const { itens, alvo } = p;
  const tema = alvo.tema ?? T("sobre a reposição de parafusos e grampos", "sobre o fornecimento de parafusos e grampos", "sobre reposição de parafuso e grampo");
  const para = alvo.para ?? T("pra apresentar nossa linha", "para apresentar nossa linha", "pra mostrar nossa linha");
  return [
    fala("p_socio", "Dono, sócio ou diretor", p.falas.socio, p.ok("Contato: decisor de compra (dono, sócio ou diretor)", p.next), p.tips.socio, "proposta"),
    fala("p_compras", "Compras ou comprador", p.falas.compras, p.ok("Contato: comprador", p.alcada ? "p_alcada" : p.next), p.tips.compras, "proposta"),
    fala("p_gestor", "Gerente, encarregado ou líder", p.falas.gestor, [...p.ok("Contato: gerente ou encarregado, participa da compra", p.next), o("Quem compra é outra pessoa", "pedir_decisor", "neutro", "Contato: gerente, não compra")], p.tips.gestor, "proposta"),
    fala("p_balcao", "Vendas, balcão ou atendimento", T(
      `Legal! Você que atende os clientes entende bem: quando o parafuso certo falta, o cliente vai embora, não é? A Fey é uma metalúrgica e fabrica ${itens}. Queria falar com ${alvo.quem} ${para.n}. Quem seria essa pessoa, e você consegue me passar agora?`,
      `Que bom! Quem atende os clientes sabe bem: quando o parafuso certo falta, o cliente acaba indo embora. A Fey é uma metalúrgica e fabrica ${itens}. Gostaria de falar com ${alvo.quem} ${para.f}. Quem seria essa pessoa, e seria possível me transferir agora?`,
      `Que legal! Quem tá no balcão sabe bem: quando falta o parafuso certo, o cliente vai embora, né? A Fey é uma metalúrgica, a gente fabrica ${itens}. Queria falar com ${alvo.quem} ${para.s}. Quem é essa pessoa, e dá pra me passar agora?`,
    ), [o("Passou a ligação", "transferido", "ok", "Balcão transferiu a ligação"), o("Deu nome e horário", "horario", "neutro"), o("Perguntou o assunto", "assunto"), o("Ele mesmo compra", p.next, "ok", "Contato: balcão que também compra"), o("Não passa", "obj_nao", "objecao", "Não passou o decisor")], "Quem atende o balcão é filtro e pode virar aliado. Não faça o pitch pra ele: peça ajuda, pergunte o nome de quem compra e qual o melhor horário. Use o problema dele (“cliente que vai embora”) para criar empatia. Agradeça pelo nome.", "ponte"),
    fala("p_operacao", "Estoque, manutenção, oficina ou produção", T(
      `Legal! Você vê de perto o que falta e o que quebra. Uma pergunta rápida: qual fixador mais dá dor de cabeça aí, o que acaba rápido ou o que vem com defeito? Pergunto pra levar o assunto certo à pessoa que cuida das compras e ajudar vocês.`,
      `Que bom. Você acompanha de perto o que falta e o que quebra. Uma pergunta rápida: qual fixador mais causa transtorno aí, o que acaba rápido ou o que vem com defeito? Pergunto para levar o assunto adequado à pessoa responsável pelas compras e poder ajudar vocês.`,
      `Que bom! Você vê de perto o que falta e o que quebra. Uma perguntinha: qual fixador mais dá dor de cabeça aí, o que acaba rápido ou o que vem com defeito? Pergunto pra levar o assunto certo à pessoa que cuida das compras e ajudar vocês.`,
    ), [o("Citou um item ou problema", "pedir_decisor", "ok", "Operação informou item ou problema (anotar)"), o("Disse que está tudo certo", "pedir_decisor", "neutro"), o("Ele também faz as compras", p.next, "ok", "Contato: operação que também compra"), o("Prefere não falar", "obj_nao", "objecao")], "Quem vive o problema fala com gosto dele: deixe contar e anote item, marca e frequência (isso vira argumento para o decisor: “o pessoal da oficina comentou…”). Depois pergunte quem pede a compra.", "pergunta"),
    fala("p_admin", "Financeiro, administrativo ou RH", T(
      `Entendi, agradeço! Já adianto que não é assunto financeiro: é sobre as compras de fixadores. Pra não tomar seu tempo, quem cuida disso aí e como falo com essa pessoa?`,
      `Entendi, agradeço. Adianto que não se trata de assunto financeiro: é sobre as compras de fixadores. Para não tomar seu tempo, poderia me dizer quem cuida disso e como posso falar com essa pessoa?`,
      `Entendi, valeu! Já adianto que não é cobrança nem nada financeiro: é sobre compra de fixadores. Pra não te tomar tempo: quem cuida disso aí e como eu falo com essa pessoa?`,
    ), [o("Passou a ligação", "transferido", "ok", "Administrativo transferiu a ligação"), o("Deu nome e horário", "horario", "neutro"), o("Perguntou o assunto", "assunto"), o("Também cuida das compras", p.next, "ok", "Contato: administrativo que também compra"), o("Não passa", "obj_nao", "objecao", "Não passou o decisor")], "Financeiro e administrativo costumam saber quem compra e quem aprova. Deixe claro que não é cobrança nem pedido de dado: isso derruba a guarda. Em algumas empresas pequenas eles também compram: confirme.", "ponte"),
    fala("p_assistente", "Assistente ou secretária(o)", T(
      `Oi! Você consegue me ajudar? Preciso de dois minutos com ${alvo.quem} aí na {empresa}, ${para.n}. Qual o melhor dia e horário pra eu falar com essa pessoa?`,
      `Olá! Poderia me ajudar? Preciso de dois minutos com ${alvo.quem} na {empresa}, ${para.f}. Qual seria o melhor dia e horário para falar com essa pessoa?`,
      `Oi! Você me ajuda? Preciso de uns dois minutinhos com ${alvo.quem} aí na {empresa}, ${para.s}. Qual o melhor dia e horário pra falar com essa pessoa?`,
    ), [o("Passou a ligação", "transferido", "ok", "Assistente transferiu a ligação"), o("Marcou um horário", "@retorno", "ok", "Horário marcado com o decisor, via assistente"), o("Perguntou o assunto", "assunto"), o("Pediu para mandar e-mail", "rec_email"), o("Não passa", "obj_nao", "objecao")], "Assistente conhece a agenda e o humor do chefe: trate como parceira, nunca como obstáculo. Peça horário (não “posso falar?”) e confirme o nome do decisor. Cumprir o horário combinado é o que abre a próxima ligação.", "ponte"),
    ...(p.alcada ? [fala("p_alcada", "Quem aprova a compra", T(
      "Antes de seguir: quando vocês fecham com um fornecedor novo, a decisão é sua ou passa por mais alguém?",
      "Antes de prosseguirmos: quando a empresa contrata um fornecedor novo, a decisão é sua ou passa por mais alguém?",
      "Antes de seguir, só por curiosidade: quando vocês fecham com um fornecedor novo, a decisão é sua ou passa por mais alguém?",
    ), [o("Decide sozinho", p.next, "ok", "Comprador decide sozinho"), o("Passa por outra pessoa", p.next, "neutro", "Comprador precisa de aprovação (anotar quem)"), o("Prefere não dizer", p.next)], "BANT, autoridade: saiba cedo quem aprova para trazer essa pessoa à conversa marcada. Pergunte sem cobrança, como curiosidade.", "pergunta")] : []),
  ];
}

/** 1. Confirmações: empresa e local, função do contato, segmento compatível. Conversadas, sem cara de formulário. */
export function confirma(next: string, itens: string, tipo: Tipo): ScriptNode[] {
  const perfil = tipo === "revenda" ? "Cliente que revende fixadores é o perfil central: pergunte como atende o balcão e o que mais gira." : tipo === "producao" ? "Quem usa fixador na produção compra recorrente e valoriza prazo e padrão: vá por aí." : "Quem usa nos serviços e na manutenção sofre com parada: o valor está em ter o item na hora.";
  return [
    fala("conf_empresa", "Confirmar empresa e local", T(
      "Só pra eu não incomodar a empresa errada: aí é a {empresa_completa}, de {cidade}, certo?",
      "Apenas para eu não incomodar a empresa errada: estou falando com a {empresa_completa}, de {cidade}, correto?",
      "Só pra eu não atrapalhar a empresa errada: aí é a {empresa_completa}, de {cidade}, né?",
    ), [o("Confirmou", "papel", "ok", "Empresa e local confirmados"), o("Mudou de nome ou de endereço", "papel", "neutro", "Atenção: nome ou endereço diferente do cadastro"), o("Não é essa empresa", "@encerrar", "objecao", "Telefone não pertence à empresa")], "Soa como cortesia, não como checagem. Se mudou, anote o nome e o endereço novos na observação."),
    fala("conf_segmento", "Entender como a empresa trabalha", T(
      "Legal! Me conta um pouco como a {empresa} trabalha com fixadores: vocês revendem, usam na produção, ou é mais pra manutenção e serviço?",
      "Ótimo. Poderia me contar um pouco como a {empresa} trabalha com fixadores: revenda, uso na produção, ou manutenção e serviços?",
      "Que legal! Me conta um pouco como a {empresa} trabalha com fixadores: vocês revendem, usam na produção, ou é mais manutenção e serviço?",
    ), [o("Revende (balcão, loja ou distribuidor)", "conf_negocio", "ok", "Segmento: revenda de fixadores"), o("Usa na produção ou montagem", "conf_negocio", "ok", "Segmento: usa na produção"), o("Usa na manutenção ou nos serviços", "conf_negocio", "ok", "Segmento: usa na manutenção ou serviços"), o("Não compra fixadores", "@encerrar", "objecao", "Fora do perfil: não compra fixadores")], perfil, "confirma"),
    fala("conf_negocio", "Conhecer a empresa", T(
      "Que bacana! E há quanto tempo a {empresa} está no mercado? Pergunto por curiosidade mesmo: dá pra sentir quando é uma casa tradicional.",
      "Muito bom. E há quanto tempo a {empresa} atua no mercado? Pergunto por interesse genuíno: percebe-se quando é uma casa tradicional.",
      "Que bacana! E faz quanto tempo que a {empresa} tá no mercado? Pergunto por curiosidade mesmo: dá pra sentir quando é uma casa tradicional.",
    ), [o("Mais de 10 anos", next, "ok", "Tempo de mercado: mais de 10 anos"), o("De 3 a 10 anos", next, "ok", "Tempo de mercado: 3 a 10 anos"), o("Menos de 3 anos", next, "ok", "Tempo de mercado: menos de 3 anos"), o("Prefere não dizer", next)], "Aqui a conversa fica mais leve. Ouça a história da pessoa, comente com interesse de verdade e só então siga. É onde nasce a conexão.", "ponte"),
  ];
}

/** 2. Enriquecedores: o que a conversa descobre sobre o lead. Cada pergunta traz um porquê e permite pular. */
export function enriquece(last: string, tipo: Tipo, kind: "sdr" | "vendas"): ScriptNode[] {
  const aplic = tipo === "revenda" ? [o("Balcão e varejo", "enr_freq", "ok", "Aplicação: balcão e varejo"), o("Oficinas e frotas", "enr_freq", "ok", "Aplicação: oficinas e frotas"), o("Indústrias e construtoras", "enr_freq", "ok", "Aplicação: indústrias e construtoras"), o("Um pouco de tudo", "enr_freq", "ok", "Aplicação: variada")]
    : tipo === "producao" ? [o("Montagem do produto final", "enr_freq", "ok", "Aplicação: montagem do produto final"), o("Manutenção das máquinas", "enr_freq", "ok", "Aplicação: manutenção das máquinas"), o("Reposição e assistência técnica", "enr_freq", "ok", "Aplicação: reposição e assistência"), o("Mais de uma aplicação", "enr_freq", "ok", "Aplicação: variada")]
    : [o("Manutenção da própria frota", "enr_freq", "ok", "Aplicação: manutenção de frota"), o("Serviço para clientes", "enr_freq", "ok", "Aplicação: serviços para clientes"), o("Reposição e estoque", "enr_freq", "ok", "Aplicação: reposição e estoque"), o("Mais de uma aplicação", "enr_freq", "ok", "Aplicação: variada")];
  const skip = o("Prefere não responder", "enr_freq", "neutro");
  return [
    ...(kind === "sdr" ? [fala("enr_conhece", "Conhece a Fey?", T(
      "Me tira uma curiosidade: você já conhecia a Fey, ou já chegou a comprar da gente, direto ou por algum distribuidor?",
      "Poderia me tirar uma curiosidade: já conhecia a Fey ou já chegou a comprar da empresa, diretamente ou por algum distribuidor?",
      "Me tira uma curiosidade: você já conhecia a Fey, ou já comprou da gente, direto ou por algum distribuidor?",
    ), [o("É ou já foi cliente da Fey", "enr_mix", "ok", "Já é ou foi cliente Fey"), o("Compra Fey por um distribuidor", "enr_mix", "neutro", "Compra Fey por distribuidor (anotar qual)"), o("Compra de um concorrente", "enr_mix", "neutro", "Compra de concorrente (anotar qual)"), o("Não conhece a Fey", "enr_mix", "neutro", "Não conhece a Fey"), o("Prefere não responder", "enr_mix")], "Descubra de quem compra hoje (distribuidor ou concorrente) sem soar como interrogatório, e anote o nome. Se ele já conhece, pergunte o que achou. Pare para ouvir antes da próxima pergunta.")] : []),
    fala("enr_mix", "Quais produtos compra", T(
      "E o que vocês mais compram hoje? É um mix de vários itens ou mais uns específicos? Pergunto pra não te mandar nada que não sirva.",
      "E o que a empresa mais compra atualmente? Um mix de vários itens ou alguns específicos? Pergunto para não enviar nada que não seja útil.",
      "E o que vocês mais compram hoje? É um mix de vários itens ou uns específicos? Pergunto pra não te mandar nada que não sirva.",
    ), [o("Mix variado de itens", "enr_aplicacao", "ok", "Compra mix variado"), o("Poucos itens específicos", "enr_aplicacao", "ok", "Compra poucos itens específicos"), o("Só um item", "enr_aplicacao", "neutro", "Compra um item só"), o("Não soube dizer", "enr_aplicacao")], "Deixe falar. Anote os itens e como é o mix: isso vira a cotação do vendedor. “Me conta mais” é a melhor pergunta de continuação (Sandler)."),
    fala("enr_aplicacao", "Onde aplica", T(
      "Entendi! E onde isso entra no dia a dia de vocês? Pergunto porque a aplicação muda qual parafuso ou grampo faz mais sentido.",
      "Entendi. E em que aplicação isso entra no dia a dia? Pergunto porque a aplicação define qual parafuso ou grampo é o mais adequado.",
      "Entendi! E onde isso entra no dia a dia de vocês? Pergunto porque a aplicação muda qual parafuso ou grampo é o melhor.",
    ), [...aplic, skip]),
    fala("enr_freq", "Frequência de compra", T(
      "E de quanto em quanto tempo vocês repõem isso? Toda semana, todo mês, ou só quando falta?",
      "E com que frequência a empresa faz a reposição? Semanal, mensal, ou apenas quando falta?",
      "E de quanto em quanto tempo vocês repõem isso? Toda semana, todo mês, ou só quando falta mesmo?",
    ), [o("Toda semana", "enr_func", "ok", "Compra toda semana"), o("Todo mês", "enr_func", "ok", "Compra todo mês"), o("A cada dois ou três meses", "enr_func", "neutro", "Compra a cada 2 ou 3 meses"), o("Só quando precisa", "enr_func", "neutro", "Compra só sob demanda")]),
    fala("enr_func", "Tamanho da empresa", T(
      "Quantas pessoas vocês são aí, mais ou menos? Só pra eu ter noção do tamanho da casa.",
      "Aproximadamente quantas pessoas trabalham na empresa? Apenas para eu ter noção do porte.",
      "Quantas pessoas vocês são aí, mais ou menos? Só pra eu ter noção do tamanho da casa.",
    ), [o("Até 5", "enr_quando", "neutro", "Funcionários: até 5"), o("De 6 a 20", "enr_quando", "ok", "Funcionários: 6 a 20"), o("De 21 a 100", "enr_quando", "ok", "Funcionários: 21 a 100"), o("Mais de 100", "enr_quando", "ok", "Funcionários: mais de 100"), o("Não soube dizer", "enr_quando")], "Última pergunta antes da proposta. A Gong viu que 11 a 14 perguntas bem dirigidas funcionam melhor que um questionário completo."),
    fala("enr_quando", "Quando precisa", T(
      "E a próxima reposição, quando vocês costumam precisar? Pra eu já deixar tudo pronto no tempo certo.",
      "E quando costuma ocorrer a próxima reposição? Assim deixo tudo preparado no tempo adequado.",
      "E a próxima reposição, quando vocês costumam precisar? Assim eu já deixo tudo pronto no tempo certo.",
    ), [o("Esta semana", last, "ok", "Próxima compra: esta semana"), o("Neste mês", last, "ok", "Próxima compra: neste mês"), o("Nos próximos meses", last, "neutro", "Próxima compra: nos próximos meses"), o("Sem previsão", last, "neutro", "Próxima compra: sem previsão")], "Prazo (o T do BANT): é ele quem diz quando precisa. Orçamento está no pedido mínimo, autoridade em quem decide, necessidade no problema e no impacto."),
  ];
}

/** Pedido mínimo (confirmação) com os 25%. */
export const minimo = (to: string): ScriptNode =>
  fala("conf_minimo", "Alinhar o pedido mínimo", T(
    `Olha, vou ser transparente desde já, pra não te fazer perder tempo: o primeiro pedido tem mínimo de ${FIRST}, e do segundo em diante é ${NEXT}. E em cima disso eu aplico 25% de desconto, então o valor do pedido continua o mesmo, só que você leva mais produto por ele. Isso cabe na rotina de vocês?`,
    `Vou ser transparente desde já, para não lhe fazer perder tempo: o primeiro pedido tem valor mínimo de ${FIRST}, e do segundo em diante, ${NEXT}. Sobre esse valor aplicamos 25% de desconto, de modo que o valor do pedido se mantém e a quantidade de produto aumenta. Isso se encaixa na rotina da empresa?`,
    `Olha, vou ser transparente já, pra não te fazer perder tempo: o primeiro pedido tem mínimo de ${FIRST}, e do segundo em diante é ${NEXT}. E em cima disso eu dou 25% de desconto, então o valor do pedido é o mesmo, só que você leva mais produto. Isso cabe na rotina de vocês?`,
  ), [o("Cabe, comporta o pedido", to, "ok", `Comporta o pedido mínimo (${FIRST} e ${NEXT})`), o("Depende do mix", to, "neutro", "Pedido mínimo depende do mix"), o("Acha alto", "obj_minimo", "objecao"), o("Não soube dizer", to)], "Confirme a capacidade de compra: R$ 3.500 no primeiro pedido e R$ 2.500 do segundo em diante. O desconto de 25% reduz o preço por item sem baixar o mínimo.", "confirma");

/**
 * Objeções. Cada uma segue o mesmo caminho dos profissionais: reconhecer o que a pessoa sente, esclarecer com uma pergunta, responder e propor o próximo passo.
 * O tom é o mais humano da conversa: aqui a pessoa precisa se sentir ouvida. `back` é onde a conversa volta depois de resolvida.
 */
export function objecoes(back: string, foco: "visita" | "venda"): ScriptNode[] {
  const dica = foco === "visita" ? "O foco é a conversa com o vendedor: preço fino fica com ele. Pode citar os 25% sem prometer valores." : "Ofereça 25% primeiro; só depois, se precisar, chegue a 26%. Escalone, não comece pelo máximo.";
  const ok = (l: string, note?: string) => o(l, back, "ok", note);
  const nao = (note?: string) => o("Continua firme na negativa", "@encerrar", "objecao", note);
  const outra = o("Levantou outra objeção", "obj_menu", "neutro");
  return [
    fala("obj_menu", "Qual foi a objeção?", T(
      "Entendi, agradeço a sinceridade. O que mais pesa pra você agora? Assim eu te respondo o que realmente importa.",
      "Entendo, agradeço a sinceridade. O que mais pesa para você neste momento? Assim posso responder ao que realmente importa.",
      "Entendi, valeu pela sinceridade! O que mais pesa pra você agora? Assim eu te respondo o que realmente importa.",
    ), [o("Preço", "obj_preco", "objecao"), o("Prazo de entrega", "obj_prazo", "objecao"), o("Qualidade e garantia", "obj_qualidade", "objecao"), o("Forma de pagamento", "obj_pagamento", "objecao"), o("Frete", "obj_frete", "objecao"), o("Pedido mínimo", "obj_minimo", "objecao"), o("Outras objeções…", "obj_menu2", "neutro")], `Escute até o fim, sem interromper, e esclareça antes de responder: muitas vezes o que ele diz não é o que ele quer dizer (Blount). ${PAR}`, "objecao"),
    fala("obj_menu2", "Outras objeções", T(
      "Certo. E tem mais alguma coisa pesando aí, além disso?",
      "Certo. Há mais alguma coisa que esteja pesando, além disso?",
      "Certo! E tem mais alguma coisa pesando aí, além disso?",
    ), [o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Satisfeito com o fornecedor atual", "obj_satisfeito", "objecao"), o("Compra por distribuidor", "obj_distribuidor", "objecao"), o("Concorrente mais barato", "obj_concorrente", "objecao"), o("Não conhece a Fey", "obj_confianca", "objecao"), o("Já teve experiência ruim", "obj_ruim", "objecao"), o("Precisa falar com sócio ou decisor", "obj_socio", "objecao"), o("Manda por e-mail ou WhatsApp", "obj_enviar", "objecao"), o("Sem interesse", "obj_nao", "objecao"), o("Mais objeções…", "obj_menu3", "neutro")], undefined, "objecao"),
    fala("obj_menu3", "Mais objeções", T(
      "Tudo bem. E tem mais alguma coisa que eu deveria saber?",
      "Perfeitamente. Há algo mais que eu deva saber?",
      "Beleza! Tem mais alguma coisa que eu deveria saber?",
    ), [o("Sem tempo agora", "obj_tempo", "objecao"), o("Estoque cheio, sem necessidade agora", "obj_estoque", "objecao"), o("Pediu para ligar mais tarde (próximo mês ou trimestre)", "obj_depois", "objecao"), o("Sem verba no momento", "obj_verba", "objecao"), o("Vai pensar", "obj_pensar_geral", "objecao"), o("Voltar às objeções principais", "obj_menu", "neutro")], undefined, "objecao"),
    fala("obj_preco", "Acha caro", T(
      "Super justo você olhar o preço com cuidado. Posso te perguntar: caro comparado com o quê? Com o que vocês compram hoje, ou com o que esperavam? Eu pergunto porque a nossa linha é premium, e eu aplico 25% de desconto no pedido: o mínimo continua o mesmo, mas você leva mais.",
      "É totalmente compreensível avaliar o preço com cuidado. Posso lhe perguntar: caro em comparação com o quê? Com o que vocês compram hoje, ou com o que esperavam? Pergunto porque nossa linha é premium e aplicamos 25% de desconto no pedido: o mínimo se mantém, mas vocês levam mais produto.",
      "Super justo olhar o preço com cuidado! Posso te perguntar: caro comparado com o quê? Com o que vocês compram hoje, ou com o que você esperava? Pergunto porque a nossa linha é premium, e eu dou 25% de desconto no pedido: o mínimo é o mesmo, mas você leva mais.",
    ), [ok("Explicou a comparação e topou olhar"), o("Ainda acha caro", "obj_valor", "objecao"), outra], `${dica} Rotule antes de argumentar: “parece que o preço está pesando”. Não defenda o preço: descubra com o que ele compara (Voss).`),
    fala("obj_valor", "Mostrar o valor", T(
      "Entendo, de verdade. Só que, no fixador, o que pesa no bolso não é só o preço, é o que acontece quando ele falha: retrabalho, máquina ou veículo parado. Que tal eu montar uma comparação por item, com o que vocês já compram, e você mesmo confere se a conta fecha?",
      "Compreendo perfeitamente. No entanto, no caso do fixador, o custo real não é apenas o preço, mas o que ocorre quando ele falha: retrabalho, máquina ou veículo parado. Que tal montarmos uma comparação por item, com o que vocês já compram, para que você mesmo verifique se a conta fecha?",
      "Entendo, de verdade! Só que, no fixador, o que pesa no bolso não é só o preço, é o que rola quando ele falha: retrabalho, máquina ou carro parado. Que tal eu montar uma comparação por item, com o que vocês já compram, e você mesmo vê se a conta fecha?",
    ), [ok("Aceitou a comparação", "Pediu comparação por item"), nao("Preço acima do mercado")], dica),
    fala("obj_prazo", "Prazo de entrega", T(
      "Prazo é uma das coisas que a gente mais leva a sério. Me diz uma coisa: em quantos dias você precisa receber pra ter tranquilidade? Aí eu já combino isso na cotação.",
      "O prazo é um dos pontos que mais levamos a sério. Poderia me dizer em quantos dias precisa receber para ter tranquilidade? Assim já alinho isso na cotação.",
      "Prazo é uma das coisas que a gente mais leva a sério! Me diz uma coisa: em quantos dias você precisa receber pra ter tranquilidade? Aí eu já combino isso na cotação.",
    ), [ok("Informou o prazo que precisa", "Prazo de entrega é prioridade"), nao(), outra], "Não prometa um número de dias: o vendedor confirma o prazo exato por região, na cotação."),
    fala("obj_qualidade", "Qualidade e garantia", T(
      "Faz muito bem em perguntar. A gente fabrica, então responde pelo que produz. O que aconteceu com os fixadores que vocês usaram e deram problema? Se quiser, mando até uma amostra pra você testar do seu jeito.",
      "Faz muito bem em perguntar. Nós fabricamos, portanto respondemos pelo que produzimos. O que ocorreu com os fixadores que apresentaram problema? Se desejar, posso enviar uma amostra para que você teste da sua maneira.",
      "Faz bem em perguntar! A gente fabrica, então responde pelo que produz. O que rolou com os fixadores que deram problema pra vocês? Se quiser, mando até uma amostra pra você testar do seu jeito.",
    ), [ok("Contou o problema que tem hoje", "Reclama da qualidade do fornecedor atual"), ok("Pediu amostra", "Pediu amostra"), nao(), outra], "Pergunte o que deu errado antes: é o que dá o argumento. Ofereça amostra se fizer sentido, sem prometer o que não pode."),
    fala("obj_pagamento", "Forma de pagamento", T(
      "Isso a gente acerta junto no pedido, conforme a análise de cadastro, e o vendedor busca a melhor opção pra vocês. Como a {empresa} costuma pagar os fornecedores?",
      "Isso é definido junto ao pedido, conforme a análise de cadastro, e o vendedor buscará a melhor opção. Como a {empresa} costuma pagar seus fornecedores?",
      "Isso a gente acerta junto no pedido, conforme a análise de cadastro, e o vendedor busca a melhor opção pra vocês. Como a {empresa} costuma pagar os fornecedores?",
    ), [ok("Disse como prefere pagar", "Preferência de pagamento informada"), nao(), outra], "Não prometa prazo nem parcelamento: depende da análise."),
    fala("obj_frete", "Frete", T(
      "O frete a gente calcula na cotação, conforme a região e a transportadora. Pra onde seria a entrega?",
      "O frete é calculado na cotação, conforme a região e a transportadora. Para onde seria a entrega?",
      "O frete a gente calcula na cotação, conforme a região e a transportadora. Pra onde seria a entrega?",
    ), [ok("Informou o local de entrega", "Frete: informou local de entrega"), nao(), outra], undefined),
    fala("obj_minimo", "Pedido mínimo alto", T(
      `Entendo. O mínimo é de ${FIRST} só no primeiro pedido e cai pra ${NEXT} do segundo em diante. Com os 25% de desconto, esse valor rende bastante produto. Quanto vocês costumam comprar por vez hoje?`,
      `Entendo. O mínimo é de ${FIRST} apenas no primeiro pedido e passa a ${NEXT} do segundo em diante. Com os 25% de desconto, esse valor rende bastante produto. Quanto a empresa costuma comprar por vez atualmente?`,
      `Entendo! O mínimo é de ${FIRST} só no primeiro pedido e cai pra ${NEXT} do segundo em diante. Com os 25% de desconto, esse valor rende bastante produto. Quanto vocês costumam comprar por vez hoje?`,
    ), [ok("Aceitou montar o pedido"), o("Compra bem menos que isso", "obj_minimo2", "objecao"), outra], "Descubra o volume real antes de defender o mínimo: R$ 3.500 no primeiro e R$ 2.500 depois."),
    fala("obj_minimo2", "Volume abaixo do mínimo", T(
      "Olha, se a gente juntar o mix completo, ou reunir a compra de uns três meses, o valor chega mais fácil. Vale a gente olhar quais itens se encaixam?",
      "Se reunirmos o mix completo, ou a compra de aproximadamente três meses, o valor é atingido com mais facilidade. Vale analisarmos quais itens se encaixam?",
      "Olha, se a gente juntar o mix completo, ou a compra de uns três meses, o valor chega bem mais fácil. Vale a gente olhar quais itens se encaixam?",
    ), [ok("Topou ver o mix", "Pode chegar ao mínimo com o mix completo"), nao("Volume abaixo do pedido mínimo")], undefined),
    fala("obj_fornecedor", "Já tem fornecedor", T(
      "Que bom, isso mostra que vocês levam a reposição a sério! Eu não quero que você troque ninguém. Só me conta: quando o seu fornecedor atual falha em prazo ou em algum item, o que vocês fazem? A ideia é ter a Fey como segunda opção de confiança e, nos itens em que formos melhores, a primeira.",
      "Que bom, isso demonstra seriedade com a reposição. Não pretendo que você substitua ninguém. Apenas gostaria de saber: quando o fornecedor atual falha em prazo ou em algum item, como vocês procedem? A ideia é a Fey ser uma segunda opção de confiança e, nos itens em que formos melhores, a primeira.",
      "Que bom, isso mostra que vocês levam a reposição a sério! Não quero que você troque ninguém, viu? Só me conta: quando o seu fornecedor falha em prazo ou em algum item, o que vocês fazem? A ideia é ter a Fey como segunda opção de confiança e, nos itens em que a gente for melhor, a primeira.",
    ), [ok("Topou conhecer a Fey", "Tem fornecedor, topou conhecer"), nao("Mantém o fornecedor atual"), outra], "Nunca fale mal do concorrente. Pergunte o que acontece quando o fornecedor falha: é nesse ponto que a Fey entra. “Estou satisfeito” cai aqui também."),
    fala("obj_satisfeito", "Satisfeito com o fornecedor atual", T(
      "Que ótimo ouvir isso, e eu não quero mexer no que funciona. Posso só te perguntar uma coisa: se o fornecedor atual esgotasse um item de giro ou atrasasse uma entrega, vocês teriam uma segunda opção pronta? Eu proponho ser só essa reserva, sem trocar ninguém.",
      "É ótimo saber disso, e não pretendo alterar o que funciona. Posso lhe perguntar: se o fornecedor atual esgotasse um item de giro ou atrasasse uma entrega, vocês teriam uma segunda opção pronta? Proponho a Fey apenas como reserva, sem substituir ninguém.",
      "Que bom ouvir isso, e eu não quero mexer no que tá funcionando! Posso só te perguntar: se o fornecedor atual ficasse sem um item de giro ou atrasasse uma entrega, vocês teriam uma segunda opção pronta? Eu seria só essa reserva, sem trocar ninguém.",
    ), [ok("Topou ter uma segunda opção", "Satisfeito com o atual, aceitou a Fey como reserva"), nao("Satisfeito com o fornecedor atual"), outra], "Ninguém troca de fornecedor que funciona: posicione a Fey como seguro, não como substituta. Josh Braun: pergunte se faz sentido, sem pressão. Se não, deixe a porta aberta e registre."),
    fala("obj_distribuidor", "Compra por distribuidor", T(
      "Que legal, então vocês já conhecem a Fey! Comprando direto da fábrica a condição melhora e o prazo fica mais firme. Qual distribuidor vocês usam hoje? Posso mostrar como ficaria comprando direto, só pra você comparar.",
      "Que bom, então vocês já conhecem a Fey. Comprando direto da fábrica a condição melhora e o prazo fica mais firme. Qual distribuidor vocês utilizam hoje? Posso demonstrar como ficaria comprando direto, apenas para comparação.",
      "Que legal, então vocês já conhecem a Fey! Comprando direto da fábrica a condição melhora e o prazo fica mais firme. Qual distribuidor vocês usam hoje? Posso mostrar como ficaria comprando direto, só pra você comparar.",
    ), [ok("Informou o distribuidor e quer ver", "Compra por distribuidor (anotar qual)"), o("Prefere manter o distribuidor", "@encerrar", "objecao", "Prefere manter o distribuidor"), outra], "Anote qual é o distribuidor. Não force: se ele gosta do distribuidor, deixe a porta aberta."),
    fala("obj_concorrente", "Concorrente mais barato", T(
      "Faz sentido comparar! Só que preço de etiqueta não conta tudo: o que pesa é a durabilidade e quanto o item dá de retrabalho. A gente fabrica linha premium e, com os 25% de desconto, a conta por item fica bem competitiva. Posso montar uma comparação com o que você já compra?",
      "Faz sentido comparar. No entanto, o preço de etiqueta não conta tudo: pesam a durabilidade e o retrabalho que o item gera. Fabricamos linha premium e, com os 25% de desconto, a conta por item fica bastante competitiva. Posso montar uma comparação com o que você já compra?",
      "Faz sentido comparar! Só que preço de etiqueta não conta tudo: o que pesa é a durabilidade e quanto o item dá de retrabalho. A gente fabrica linha premium e, com os 25% de desconto, a conta por item fica bem competitiva. Posso montar uma comparação com o que você já compra?",
    ), [ok("Aceitou a comparação", "Concorrente mais barato: pediu comparação"), nao("Fechado com concorrente"), outra], dica),
    fala("obj_confianca", "Não conhece a Fey", T(
      "Faz total sentido, ninguém compra de quem não conhece. A Fey é uma metalúrgica e fabrica o que vende. Que tal você começar com uma amostra, ou só olhar a cotação sem compromisso, e decidir depois?",
      "Faz todo sentido: ninguém compra de quem não conhece. A Fey é uma metalúrgica e fabrica o que vende. Que tal começar com uma amostra, ou apenas analisar a cotação sem compromisso, e decidir depois?",
      "Faz total sentido, ninguém compra de quem não conhece! A Fey é uma metalúrgica e fabrica o que vende. Que tal começar com uma amostra, ou só dar uma olhada na cotação sem compromisso, e decidir depois?",
    ), [ok("Topou amostra ou cotação", "Não conhecia a Fey: aceitou amostra ou cotação"), nao("Não confia sem conhecer"), outra], "Reduza o risco do primeiro passo: amostra ou cotação, nunca pressão. Ofereça só o que a Fey pode cumprir."),
    fala("obj_ruim", "Já teve experiência ruim", T(
      "Poxa, sinto muito por isso. O que aconteceu, se você não se importar de me contar? Quero entender pra não repetir com você.",
      "Lamento muito por isso. O que ocorreu, se não se importar de me contar? Gostaria de entender para não repetir o problema com você.",
      "Poxa, sinto muito por isso! O que aconteceu, se você não se importar de me contar? Quero entender pra não repetir com você.",
    ), [ok("Contou o que aconteceu", "Experiência ruim anterior: anotar o motivo"), nao(), outra], "Deixe falar sem interromper e rotule: “parece que isso te deixou na mão”. A queixa dele vira o seu argumento."),
    fala("obj_socio", "Precisa falar com o sócio", T(
      "Claro, faz todo sentido envolver quem decide junto. Que tal a gente marcar um horário em que vocês dois estejam livres? Assim eu apresento uma vez só e ninguém repete nada.",
      "Claro, faz todo sentido envolver quem decide. Que tal marcarmos um horário em que ambos estejam disponíveis? Assim apresento uma única vez e ninguém precisa repetir nada.",
      "Claro, faz todo sentido envolver quem decide junto! Que tal a gente marcar um horário em que vocês dois estejam livres? Assim eu apresento uma vez só e ninguém precisa repetir nada.",
    ), [o("Combinou com o decisor", "@retorno", "ok", "Conversa com o decisor agendada"), nao("Não passou o decisor")], undefined),
    fala("obj_tempo", "Sem tempo agora", T(
      "Sem problema, sei que te peguei no meio do trabalho! Em duas frases: a Fey é uma metalúrgica que fabrica parafusos e grampos, linha premium, com prazo firme. Se fizer sentido, eu ligo em outro horário. Quando é melhor, de manhã ou à tarde?",
      "Sem problema, sei que o contato foi no meio do expediente. Em duas frases: a Fey é uma metalúrgica que fabrica parafusos e grampos, linha premium, com prazo firme. Se fizer sentido, retorno em outro horário. Qual é o melhor período, manhã ou tarde?",
      "Sem problema, sei que te peguei no meio do trampo! Em duas frases: a Fey é uma metalúrgica que fabrica parafuso e grampo, linha premium, com prazo firme. Se fizer sentido, eu ligo em outra hora. Quando é melhor, de manhã ou à tarde?",
    ), [o("Deu um horário", "@retorno", "ok", "Pediu retorno em outro horário"), o("Pediu pra não ligar mais", "@encerrar", "objecao", "Pediu para não ser contatado")], "Respeite o tempo: cumpra o que prometeu. Se ele deu horário, ligue exatamente nele. “Estou em reunião” costuma ser adiamento: peça um horário concreto."),
    fala("obj_enviar", "Manda por e-mail ou WhatsApp", T(
      "Mando sim! Pra não te encher de coisa que não serve, deixa eu te fazer duas perguntinhas rápidas: quais itens vocês mais compram e o que mais complica hoje? Aí mando só o que importa.",
      "Envio sim. Para não encher você de informação que não serve, posso fazer duas perguntas rápidas: quais itens a empresa mais compra e o que mais complica hoje? Assim envio apenas o que importa.",
      "Mando sim! Pra não te encher de coisa que não serve, deixa eu te fazer duas perguntinhas rápidas: quais itens vocês mais compram e o que mais complica hoje? Aí mando só o que importa.",
    ), [o("Passou o contato e os itens", "@retorno", "ok", "Pediu material por e-mail ou WhatsApp"), ok("Aceitou conversar um pouco antes"), nao()], "“Manda por e-mail” é, quase sempre, tentativa de se livrar (Blount). Tente trinta segundos de conversa antes; se não rolar, combine o retorno: “te ligo depois de amanhã pra saber o que achou”."),
    fala("obj_estoque", "Estoque cheio", T(
      "Entendo, sem pressa. Quando o estoque começa a baixar, vocês costumam ser pegos de surpresa? Posso deixar a cotação pronta, pra vocês agirem rápido quando precisar.",
      "Entendo, sem pressa. Quando o estoque começa a baixar, vocês costumam ser pegos de surpresa? Posso deixar a cotação pronta, para que ajam rapidamente quando necessário.",
      "Entendo, sem pressa! Quando o estoque começa a baixar, vocês costumam ser pegos de surpresa? Posso deixar a cotação pronta, pra vocês agirem rápido quando precisar.",
    ), [o("Combinou um retorno", "@retorno", "ok", "Estoque cheio: retornar mais tarde"), nao("Sem necessidade no momento")], undefined),
    fala("obj_depois", "Pediu para ligar mais tarde", T(
      "Combinado, eu volto a ligar. Só me ajuda a ligar no momento certo: o que precisaria acontecer pra esse assunto virar prioridade: o estoque baixar, uma obra nova, um item em falta? E em que mês você me recomenda ligar?",
      "Combinado, retornarei a ligação. Para eu ligar no momento certo: o que precisaria acontecer para esse assunto se tornar prioridade: o estoque diminuir, uma obra nova, um item em falta? E em que mês recomenda que eu ligue?",
      "Combinado, eu volto a ligar! Só me ajuda a ligar na hora certa: o que precisaria acontecer pra esse assunto virar prioridade: o estoque baixar, uma obra nova, um item faltando? E em que mês você me recomenda ligar?",
    ), [o("Deu uma data ou um gatilho", "@retorno", "ok", "Retornar na data ou gatilho combinado"), nao("Sem previsão de interesse")], "“Me liga no próximo trimestre” vale ouro quando vem com uma data ou um gatilho: anote os dois. Sem isso, é uma forma educada de dizer “não”."),
    fala("obj_verba", "Sem verba no momento", T(
      "Entendo, e eu respeito. Posso só perguntar: o assunto não vale a pena resolver agora, ou é só uma questão de momento do caixa? Pergunto porque a primeira compra já entra com 25% de desconto, e a gente pode deixar tudo pronto pra quando for a hora.",
      "Compreendo e respeito. Posso perguntar: o assunto não vale ser resolvido agora, ou é apenas uma questão do momento do caixa? Pergunto porque a primeira compra já tem 25% de desconto, e podemos deixar tudo preparado para o momento adequado.",
      "Entendo, e eu respeito! Posso só perguntar: o assunto não vale resolver agora, ou é só o caixa do momento? Pergunto porque a primeira compra já entra com 25% de desconto, e a gente pode deixar tudo pronto pra quando for a hora.",
    ), [o("É só o momento: combinou retorno", "@retorno", "ok", "Sem verba agora: retornar quando o caixa permitir"), nao("Sem verba e sem interesse")], "Separe “não tenho dinheiro” de “não vejo valor” antes de insistir (Rework): se o problema não vale resolver, o orçamento nem entra na conversa. Não ofereça desconto extra por pressão."),
    fala("obj_pensar_geral", "Vai pensar", T(
      "Claro, é uma decisão que se pensa mesmo. Pra eu te ajudar a pensar: o que você ainda precisa ver, o preço, o prazo ou a garantia? Se quiser, a gente conversa de novo daqui a dois dias.",
      "Claro, é uma decisão que merece reflexão. Para eu ajudar: o que ainda precisa avaliar, o preço, o prazo ou a garantia? Se preferir, retomamos a conversa em dois dias.",
      "Claro, decisão a gente pensa mesmo! Pra eu te ajudar nessa: o que você ainda precisa ver, o preço, o prazo ou a garantia? Se quiser, a gente conversa de novo daqui a dois dias.",
    ), [o("Disse o que falta decidir", "obj_menu", "neutro"), o("Combinou o retorno", "@retorno", "ok", "Combinado retorno em 2 dias"), nao()], "“Vou pensar” quase sempre esconde uma dúvida: descubra qual é, com calma, sem pressionar."),
    fala("obj_nao", "Sem interesse", T(
      "Tudo bem, agradeço a sinceridade! Só pra eu entender, e pra não te incomodar à toa: é porque vocês já estão bem atendidos ou porque o assunto não faz sentido pra vocês? Pergunto sem compromisso mesmo.",
      "Tudo bem, agradeço a sinceridade. Para eu compreender e não incomodar à toa: é porque já estão bem atendidos ou porque o assunto não faz sentido para a empresa? Pergunto sem compromisso.",
      "Tudo bem, agradeço a sinceridade! Só pra eu entender, e pra não te incomodar à toa: é porque vocês já estão bem atendidos ou porque o assunto não faz sentido pra vocês? Pergunto sem compromisso mesmo.",
    ), [ok("Explicou o motivo e abriu espaço"), o("Encerrou a conversa", "@encerrar", "objecao", "Sem interesse")], `Pergunta de saída (negativo reverso, Sandler): ajuda a registrar o motivo real. ${PAR}`),
  ];
}
void cat; void FEY; void ONLINE;
