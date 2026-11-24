import type { ScriptNode, ScriptOption } from "@/config/scripts";
import { FEY, FIRST, NEXT, ONLINE, PAR, PARES, T, cat, fala, o, type Alvo, type Say, type Tipo, type Tri } from "./seed-core";

/**
 * Entrada da ligação, pensada para quem atendeu poder ser QUALQUER pessoa (dono, comprador, balcão, financeiro, recepção…).
 * Passos: abertura neutra (feita no objetivo; ela já pergunta o nome, e o nome vai no campo “Conversando atualmente com”) → função da pessoa → caminho próprio de cada perfil. Cada pessoa que atende (portaria, recepção, comprador…) entra pelo passo “Transferiram a ligação”, que pergunta o nome da nova pessoa.
 * Recepção, pessoa errada, transferência, caixa postal e WhatsApp também ficam aqui.
 */
export function entrada(_nomeTo: string, itens: string, a: Alvo, tipo: Tipo): ScriptNode[] {
  const m = a.motivo;
  const tema = a.tema ?? T("sobre a reposição de parafusos e grampos", "sobre o fornecimento de parafusos e grampos", "sobre reposição de parafuso e grampo");
  const gk = a.gk ?? T(`Atendemos ${PARES[tipo]}, e é por isso que estou ligando.`, `Atendemos ${PARES[tipo]}, e esse é o motivo do contato.`, `Atendemos ${PARES[tipo]}, e é por isso que tô ligando.`);
  const fecha = a.fecha ?? T("É coisa rápida, e quem cuida disso é quem decide se interessa. Essa pessoa consegue falar agora?", "É um assunto breve, e cabe a quem cuida disso decidir se há interesse. Essa pessoa poderia me atender agora?", "É rapidinho, e quem cuida disso é quem decide se vale a pena. Dá pra chamar essa pessoa?");
  /** "quem cuida das compras" → "a pessoa que cuida das compras" */
  const pessoa = a.quem.replace(/^quem /, "a pessoa que ");
  return [
    fala("secretaria", "Passar pela recepção", T(
      `Oi, tudo bem? Será que você pode me ajudar? Eu preciso falar com ${a.quem} aí na {empresa}, só que não sei quem é. Você sabe me dizer?`,
      `Você poderia me ajudar? Preciso falar com ${a.quem} na {empresa}, mas não sei quem é a pessoa. Você consegue me indicar?`,
      `E aí, tudo bem? Me dá uma mão? Tô procurando ${a.quem} aí na {empresa} e não sei quem é. Você sabe me dizer?`,
    ), [o("Vai passar a ligação", "transferido", "ok", "Recepção transferiu a ligação"), o("Perguntou qual é o assunto", "assunto"), o("O responsável não está", "horario"), o("Pediu para mandar e-mail", "rec_email"), o("Disse que não precisam", "obj_nao", "objecao")],
    "Peça ajuda, não permissão. A recepção não decide, mas abre ou fecha a porta: seja cordial, use o nome dela e nunca minta sobre quem você é nem invente projeto ou indicação. Pergunta aberta (“quem seria?”) funciona melhor que “posso falar com o responsável?”. Nunca use a palavra “barreira” em voz alta.", "ponte"),
    fala("assunto", "Dizer o assunto", T(
      `Claro! Somos uma metalúrgica especializada em fixadores e fabricamos ${itens}. ${m.n} ${fecha.n}`,
      `Com certeza. Somos uma metalúrgica especializada em fixadores e fabricamos ${itens}. ${m.f} ${fecha.f}`,
      `Claro! Somos uma metalúrgica especializada em fixadores e fabricamos ${itens}. ${m.s} ${fecha.s}`,
    ), [o("Passou a ligação", "transferido", "ok", "Recepção transferiu a ligação"), o("Perguntou quem é a Fey", "gk_quem"), o("Anotou um recado", "horario"), o("Pediu para mandar e-mail", "rec_email"), o("Recusou", "obj_nao", "objecao")],
    "Um motivo curto, honesto e sem jargão. Quem entende o assunto passa a ligação com mais facilidade. Não conte o pitch inteiro: a recepção não é quem decide.", "ponte"),
    fala("gk_quem", "Quem é a Fey", T(
      `Somos uma metalúrgica especializada em fixadores. Fabricamos ${itens}. ${gk.n} Quem cuida disso aí talvez já tenha ouvido falar da gente. Dá pra me passar pra essa pessoa?`,
      `Somos uma metalúrgica especializada em fixadores e fabricamos ${itens}. ${gk.f} É possível que o responsável já conheça a empresa. Você poderia me passar para essa pessoa?`,
      `Somos uma metalúrgica especializada em fixadores. Fabricamos ${itens}. ${gk.s} Pode ser que o pessoal daí já tenha ouvido falar da gente. Me passa pra essa pessoa?`,
    ), [o("Passou a ligação", "transferido", "ok", "Recepção transferiu a ligação"), o("Anotou um recado", "horario"), o("Pediu para mandar e-mail", "rec_email"), o("Recusou", "obj_nao", "objecao")],
    "Prova social (Gong: a abertura “já ouviu falar de nós?” ficou entre as melhores, com cerca de 11% de sucesso): mostre que a Fey atende empresas parecidas. Seja específico e curto; não prometa o que não pode cumprir.", "ponte"),
    fala("horario", "Combinar outro horário", T(
      `Sem problema! Eu não quero te atrapalhar. Qual o nome dessa pessoa, e a que horas ela costuma estar aí? Eu ligo direto nesse horário.`,
      `Sem problema. Não quero atrapalhar. Qual é o nome dessa pessoa e em que horário ela costuma estar disponível? Ligo exatamente nessa hora.`,
      `Beleza! Não quero atrapalhar ninguém. Como é o nome dela e a que horas ela costuma estar aí? Eu ligo bem nessa hora, combinado?`,
    ), [o("Deu o nome e o horário", "@retorno", "ok", "Retornar no horário combinado com o decisor"), o("Só o nome, sem horário", "@retorno", "neutro", "Sem horário combinado: tentar de novo em outro dia e horário"), o("Não quis passar nada", "obj_nao", "objecao", "Recepção não passou nome nem horário")], "Anote nome, horário e quem informou. Na volta, abra com “a recepção me indicou este horário”.", "apoio"),
    fala("rec_email", "Pedido de e-mail", T(
      `Claro, eu mando sim! Pra quem eu endereço, e qual o melhor e-mail? Ah, e depois de amanhã eu te ligo só pra ver se chegou direitinho, pode ser?`,
      `Claro, envio sim. A quem devo endereçar e qual é o melhor e-mail? Se for conveniente, ligo depois de amanhã para confirmar o recebimento.`,
      `Claro, mando sim! Pra quem eu endereço e qual o melhor e-mail? E já aviso que depois de amanhã eu ligo só pra ver se chegou, tá bom?`,
    ), [o("Passou nome e e-mail", "@retorno", "ok", "Enviar apresentação ao responsável de compras e ligar em 2 dias"), o("Só o e-mail geral da empresa", "@retorno", "neutro", "E-mail geral: pouca chance de chegar ao decisor, ligar de novo"), o("Não passa", "obj_nao", "objecao")], "E-mail para a caixa geral quase nunca chega ao decisor: sempre peça o NOME de quem vai ler e combine o dia da ligação. Se a pessoa recusar tudo, ofereça deixar um recado de trinta segundos para o responsável.", "apoio"),
    fala("transferido", "Transferiram a ligação", T(
      `{saudacao}! Aqui é {meunome}, da Fey, uma metalúrgica especializada em fixadores. A pessoa que me atendeu me passou pra você, por causa das compras. Com quem eu falo?`,
      `{saudacao}! Aqui é {meunome}, da Fey, metalúrgica especializada em fixadores. Me encaminharam até você por causa das compras. Com quem eu falo, por favor?`,
      `Oi! Aqui é {meunome}, da Fey, a metalúrgica especializada em fixadores. A pessoa que me atendeu me passou pra você, por causa das compras. Com quem eu falo?`,
    ), [o("Disse o nome", "papel", "ok", "Chegou a outra pessoa por transferência"), o("Perguntou o assunto", "assunto"), o("Sem tempo agora", "obj_tempo", "objecao")], "Pessoa nova, conversa nova: reapresente-se em uma frase, diga quem passou a ligação (isso dá legitimidade) e pergunte o nome. Escreva o nome no campo “Conversando atualmente com”: o campo esvazia sozinho para a nova pessoa, e o nome de quem falou antes fica registrado na ligação.", "ponte"),
    fala("quem", "Pessoa errada", T(
      `Ih, desculpa o engano, e obrigado pela paciência. Você sabe me dizer quem é ${pessoa} aí na {empresa}? Dá pra falar direto com ela?`,
      `Desculpe o engano, e obrigado pela paciência. Você saberia me dizer quem é ${pessoa} na {empresa}? Assim eu falo direto com ela.`,
      `Ih, foi mal o engano, e valeu pela paciência! Você sabe quem é ${pessoa} aí na {empresa}? Dá pra falar direto com ela?`,
    ), [o("Passou o contato", "transferido", "ok"), o("Não sabe ou não passa", "@encerrar", "objecao")], undefined, "ponte"),
    fala("sem_resp", "Ninguém atendeu", T(
      `Se cair na caixa postal, deixe um recado de uns vinte segundos, algo como “Oi, aqui é {meunome}, da Fey, metalúrgica especializada em fixadores. Liguei ${tema.n}. Vou tentar de novo mais tarde e, se você preferir, é só me chamar neste número. É [seu telefone], repito, [seu telefone]. Um abraço!”`,
      `Se cair na caixa postal, deixe um recado de cerca de vinte segundos, algo como “{saudacao}, aqui é {meunome}, da Fey, metalúrgica especializada em fixadores. Liguei ${tema.f}. Tento novamente mais tarde e, se preferir, pode me chamar neste número. O telefone é [seu telefone], repito, [seu telefone]. Obrigado e até logo.”`,
      `Se cair na caixa postal, deixe um recado de uns vinte segundos, algo como “Oi! Aqui é {meunome}, da Fey, a metalúrgica especializada em fixadores. Liguei ${tema.s}. Mais tarde eu tento de novo e, se quiser, me chama nesse número. É [seu telefone], repito, [seu telefone]. Valeu, um abraço!”`,
    ), [o("Deixou o recado", "wa_msg", "neutro"), o("Não deu para deixar recado", "wa_msg", "neutro"), o("Tentativa registrada", "@retorno", "neutro", "Ninguém atendeu: tentar outro horário ou número")], "Faça pelo menos seis tentativas, em horários e dias diferentes, antes de desistir. Manhã cedo e fim da tarde costumam funcionar melhor. Recado curto (cerca de vinte segundos), com o motivo, e o número repetido duas vezes.", "apoio"),
    fala("wa_msg", "Mensagem de WhatsApp", T(
      `Logo depois da ligação, mande no WhatsApp uma mensagem como “Oi, tudo bem? Aqui é {meunome}, da Fey, a metalúrgica especializada em fixadores. Tentei falar com você por telefone, ${tema.n}. Posso te ligar mais tarde ou, se preferir, me diz por aqui o melhor horário. Um abraço!”`,
      `Logo depois da ligação, envie no WhatsApp uma mensagem como “{saudacao}, tudo bem? Aqui é {meunome}, da Fey, metalúrgica especializada em fixadores. Tentei contato por telefone ${tema.f}. Posso ligar em outro momento ou, se preferir, me informe por aqui o melhor horário. Obrigado!”`,
      `Logo depois da ligação, mande no WhatsApp uma mensagem como “Oi, tudo bem? Aqui é {meunome}, da Fey, a metalúrgica especializada em fixadores. Tentei te ligar agora há pouco, ${tema.s}. Se quiser, me fala aqui o melhor horário que eu te ligo. Valeu!”`,
    ), [o("Mensagem enviada", "@retorno", "ok", "Recado na caixa postal e mensagem de WhatsApp enviados"), o("Não tem WhatsApp", "@retorno", "neutro", "Sem WhatsApp: tentar outro horário")], "Mensagem curta, sem anexo e sem preço na primeira vez: o objetivo é abrir a conversa. Quem vê duas tentativas (ligação e mensagem) lembra do nome. No Brasil o WhatsApp é o canal mais natural: mensagem curta, sem áudio longo e sem mandar o mesmo texto de novo. Se não responder, tente de novo em 2 a 3 dias com outro enfoque (apresentação, depois um exemplo, depois um convite fácil de recusar).", "apoio"),
    fala("pedir_decisor", "Pedir ajuda para chegar ao decisor", T(
      `Entendi, obrigado por me contar. Será que você me ajuda? Eu preciso falar com ${a.quem}. Quem é essa pessoa, e qual o melhor jeito de falar com ela?`,
      `Entendi, obrigado pela informação. Você poderia me ajudar? Preciso falar com ${a.quem}. Quem é essa pessoa e qual a melhor forma de falar com ela?`,
      `Entendi, valeu por me contar! Você me ajuda? Preciso falar com ${a.quem}. Quem é essa pessoa, e qual o melhor jeito de falar com ela?`,
    ), [o("Transferiu ou chamou a pessoa", "transferido", "ok"), o("Deu nome e horário", "horario", "neutro"), o("Não passa o contato", "@encerrar", "objecao", "Não passou o decisor")], "Quem não decide costuma ajudar se for tratado como parceiro: agradeça, peça o NOME e o melhor horário, e deixe claro que será rápido.", "ponte"),
    fala("papel", "Função de quem atende", T(
      `[[contato?Prazer, {contato}!|Prazer!]] E você cuida de quê aí na {empresa}? Pergunto pra não te falar de uma coisa que nem é com você.`,
      `[[contato?Muito prazer, {contato}!|Muito prazer!]] E qual é a sua função na {empresa}? Pergunto para não tomar seu tempo com algo que não seja da sua área.`,
      `[[contato?Prazer, {contato}!|Prazer!]] E você faz o que aí na {empresa}? Pergunto pra não te falar de coisa que nem é com você.`,
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
  // quem atende o cliente conhece uma dor diferente em cada tipo de empresa
  const empatia = p.tipo === "revenda"
    ? T(
      `Legal! Quem tá no balcão sabe como é. Faltou o parafuso certo, o cliente vai embora, né?`,
      `Que bom. Quem atende no balcão sabe bem como é. Quando falta o parafuso certo, o cliente acaba indo embora.`,
      `Que legal! Quem tá no balcão sabe bem. Faltou o parafuso certo, o cliente vai embora, né?`,
    )
    : p.tipo === "servico"
      ? T(
      `Legal! Quem fala com o cliente da oficina sabe como é. Faltou a peça certa, o veículo fica parado e o cliente cobra, né?`,
      `Que bom. Quem atende o cliente na oficina sabe bem como é. Quando falta a peça certa, o veículo fica parado e o cliente cobra.`,
      `Que legal! Quem fala com o cliente da oficina sabe bem. Faltou a peça certa, o veículo fica parado e o cliente cobra, né?`,
    )
      : T(
      `Legal! Quem fala com o cliente sabe como é. Faltou material na produção, a entrega atrasa e a cobrança cai em cima, né?`,
      `Que bom. Quem atende o cliente sabe bem como é. Quando falta material na produção, a entrega atrasa e a cobrança chega.`,
      `Que legal! Quem fala com o cliente sabe bem. Faltou material na produção, a entrega atrasa e a cobrança cai em cima, né?`,
    );
  const dorBalcao = p.tipo === "revenda" ? "“cliente que vai embora”" : p.tipo === "servico" ? "“veículo parado esperando peça”" : "“entrega atrasada por falta de material”";
  return [
    fala("p_socio", "Dono, sócio ou diretor", p.falas.socio, p.ok("Contato: decisor de compra (dono, sócio ou diretor)", p.next), p.tips.socio, "proposta"),
    fala("p_compras", "Compras ou comprador", p.falas.compras, p.ok("Contato: comprador", p.alcada ? "p_alcada" : p.next), p.tips.compras, "proposta"),
    fala("p_gestor", "Gerente, encarregado ou líder", p.falas.gestor, [...p.ok("Contato: gerente ou encarregado, participa da compra", p.next), o("Quem compra é outra pessoa", "pedir_decisor", "neutro", "Contato: gerente, não compra")], p.tips.gestor, "proposta"),
    fala("p_balcao", "Vendas, balcão ou atendimento", T(
      `${empatia.n} Somos uma metalúrgica especializada em fixadores e fabricamos ${itens}. Eu queria falar com ${alvo.quem} ${para.n}. Quem seria, e você consegue me passar agora?`,
      `${empatia.f} Somos uma metalúrgica especializada em fixadores e fabricamos ${itens}. Gostaria de falar com ${alvo.quem} ${para.f}. Quem seria, e você consegue me transferir agora?`,
      `${empatia.s} Somos uma metalúrgica especializada em fixadores e fabricamos ${itens}. Queria falar com ${alvo.quem} ${para.s}. Quem é, e dá pra me passar agora?`,
    ), [o("Passou a ligação", "transferido", "ok", "Balcão transferiu a ligação"), o("Deu nome e horário", "horario", "neutro"), o("Perguntou o assunto", "assunto"), o("Ele mesmo compra", p.next, "ok", "Contato: balcão que também compra"), o("Não passa", "obj_nao", "objecao", "Não passou o decisor")], "Quem atende o balcão é filtro e pode virar aliado. Não faça o pitch pra ele: peça ajuda, pergunte o nome de quem compra e qual o melhor horário. Use o problema dele (" + dorBalcao + ") para criar empatia. Agradeça pelo nome.", "ponte"),
    fala("p_operacao", "Estoque, manutenção, oficina ou produção", T(
      `Legal! Você vê de perto o que falta e o que quebra. Me conta, qual fixador mais dá dor de cabeça aí, o que acaba rápido ou o que vem com defeito? É pra eu levar o assunto certo pra quem cuida das compras.`,
      `Que bom. Você acompanha de perto o que falta e o que quebra. Qual fixador mais causa transtorno aí, o que acaba rápido ou o que vem com defeito? Quero levar o assunto certo a quem cuida das compras.`,
      `Que bom! Você vê de perto o que falta e o que quebra. Me conta, qual fixador mais dá dor de cabeça aí, o que acaba rápido ou o que vem com defeito? É pra eu levar o assunto certo pra quem cuida das compras.`,
    ), [o("Citou um item ou problema", "pedir_decisor", "ok", "Operação informou item ou problema (anotar)"), o("Disse que está tudo certo", "pedir_decisor", "neutro"), o("Ele também faz as compras", p.next, "ok", "Contato: operação que também compra"), o("Prefere não falar", "obj_nao", "objecao")], "Quem vive o problema fala com gosto dele: deixe contar e anote item, marca e frequência (isso vira argumento para o decisor: “o pessoal da oficina comentou…”). Depois pergunte quem pede a compra.", "pergunta"),
    fala("p_admin", "Financeiro, administrativo ou RH", T(
      `Entendi, obrigado! E já adianto que não é cobrança nem nada de financeiro, é sobre a compra de fixadores. Quem cuida disso aí, e como eu falo com essa pessoa?`,
      `Entendi, obrigado. Já adianto que não se trata de assunto financeiro, e sim da compra de fixadores. Quem cuida disso, e como posso falar com essa pessoa?`,
      `Entendi, valeu! Já adianto que não é cobrança nem nada de financeiro, é sobre compra de fixador. Quem cuida disso aí, e como eu falo com essa pessoa?`,
    ), [o("Passou a ligação", "transferido", "ok", "Administrativo transferiu a ligação"), o("Deu nome e horário", "horario", "neutro"), o("Perguntou o assunto", "assunto"), o("Também cuida das compras", p.next, "ok", "Contato: administrativo que também compra"), o("Não passa", "obj_nao", "objecao", "Não passou o decisor")], "Financeiro e administrativo costumam saber quem compra e quem aprova. Deixe claro que não é cobrança nem pedido de dado: isso derruba a guarda. Em algumas empresas pequenas eles também compram: confirme.", "ponte"),
    fala("p_assistente", "Assistente ou secretária(o)", T(
      `Oi! Você me ajuda? Eu preciso de uns dois minutinhos com ${alvo.quem} aí na {empresa}, ${para.n}. Qual o melhor dia e horário pra eu falar com essa pessoa?`,
      `Olá! Você poderia me ajudar? Preciso de dois minutos com ${alvo.quem} na {empresa}, ${para.f}. Qual seria o melhor dia e horário para falar com essa pessoa?`,
      `Oi! Me dá uma força? Preciso de uns dois minutinhos com ${alvo.quem} aí na {empresa}, ${para.s}. Qual o melhor dia e horário pra eu falar com essa pessoa?`,
    ), [o("Passou a ligação", "transferido", "ok", "Assistente transferiu a ligação"), o("Marcou um horário", "@retorno", "ok", "Horário marcado com o decisor, via assistente"), o("Perguntou o assunto", "assunto"), o("Pediu para mandar e-mail", "rec_email"), o("Não passa", "obj_nao", "objecao")], "Assistente conhece a agenda e o humor do chefe: trate como parceira, nunca como obstáculo. Peça horário (não “posso falar?”) e confirme o nome do decisor. Cumprir o horário combinado é o que abre a próxima ligação.", "ponte"),
    ...(p.alcada ? [fala("p_alcada", "Quem aprova a compra", T(
      `E quando vocês fecham com um fornecedor novo, a decisão é sua ou passa por mais alguém?`,
      `Quando a empresa passa a comprar de um fornecedor novo, a decisão é sua ou passa por mais alguém?`,
      `Só por curiosidade, quando vocês fecham com um fornecedor novo, quem decide é você ou passa por mais alguém?`,
    ), [o("Decide sozinho", p.next, "ok", "Comprador decide sozinho"), o("Passa por outra pessoa", p.next, "neutro", "Comprador precisa de aprovação (anotar quem)"), o("Prefere não dizer", p.next)], "BANT, autoridade: saiba cedo quem aprova para trazer essa pessoa à conversa marcada. Pergunte sem cobrança, como curiosidade.", "pergunta")] : []),
  ];
}

/** 1. Confirmações: empresa e local, função do contato, segmento compatível. Conversadas, sem cara de formulário. */
export function confirma(next: string, itens: string, tipo: Tipo): ScriptNode[] {
  const perfil = tipo === "revenda" ? "Cliente que revende fixadores é o perfil central: pergunte como atende o balcão e o que mais gira." : tipo === "producao" ? "Quem usa fixador na produção compra recorrente e valoriza prazo e padrão: vá por aí." : "Quem usa nos serviços e na manutenção sofre com parada: o valor está em ter o item na hora.";
  return [
    fala("conf_empresa", "Confirmar empresa e local", T(
      `Só pra eu não incomodar a empresa errada, aí é a {empresa_completa}, de {cidade}, né?`,
      `Só para não incomodar a empresa errada, estou falando com a {empresa_completa}, de {cidade}, certo?`,
      `Só pra eu não atrapalhar a empresa errada, aí é a {empresa_completa}, de {cidade}, né?`,
    ), [o("Confirmou", "papel", "ok", "Empresa e local confirmados"), o("Mudou de nome ou de endereço", "papel", "neutro", "Atenção: nome ou endereço diferente do cadastro"), o("Não é essa empresa", "@encerrar", "objecao", "Telefone não pertence à empresa")], "Soa como cortesia, não como checagem. Se mudou, anote o nome e o endereço novos na observação."),
    fala("conf_segmento", "Entender como a empresa trabalha", T(
      `Legal! E me conta, como a {empresa} trabalha com fixadores? Vocês revendem, usam na produção, ou é mais manutenção e serviço?`,
      `Ótimo. E como a {empresa} trabalha com fixadores? É revenda, uso na produção, ou manutenção e serviços?`,
      `Que legal! E me conta, como é que a {empresa} trabalha com fixador? Vocês revendem, usam na produção, ou é mais manutenção e serviço?`,
    ), [o("Revende (balcão, loja ou distribuidor)", "conf_negocio", "ok", "Segmento: revenda de fixadores"), o("Usa na produção ou montagem", "conf_negocio", "ok", "Segmento: usa na produção"), o("Usa na manutenção ou nos serviços", "conf_negocio", "ok", "Segmento: usa na manutenção ou serviços"), o("Não compra fixadores", "@encerrar", "objecao", "Fora do perfil: não compra fixadores")], perfil, "confirma"),
    fala("conf_negocio", "Conhecer a empresa", T(
      `Que bacana! E faz quanto tempo que a {empresa} tá no mercado? Dá pra sentir quando é uma casa tradicional.`,
      `Muito bom. E há quanto tempo a {empresa} está no mercado? Dá para perceber quando é uma casa tradicional.`,
      `Que bacana! E faz quanto tempo que a {empresa} tá no mercado? Dá pra sentir quando é casa tradicional, né?`,
    ), [o("Mais de 10 anos", next, "ok", "Tempo de mercado: mais de 10 anos"), o("De 3 a 10 anos", next, "ok", "Tempo de mercado: 3 a 10 anos"), o("Menos de 3 anos", next, "ok", "Tempo de mercado: menos de 3 anos"), o("Prefere não dizer", next)], "Aqui a conversa fica mais leve. Ouça a história da pessoa, comente com interesse de verdade e só então siga. É onde nasce a conexão.", "ponte"),
  ];
}

/** 2. Enriquecedores: o que a conversa descobre sobre o lead. Cada pergunta traz um porquê e permite pular. */
export function enriquece(last: string, tipo: Tipo, kind: "sdr" | "vendas"): ScriptNode[] {
  const aplic = tipo === "revenda" ? [o("Balcão e varejo", "enr_freq", "ok", "Aplicação: balcão e varejo"), o("Oficinas e frotas", "enr_freq", "ok", "Aplicação: oficinas e frotas"), o("Indústrias e construtoras", "enr_freq", "ok", "Aplicação: indústrias e construtoras"), o("Um pouco de tudo", "enr_freq", "ok", "Aplicação: mais de uma")]
    : tipo === "producao" ? [o("Montagem do produto final", "enr_freq", "ok", "Aplicação: montagem do produto final"), o("Manutenção das máquinas", "enr_freq", "ok", "Aplicação: manutenção das máquinas"), o("Reposição e assistência técnica", "enr_freq", "ok", "Aplicação: reposição e assistência"), o("Mais de uma aplicação", "enr_freq", "ok", "Aplicação: variada")]
    : [o("Manutenção da própria frota", "enr_freq", "ok", "Aplicação: manutenção de frota"), o("Serviço para clientes", "enr_freq", "ok", "Aplicação: serviços para clientes"), o("Reposição e estoque", "enr_freq", "ok", "Aplicação: reposição e estoque"), o("Mais de uma aplicação", "enr_freq", "ok", "Aplicação: variada")];
  const skip = o("Prefere não responder", "enr_freq", "neutro");
  return [
    ...(kind === "sdr" ? [fala("enr_conhece", "Conhece a Fey?", T(
      `Deixa eu te perguntar uma coisa. Você já conhecia a Fey? Já chegou a comprar da gente, direto ou por algum distribuidor?`,
      `Queria saber se você já conhecia a Fey. Já chegou a comprar da empresa, direto ou por algum distribuidor?`,
      `Tô curioso, você já conhecia a Fey? Já comprou da gente, direto ou por algum distribuidor?`,
    ), [o("É ou já foi cliente da Fey", "enr_mix", "ok", "Já é ou foi cliente Fey"), o("Compra Fey por um distribuidor", "enr_mix", "neutro", "Compra Fey por distribuidor (anotar qual)"), o("Compra de um concorrente", "enr_mix", "neutro", "Compra de concorrente (anotar qual)"), o("Não conhece a Fey", "enr_mix", "neutro", "Não conhece a Fey"), o("Prefere não responder", "enr_mix")], "Descubra de quem compra hoje (distribuidor ou concorrente) sem soar como interrogatório, e anote o nome. Se ele já conhece, pergunte o que achou. Pare para ouvir antes da próxima pergunta.")] : []),
    ...(kind === "sdr" ? [fala("enr_mix", "Quais produtos compra", T(
      `E o que vocês mais compram hoje? É um mix de vários itens ou uns bem específicos? Eu pergunto pra não te mandar nada que não sirva.`,
      `E o que a empresa mais compra hoje? Um mix de vários itens ou alguns específicos? Pergunto para não enviar nada que não seja útil.`,
      `E o que vocês mais compram hoje? É um mix de vários itens ou uns específicos? Pergunto pra não te mandar nada que não sirva.`,
    ), [o("Mix variado de itens", "enr_aplicacao", "ok", "Compra mix variado"), o("Poucos itens específicos", "enr_aplicacao", "ok", "Compra poucos itens específicos"), o("Só um item", "enr_aplicacao", "neutro", "Compra um item só"), o("Não soube dizer", "enr_aplicacao")], "Deixe falar. Anote os itens e como é o mix: isso vira a cotação do vendedor. “Me conta mais” é a melhor pergunta de continuação (Sandler).")] : []),
    fala("enr_aplicacao", "Onde aplica", T(
      `Entendi! E dentro disso, onde esses itens entram mais no dia a dia? Eu pergunto porque a aplicação muda qual parafuso ou grampo é o ideal.`,
      `Entendi. E dentro disso, em que aplicação esses itens entram mais? A aplicação define qual parafuso ou grampo é o ideal.`,
      `Entendi! E dentro disso, onde esses itens entram mais no dia a dia? Porque, dependendo da aplicação, muda qual parafuso ou grampo é o melhor.`,
    ), [...aplic, skip]),
    fala("enr_freq", "Frequência de compra", T(
      `E de quanto em quanto tempo vocês repõem isso? É toda semana, todo mês, ou só quando falta mesmo?`,
      `E com que frequência a empresa faz a reposição? Toda semana, todo mês, ou apenas quando falta?`,
      `E de quanto em quanto tempo vocês repõem isso? É toda semana, todo mês, ou só quando acaba mesmo?`,
    ), [o("Toda semana", "enr_func", "ok", "Compra toda semana"), o("Todo mês", "enr_func", "ok", "Compra todo mês"), o("A cada dois ou três meses", "enr_func", "neutro", "Compra a cada 2 ou 3 meses"), o("Só quando precisa", "enr_func", "neutro", "Compra só sob demanda")]),
    fala("enr_func", "Tamanho da empresa", T(
      `Quantas pessoas vocês são aí, mais ou menos? É só pra eu ter noção do tamanho da casa.`,
      `Quantas pessoas trabalham aí, mais ou menos? É só para eu ter noção do porte da empresa.`,
      `Quantas pessoas vocês são aí, mais ou menos? Só pra eu ter noção do tamanho da casa.`,
    ), [o("Até 5", "enr_quando", "neutro", "Funcionários: até 5"), o("De 6 a 20", "enr_quando", "ok", "Funcionários: 6 a 20"), o("De 21 a 100", "enr_quando", "ok", "Funcionários: 21 a 100"), o("Mais de 100", "enr_quando", "ok", "Funcionários: mais de 100"), o("Não soube dizer", "enr_quando")], "Pergunta leve de perfil, sem cara de formulário. A Gong viu que 11 a 14 perguntas bem dirigidas funcionam melhor que um questionário completo."),
    fala("enr_quando", "Quando precisa", T(
      `E a próxima reposição, quando vocês costumam precisar? Aí eu já deixo tudo pronto no tempo certo.`,
      `E quando costuma ser a próxima reposição? Assim eu já deixo tudo pronto no tempo certo.`,
      `E a próxima reposição, quando vocês costumam precisar? Aí eu já deixo tudo pronto na hora certa.`,
    ), [o("Esta semana", last, "ok", "Próxima compra: esta semana"), o("Neste mês", last, "ok", "Próxima compra: neste mês"), o("Nos próximos meses", last, "neutro", "Próxima compra: nos próximos meses"), o("Sem previsão", last, "neutro", "Próxima compra: sem previsão")], "Prazo (o T do BANT): é ele quem diz quando precisa. Orçamento está no pedido mínimo, autoridade em quem decide, necessidade no problema e no impacto."),
  ];
}

/** Pedido mínimo (confirmação) com os 25%. */
export const minimo = (to: string): ScriptNode =>
  fala("conf_minimo", "Alinhar o pedido mínimo", T(
      `Olha, eu prefiro ser transparente desde já. O primeiro pedido tem um mínimo de ${FIRST}, e do segundo em diante o mínimo cai pra ${NEXT}. Em cima disso eu aplico 25% de desconto, então o valor do pedido continua o mesmo, mas você leva mais produto. Cabe na rotina de vocês?`,
      `Prefiro ser transparente desde já. O primeiro pedido tem mínimo de ${FIRST}, e do segundo em diante o mínimo passa a ser ${NEXT}. Sobre esse valor aplicamos 25% de desconto, então o valor do pedido continua o mesmo e a empresa leva mais produto. Isso cabe na rotina de vocês?`,
      `Olha, vou ser bem transparente. O primeiro pedido tem mínimo de ${FIRST}, e do segundo em diante cai pra ${NEXT}. E em cima disso eu dou 25% de desconto, ou seja, o valor do pedido é o mesmo, só que você leva mais produto. Cabe aí pra vocês?`,
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
      `Entendi, e valeu por ser franco comigo. O que pesa mais pra você agora? Assim eu respondo o que realmente importa.`,
      `Entendi, e agradeço a franqueza. O que pesa mais para você neste momento? Assim posso responder ao que realmente importa.`,
      `Entendi, valeu por ser sincero! O que tá pesando mais pra você agora? Aí eu respondo o que importa de verdade.`,
    ), [o("Preço", "obj_preco", "objecao"), o("Prazo de entrega", "obj_prazo", "objecao"), o("Qualidade e garantia", "obj_qualidade", "objecao"), o("Forma de pagamento", "obj_pagamento", "objecao"), o("Frete", "obj_frete", "objecao"), o("Pedido mínimo", "obj_minimo", "objecao"), o("Perguntou o preço de cara", "obj_preco_cedo", "objecao"), o("Outras objeções…", "obj_menu2", "neutro")], `Escute até o fim, sem interromper, e esclareça antes de responder: muitas vezes o que ele diz não é o que ele quer dizer (Blount). ${PAR}`, "objecao"),
    fala("obj_menu2", "Outras objeções", T(
      `Certo. E fora isso, tem mais alguma coisa te preocupando?`,
      `Certo. Além disso, há mais alguma coisa que o preocupe?`,
      `Certo! E fora isso, tem mais alguma coisa te preocupando?`,
    ), [o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Satisfeito com o fornecedor atual", "obj_satisfeito", "objecao"), o("Compra por distribuidor", "obj_distribuidor", "objecao"), o("Concorrente mais barato", "obj_concorrente", "objecao"), o("Não conhece a Fey", "obj_confianca", "objecao"), o("Já teve experiência ruim", "obj_ruim", "objecao"), o("Precisa falar com sócio ou decisor", "obj_socio", "objecao"), o("Manda por e-mail ou WhatsApp", "obj_enviar", "objecao"), o("Sem interesse", "obj_nao", "objecao"), o("Mais objeções…", "obj_menu3", "neutro")], undefined, "objecao"),
    fala("obj_menu3", "Mais objeções", T(
      `Tá certo. E tem mais alguma coisa que eu deva saber?`,
      `Entendi. Há mais alguma coisa que eu deva saber?`,
      `Beleza! Tem mais alguma coisa que eu precise saber?`,
    ), [o("Sem tempo agora", "obj_tempo", "objecao"), o("Estoque cheio, sem necessidade agora", "obj_estoque", "objecao"), o("Pediu para ligar mais tarde (próximo mês ou trimestre)", "obj_depois", "objecao"), o("Sem verba no momento", "obj_verba", "objecao"), o("Vai pensar", "obj_pensar_geral", "objecao"), o("Pede desconto maior", "obj_desconto", "objecao"), o("Só trabalha com uma marca", "obj_marca", "objecao"), o("A compra é centralizada em outra área", "obj_matriz", "objecao"), o("Mais objeções…", "obj_menu4", "neutro"), o("Voltar às objeções principais", "obj_menu", "neutro")], undefined, "objecao"),
    fala("obj_menu4", "Ainda mais objeções", T(
      "Certo. E tem mais alguma coisa que eu possa esclarecer?",
      "Certo. Há mais alguma coisa que eu possa esclarecer?",
      "Certo! Tem mais alguma coisa que eu possa te esclarecer?",
    ), [o("Burocracia de cadastro", "obj_cadastro", "objecao"), o("Pede certificado ou laudo", "obj_certificado", "objecao"), o("Pede referências de clientes", "obj_referencia", "objecao"), o("Precisa de item sob medida", "obj_especial", "objecao"), o("Duvida que funcione para ele", "obj_resultado", "objecao"), o("Diz que não precisa", "obj_nao_preciso", "objecao"), o("Perguntou como conseguimos o número", "obj_numero", "objecao"), o("Gostou, mas deixa para outro momento", "obj_momento", "objecao"), o("Voltar às outras objeções", "obj_menu3", "neutro"), o("Voltar às objeções principais", "obj_menu", "neutro")], undefined, "objecao"),
    fala("obj_preco", "Acha caro", T(
      `Faz sentido olhar o preço com cuidado, e eu prefiro que você olhe mesmo. Mas me diz uma coisa, caro comparado com o quê? Com o que vocês pagam hoje ou com o que você esperava? Porque a nossa linha é premium, e eu dou 25% de desconto no pedido. O mínimo continua o mesmo, mas você leva mais produto.`,
      `É natural avaliar o preço com cuidado. Em comparação com o quê o valor parece alto? Com o que a empresa paga hoje, ou com o que esperava? Nossa linha é premium e damos 25% de desconto no pedido. O mínimo se mantém, mas vocês levam mais produto.`,
      `Faz sentido olhar o preço com calma, e eu prefiro que olhe mesmo! Mas me diz, caro comparado com o quê? Com o que vocês pagam hoje ou com o que você esperava? É que a nossa linha é premium, e eu dou 25% de desconto no pedido. O mínimo é o mesmo, mas você leva mais produto.`,
    ), [ok("Explicou a comparação e topou olhar"), o("Ainda acha caro", "obj_valor", "objecao"), outra], `${dica} Rotule antes de argumentar: “parece que o preço está pesando”. Não defenda o preço: descubra com o que ele compara (Voss).`),
    fala("obj_valor", "Mostrar o valor", T(
      `Entendo. Só que no fixador o que pesa no bolso não é só o preço, é o que acontece quando ele falha. Retrabalho, máquina parada, veículo parado. Que tal eu montar uma comparação item por item, com o que vocês já compram? Aí você mesmo vê se a conta fecha.`,
      `Entendo. No caso do fixador, porém, o custo real não é apenas o preço, mas o que acontece quando ele falha, como retrabalho, máquina ou veículo parado. Que tal montarmos uma comparação item a item, com o que vocês já compram? Assim você mesmo verifica se a conta fecha.`,
      `Entendi! Só que no fixador o que pesa no bolso não é só o preço, é o que rola quando ele falha. Retrabalho, máquina ou carro parado. Que tal eu montar uma comparação item por item, com o que vocês já compram? Aí você mesmo vê se a conta fecha.`,
    ), [ok("Aceitou a comparação", "Pediu comparação por item"), nao("Preço acima do mercado")], dica),
    fala("obj_prazo", "Prazo de entrega", T(
      `Prazo é coisa que a gente leva muito a sério. Me diz, em quantos dias você precisa receber pra ficar tranquilo? Aí eu já deixo combinado na cotação.`,
      `O prazo é um dos pontos que levamos mais a sério. Em quantos dias você precisa receber para ficar tranquilo? Assim já deixo alinhado na cotação.`,
      `Prazo é coisa que a gente leva a sério demais! Me diz, em quantos dias você precisa receber pra ficar tranquilo? Aí eu já deixo combinado na cotação.`,
    ), [ok("Informou o prazo que precisa", "Prazo de entrega é prioridade"), nao(), outra], "Não prometa um número de dias: o vendedor confirma o prazo exato por região, na cotação."),
    fala("obj_qualidade", "Qualidade e garantia", T(
      `Faz bem em perguntar. A gente fabrica, então responde pelo que produz. O que aconteceu com os fixadores que deram problema pra vocês? E se quiser, eu mando até uma amostra pra você testar do seu jeito.`,
      `Faz bem em perguntar. Nós fabricamos e, por isso, respondemos pelo que produzimos. O que aconteceu com os fixadores que apresentaram problema? Se quiser, envio uma amostra para você testar do seu jeito.`,
      `Faz bem em perguntar! A gente fabrica, então responde pelo que faz. O que rolou com os fixadores que deram problema aí? Se quiser, eu mando até uma amostra pra você testar do seu jeito.`,
    ), [ok("Contou o problema que tem hoje", "Reclama da qualidade do fornecedor atual"), ok("Pediu amostra", "Pediu amostra"), nao(), outra], "Pergunte o que deu errado antes: é o que dá o argumento. Ofereça amostra se fizer sentido, sem prometer o que não pode."),
    fala("obj_pagamento", "Forma de pagamento", T(
      `Isso a gente acerta junto com o pedido, depois da análise de cadastro, e o vendedor corre atrás da melhor condição pra vocês. Como a {empresa} costuma pagar os fornecedores?`,
      `Isso é definido junto com o pedido, após a análise de cadastro, e o vendedor busca a melhor condição para vocês. Como a {empresa} costuma pagar os fornecedores?`,
      `Isso a gente acerta junto com o pedido, depois da análise de cadastro, e o vendedor vai atrás da melhor condição pra vocês. Como a {empresa} costuma pagar os fornecedores?`,
    ), [ok("Disse como prefere pagar", "Preferência de pagamento informada"), nao(), outra], "Não prometa prazo nem parcelamento: depende da análise."),
    fala("obj_frete", "Frete", T(
      `O frete a gente calcula na cotação, de acordo com a região e a transportadora. Pra onde seria a entrega?`,
      `O frete é calculado na cotação, de acordo com a região e a transportadora. Para onde seria a entrega?`,
      `O frete a gente calcula na cotação, conforme a região e a transportadora. Pra onde vai a entrega?`,
    ), [ok("Informou o local de entrega", "Frete: informou local de entrega"), nao(), outra], undefined),
    fala("obj_minimo", "Pedido mínimo alto", T(
      `Entendo. O mínimo de ${FIRST} vale só pro primeiro pedido, e do segundo em diante cai pra ${NEXT}. Com os 25% de desconto, esse valor rende bastante produto. Quanto vocês costumam comprar de cada vez?`,
      `Entendo. O mínimo de ${FIRST} vale apenas para o primeiro pedido e, do segundo em diante, passa a ${NEXT}. Com os 25% de desconto, esse valor rende bastante produto. Quanto a empresa costuma comprar de cada vez?`,
      `Entendi! O mínimo de ${FIRST} é só no primeiro pedido, e do segundo em diante cai pra ${NEXT}. Com os 25% de desconto, esse valor rende bastante produto. Quanto vocês costumam comprar de cada vez?`,
    ), [ok("Aceitou montar o pedido"), o("Compra bem menos que isso", "obj_minimo2", "objecao"), outra], "Descubra o volume real antes de defender o mínimo: R$ 3.500 no primeiro e R$ 2.500 depois."),
    fala("obj_minimo2", "Volume abaixo do mínimo", T(
      `Olha, se a gente juntar o mix completo, ou a compra de uns três meses, o valor chega mais fácil. Vale dar uma olhada em quais itens entram?`,
      `Se reunirmos o mix completo, ou a compra de cerca de três meses, o valor é atingido com mais facilidade. Vale analisarmos quais itens entram?`,
      `Olha, se a gente juntar o mix todo, ou a compra de uns três meses, o valor chega bem mais fácil. Bora dar uma olhada em quais itens entram?`,
    ), [ok("Topou ver o mix", "Pode chegar ao mínimo com o mix completo"), nao("Volume abaixo do pedido mínimo")], undefined),
    fala("obj_fornecedor", "Já tem fornecedor", T(
      `Que bom, isso mostra que vocês cuidam bem da reposição! E olha, eu não quero que você troque ninguém. Só queria entender o que vocês fazem quando o fornecedor atual falha no prazo ou em algum item. A ideia é a Fey ser a segunda opção de confiança e, nos itens em que a gente for melhor, a primeira. E se desse pra melhorar uma coisa no atual, qual seria?`,
      `Que bom, isso mostra cuidado com a reposição. Não pretendo que você substitua ninguém. Gostaria apenas de entender o que vocês fazem quando o fornecedor atual falha no prazo ou em algum item. A ideia é a Fey ser uma segunda opção de confiança e, nos itens em que formos melhores, a primeira. E se pudesse melhorar algo no atual, o que seria?`,
      `Que bom, dá pra ver que vocês cuidam bem da reposição! E olha, eu não quero que você troque ninguém, viu? Só queria saber o que vocês fazem quando o fornecedor atual atrasa ou falha em algum item. A ideia é a Fey ser a segunda opção de confiança e, nos itens em que a gente for melhor, a primeira. E se desse pra melhorar uma coisa no atual, qual seria?`,
    ), [ok("Topou conhecer a Fey", "Tem fornecedor, topou conhecer"), nao("Mantém o fornecedor atual"), outra], "Nunca fale mal do concorrente. Pergunte o que acontece quando o fornecedor falha: é nesse ponto que a Fey entra. “Estou satisfeito” cai aqui também."),
    fala("obj_satisfeito", "Satisfeito com o fornecedor atual", T(
      `Que ótimo, e eu não quero mexer no que funciona. Me diz só uma coisa. Se o fornecedor atual ficasse sem um item de giro ou atrasasse uma entrega, vocês teriam uma segunda opção pronta? Eu seria só essa reserva, sem trocar ninguém.`,
      `Fico feliz em saber, e não pretendo mexer no que funciona. Se o fornecedor atual ficasse sem um item de giro ou atrasasse uma entrega, vocês teriam uma segunda opção pronta? A Fey seria apenas essa reserva, sem substituir ninguém.`,
      `Que bom ouvir isso, e eu não quero mexer no que tá funcionando! Se o fornecedor atual ficasse sem um item de giro ou atrasasse uma entrega, vocês teriam uma segunda opção na manga? Eu seria só essa reserva, sem trocar ninguém.`,
    ), [ok("Topou ter uma segunda opção", "Satisfeito com o atual, aceitou a Fey como reserva"), nao("Satisfeito com o fornecedor atual"), outra], "Ninguém troca de fornecedor que funciona: posicione a Fey como seguro, não como substituta. Josh Braun: pergunte se faz sentido, sem pressão. Se não, deixe a porta aberta e registre."),
    fala("obj_distribuidor", "Compra por distribuidor", T(
      `Que legal, então vocês já têm um distribuidor de confiança! Comprando direto da fábrica a condição melhora e o prazo fica mais firme. Qual distribuidor vocês usam hoje? Se quiser, eu mostro como ficaria comprando direto, só pra você comparar.`,
      `Que bom, então vocês já têm um distribuidor de confiança. Comprando direto da fábrica, a condição melhora e o prazo fica mais firme. Qual distribuidor vocês utilizam hoje? Posso mostrar como ficaria comprando direto, apenas para comparação.`,
      `Que legal, então vocês já têm um distribuidor de confiança! Comprando direto da fábrica a condição melhora e o prazo fica mais firme. Qual distribuidor vocês usam hoje? Se quiser, eu mostro como ficaria comprando direto, só pra você comparar.`,
    ), [ok("Informou o distribuidor e quer ver", "Compra por distribuidor (anotar qual)"), o("Prefere manter o distribuidor", "@encerrar", "objecao", "Prefere manter o distribuidor"), outra], "Anote qual é o distribuidor. Não force: se ele gosta do distribuidor, deixe a porta aberta."),
    fala("obj_concorrente", "Concorrente mais barato", T(
      `Faz sentido comparar! Só que o preço de etiqueta não conta a história toda, porque pesa a durabilidade e o retrabalho que o item dá. A gente fabrica linha premium e, com os 25% de desconto, a conta por item fica bem competitiva. Posso montar uma comparação com o que você já compra?`,
      `Faz sentido comparar. No entanto, o preço de etiqueta não conta a história toda, pois pesam a durabilidade e o retrabalho que o item gera. Fabricamos linha premium e, com os 25% de desconto, a conta por item fica bastante competitiva. Posso montar uma comparação com o que você já compra?`,
      `Faz sentido comparar! Só que o preço de etiqueta não conta a história toda, porque pesa a durabilidade e o retrabalho que o item dá. A gente fabrica linha premium e, com os 25% de desconto, a conta por item fica bem competitiva. Posso montar uma comparação com o que você já compra?`,
    ), [ok("Aceitou a comparação", "Concorrente mais barato: pediu comparação"), nao("Fechado com concorrente"), outra], dica),
    fala("obj_confianca", "Não conhece a Fey", T(
      `Faz todo sentido, ninguém compra de quem não conhece. Somos uma metalúrgica especializada em fixadores e fabricamos o que vendemos. Que tal começar por uma amostra, ou só dar uma olhada na cotação, sem compromisso? Aí você decide.`,
      `Faz todo sentido, ninguém compra de quem não conhece. Somos uma metalúrgica especializada em fixadores e fabricamos o que vendemos. Que tal começar por uma amostra, ou apenas analisar a cotação, sem compromisso? Depois você decide.`,
      `Faz todo sentido, ninguém compra de quem não conhece! Somos uma metalúrgica especializada em fixadores e fabricamos o que vendemos. Que tal começar por uma amostra, ou só dar uma olhada na cotação, sem compromisso? Aí você decide.`,
    ), [ok("Topou amostra ou cotação", "Não conhecia a Fey: aceitou amostra ou cotação"), nao("Não confia sem conhecer"), outra], "Reduza o risco do primeiro passo: amostra ou cotação, nunca pressão. Ofereça só o que a Fey pode cumprir."),
    fala("obj_ruim", "Já teve experiência ruim", T(
      `Poxa, sinto muito por isso. Se você não se importar de me contar, o que aconteceu? Eu quero entender pra não repetir com você.`,
      `Lamento por isso. Se não se importar de me contar, o que aconteceu? Gostaria de entender para não repetir o problema com você.`,
      `Poxa, que chato isso! Se não se importar de me contar, o que rolou? Quero entender pra não repetir com você.`,
    ), [ok("Contou o que aconteceu", "Experiência ruim anterior: anotar o motivo"), nao(), outra], "Deixe falar sem interromper e rotule: “parece que isso te deixou na mão”. A queixa dele vira o seu argumento."),
    fala("obj_socio", "Precisa falar com o sócio", T(
      `Claro, faz todo sentido chamar quem decide junto. Que tal a gente marcar um horário em que vocês dois consigam? Aí eu apresento uma vez só e ninguém precisa repetir nada. Combinado o horário, eu te confirmo por WhatsApp, por escrito, pra ninguém esquecer.`,
      `Claro, faz sentido envolver quem decide. Que tal marcarmos um horário em que ambos estejam disponíveis? Assim eu apresento uma única vez e ninguém precisa repetir nada. Definido o horário, envio a confirmação por escrito, por WhatsApp ou e-mail.`,
      `Claro, faz todo sentido chamar quem decide junto! Que tal a gente marcar um horário em que vocês dois consigam? Aí eu apresento uma vez só e ninguém repete nada. Combinou o horário, eu te confirmo por WhatsApp, por escrito, pra ninguém esquecer.`,
    ), [o("Combinou com o decisor", "@retorno", "ok", "Conversa com o decisor agendada"), nao("Não passou o decisor")], undefined),
    fala("obj_tempo", "Sem tempo agora", T(
      `Sem problema, sei que te peguei no meio do corre! Rapidinho então, somos uma metalúrgica especializada em fixadores, com linha premium e prazo firme. Se fizer sentido, eu ligo em outro horário. Fica melhor de manhã ou à tarde?`,
      `Sem problema, sei que o contato foi no meio do expediente. Resumindo, somos uma metalúrgica especializada em fixadores, com linha premium e prazo firme. Se fizer sentido, ligo em outro horário. Qual é o melhor período, manhã ou tarde?`,
      `Sem problema, sei que te peguei no meio do corre! Resumindo, somos uma metalúrgica especializada em fixadores, com linha premium e prazo firme. Se fizer sentido, eu ligo em outra hora. Fica melhor de manhã ou à tarde?`,
    ), [o("Deu um horário", "@retorno", "ok", "Pediu retorno em outro horário"), o("Pediu pra não ligar mais", "@encerrar", "objecao", "Pediu para não ser contatado")], "Respeite o tempo: cumpra o que prometeu. Se ele deu horário, ligue exatamente nele. “Estou em reunião” costuma ser adiamento: peça um horário concreto."),
    fala("obj_enviar", "Manda por e-mail ou WhatsApp", T(
      `Mando sim! Só que pra não te mandar coisa que não serve, me deixa fazer duas perguntinhas rápidas. Quais itens vocês mais compram, e o que mais complica hoje? Aí eu mando só o que importa.`,
      `Envio sim. Para não enviar informação que não seja útil, posso fazer duas perguntas rápidas? Quais itens a empresa mais compra e o que mais complica hoje? Assim envio apenas o que importa.`,
      `Mando sim! Só que pra não te encher de coisa que não serve, me deixa fazer duas perguntinhas rápidas. Quais itens vocês mais compram, e o que mais complica hoje? Aí eu mando só o que importa.`,
    ), [o("Passou o contato e os itens", "@retorno", "ok", "Pediu material por e-mail ou WhatsApp"), ok("Aceitou conversar um pouco antes"), nao()], "“Manda por e-mail” é, quase sempre, tentativa de se livrar (Blount). Tente trinta segundos de conversa antes; se não rolar, combine o retorno: “te ligo depois de amanhã pra saber o que achou”."),
    fala("obj_estoque", "Estoque cheio", T(
      `Entendi, sem pressa. Quando o estoque começa a baixar, vocês costumam ser pegos de surpresa? Posso deixar a cotação pronta, pra vocês agirem rápido quando precisar.`,
      `Entendo, sem pressa. Quando o estoque começa a baixar, vocês costumam ser surpreendidos? Posso deixar a cotação pronta, para que ajam rapidamente quando necessário.`,
      `Tranquilo, sem pressa! Quando o estoque começa a baixar, vocês costumam ser pegos de surpresa? Posso deixar a cotação prontinha, aí vocês agem rápido quando precisar.`,
    ), [o("Combinou um retorno", "@retorno", "ok", "Estoque cheio: retornar mais tarde"), nao("Sem necessidade no momento")], undefined),
    fala("obj_depois", "Pediu para ligar mais tarde", T(
      `Combinado, eu ligo de novo. Só me ajuda a acertar o momento. O que precisaria acontecer pra esse assunto virar prioridade? O estoque baixar, uma obra nova, um item faltando? E em que mês você me recomenda ligar?`,
      `Combinado, ligo novamente. Para eu acertar o momento, o que precisaria acontecer para esse assunto virar prioridade? O estoque diminuir, uma obra nova, um item em falta? E em que mês você recomenda que eu ligue?`,
      `Combinado, eu volto a ligar! Só me ajuda a pegar a hora certa. O que precisaria acontecer pra esse assunto virar prioridade? O estoque baixar, uma obra nova, um item faltando? E em que mês você me recomenda ligar?`,
    ), [o("Deu uma data ou um gatilho", "@retorno", "ok", "Retornar na data ou gatilho combinado"), nao("Sem previsão de interesse")], "“Me liga no próximo trimestre” vale ouro quando vem com uma data ou um gatilho: anote os dois. Sem isso, é uma forma educada de dizer “não”."),
    fala("obj_verba", "Sem verba no momento", T(
      `Entendo, e respeito. Posso só perguntar uma coisa? O assunto não vale resolver agora, ou é só o caixa do momento? É que o pedido já entra com 25% de desconto, e a gente deixa tudo pronto pra quando for a hora.`,
      `Entendo e respeito. Posso perguntar uma coisa? O assunto não vale ser resolvido agora, ou é apenas uma questão do caixa neste momento? O pedido já tem 25% de desconto, e podemos deixar tudo preparado para a hora certa.`,
      `Entendi, e respeito! Posso só te perguntar uma coisa? O assunto não vale resolver agora, ou é só o caixa do momento? É que o pedido já entra com 25% de desconto, e a gente deixa tudo pronto pra quando for a hora.`,
    ), [o("É só o momento: combinou retorno", "@retorno", "ok", "Sem verba agora: retornar quando o caixa permitir"), nao("Sem verba e sem interesse")], "Separe “não tenho dinheiro” de “não vejo valor” antes de insistir (Rework): se o problema não vale resolver, o orçamento nem entra na conversa. Não ofereça desconto extra por pressão."),
    fala("obj_pensar_geral", "Vai pensar", T(
      `Claro, decisão importante a gente pensa mesmo. Pra eu te ajudar melhor, o que você ainda precisa ver, o preço, o prazo ou a garantia? Posso te ligar daqui a dois dias, de manhã ou à tarde?`,
      `Claro, é uma decisão que merece reflexão. Para eu ajudar melhor, o que ainda precisa avaliar, o preço, o prazo ou a garantia? Posso ligar em dois dias, de manhã ou à tarde?`,
      `Claro, decisão importante a gente pensa mesmo! Pra eu te ajudar melhor, o que falta você ver, o preço, o prazo ou a garantia? Posso te ligar daqui a dois dias, de manhã ou à tarde?`,
    ), [o("Disse o que falta decidir", "obj_menu", "neutro"), o("Combinou o retorno", "@retorno", "ok", "Combinado retorno em 2 dias"), nao()], "“Vou pensar” quase sempre esconde uma dúvida: descubra qual é, com calma, sem pressionar."),
    fala("obj_preco_cedo", "Perguntou o preço de cara", T(
      "Justo perguntar, e eu vou ser direto. Como a gente fabrica uma linha grande, o valor muda bastante de um item pro outro, e um número solto não ia te ajudar. Me diz os dois ou três itens que você mais compra, que eu te devolvo o valor com 25% de desconto ainda hoje.",
      "É justo perguntar, e serei direto. Como fabricamos uma linha ampla, o valor varia bastante de um item para outro, e um número solto não ajudaria. Se me informar os dois ou três itens que mais compra, devolvo o valor com 25% de desconto ainda hoje.",
      "Justo perguntar, e vou ser direto! Como a gente fabrica uma linha grande, o valor muda bastante de um item pro outro, e um número solto não ia te ajudar. Me diz os dois ou três itens que você mais compra, que eu te devolvo o valor com 25% de desconto ainda hoje.",
    ), [ok("Passou os itens", "Pediu o preço logo de cara e passou os itens"), o("Quer só a tabela", "@cotacao", "neutro", "Pediu somente o preço ou a tabela"), nao(), outra], "Preço dito sem contexto vira comparação injusta. Não fuja da pergunta: explique por que o valor depende do item e peça os itens de maior giro em troca do número."),
    fala("obj_desconto", "Pede desconto maior", T(
      "Faz sentido pedir, e eu gosto de quem negocia. O pedido já sai com 25% de desconto, que é a nossa condição de partida. Me diz uma coisa, se eu conseguir ajustar um pouquinho mais, isso resolve e a gente fecha o pedido hoje?",
      "É legítimo pedir, e valorizo quem negocia. O pedido já sai com 25% de desconto, que é a nossa condição de partida. Se eu conseguir ajustar um pouco mais, isso resolve e podemos fechar o pedido hoje?",
      "Faz sentido pedir, e eu curto quem negocia! O pedido já sai com 25% de desconto, que é a nossa condição de partida. Me diz uma coisa, se eu conseguir um tiquinho a mais, isso resolve e a gente fecha hoje?",
    ), [ok("Fecha hoje se houver ajuste", "Fecharia com um ajuste no desconto"), o("Quer pensar", "obj_pensar_geral", "objecao"), nao("Só fecha com desconto bem maior"), outra], "Só ceda o 26% em troca de um compromisso (fechar o pedido), nunca de graça. Descubra se o desconto é o que de fato trava a compra antes de oferecer qualquer coisa."),
    fala("obj_marca", "Só trabalha com uma marca", T(
      "Entendi, é normal ter a marca de costume. Eu não quero que você mude nada de uma vez. O que essa marca entrega que você não abre mão? Se a gente também faz, eu te mostro com uma amostra, sem compromisso.",
      "Entendo, é normal ter uma marca de costume. Não pretendo que você mude tudo de uma vez. O que essa marca entrega que a empresa não abre mão? Se também oferecemos, mostro com uma amostra, sem compromisso.",
      "Entendi, é normal ter a marca de costume. Não quero que você mude nada de uma vez, viu? O que essa marca tem que você não abre mão? Se a gente também faz, eu te mostro com uma amostra, sem compromisso.",
    ), [ok("Disse o que não abre mão", "Marca usada hoje e o que valoriza (anotar)"), ok("Topou testar uma amostra", "Aceitou testar uma amostra"), nao("Só compra a marca atual"), outra], "Não ataque a marca dele: descubra o que ela entrega e proponha uma amostra para comparar lado a lado."),
    fala("obj_matriz", "A compra é centralizada", T(
      "Entendi, então a compra passa por outra área ou pela matriz. Isso ajuda, porque me deixa falar com a pessoa certa. Quem cuida disso, e qual o melhor jeito de chegar nela? Se você puder me apresentar, eu cuido do resto.",
      "Entendo, então a compra é centralizada em outra área ou na matriz. Isso ajuda, porque me permite falar com a pessoa certa. Quem cuida disso e qual a melhor forma de chegar até ela? Se puder me apresentar, eu cuido do restante.",
      "Entendi, então a compra passa por outra área ou pela matriz. Isso ajuda, que aí eu falo com a pessoa certa. Quem cuida disso, e qual o melhor jeito de chegar nela? Se você puder me apresentar, eu cuido do resto.",
    ), [o("Passou o contato de quem compra", "@retorno", "ok", "Compra centralizada: contato da matriz ou da área de compras anotado"), o("Não pode passar o contato", "@encerrar", "objecao", "Compra centralizada e sem contato"), outra], "Quem compra para várias unidades costuma decidir volume maior. Anote o nome, a área e o melhor horário, e cite quem indicou na próxima ligação."),
    fala("obj_cadastro", "Burocracia de cadastro", T(
      "Entendo, ninguém merece papelada. Do nosso lado é simples, a gente só pede os dados básicos da empresa e faz a análise de cadastro, e eu acompanho de perto pra não ficar parado. O que costuma travar aí, algum documento ou a aprovação interna?",
      "Entendo, ninguém gosta de burocracia. Do nosso lado é simples, pedimos os dados básicos da empresa e fazemos a análise de cadastro, e eu acompanho de perto para não ficar parado. O que costuma travar aí, algum documento ou a aprovação interna?",
      "Entendo, ninguém merece papelada! Do nosso lado é simples, a gente só pede os dados básicos da empresa e faz a análise de cadastro, e eu acompanho de perto pra não ficar parado. O que costuma travar aí, algum documento ou a aprovação interna?",
    ), [ok("Explicou o que trava", "Cadastro: gargalo informado (anotar)"), nao(), outra], "Não prometa prazo de aprovação: diga que acompanha o processo. Descubra o gargalo real (documento, aprovação, sistema) e ofereça ajuda concreta."),
    fala("obj_certificado", "Pede certificado ou laudo", T(
      "Boa pergunta, é isso que dá segurança na compra. Qual norma ou certificado vocês precisam pro item? Eu levo pro nosso time técnico e te respondo com o que a gente tem de documentação, sem inventar nada.",
      "Boa pergunta, é isso que dá segurança na compra. Qual norma ou certificado a empresa precisa para o item? Encaminho ao nosso time técnico e respondo com a documentação disponível, sem afirmar nada além do que temos.",
      "Boa pergunta, é isso que dá segurança na compra! Qual norma ou certificado vocês precisam pro item? Levo pro nosso time técnico e te respondo com o que a gente tem de documentação, sem inventar nada.",
    ), [o("Informou a norma ou o certificado", "@retorno", "ok", "Pediu certificado ou laudo: acionar o time técnico e retornar"), nao(), outra], "Nunca afirme que o item tem uma certificação que você não conferiu. Anote a norma pedida e retorne com a resposta do time técnico no prazo prometido."),
    fala("obj_referencia", "Pede referências de clientes", T(
      "Faz todo sentido querer conhecer quem vai fornecer. Posso te passar clientes que compram da gente num negócio parecido, e se preferir você começa por uma amostra pra ver a qualidade com os próprios olhos. O que te deixaria mais seguro?",
      "Faz todo sentido querer conhecer quem vai fornecer. Posso indicar clientes que compram conosco em um negócio parecido e, se preferir, começar por uma amostra para avaliar a qualidade. O que deixaria você mais seguro?",
      "Faz todo sentido querer conhecer quem vai fornecer! Posso te passar clientes que compram da gente num negócio parecido, e se preferir você começa por uma amostra pra ver a qualidade com os próprios olhos. O que te deixaria mais seguro?",
    ), [ok("Topou amostra ou referência", "Pediu referências: aceitou amostra ou contato de cliente"), nao(), outra], "Só ofereça um cliente como referência com a autorização dele. Se não houver, a amostra é a melhor prova."),
    fala("obj_especial", "Precisa de item sob medida", T(
      "Boa, a gente fabrica, então isso é mais fácil do que parece. Me conta o que você precisa, medida, material e quantidade aproximada, que eu levo pro nosso time técnico ver se dá pra fazer e em quanto tempo.",
      "Ótimo, como fabricamos, isso é mais simples do que parece. Pode me contar o que precisa, medida, material e quantidade aproximada? Levo ao nosso time técnico para avaliar a viabilidade e o prazo.",
      "Boa, a gente fabrica, então isso é mais fácil do que parece! Me conta o que você precisa, medida, material e quantidade aproximada, que eu levo pro nosso time técnico ver se dá pra fazer e em quanto tempo.",
    ), [o("Explicou o item", "@retorno", "ok", "Item sob medida: acionar o time técnico e retornar"), nao(), outra], "Anote medida, material, aplicação e quantidade, sem prometer prazo nem preço. O time técnico confirma a viabilidade."),
    fala("obj_resultado", "Duvida que funcione para ele", T(
      "Boa pergunta, e eu não vou te prometer o que não sei. Prefiro te mostrar com um negócio parecido com o seu. Posso te passar um cliente que compra da gente numa rotina parecida, ou você começa por um pedido pequeno pra ver com os próprios olhos. O que te deixa mais tranquilo?",
      "Pergunta pertinente, e não vou prometer o que não posso garantir. Prefiro mostrar com um caso parecido com o seu. Posso indicar um cliente que compra conosco em uma rotina semelhante, ou você pode começar por um pedido pequeno para avaliar. O que deixaria você mais tranquilo?",
      "Boa pergunta, e eu não vou te prometer o que não sei! Prefiro te mostrar com um negócio parecido com o seu. Posso te passar um cliente que compra da gente numa rotina parecida, ou você começa por um pedido pequeno pra ver com os próprios olhos. O que te deixa mais tranquilo?",
    ), [ok("Topou ver um caso parecido ou testar com pedido pequeno", "Quer ver resultado parecido: caso de cliente ou pedido pequeno"), nao(), outra], "Quem pergunta se funciona quer prova, não argumento. Só cite um cliente com a autorização dele; sem isso, o pedido pequeno é a melhor prova."),
    fala("obj_nao_preciso", "Diz que não precisa", T(
      "Pode ser que não precise mesmo, e tudo bem. Só pra eu entender, quando falta um parafuso ou uma porca de uma hora pra outra, como vocês resolvem hoje? Se dá certo sempre, eu fico tranquilo e não te incomodo mais.",
      "Pode ser que não precisem, e tudo bem. Para eu compreender, quando falta um parafuso ou uma porca de uma hora para outra, como vocês resolvem hoje? Se funciona sempre, fico tranquilo e não volto a incomodar.",
      "Pode ser que não precise mesmo, e tá tudo bem! Só pra eu entender, quando falta um parafuso ou uma porca de uma hora pra outra, como vocês resolvem hoje? Se dá certo sempre, eu fico tranquilo e não te incomodo mais.",
    ), [ok("Contou como resolve hoje e topou conversar", "Dizia não precisar: contou como resolve a falta de item"), nao("Não vê necessidade"), outra], "Quase sempre é uma dor que a pessoa ainda não reconheceu. Pergunte pelo dia em que faltou item, sem discutir nem provar que ela precisa."),
    fala("obj_numero", "Perguntou como conseguimos o número", T(
      "Boa pergunta, e eu respondo direto. O telefone da empresa vem de cadastro empresarial, não de lista pessoal, e eu liguei porque vocês trabalham com um tipo de negócio que usa fixador. Se preferir que eu não ligue mais, eu retiro agora, sem problema nenhum. Mas se você me der uma chance, eu te conto o que a gente faz.",
      "Pergunta pertinente, e respondo com transparência. O telefone da empresa vem de cadastro empresarial, não de lista pessoal, e liguei porque vocês atuam em um negócio que utiliza fixadores. Se preferir que eu não ligue mais, retiro agora, sem qualquer problema. Mas, se me der uma chance, conto o que fazemos.",
      "Boa pergunta, e eu respondo na lata! O telefone da empresa vem de cadastro empresarial, não de lista pessoal, e eu liguei porque vocês trabalham com um negócio que usa fixador. Se preferir que eu não ligue mais, eu retiro agora, sem problema nenhum. Mas se você me der uma chance, eu te conto o que a gente faz.",
    ), [ok("Aceitou continuar a conversa"), o("Pediu para não ligar mais", "@encerrar", "objecao", "Pediu para não receber mais ligações: tirar do contato"), outra], "Fale a verdade sobre a origem do contato (confira no lead) e nunca insista com quem pede para sair da lista. Quem pede para sair e é respeitado fala bem da Fey."),
    fala("obj_momento", "Gostou, mas deixa para outro momento", T(
      "Que bom que você gostou, e eu não quero te atropelar. Só que “outro momento” costuma virar nunca, então me ajuda com uma coisa. O que precisa acontecer pra ficar um bom momento, e em que mês você acha que isso rola? Eu anoto e te procuro bem nessa data.",
      "Fico contente que tenha gostado, e não quero atropelar. Mas “outro momento” costuma virar nunca, então me ajude com uma informação. O que precisa acontecer para ser um bom momento, e em que mês isso deve ocorrer? Anoto e retorno exatamente nessa data.",
      "Que bom que você gostou, e eu não quero te atropelar! Só que “outro momento” costuma virar nunca, então me ajuda com uma coisa. O que precisa rolar pra ficar um bom momento, e em que mês você acha que isso acontece? Eu anoto e te procuro bem nessa data.",
    ), [o("Combinou o mês ou o que precisa acontecer", "@retorno", "ok", "Outro momento: retorno combinado com data ou gatilho"), nao(), outra], "Há interesse, só falta data. Transforme “depois” em um mês ou em um gatilho (fim do estoque, pedido grande, nova obra) e cumpra o combinado."),
    fala("obj_nao", "Sem interesse", T(
      `Tudo bem, valeu pela sinceridade! Só pra eu entender e não te incomodar à toa, é porque vocês já estão bem atendidos ou porque o assunto não faz sentido pra vocês? Pergunto sem compromisso mesmo.`,
      `Tudo bem, agradeço a franqueza. Para eu compreender e não incomodar à toa, é porque já estão bem atendidos ou porque o assunto não faz sentido para a empresa? Pergunto sem compromisso.`,
      `Tranquilo, valeu pela sinceridade! Só pra eu entender e não te incomodar à toa, é porque vocês já estão bem atendidos ou porque o assunto não faz sentido aí? Pergunto sem compromisso mesmo.`,
    ), [ok("Explicou o motivo e abriu espaço"), o("Encerrou a conversa", "@encerrar", "objecao", "Sem interesse")], `Pergunta de saída (negativo reverso, Sandler): ajuda a registrar o motivo real. ${PAR}`),
  ];
}
void cat; void FEY; void ONLINE;
