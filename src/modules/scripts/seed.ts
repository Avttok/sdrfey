import { withData } from "./seed-data";
import { visita } from "./seed-visita";
import { sql } from "drizzle-orm";
import { after } from "next/server";
import { db, scripts } from "@/db";
import type { ScriptGoal, ScriptNode, ScriptOption } from "@/config/scripts";
import type { ObjectiveId } from "@/config/objectives";
import type { ScriptTask } from "@/config/tasks";
import { GOALS, SEGMENTS } from "@/config/scripts";
import { NEXT, ONLINE, PARES, SEG, T, fala, fim, o, type Alvo } from "./seed-core";
import { confirma, enriquece, entrada, minimo, objecoes, perfis } from "./seed-parts";

/** Muda quando os textos de fábrica são reescritos: os scripts do time que ninguém editou são atualizados. */
export const SEED_VERSION = 27;

type Seg = (typeof SEG)[string];

/** Muda, para um objetivo, o destino das respostas de um passo (o resto da conversa fica igual). */
function reroute(nodes: ScriptNode[], from: string, obj: ObjectiveId, dest: string, only?: (o: ScriptOption) => boolean): ScriptNode[] {
  return nodes.map((n) => (n.id !== from ? n : { ...n, options: n.options.map((o) => (o.to && !o.to.startsWith("@") && o.to !== dest && (!only || only(o)) ? { ...o, goto: { ...o.goto, [obj]: dest } } : o)) }));
}

/** Passos que só existem para os objetivos "Confirmar dados" e "Qualificar lead" da Prospecção. */
function sdrObjetivos(): ScriptNode[] {
  const cad = [tk("outro", "Atualizar o cadastro do lead no sistema", 0)];
  return [
    fala("dados_abre", "Atualizar o cadastro", T(
      "Olha, eu tô atualizando o cadastro da {empresa} aqui na Fey, pra gente mandar só o que serve, e pra pessoa certa. Posso confirmar com você duas ou três coisinhas rápidas?",
      "Estou atualizando o cadastro da {empresa} aqui na Fey, para enviarmos apenas o que for útil, e à pessoa certa. Posso confirmar com você duas ou três informações rápidas?",
      "Olha, tô atualizando o cadastro da {empresa} aqui na Fey, pra gente mandar só o que serve, e pra pessoa certa. Posso confirmar duas ou três coisinhas rapidinho?",
    ), [o("Pode confirmar", "dados_contato", "ok"), o("Quem cuida disso é outra pessoa", "pedir_decisor", "neutro"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Prefere não passar dados", "obj_nao", "objecao")], "Objetivo: sair da ligação com o contato certo e atualizado. Diga que é só cadastro, seja breve e deixe o pitch para outra hora.", "confirma"),
    fala("dados_contato", "Melhor contato", T(
      "Qual é o melhor WhatsApp e e-mail pra falar com quem cuida das compras aí? E o seu, posso deixar anotado também?",
      "Qual é o melhor WhatsApp e e-mail para falar com quem cuida das compras? E o seu, posso deixar anotado também?",
      "Qual o melhor WhatsApp e e-mail pra falar com quem cuida das compras aí? E o seu, posso anotar também?",
    ), [o("Passou WhatsApp ou e-mail", "dados_perfil", "ok", "Dados confirmados: WhatsApp ou e-mail do contato"), o("Passou só o telefone fixo", "dados_perfil", "neutro", "Dados confirmados: só telefone fixo"), o("Prefere não passar", "dados_perfil", "neutro")], "Cadastre o contato no bloco de contatos do lead enquanto a pessoa fala. Repita o número ou o e-mail em voz alta para confirmar.", "pergunta"),
    fala("dados_perfil", "Quem decide a compra", T(
      "E quem decide as compras de fixadores aí, é você mesmo ou outra pessoa? E em que horário costuma ser mais fácil falar com essa pessoa?",
      "E quem decide as compras de fixadores, é você ou outra pessoa? Em que horário costuma ser mais fácil falar com ela?",
      "E quem decide a compra de fixador aí, é você mesmo ou outra pessoa? E que horas é mais fácil de encontrar ela?",
    ), [o("Decide sozinho", "dados_fim", "ok", "Dados confirmados: o contato decide a compra"), o("Outra pessoa decide", "dados_fim", "neutro", "Dados confirmados: decisor é outra pessoa (anotar nome e horário)"), o("Não sabe", "dados_fim", "neutro")], "Anote o nome do decisor e o melhor horário. É o que mais ajuda a próxima ligação.", "pergunta"),
    fala("dados_fim", "Fechar o cadastro", T(
      "Pronto, deixei tudo anotado, obrigado pela ajuda. Posso te chamar no WhatsApp quando tiver uma novidade ou uma condição boa pra {empresa}? Prometo não encher.",
      "Pronto, deixei tudo anotado, obrigado pela ajuda. Posso entrar em contato pelo WhatsApp quando houver uma novidade ou uma condição interessante para a {empresa}? Prometo ser breve.",
      "Pronto, deixei tudo anotado, valeu pela ajuda! Posso te chamar no WhatsApp quando tiver uma novidade ou uma condição boa pra {empresa}? Prometo não encher.",
    ), [{ ...o("Autorizou o contato", "@retorno", "ok", "Dados confirmados: contato autorizado pelo WhatsApp"), tasks: cad }, { ...o("Prefere não receber", "@encerrar", "neutro", "Dados confirmados: não quer contato por WhatsApp"), tasks: cad }], "Agradeça de verdade. Cadastro bem feito vale mais que uma ligação de venda forçada.", "fechamento"),
    fala("qualif_resumo", "Resumo da qualificação", T(
      "Então, pelo que você me contou, eu acho que a Fey pode ajudar a {empresa}. Faz sentido a gente aprofundar isso numa conversa rápida com o nosso especialista?",
      "Então, pelo que você me contou, acredito que a Fey pode ajudar a {empresa}. Faz sentido aprofundarmos isso em uma conversa rápida com o nosso especialista?",
      "Então, pelo que você me contou, acho que a Fey pode ajudar a {empresa} sim. Faz sentido a gente aprofundar num papo rápido com o nosso especialista?",
    ), [o("Quer a conversa com o especialista", "visita", "ok", "Qualificado: quer conversar com o especialista"), o("Prefere receber material", "digital", "neutro", "Qualificado: pediu material"), o("Quer retorno mais pra frente", "@retorno", "neutro", "Qualificado: retornar mais pra frente"), o("Não tem fit", "@encerrar", "objecao", "Qualificação: sem fit com a Fey"), o("Levantou uma objeção", "obj_menu", "objecao")], "Aqui você decide o fit com o que ouviu: compra fixadores, com que frequência, qual volume e quem decide. Anote a conclusão e marque a qualificação no fim do atendimento.", "proposta"),
  ];
}

function sdr(s: Seg): { nodes: ScriptNode[]; startId: string } {
  const alvo: Alvo = { quem: "quem cuida das compras", motivo: T(
    `Estou ligando porque atendemos ${PARES[s.tipo]} e queria ver se faz sentido apresentar nossa linha.`,
    `Estou ligando porque atendemos ${PARES[s.tipo]} e gostaria de avaliar se faz sentido apresentar nossa linha.`,
    `Tô ligando porque a gente atende ${PARES[s.tipo]} e queria ver se faz sentido te mostrar nossa linha.`,
  ) };
  const decisor = (note: string, to: string) => [o("Topou ouvir", to, "ok", note), o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Pediu e-mail ou WhatsApp", "obj_enviar", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Sem interesse", "obj_nao", "objecao")];
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", T(
      `{saudacao}, tudo bem? Aqui é {meunome}, da Fey, uma metalúrgica especializada em fixadores. Eu tô ligando pra área de compras. Com quem eu falo?`,
      `{saudacao}, tudo bem? Aqui é {meunome}, da Fey, metalúrgica especializada em fixadores. Estou ligando para a área de compras. Com quem eu falo, por favor?`,
      `{saudacao}, tudo bem? Aqui é {meunome}, da Fey, a metalúrgica especializada em fixadores. Tô ligando pra área de compras. Com quem eu falo?`,
    ), [o("Disse quem é", "conf_empresa", "ok"), o("Prefere não dizer o nome", "conf_empresa", "neutro"), o("Vai transferir a ligação", "transferido", "ok"), o("Perguntou o assunto", "assunto"), o("Pessoa errada ou não trabalha mais aqui", "quem", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Caixa postal, URA ou ninguém atendeu", "sem_resp"), o("Não é essa empresa", "@encerrar", "objecao", "Telefone não pertence à empresa")], "Abertura neutra de propósito: você não sabe quem atendeu (dono, balcão, recepção…), então só se identifica, diz a área e pergunta o nome. O pitch vem depois, quando souber a função da pessoa. Evite “como vai o dia?” e “estou atrapalhando?”. Escreva o nome no campo “Conversando atualmente com”: o roteiro passa a chamar a pessoa por ele.", "abertura"),
    ...entrada("conf_empresa", s.itens, alvo, s.tipo),
    ...confirma("pitch", s.itens, s.tipo),
    ...perfis({
      itens: s.itens, dor: s.dor, tipo: s.tipo, alvo, next: "conf_segmento", alcada: true, ok: decisor,
      falas: {
        socio: T(
      `Que bom falar direto com quem decide! Vou ser breve, porque seu tempo vale ouro. Somos uma metalúrgica especializada em fixadores, fabricamos ${s.itens} e atendemos ${PARES[s.tipo]}. Eu queria ver se faz sentido mostrar nossa linha pra {empresa}. Em trinta segundos eu te explico, e você decide se vale a pena continuar. Pode ser?`,
      `Que bom falar diretamente com quem decide. Serei breve, pois seu tempo é valioso. Somos uma metalúrgica especializada em fixadores, fabricamos ${s.itens} e atendemos ${PARES[s.tipo]}. Gostaria de avaliar se faz sentido apresentar nossa linha à {empresa}. Posso explicar em trinta segundos, e você decide se vale continuar?`,
      `Que bom falar direto com quem decide! Vou ser breve, que eu sei que o seu tempo é corrido. Somos uma metalúrgica especializada em fixadores, fabricamos ${s.itens} e atendemos ${PARES[s.tipo]}. Queria ver se faz sentido mostrar nossa linha pra {empresa}. Te explico em trinta segundos e você decide se vale seguir. Pode ser?`,
    ),
        compras: T(
      `Então eu tô falando com a pessoa certa! Somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}. Tô ligando pra apresentar a Fey como mais uma opção na sua lista de fornecedores, com fabricação própria e prazo firme. Posso te fazer umas perguntas rápidas sobre como vocês compram hoje, pra ver se faz sentido?`,
      `Então estou falando com a pessoa certa. Somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}. Estou ligando para apresentar a Fey como mais uma opção na lista de fornecedores, com fabricação própria e prazo firme. Posso fazer algumas perguntas rápidas sobre como a empresa compra hoje, para avaliarmos se faz sentido?`,
      `Então eu tô falando com a pessoa certa! Somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}. Tô ligando pra mostrar a Fey como mais uma opção na sua lista de fornecedores, com fabricação própria e prazo firme. Posso te fazer umas perguntinhas sobre como vocês compram hoje, pra ver se faz sentido?`,
    ),
        gestor: T(
      `Boa! Quem vive o dia a dia sabe o que pesa. Somos uma metalúrgica especializada em fixadores, fabricamos ${s.itens}, e eu tô ligando porque ajudamos ${PARES[s.tipo]} a evitar ${s.dor}. Me conta, quando falta ou quebra um fixador aí, o que acontece? E você participa da escolha do fornecedor?`,
      `Ótimo. Quem vive o dia a dia sabe o que pesa. Somos uma metalúrgica especializada em fixadores, fabricamos ${s.itens}, e estou ligando porque ajudamos ${PARES[s.tipo]} a evitar ${s.dor}. Você poderia me contar o que acontece quando falta ou quebra um fixador? E você participa da escolha do fornecedor?`,
      `Boa! Quem tá no dia a dia sabe o que pesa. Somos uma metalúrgica especializada em fixadores, fabricamos ${s.itens}, e tô ligando porque ajudamos ${PARES[s.tipo]} a evitar ${s.dor}. Me conta, quando falta ou quebra um fixador aí, o que rola? E você participa da escolha do fornecedor?`,
    ),
      },
      tips: {
        socio: "Dono e sócio valorizam tempo, margem e risco: fale curto, vá ao ponto e respeite os trinta segundos prometidos. Não aceite “manda por e-mail” de primeira: ofereça a conversa de vinte minutos. Tom firme e cordial, de igual para igual.",
        compras: "Comprador compara preço, prazo e confiabilidade o dia todo: seja específico (fabricação própria, prazo firme), não vago. Ele quer uma alternativa que o faça ficar bem com o chefe, então pergunte como compra hoje e o que já falhou. Descubra se ele decide ou só recomenda.",
        gestor: "Gerente e encarregado sentem a dor (máquina parada, cliente esperando), mas nem sempre decidem a compra. Comece pelo problema, não pelo produto, e descubra cedo se ele participa da decisão; se não, ele vira o seu aliado para chegar a quem decide.",
      },
    }),
    fala("pitch", "Despertar interesse", T(
      `Sabe o que a gente mais ouve de quem trabalha com ${s.itens}? É o problema de ${s.dor}. A Fey fabrica direto, com linha premium e prazo de entrega firme, e isso tira essa dor. Isso é familiar aí, ou vocês já têm isso redondo?`,
      `O que mais ouvimos de quem trabalha com ${s.itens} é o problema de ${s.dor}. A Fey fabrica diretamente, com linha premium e prazo de entrega firme, o que reduz essa dor. Isso é familiar para vocês, ou já está bem resolvido?`,
      `Olha, o que a gente mais escuta de quem trabalha com ${s.itens} é o perrengue de ${s.dor}. A gente fabrica direto, linha premium e prazo firme, e isso resolve essa dor. Isso rola aí também, ou vocês já têm isso redondo?`,
    ), [o("Reconheceu o problema ou contou como compra", "impl", "ok"), o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Disse que é caro", "obj_preco", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Não tem interesse", "obj_nao", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Fale do problema do cliente, não do seu produto. Depois da pergunta, escute: quem fala menos conduz mais a conversa. Uma pergunta por vez.", "proposta"),
    fala("impl", "Entender o impacto", T(
      "Poxa, imagino. E quando isso acontece, como fica na prática? O cliente espera, vocês saem correndo atrás em outro lugar, ou nem chega a ser problema?",
      "Entendo. E quando isso acontece, como fica na prática? O cliente aguarda, vocês procuram em outro lugar às pressas, ou nem chega a ser um problema?",
      "Poxa, imagino! E quando isso acontece, como fica na prática? O cliente espera, vocês saem correndo atrás em outro lugar, ou nem chega a incomodar?",
    ), [o("Cliente espera ou desiste da venda", "ganho", "ok", "Impacto: cliente espera ou venda perdida"), o("Compra em outro lugar, mais caro", "ganho", "ok", "Impacto: compra de emergência mais cara"), o("Para o serviço ou a produção", "ganho", "ok", "Impacto: serviço ou produção parados"), o("Quase não acontece", "contrato", "neutro", "Pouco impacto percebido")], "Implicação (SPIN): deixe ele mesmo dizer o quanto isso pesa. Rotule: “parece que isso incomoda”. Não proponha solução ainda.", "pergunta"),
    fala("ganho", "O valor de resolver", T(
      "Entendi. E se vocês tivessem um fornecedor que entrega no prazo e nunca deixa faltar o item de giro, isso mudaria alguma coisa pra vocês?",
      "Entendi. E se a empresa tivesse um fornecedor que entrega no prazo combinado e não deixa faltar o item de giro, isso mudaria algo para vocês?",
      "Entendi! E se vocês tivessem um fornecedor que entrega no prazo e nunca deixa faltar o item de giro, isso faria diferença pra vocês?",
    ), [o("Mudaria bastante", "contrato", "ok", "Vê valor em prazo firme e item de giro"), o("Ajudaria um pouco", "contrato", "neutro"), o("Já está resolvido", "contrato", "neutro", "Diz ter o assunto resolvido")], "Ganho (SPIN): é ele quem diz o valor, não você. Se ele descreve o benefício, o “sim” da reunião fica fácil.", "pergunta"),
    fala("contrato", "Pedir licença para perguntar", T(
      "Beleza! Então deixa eu entender melhor como funciona aí, só pra ver se a Fey serve mesmo pra vocês. Se não servir, eu mesmo te falo, combinado?",
      "Perfeito. Então gostaria de entender melhor como funciona aí, só para avaliar se a Fey atende de fato às necessidades de vocês. Se não atender, eu mesmo aviso, combinado?",
      "Beleza! Então deixa eu entender melhor como funciona aí, só pra ver se a Fey serve mesmo pra vocês. Se não servir, eu mesmo te falo, fechado?",
    ), [o("Pode seguir", "enr_conhece", "ok"), o("Está com pouco tempo", "obj_tempo", "objecao")], "Contrato inicial (Sandler): alinha a expectativa e tira a pressão. Dar permissão para dizer “não” aumenta o “sim”.", "ponte"),
    ...enriquece("conf_minimo", s.tipo, "sdr"),
    minimo("visita"),
    fala("visita", "Marcar a conversa", T(
      `{contato}, pelo que a gente conversou, acho que vale você ver isso de perto. É um papo de uns vinte minutos com nosso especialista, que já leva uma proposta pensada pra {empresa}, e você mesmo julga se faz sentido, sem compromisso. Você prefere presencial, com nosso representante, ou online, por ligação ou WhatsApp? E o que fica melhor, terça de manhã ou quinta à tarde?`,
      `{contato}, pelo que conversamos, acredito que vale a pena você ver isso de perto. Seria uma conversa de cerca de vinte minutos com nosso especialista, que já leva uma proposta pensada para a {empresa}, e você mesmo avalia se faz sentido, sem compromisso. Você prefere presencial, com nosso representante, ou online, por ligação ou WhatsApp? E o que seria melhor, terça de manhã ou quinta à tarde?`,
      `{contato}, pelo que a gente conversou, acho que vale você ver isso de pertinho. É um papo de uns vinte minutinhos com nosso especialista, que já leva uma proposta pensada pra {empresa}, e você mesmo vê se faz sentido, sem compromisso. Você prefere presencial, com nosso representante, ou online, por ligação ou WhatsApp? E o que fica melhor, terça de manhã ou quinta à tarde?`,
    ), [o("Visita presencial (representante)", "visita_confirma", "ok", "Agendado: visita presencial"), o("Conversa online (vendedor SDR, por ligação ou WhatsApp)", "visita_confirma", "ok", "Agendado: conversa online por ligação ou WhatsApp"), o("Prefere receber por WhatsApp ou por e-mail", "digital"), o("Sem disponibilidade agora", "obj_tempo", "objecao"), o("Recusou", "obj_nao", "objecao")], `Venda a reunião, não o produto (“você mesmo julga”). Dê sempre duas opções de dia e horário, nunca “quer marcar?”. Peça a agenda: “você está com a agenda aí?”. ${ONLINE}`, "proposta"),
    fala("visita_confirma", "Confirmar o combinado", T(
      `Então ficamos combinados para [dia e horário combinados], com {contato}, pra falar da reposição da {empresa}. Vou te mandar o convite agora, enquanto a gente fala, e um WhatsApp pra lembrar. Qual o melhor número e e-mail pra eu enviar?`,
      `Então ficamos combinados para [dia e horário combinados], com {contato}, para tratar da reposição da {empresa}. Vou enviar o convite agora, durante a ligação, e uma mensagem de WhatsApp como lembrete. Qual é o melhor número e e-mail para o envio?`,
      `Então tá fechado, [dia e horário combinados], com {contato}, pra gente falar da reposição da {empresa}. Vou te mandar o convite agora mesmo, enquanto a gente fala, e um WhatsApp só pra lembrar. Qual o melhor número e e-mail?`,
    ), [o("Confirmou os dados", "@visita", "ok", "Convite enviado durante a ligação e lembrete combinado"), o("Quer trocar o horário", "visita", "neutro")], "Reunião agendada só vale se o lead aparece: recapitule dia e horário, diga a pauta em uma linha e envie o convite ainda na ligação (Rework, Pipedrive). Anote o dia e o horário na observação.", "fechamento"),
    fala("digital", "Seguir pelo digital", T(
      "Perfeito! Te mando agora um material curtinho, só com o que importa pro seu perfil. Posso te ligar depois de amanhã, uns cinco minutinhos, pra saber o que você achou? Se fizer sentido, a gente já marca a conversa.",
      "Perfeito. Vou enviar agora um material resumido, apenas com o que importa ao seu perfil. Posso ligar depois de amanhã, por uns cinco minutos, para saber sua opinião? Se fizer sentido, já marcamos a conversa.",
      "Perfeito! Te mando agora um material curtinho, só com o que interessa pro seu perfil. Depois de amanhã eu te ligo uns cinco minutinhos, pra saber o que achou? Se fizer sentido, a gente já marca o papo.",
    ), [o("Concordou", "@retorno", "ok", "Enviar material e retornar em 2 dias"), o("Mesmo assim recusou", "obj_nao", "objecao")], "Combine o dia do retorno antes de desligar. Mensagem curta para o WhatsApp: “Oi! Aqui é [seu nome], da Fey, a metalúrgica de fixadores. Conforme conversamos, segue o material. Qualquer dúvida, é só chamar.”", "apoio"),
    ...objecoes("visita", "visita"),
    ...sdrObjetivos(),
  ];
  const papeis = ["p_socio", "p_compras", "p_gestor", "p_balcao", "p_operacao", "p_admin"];
  let routed = reroute(nodes, "conf_negocio", "qualificar", "contrato");
  routed = reroute(routed, "conf_minimo", "qualificar", "qualif_resumo", (o) => o.to === "visita");
  routed = reroute(routed, "papel", "dados", "dados_abre", (o) => papeis.includes(o.to ?? ""));
  return { nodes: routed, startId: "abertura" };
}

function vendas(s: Seg): { nodes: ScriptNode[]; startId: string } {
  const alvo: Alvo = { quem: "quem cuida das compras", tema: T("sobre uma cotação de reposição", "sobre uma cotação de reposição", "sobre uma cotação de reposição"), para: T("pra montar uma cotação pra vocês", "para montar uma cotação para a empresa", "pra montar uma cotação pra vocês"), motivo: T("Estou ligando pra ajudar na reposição e montar uma cotação certa.", "Estou ligando para ajudar na reposição e montar uma cotação adequada.", "Tô ligando pra te ajudar na reposição e montar uma cotação certinha.") };
  const decisor = (note: string, to: string) => [o("Topou conversar", to, "ok", note), o("Pediu a tabela de preços", "tabela"), o("Já tem fornecedor fechado", "obj_fornecedor", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Sem interesse", "obj_nao", "objecao")];
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", T(
      `{saudacao}, tudo bem? Aqui é {meunome}, da Fey, uma metalúrgica especializada em fixadores. Eu tô ligando pra falar da reposição de ${s.itens} com quem cuida das compras. Com quem eu falo?`,
      `{saudacao}, tudo bem? Aqui é {meunome}, da Fey, metalúrgica especializada em fixadores. Estou ligando para falar da reposição de ${s.itens} com quem cuida das compras. Com quem eu falo, por favor?`,
      `{saudacao}, tudo bem? Aqui é {meunome}, da Fey, a metalúrgica especializada em fixadores. Tô ligando pra falar da reposição de ${s.itens} com quem cuida das compras. Com quem eu falo?`,
    ), [o("Disse quem é", "papel", "ok"), o("Prefere não dizer o nome", "papel", "neutro"), o("Vai transferir a ligação", "transferido", "ok"), o("Perguntou o assunto", "assunto"), o("Pessoa errada ou não trabalha mais aqui", "quem", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Caixa postal, URA ou ninguém atendeu", "sem_resp")], "Aqui o objetivo é cotar e vender, mas você ainda não sabe quem atendeu: abra neutro, pegue o nome e a função, e só então consulte. Seja consultivo: você quer ajudar a resolver a reposição, não empurrar produto. Escreva o nome no campo “Conversando atualmente com”: o roteiro passa a chamar a pessoa por ele.", "abertura"),
    ...entrada("papel", s.itens, alvo, s.tipo),
    ...perfis({
      itens: s.itens, dor: s.dor, tipo: s.tipo, alvo, next: "desc_itens", alcada: false, ok: decisor,
      falas: {
        socio: T(
      `Que bom falar com quem decide! Somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}. Eu tô ligando pra ajudar na reposição da {empresa}. Com umas perguntas rápidas, eu já monto uma cotação certa. Pode ser agora?`,
      `Que bom falar com quem decide. Somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}. Estou ligando para ajudar na reposição da {empresa}. Com algumas perguntas rápidas, já monto uma cotação adequada. Pode ser agora?`,
      `Que bom falar com quem decide! Somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}. Tô ligando pra ajudar na reposição da {empresa}. Com umas perguntinhas, eu já monto uma cotação certinha. Pode ser agora?`,
    ),
        compras: T(
      `Perfeito, então é com você mesmo! Somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}. Eu quero te ajudar com a reposição. Com duas perguntas eu já monto uma cotação certa, com prazo firme. Pode ser agora?`,
      `Perfeito, então é com você. Somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}. Gostaria de ajudar na reposição. Com algumas perguntas, já monto uma cotação adequada, com prazo firme. Pode ser agora?`,
      `Perfeito, então é com você mesmo! Somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}. Quero te ajudar com a reposição. Com umas perguntinhas, eu já monto uma cotação certinha, com prazo firme. Pode ser agora?`,
    ),
        gestor: T(
      `Boa! Quem vive o dia a dia sabe o que falta. Somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}. Eu queria ajudar com a reposição. O que mais acaba ou atrasa aí? E você participa da compra?`,
      `Ótimo. Quem vive o dia a dia sabe o que falta. Somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}. Gostaria de ajudar na reposição. O que mais acaba ou atrasa? E você participa da compra?`,
      `Boa! Quem tá no dia a dia sabe o que falta. Somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}. Eu queria ajudar com a reposição. O que mais acaba ou atrasa aí? E você participa da compra?`,
    ),
      },
      tips: {
        socio: "Dono quer resolver rápido e ter número: ofereça cotação ainda hoje e fale de prazo e valor. Seja direto.",
        compras: "Comprador quer cotação comparável: peça itens e quantidades e prometa prazo de resposta. Compare em itens, não em adjetivos.",
        gestor: "Gerente sabe o que falta; confirme se ele compra ou indica quem compra. Se participa, colete itens e quantidades.",
      },
    }),
    fala("desc_itens", "Descobrir a necessidade", T(
      `Show! Pra eu montar uma cotação certinha pra {empresa}, quais itens vocês mais compram, e mais ou menos quanto por mês? Se você tiver a lista dos de maior giro, já ajuda bastante.`,
      `Ótimo. Para montar uma cotação adequada para a {empresa}, quais itens a empresa mais compra e, aproximadamente, quanto por mês? Se tiver a lista dos de maior giro, já ajuda bastante.`,
      `Show! Pra eu montar uma cotação certinha pra {empresa}, quais itens vocês mais compram, e mais ou menos quanto por mês? Se tiver a lista dos de maior giro à mão, já ajuda demais.`,
    ), [o("Passou itens e quantidades", "enr_aplicacao", "ok", "Passou itens e quantidades para a cotação"), o("Pediu a tabela de preços", "tabela"), o("Já tem fornecedor fechado", "obj_fornecedor", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Anote itens e quantidades: é isso que vira a cotação. Reaja ao que ele disser antes da próxima pergunta.", "pergunta"),
    fala("tabela", "Só a tabela", T(
      "Posso mandar a tabela, sim! Só que, sem saber o que vocês compram, ela vira um catálogo enorme e pouco útil. Se você me disser os três itens de maior giro, eu te devolvo o valor com desconto ainda hoje. Pode ser?",
      "Posso enviar a tabela, sim. Porém, sem saber o que a empresa compra, ela se torna um catálogo extenso e pouco útil. Se me informar os três itens de maior giro, devolvo o valor com desconto ainda hoje. Pode ser?",
      "Mando a tabela sim! Só que, sem saber o que vocês compram, ela vira um catálogo enorme que não ajuda. Se você me disser os três itens de maior giro, eu te devolvo o valor com desconto ainda hoje. Pode ser?",
    ), [o("Passou os itens", "enr_aplicacao", "ok"), o("Quer só a tabela mesmo", "@cotacao", "neutro", "Pediu somente a tabela")], undefined, "proposta"),
    ...enriquece("conf_minimo", s.tipo, "vendas"),
    minimo("proposta"),
    fala("proposta", "Apresentar a proposta", T(
      `Com o que você me passou, eu monto a cotação ainda hoje. É linha premium, com prazo de entrega firme, e eu dou 25% de desconto no pedido. O valor mínimo continua o mesmo, só que você leva mais produto por ele. Prefere receber por WhatsApp ou por e-mail?`,
      `Com as informações que você passou, monto a cotação ainda hoje. É linha premium, com prazo de entrega firme, e aplicamos 25% de desconto no pedido. O valor mínimo se mantém, e a empresa leva mais produto. Prefere receber por WhatsApp ou por e-mail?`,
      `Com o que você me passou, eu monto a cotação ainda hoje. É linha premium, prazo firme, e eu dou 25% de desconto no pedido. O mínimo continua o mesmo, só que você leva mais produto por ele. Prefere receber por WhatsApp ou por e-mail?`,
    ), [o("Quer receber a cotação", "@cotacao", "ok", "Cotação enviada por e-mail ou WhatsApp"), o("Quer fechar já", "fechar", "ok"), o("Disse que é caro", "obj_preco", "objecao"), o("Quer pensar", "obj_pensar", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Ofereça 25% primeiro, e só depois, se precisar, 26%. Depois de pedir o próximo passo, fique em silêncio e deixe ele responder.", "proposta"),
    fala("fechar", "Fechar o pedido", T(
      `Perfeito! Então deixa eu confirmar com você os itens, as quantidades, a forma de pagamento e o endereço de entrega. Se estiver tudo certo, eu já abro o pedido agora. Pode ser?`,
      `Perfeito. Vou confirmar com você os itens, as quantidades, a forma de pagamento e o endereço de entrega. Estando tudo correto, abro o pedido agora. Pode ser?`,
      `Perfeito! Deixa eu confirmar com você os itens, as quantidades, a forma de pagamento e o endereço de entrega. Se tiver tudo certo, já abro o pedido agora, beleza?`,
    ), [o("Confirmou tudo", "venda_extra", "ok"), o("Faltou ajustar algo", "proposta", "neutro"), o("Quer pensar mais um pouco", "obj_pensar", "objecao")], "Repita itens, valores e prazo em voz alta antes de abrir o pedido. Resolvida a dúvida, peça o fechamento de novo (Blount).", "fechamento"),
    fala("venda_extra", "Incluir mais itens", T(
      `Já que o pedido tá aberto, tem mais algum item que costuma faltar aí? Dá pra incluir agora e já entra no desconto.`,
      `Aproveitando que o pedido está aberto, há mais algum item que costuma faltar? É possível incluir agora, já com o desconto.`,
      `Já que o pedido tá aberto, tem mais algum item que sempre falta aí? Dá pra incluir agora e já entra no desconto!`,
    ), [o("Incluiu mais itens", "@venda", "ok", "Pedido fechado com itens extras"), o("Só isso mesmo", "@venda", "ok", "Pedido confirmado na ligação")], "Quem acabou de decidir está aberto a complementar. Sugira um item ligado ao que ele comprou, sem insistir.", "fechamento"),
    fala("obj_pensar", "Quer pensar", T(
      `Claro, decisão importante a gente pensa mesmo. Pra eu te ajudar, o que você ainda precisa ver, o prazo, o pagamento ou a garantia? Se quiser, a gente conversa de novo daqui a dois dias.`,
      `Claro, uma decisão importante merece reflexão. Para eu ajudar, o que ainda precisa avaliar, o prazo, a condição de pagamento ou a garantia? Se preferir, conversamos novamente em dois dias.`,
      `Claro, decisão importante a gente pensa mesmo! Pra eu te ajudar nessa, o que você ainda quer ver, o prazo, o pagamento ou a garantia? Se quiser, a gente se fala de novo daqui a dois dias.`,
    ), [o("Combinou o retorno", "@retorno", "ok", "Combinado retorno em 2 dias"), o("Disse o que falta decidir", "obj_menu", "neutro"), o("Não quer retorno", "@encerrar", "objecao")], "“Vou pensar” quase sempre esconde uma dúvida: descubra qual é, com calma, sem pressionar.", "objecao"),
    ...objecoes("proposta", "venda"),
    fala("proposta_fecha", "Propor o fechamento", T(
      "Com o que você me passou, eu já consigo te passar o valor com 25% de desconto, e se fizer sentido eu abro o pedido agora mesmo, sem você precisar esperar a cotação. É linha premium, com prazo de entrega firme. Posso já abrir?",
      "Com as informações que você passou, já consigo informar o valor com 25% de desconto e, se fizer sentido, abrir o pedido agora, sem aguardar a cotação. É linha premium, com prazo de entrega firme. Posso abrir o pedido?",
      "Com o que você me passou, já consigo te falar o valor com 25% de desconto, e se fizer sentido eu abro o pedido agora mesmo, sem você esperar a cotação. É linha premium, com prazo firme. Posso já abrir?",
    ), [o("Pode abrir o pedido", "fechar", "ok"), o("Prefere receber a cotação", "@cotacao", "neutro", "Preferiu receber a cotação antes de fechar"), o("Disse que é caro", "obj_preco", "objecao"), o("Quer pensar", "obj_pensar", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Ofereça 25% primeiro e só depois, se precisar, 26%. Se ele hesitar, volte para a cotação sem pressionar.", "fechamento"),
  ];
  return { nodes: reroute(nodes, "conf_minimo", "fechar", "proposta_fecha", (o) => o.to === "proposta"), startId: "abertura" };
}

function retorno(s: Seg): { nodes: ScriptNode[]; startId: string } {
  const alvo: Alvo = { quem: "quem recebeu a nossa cotação", para: T("pra conversar sobre ela", "para conversar sobre ela", "pra gente bater um papo sobre ela"), tema: T("sobre a cotação que enviei", "sobre a cotação enviada", "sobre a cotação que mandei"), gk: T("Estou ligando porque a gente enviou uma cotação pra empresa.", "Estou ligando porque enviamos uma cotação para a empresa.", "Tô ligando porque a gente mandou uma cotação pra empresa."), fecha: T("É coisa rápida. Quem cuida disso consegue falar agora?", "É um assunto breve. Quem cuida disso poderia me atender agora?", "É rapidinho. Dá pra chamar quem cuida disso?"), motivo: T("Tô ligando por causa de uma cotação que enviei pra empresa.", "Estou ligando a respeito de uma cotação enviada à empresa.", "Tô ligando por causa de uma cotação que mandei pra empresa.") };
  const decisor = (note: string, _to: string) => [o("Já viu e está analisando", "duvidas", "ok", note), o("Ainda não viu", "reenviar"), o("Quer fechar", "fechar", "ok"), o("Achou caro", "obj_preco", "objecao"), o("Fechou com outro", "motivo", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")];
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", T(
      "{saudacao}, tudo bem? Aqui é {meunome}, da Fey. Tô ligando por causa da cotação que enviei pra {empresa}. Com quem eu falo?",
      "{saudacao}, tudo bem? Aqui é {meunome}, da Fey. Estou ligando a respeito da cotação enviada à {empresa}. Com quem eu falo, por favor?",
      "{saudacao}, tudo bem? Aqui é {meunome}, da Fey. Tô ligando por causa da cotação que mandei pra {empresa}. Com quem eu falo?",
    ), [o("Disse quem é", "papel", "ok"), o("Prefere não dizer o nome", "papel", "neutro"), o("Vai transferir a ligação", "transferido", "ok"), o("Perguntou o assunto", "assunto"), o("Pessoa errada ou não trabalha mais aqui", "quem", "objecao"), o("Caixa postal, URA ou ninguém atendeu", "sem_resp")], "Ligue em até dois dias úteis depois do envio, no horário combinado. Quem cumpre o que prometeu ganha confiança. Mesmo esperando o contato certo, abra perguntando com quem fala: pode ser outra pessoa. Escreva o nome no campo “Conversando atualmente com”: o roteiro passa a chamar a pessoa por ele.", "abertura"),
    ...entrada("papel", s.itens, alvo, s.tipo),
    ...perfis({
      itens: s.itens, dor: s.dor, tipo: s.tipo, alvo, next: "duvidas", alcada: false, ok: decisor,
      falas: {
        socio: T(
      `Que bom falar com você! É sobre a cotação que a Fey enviou pra {empresa}. Você já conseguiu dar uma olhada?`,
      `Que bom falar com você. É sobre a cotação que a Fey enviou à {empresa}. Você já teve oportunidade de analisar?`,
      `Que bom falar com você! É sobre a cotação que a Fey mandou pra {empresa}. Já deu pra dar uma olhada?`,
    ),
        compras: T(
      `Perfeito, então é com você! É sobre a cotação que a Fey enviou pra {empresa}. Você já conseguiu dar uma olhada?`,
      `Perfeito, então é com você. É sobre a cotação que a Fey enviou à {empresa}. Você já teve oportunidade de analisar?`,
      `Perfeito, então é com você mesmo! É sobre a cotação que a Fey mandou pra {empresa}. Já deu pra dar uma olhada?`,
    ),
        gestor: T("Boa! É sobre a cotação que a Fey enviou pra {empresa}. Você participa dessa decisão? Já deu pra olhar?", "Ótimo. É sobre a cotação que a Fey enviou à {empresa}. Você participa dessa decisão? Já teve oportunidade de analisar?", "Boa! É sobre a cotação que a Fey mandou pra {empresa}. Você entra nessa decisão? Já deu pra olhar?"),
      },
      tips: {
        socio: "Quem decide quer ir ao ponto: pergunte se viu e qual a decisão. Se disser que está tudo certo, vá direto ao fechamento.",
        compras: "Comprador compara cotações: pergunte o que ficou de fora (itens, prazo, condição) e ofereça ajustar na hora.",
        gestor: "Descubra se ele participa da decisão; se não, peça para falar com quem recebeu a cotação.",
      },
    }),
    fala("duvidas", "Tirar dúvidas", T(
      `Que bom! E o que ficou mais em aberto pra você, os itens, o prazo ou a forma de pagamento? Se quiser, eu ajusto a cotação agora, enquanto a gente conversa.`,
      `Que bom. E o que ficou mais em aberto, os itens, o prazo ou a forma de pagamento? Se preferir, ajusto a cotação agora, durante a conversa.`,
      `Que bom! E o que ficou mais em aberto pra você, os itens, o prazo ou o pagamento? Se quiser, eu ajusto a cotação agora mesmo, enquanto a gente conversa.`,
    ), [o("Sem dúvidas, vai fechar", "fechar", "ok"), o("Pediu um ajuste", "@cotacao", "neutro", "Pediu ajuste na cotação"), o("Dúvida sobre o produto", "duvida_tec", "neutro"), o("Ainda vai decidir", "prazo", "neutro"), o("Levantou uma objeção", "obj_menu", "objecao")], "Pergunta aberta, e depois silêncio. Se ele disser “está tudo certo”, vá direto ao fechamento.", "pergunta"),
    fala("duvida_tec", "Dúvida sobre o produto", T(
      `Boa pergunta! Em qual aplicação você vai usar? Assim eu confirmo direitinho se o ${s.um} serve, ou peço pro nosso time técnico te responder ainda hoje.`,
      `Boa pergunta. Em qual aplicação será usado? Assim confirmo se o ${s.um} atende, ou solicito ao nosso time técnico que responda ainda hoje.`,
      `Boa pergunta! Em qual aplicação você vai usar? Aí eu confirmo direitinho se o ${s.um} serve, ou peço pro nosso time técnico te responder ainda hoje.`,
    ), [o("Explicou a aplicação", "@retorno", "ok", "Dúvida técnica: confirmar com o time técnico e retornar"), o("Resolveu na hora", "fechar", "ok")], "Anote a aplicação com o máximo de detalhe. Nunca invente uma resposta técnica: confirme antes e retorne no prazo prometido.", "pergunta"),
    fala("reenviar", "Reenviar a cotação", T(
      "Sem problema! Reenvio agora, por e-mail e por WhatsApp. Posso te ligar daqui a dois dias, uns cinco minutinhos, pra gente conversar sobre ela?",
      "Sem problema. Reenvio agora, por e-mail e por WhatsApp. Posso ligar daqui a dois dias, por uns cinco minutos, para conversarmos sobre ela?",
      "Sem problema! Reenvio agora, por e-mail e por WhatsApp. Daqui a dois dias eu te ligo uns cinco minutinhos, pra gente bater um papo sobre ela, pode ser?",
    ), [o("Combinado", "@retorno", "ok", "Cotação reenviada, retornar em 2 dias")], undefined, "apoio"),
    fala("fechar", "Fechar o pedido", T(
      `Que bom! Deixa eu confirmar com você os itens, as quantidades, a forma de pagamento e o endereço de entrega. Se estiver tudo certo, eu já abro o pedido agora.`,
      `Que bom. Vou confirmar com você os itens, as quantidades, a forma de pagamento e o endereço de entrega. Estando tudo correto, abro o pedido agora.`,
      `Que bom! Deixa eu conferir com você os itens, as quantidades, a forma de pagamento e o endereço de entrega. Se tiver tudo certo, já abro o pedido agora mesmo.`,
    ), [o("Confirmou tudo", "@venda", "ok", "Pedido confirmado na ligação"), o("Faltou ajustar algo", "duvidas", "neutro")], "Repita itens, valores e prazo em voz alta antes de abrir o pedido.", "fechamento"),
    fala("prazo", "Combinar o retorno", T(
      `Sem pressa! Quando você acha que consegue me dar uma resposta? Eu anoto e te ligo bem nesse dia, e já te mando um resumo por escrito pra você ter em mãos.`,
      `Sem pressa. Quando você acha que consegue me dar uma resposta? Anoto e ligo exatamente nesse dia, e envio antes um resumo por escrito.`,
      `Sem pressa! Quando você acha que dá pra me responder? Eu anoto e te ligo bem nesse dia, e já te mando um resumo por escrito, pra você ter em mãos.`,
    ), [o("Deu uma data", "@retorno", "ok", "Retornar na data combinada"), o("Já tentei várias vezes sem resposta", "ret_ultima", "neutro")], undefined, "apoio"),
    fala("ret_ultima", "Última tentativa", T(
      "Pelo que eu vejo, talvez o momento não seja esse, e tudo bem. Vou deixar a cotação com você e não insisto por enquanto. Se mudar alguma coisa, é só me chamar nesse número. Posso te procurar de novo daqui a um mês?",
      "Pelo que percebo, talvez este não seja o momento, e está tudo bem. Deixo a cotação com você, sem insistir por ora. Se algo mudar, basta me chamar neste número. Posso entrar em contato novamente daqui a um mês?",
      "Pelo jeito o momento não é esse, e tá tudo bem! Deixo a cotação com você e não insisto por enquanto. Se mudar alguma coisa, é só me chamar nesse número. Posso te procurar de novo daqui a um mês?",
    ), [o("Pode procurar em um mês", "@retorno", "neutro", "Sem resposta à cotação: procurar de novo em 1 mês"), o("Prefere encerrar", "@encerrar", "objecao", "Sem interesse na cotação")], "Mensagem de despedida (break-up): reconhece o silêncio, deixa a porta aberta e tira a pressão. É comum o lead responder justamente aqui. Faça só depois de várias tentativas.", "apoio"),
    fala("motivo", "Entender o motivo", T(
      `Valeu por me avisar, é bom saber. Pra eu melhorar, o que pesou mais, o preço, o prazo ou outra coisa? E posso te procurar de novo daqui a um mês?`,
      `Agradeço por me avisar. Para eu melhorar, o que pesou mais, o preço, o prazo ou outro fator? E posso entrar em contato novamente daqui a um mês?`,
      `Valeu por me avisar, é bom saber! Pra eu melhorar, o que pesou mais, o preço, o prazo ou outra coisa? E posso te procurar de novo daqui a um mês?`,
    ), [o("Contou o motivo e permitiu novo contato", "@retorno", "neutro", "Fechou com outro: procurar de novo em 1 mês"), o("Encerrou a conversa", "@encerrar", "objecao", "Fechou com outro fornecedor")], "Registre o motivo no sistema: ele ajuda o time inteiro. Saia bem, sem insistir.", "pergunta"),
    ...objecoes("duvidas", "venda").map((n) => n.id !== "obj_enviar" ? n : fala(n.id, n.title, T(
      "Mando sim! Só me confirma o melhor e-mail ou WhatsApp, que eu já deixo a cotação ajustada pro que você precisa. Posso te ligar depois de amanhã, só pra saber o que achou?",
      "Envio, sim. Poderia confirmar o melhor e-mail ou WhatsApp? Já deixo a cotação ajustada ao que você precisa. Posso ligar depois de amanhã para saber sua opinião?",
      "Mando sim! Só me confirma o melhor e-mail ou WhatsApp, que eu já deixo a cotação ajustada pro que você precisa. Posso te ligar depois de amanhã, só pra saber o que achou?",
    ), n.options.map((x) => ({ ...x, label: x.label === "Passou o contato e os itens" ? "Passou o contato" : x.label })), n.tip, n.mood)),
  ];
  return { nodes, startId: "abertura" };
}

/** 3. Fidelizadores: quem já compra (Televendas). */
function fidelizar(s: Seg): { nodes: ScriptNode[]; startId: string } {
  const alvo: Alvo = { quem: "quem cuida das compras com a Fey", para: T("pra saber como têm sido os pedidos", "para saber como têm sido os pedidos", "pra saber como têm sido os pedidos"), tema: T("só pra saber como estão as coisas com a Fey", "apenas para saber como estão as coisas com a Fey", "só pra saber como andam as coisas com a Fey"), gk: T("A empresa já compra com a gente, e eu tô ligando só pra saber como estão as coisas.", "A empresa já é cliente, e estou ligando apenas para saber como estão as coisas.", "A empresa já compra com a gente, e eu tô ligando só pra saber como andam as coisas."), fecha: T("É coisa rápida. Quem cuida disso consegue falar agora?", "É um assunto breve. Quem cuida disso poderia me atender agora?", "É rapidinho. Dá pra chamar quem cuida disso?"), motivo: T("Tô ligando só pra saber como estão as coisas com a gente.", "Estou ligando apenas para saber como está o relacionamento com a Fey.", "Tô ligando só pra saber como andam as coisas com a gente.") };
  const decisor = (note: string, to: string) => [o("Atendeu e quer conversar", to, "ok", note), o("Está sem tempo agora", "obj_tempo", "objecao")];
  const bom = T("Que bom falar com você! É só pra saber como estão as coisas com a Fey e ver se posso ajudar em alguma coisa.", "Que bom falar com você. É apenas para saber como estão as coisas com a Fey e verificar se posso ajudar em algo.", "Que bom falar com você! É só pra saber como andam as coisas com a Fey e ver se posso ajudar em algo.");
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", T(
      `{saudacao}, tudo bem? Aqui é {meunome}, da Fey. Não é venda, viu? Eu só queria saber como andam as coisas com a gente. Com quem eu falo?`,
      `{saudacao}, tudo bem? Aqui é {meunome}, da Fey. Não estou ligando para vender. Gostaria apenas de saber como estão as coisas conosco. Com quem eu falo, por favor?`,
      `{saudacao}, tudo bem? Aqui é {meunome}, da Fey. Não é venda, viu? Só queria saber como andam as coisas com a gente. Com quem eu falo?`,
    ), [o("Disse quem é", "papel", "ok"), o("Prefere não dizer o nome", "papel", "neutro"), o("Vai transferir a ligação", "transferido", "ok"), o("Perguntou o assunto", "assunto"), o("Pessoa errada ou não trabalha mais aqui", "quem", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Caixa postal, URA ou ninguém atendeu", "sem_resp")], "Cliente que compra precisa sentir que é lembrado, e não só cobrado. Abra com interesse sincero e pegue o nome: quem comprou pode já ter saído da empresa. Escreva o nome no campo “Conversando atualmente com”: o roteiro passa a chamar a pessoa por ele.", "fideliza"),
    ...entrada("papel", s.itens, alvo, s.tipo),
    ...perfis({
      itens: s.itens, dor: s.dor, tipo: s.tipo, alvo, next: "fid_continua", alcada: false, ok: decisor,
      falas: {
        socio: bom,
        compras: bom,
        gestor: T("Que bom falar com você! É só pra saber como estão as coisas com a Fey, principalmente a entrega e o produto. Você acompanha isso aí?", "Que bom falar com você. É apenas para saber como estão as coisas com a Fey, principalmente a entrega e o produto. Você acompanha isso?", "Que bom falar com você! É só pra saber como andam as coisas com a Fey, principalmente a entrega e o produto. Você acompanha isso aí?"),
      },
      tips: {
        socio: "Cliente antigo gosta de ser lembrado pelo dono da fábrica: tom caloroso, sem pressa de vender.",
        compras: "Comprador do dia a dia é quem mais fala das entregas: escute o que funciona e o que não funciona.",
        gestor: "Quem usa o produto sabe a verdade sobre a qualidade: pergunte como o item se comporta na prática.",
      },
    }),
    fala("fid_continua", "Continua comprando?", T(
      `Então me conta, vocês continuam comprando com a Fey? Como tem sido com os produtos e com a entrega?`,
      `Então poderia me contar, vocês continuam comprando com a Fey? Como tem sido a experiência com os produtos e com a entrega?`,
      `Então me conta, vocês seguem comprando com a Fey? Como tem sido com os produtos e com a entrega?`,
    ), [o("Sim, segue comprando normalmente", "fid_nps", "ok", "Continua comprando com a Fey"), o("Está comprando menos que antes", "fid_motivo", "neutro", "Reduziu as compras"), o("Parou de comprar", "fid_motivo", "objecao", "Parou de comprar"), o("Está comprando de outro fornecedor", "obj_concorrente", "objecao", "Comprando de outro fornecedor")], "Escute com atenção. Queixa bem recebida vira fidelidade; rotule o que ouvir: “parece que o prazo te incomodou”.", "fideliza"),
    fala("fid_nps", "Nota de 0 a 10", T(
      `Que bom! Deixa eu te fazer uma pergunta rápida. De 0 a 10, o quanto você indicaria a Fey pra outra empresa? E o que faria essa nota subir?`,
      `Que bom. Posso fazer uma pergunta rápida? De 0 a 10, o quanto você indicaria a Fey a outra empresa? E o que faria essa nota subir?`,
      `Que bom! Deixa eu te perguntar uma coisa. De 0 a 10, o quanto você indicaria a Fey pra outra empresa? E o que faria essa nota subir?`,
    ), [o("Nota 9 ou 10", "fid_indica", "ok", "Satisfeito (nota 9 ou 10): pedir indicação"), o("Nota 7 ou 8", "fid_duvidas", "neutro", "Nota 7 ou 8: descobrir o que falta"), o("Nota 6 ou menos", "fid_motivo", "objecao", "Nota 6 ou menos: entender o motivo")], "Pergunta de recomendação (NPS): 9 e 10 são promotores e é a hora de pedir indicação; 7 e 8 mostram o que melhorar; até 6 pede atenção e escuta. Anote a nota e o comentário.", "fideliza"),
    fala("fid_motivo", "Entender a mudança", T(
      `Valeu por me contar. O que mudou desde a última compra? Foi preço, prazo, algum problema com o produto, ou o volume mesmo que caiu?`,
      `Agradeço por contar. O que mudou desde a última compra? Foi o preço, o prazo, algum problema com o produto, ou o volume diminuiu?`,
      `Valeu por me contar, de verdade! O que mudou desde a última compra? Foi preço, prazo, algum problema com o produto, ou o volume mesmo que caiu?`,
    ), [o("Foi preço", "obj_preco", "objecao", "Motivo da queda: preço"), o("Foi prazo ou entrega", "obj_prazo", "objecao", "Motivo da queda: prazo de entrega"), o("Teve problema com produto", "fid_tecnica", "objecao", "Motivo da queda: problema com produto"), o("O volume caiu mesmo", "fid_reposicao", "neutro", "Motivo da queda: menos necessidade")], undefined, "fideliza"),
    fala("fid_duvidas", "Dúvidas pendentes", T(
      "Que bom ouvir isso! E tem alguma coisa pendente com a gente, sobre produto, pedido ou entrega? Se tiver, eu resolvo agora.",
      "Que bom ouvir isso. Há alguma pendência conosco, sobre produto, pedido ou entrega? Se houver, resolvo agora.",
      "Que bom ouvir isso! E tem alguma coisa pendente com a gente, sobre produto, pedido ou entrega? Se tiver, eu resolvo agora mesmo.",
    ), [o("Sem dúvidas", "fid_reposicao", "ok"), o("Dúvida sobre produto", "fid_tecnica", "neutro", "Dúvida sobre produto"), o("Dúvida sobre pedido ou entrega", "fid_pedido", "neutro", "Dúvida sobre pedido ou entrega")], undefined, "fideliza"),
    fala("fid_tecnica", "Dúvida ou problema técnico", T(
      "Me explica em qual aplicação foi e o que aconteceu? Assim eu levo pro nosso time técnico e te retorno ainda hoje.",
      "Poderia explicar em qual aplicação foi e o que aconteceu? Assim encaminho ao nosso time técnico e retorno ainda hoje.",
      "Me explica em qual aplicação foi e o que rolou? Aí eu levo pro nosso time técnico e te retorno ainda hoje, sem enrolação.",
    ), [o("Explicou o caso", "@retorno", "ok", "Caso técnico: acionar o time técnico e retornar hoje"), o("Resolveu na hora", "fid_reposicao", "ok")], "Anote tudo e acione o time técnico. Nunca invente uma resposta técnica: confirme e retorne no prazo prometido.", "fideliza"),
    fala("fid_pedido", "Pedido ou entrega", T(
      "Me passa o número do pedido ou a data, que eu confiro agora e já te falo o que aconteceu.",
      "Poderia me informar o número do pedido ou a data? Verifico agora e já informo o que ocorreu.",
      "Me passa o número do pedido ou a data, que eu confiro agora e já te conto o que rolou.",
    ), [o("Passou os dados", "@retorno", "ok", "Verificar pedido ou entrega e retornar"), o("Resolveu na hora", "fid_reposicao", "ok")], undefined, "fideliza"),
    fala("fid_reposicao", "Oferecer reposição", T(
      `Pra vocês não serem pegos de surpresa, quer que eu já monte a reposição dos itens que mais giram? Eu dou 25% de desconto no pedido, e o mínimo é de ${NEXT} do segundo pedido em diante, então você leva bastante produto.`,
      `Para a empresa não ser surpreendida, deseja que eu já monte a reposição dos itens que mais giram? Aplico 25% de desconto no pedido, e o mínimo é de ${NEXT} do segundo pedido em diante, de modo que vocês levam bastante produto.`,
      `Pra vocês não serem pegos de surpresa, quer que eu já monte a reposição dos itens que mais giram? Eu dou 25% de desconto no pedido, e o mínimo é de ${NEXT} do segundo em diante, então você leva bastante produto.`,
    ), [o("Quer repor agora", "fid_indica_venda", "ok", "Reposição fechada na ligação"), o("Quer ver novidades do catálogo", "fid_catalogo", "ok"), o("Vai precisar mais pra frente", "fid_indica", "neutro", "Retornar para a próxima reposição"), o("Levantou uma objeção", "obj_menu", "objecao")], "Pergunte o que está acabando e sugira itens complementares: quem já compra tende a comprar mais.", "proposta"),
    fala("fid_catalogo", "Apresentar novidades", T(
      `Olha, a gente tem itens como ${s.itens}, além de peças especiais que combinam com o que vocês já compram. Posso te mandar o catálogo atualizado e uma sugestão de itens pro seu perfil. Prefere por WhatsApp ou por e-mail?`,
      `Temos itens como ${s.itens}, além de peças especiais que combinam com o que vocês já compram. Posso enviar o catálogo atualizado e uma sugestão de itens para o seu perfil. Prefere por WhatsApp ou por e-mail?`,
      `Olha, a gente tem itens como ${s.itens}, além de peças especiais que combinam com o que vocês já compram. Posso te mandar o catálogo atualizado e uma sugestão de itens pro seu perfil. Prefere por WhatsApp ou por e-mail?`,
    ), [o("Quer receber o catálogo", "@retorno", "ok", "Enviar catálogo e sugestão de itens"), o("Quer um pedido com novidades", "@venda", "ok", "Pedido com itens novos"), o("Agora não", "@retorno", "neutro", "Retornar em outro momento")], undefined, "proposta"),
    fala("fid_indica", "Pedir indicação", T(
      `Antes de desligar, só mais uma coisa, e fica à vontade pra dizer que não. Você conhece alguém, de outra empresa, que também sofre com falta de fixador ou com prazo? Se quiser, eu ligo e digo que foi você quem indicou.`,
      `Antes de encerrar, só mais uma coisa, e fique à vontade para dizer que não. Você conhece alguém, de outra empresa, que também enfrente falta de fixadores ou problemas de prazo? Se desejar, eu ligo e menciono que foi você quem indicou.`,
      `Antes de desligar, só mais uma coisinha, e fica à vontade pra dizer que não. Você conhece alguém, de outra empresa, que também sofre com falta de fixador ou com prazo? Se quiser, eu ligo e falo que foi você quem indicou!`,
    ), [o("Indicou alguém", "@indicacao", "ok", "Indicação recebida: anotar nome e telefone"), o("Agora não lembra de ninguém", "@retorno", "neutro", "Retornar em outro momento"), o("Prefere não indicar", "@encerrar", "neutro")], "Indicação é o jeito mais barato de prospectar: cliente satisfeito indica. Peça com leveza e anote nome e telefone na observação.", "fideliza"),
    // depois de uma reposição fechada na ligação, o resultado continua sendo a venda, indicando ou não
    fala("fid_indica_venda", "Pedir indicação (pedido fechado)", T(
      `Pedido anotado, obrigado! Antes de desligar, só mais uma coisa, e fica à vontade pra dizer que não. Você conhece alguém, de outra empresa, que também sofre com falta de fixador ou com prazo? Se quiser, eu ligo e digo que foi você quem indicou.`,
      `Pedido anotado, obrigado. Antes de encerrar, só mais uma coisa, e fique à vontade para dizer que não. Você conhece alguém, de outra empresa, que também enfrente falta de fixadores ou problemas de prazo? Se desejar, eu ligo e menciono que foi você quem indicou.`,
      `Pedido anotado, valeu! Antes de desligar, só mais uma coisinha, e fica à vontade pra dizer que não. Você conhece alguém, de outra empresa, que também sofre com falta de fixador ou com prazo? Se quiser, eu ligo e falo que foi você quem indicou!`,
    ), [o("Indicou alguém", "@venda", "ok", "Pedido fechado e indicação recebida: anotar nome e telefone"), o("Agora não lembra de ninguém", "@venda", "neutro", "Pedido fechado"), o("Prefere não indicar", "@venda", "neutro", "Pedido fechado")], "O pedido já está fechado: a indicação é um bônus. Peça com leveza e anote nome e telefone na observação.", "fideliza"),
    ...objecoes("fid_reposicao", "venda"),
  ];
  return { nodes, startId: "abertura" };
}

function reativar(s: Seg): { nodes: ScriptNode[]; startId: string } {
  const alvo: Alvo = {
    quem: "quem cuida das compras",
    tema: T("pra retomar o contato", "para retomar o relacionamento", "pra retomar o contato"),
    para: T("pra retomar o contato", "para retomar o contato", "pra retomar o contato"),
    gk: T("A empresa tem cadastro com a gente, e estou ligando pra retomar o contato.", "A empresa possui cadastro conosco, e estou ligando para retomar o contato.", "A empresa tem cadastro com a gente, e tô ligando pra retomar o contato."),
    fecha: T("É coisa rápida. Quem cuida disso consegue falar agora?", "É um assunto breve. Quem cuida disso poderia me atender agora?", "É rapidinho. Dá pra chamar quem cuida disso?"),
    motivo: T("Estou ligando pra retomar o contato com a empresa, que tem cadastro com a gente.", "Estou ligando para retomar o contato com a empresa, que possui cadastro conosco.", "Tô ligando pra retomar o contato com a empresa, que tem cadastro com a gente."),
  };
  const decisor = (note: string, to: string) => [o("Topou conversar", to, "ok", note), o("Pediu e-mail ou WhatsApp", "obj_enviar", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Sem interesse", "obj_nao", "objecao")];
  const bom = T(
    "Que bom falar com você! Eu queria retomar o contato com a {empresa}, que tem cadastro com a gente. Posso te fazer umas perguntas rápidas?",
    "Que bom falar com você. Gostaria de retomar o contato com a {empresa}, que possui cadastro conosco. Posso fazer algumas perguntas rápidas?",
    "Que bom falar com você! Queria retomar o papo com a {empresa}, que tem cadastro com a gente. Posso te fazer umas perguntinhas rápidas?",
  );
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", T(
      "{saudacao}, tudo bem? Aqui é {meunome}, da Fey. Tô retomando o contato com empresas que têm cadastro com a gente, só pra saber como estão. Com quem eu falo?",
      "{saudacao}, tudo bem? Aqui é {meunome}, da Fey. Estou retomando o contato com empresas cadastradas conosco, apenas para saber como estão. Com quem eu falo, por favor?",
      "{saudacao}, tudo bem? Aqui é {meunome}, da Fey. Tô retomando o papo com empresas que têm cadastro com a gente, só pra saber como andam. Com quem eu falo?",
    ), [o("Disse quem é", "papel", "ok"), o("Prefere não dizer o nome", "papel", "neutro"), o("Vai transferir a ligação", "transferido", "ok"), o("Perguntou o assunto", "assunto"), o("Pessoa errada ou não trabalha mais aqui", "quem", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Caixa postal, URA ou ninguém atendeu", "sem_resp")], "Cliente inativo pode ter comprado há anos, uma vez só ou nunca ter comprado. Não presuma nada: abra leve, sem cobrar, e pegue o nome. Quem cadastrou pode já ter saído da empresa. Escreva o nome no campo “Conversando atualmente com”: o roteiro passa a chamar a pessoa por ele.", "abertura"),
    ...entrada("papel", s.itens, alvo, s.tipo),
    ...perfis({
      itens: s.itens, dor: s.dor, tipo: s.tipo, alvo, next: "reat_historico", alcada: false, ok: decisor,
      falas: {
        socio: bom,
        compras: bom,
        gestor: T(
          "Que bom falar com você! Eu queria retomar o contato com a empresa, que tem cadastro com a gente. Você acompanha a compra de fixadores aí?",
          "Que bom falar com você. Gostaria de retomar o contato com a empresa, que possui cadastro conosco. Você acompanha a compra de fixadores?",
          "Que bom falar com você! Queria retomar o papo com a empresa, que tem cadastro com a gente. Você acompanha a compra de fixador aí?",
        ),
      },
      tips: {
        socio: "Dono lembra de quem já conversou com a empresa. Tom caloroso e direto, sem cobrança: você está reabrindo uma porta, não vendendo ainda.",
        compras: "Comprador valoriza quem respeita o tempo dele. Diga o motivo da ligação em uma frase e faça uma pergunta simples sobre como ele compra hoje.",
        gestor: "Quem usa o fixador no dia a dia sabe se a empresa ainda compra e de quem. Se não for ele quem decide, descubra quem é.",
      },
    }),
    fala("reat_historico", "Já comprou com a Fey?", T(
      "Aqui no sistema, a {empresa} tem cadastro com a Fey. Você lembra se já comprou ou pediu cotação com a gente?",
      "Em nosso cadastro, a {empresa} consta como registrada na Fey. Você recorda se já houve compra ou cotação conosco?",
      "Aqui no sistema, a {empresa} tem cadastro com a Fey. Você lembra se já comprou ou pediu cotação com a gente?",
    ), [o("Já comprou com a Fey", "reat_motivo", "ok", "Reativação: já foi cliente"), o("Só pediu cotação", "reat_motivo", "neutro", "Reativação: só pediu cotação antes"), o("Só tem cadastro, nunca comprou", "reat_apresenta", "neutro", "Reativação: só cadastro, nunca comprou"), o("Não lembra", "reat_apresenta", "neutro", "Reativação: não lembra do histórico"), o("Não conhece a Fey", "reat_apresenta", "neutro", "Reativação: não conhece a Fey")], "Não afirme que ele comprou: o cadastro pode vir de uma consulta antiga ou de uma lista. Pergunte e deixe a pessoa lembrar. Se ela não lembrar, siga sem constrangimento.", "pergunta"),
    fala("reat_motivo", "Entender o que mudou", T(
      "Entendi! E o que aconteceu de lá pra cá? Foi algo no nosso atendimento ou na entrega, o preço, a necessidade mudou, ou vocês acharam outro fornecedor?",
      "Entendi. E o que aconteceu desde então? Foi algo no nosso atendimento ou na entrega, o preço, a necessidade mudou ou a empresa encontrou outro fornecedor?",
      "Entendi! E o que rolou de lá pra cá? Foi algo no nosso atendimento ou na entrega, o preço, a necessidade mudou, ou vocês acharam outro fornecedor?",
    ), [o("Foi preço", "obj_preco", "objecao", "Motivo da pausa: preço"), o("Foi prazo ou entrega", "obj_prazo", "objecao", "Motivo da pausa: prazo de entrega"), o("Teve problema com produto", "reat_tecnica", "objecao", "Motivo da pausa: problema com produto"), o("Passou a comprar de outro", "obj_fornecedor", "objecao", "Motivo da pausa: comprando de outro fornecedor"), o("Necessidade mudou ou não lembra", "reat_hoje", "neutro")], "Escute sem defender a Fey. Queixa de preço, prazo ou produto é informação valiosa: rotule (“parece que o prazo te incomodou”) e anote o motivo na observação.", "pergunta"),
    fala("reat_tecnica", "Problema com o produto", T(
      "Poxa, sinto muito por isso. Me explica o que aconteceu e em qual aplicação? Aí eu levo pro nosso time técnico e te retorno ainda hoje.",
      "Lamento que isso tenha acontecido. Poderia explicar o que houve e em qual aplicação? Assim encaminho ao nosso time técnico e retorno ainda hoje.",
      "Poxa, que chato isso. Me explica o que rolou e em qual aplicação? Aí eu levo pro nosso time técnico e te retorno ainda hoje, sem enrolação.",
    ), [o("Explicou o caso", "@retorno", "ok", "Reativação: problema com produto, acionar o time técnico e retornar"), o("Topou tentar de novo", "reat_oferta", "ok")], "Anote tudo e acione o time técnico. Nunca invente uma resposta técnica: confirme e retorne no prazo prometido. Cliente que teve problema e foi ouvido costuma voltar.", "fideliza"),
    fala("reat_apresenta", "Apresentar a Fey em uma frase", T(
      `Sem problema! Resumindo, somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}, com fabricação própria e prazo de entrega firme. Atendemos ${PARES[s.tipo]}. Hoje vocês compram esse tipo de item?`,
      `Sem problema. Em resumo, somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}, com fabricação própria e prazo de entrega firme. Atendemos ${PARES[s.tipo]}. Atualmente a empresa compra esse tipo de item?`,
      `Sem problema! Resumindo, somos uma metalúrgica especializada em fixadores e fabricamos ${s.itens}, com fabricação própria e prazo firme. Atendemos ${PARES[s.tipo]}. Hoje vocês compram esse tipo de item?`,
    ), [o("Compra esse tipo de item", "reat_hoje", "ok"), o("Não usa mais fixadores", "reat_atualiza", "neutro", "Reativação: não usa mais fixadores"), o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Sem interesse", "obj_nao", "objecao")], "Curto: uma frase sobre o que a Fey faz e uma pergunta. Quem só tem cadastro não precisa ouvir o pitch inteiro.", "ponte"),
    fala("reat_hoje", "Como compra hoje", T(
      `E hoje, como vocês compram fixadores? Com frequência, só quando precisa, ou já têm um fornecedor fixo?`,
      `E atualmente, como a empresa compra fixadores? Com frequência, apenas quando precisa, ou já tem um fornecedor fixo?`,
      `E hoje, como vocês compram fixador? Toda hora, só quando aperta, ou já têm um fornecedor fixo?`,
    ), [o("Compra só quando precisa", "reat_oferta", "ok", "Compra esporádica de fixadores"), o("Vai precisar em breve", "reat_oferta", "ok", "Tem necessidade próxima"), o("Já tem fornecedor fixo", "obj_fornecedor", "objecao"), o("Está satisfeito com o atual", "obj_satisfeito", "objecao"), o("Não usa mais fixadores", "reat_atualiza", "neutro", "Reativação: não usa mais fixadores")], "Deixe falar e anote itens, frequência e fornecedor atual: isso vira a cotação. “Me conta mais” é a melhor pergunta de continuação.", "pergunta"),
    fala("reat_oferta", "Propor a cotação", T(
      `Então olha, eu monto uma cotação ainda hoje com os itens que vocês mais usam, com prazo firme e 25% de desconto no pedido. Aí você olha com calma e vê se faz sentido. Prefere receber por WhatsApp ou por e-mail?`,
      `Então eu proponho montar uma cotação ainda hoje com os itens que a empresa mais utiliza, com prazo de entrega firme e 25% de desconto no pedido. Assim você avalia com calma se faz sentido. Prefere receber por WhatsApp ou por e-mail?`,
      `Então olha, eu monto uma cotação hoje mesmo com os itens que vocês mais usam, com prazo firme e 25% de desconto no pedido. Aí você dá uma olhada sem pressa e vê se vale. Prefere receber por WhatsApp ou por e-mail?`,
    ), [o("Quer a cotação", "@cotacao", "ok", "Reativação: cotação a enviar"), o("Quer fechar o pedido já", "@venda", "ok"), o("Levantou uma objeção", "obj_menu", "objecao"), o("Agora não", "reat_depois", "neutro")], "Ofereça 25% primeiro; só depois, se precisar, chegue a 26%. Depois de pedir o próximo passo, fique em silêncio e deixe a pessoa responder.", "proposta"),
    fala("reat_atualiza", "Atualizar o cadastro", T(
      `Sem problema! Então, só pra deixar o cadastro certinho, o contato de quem cuida das compras, o e-mail e o WhatsApp ainda são os mesmos?`,
      `Sem problema. Então, para manter o cadastro correto, o contato de quem cuida das compras, o e-mail e o WhatsApp continuam os mesmos?`,
      `Sem problema! Então, só pra deixar o cadastro em dia, o contato de quem cuida das compras, o e-mail e o WhatsApp continuam os mesmos?`,
    ), [o("Atualizou os dados", "@retorno", "ok", "Cadastro atualizado: retomar mais pra frente"), o("Pediu para não receber mais contato", "@encerrar", "neutro", "Pediu para não receber mais contato")], "Mesmo sem venda a ligação vale: cadastro atualizado e motivo registrado melhoram as próximas tentativas. Respeite o pedido de quem não quer mais contato.", "apoio"),
    fala("reat_depois", "Combinar o retorno", T(
      "Sem pressa! Qual o melhor dia e horário pra eu te ligar de novo? Eu anoto e te procuro nesse dia.",
      "Sem pressa. Qual é o melhor dia e horário para eu ligar novamente? Anoto e retorno nesse dia.",
      "Sem pressa! Qual o melhor dia e horário pra eu te ligar de novo? Eu anoto e te procuro bem nessa hora.",
    ), [o("Combinou data e horário", "@retorno", "ok", "Retorno combinado"), o("Pediu para não ligar mais", "@encerrar", "neutro", "Pediu para não receber mais contato")], "Quem cumpre o que prometeu ganha confiança. Anote a data e o horário na observação e ligue exatamente nesse momento.", "fechamento"),
    ...objecoes("reat_oferta", "venda"),
  ];
  return { nodes, startId: "abertura" };
}

/* ───────────── Tarefas que o script gera ───────────── */
const tk = (kind: ScriptTask["kind"], title: string, days: number): ScriptTask => ({ kind, title, days });
const LIGAR_2 = (t: string) => tk("ligar", t, 2);
/** Resposta (passo + texto da resposta) → tarefas. O que não está aqui usa o padrão do passo final. */
const OPTION_TASKS: { node: RegExp; label: RegExp; tasks: ScriptTask[] }[] = [
  { node: /^horario$/, label: /nome e o hor/i, tasks: [tk("ligar", "Ligar no horário combinado", 1)] },
  { node: /^rec_email$/, label: /e-mail/i, tasks: [tk("email", "Enviar o e-mail de apresentação", 0), LIGAR_2("Ligar para confirmar que o e-mail chegou")] },
  { node: /^digital$/, label: /concordou/i, tasks: [tk("email", "Enviar o material (e-mail ou WhatsApp)", 0), LIGAR_2("Ligar para saber o que achou do material")] },
  { node: /^sem_resp$/, label: /tentativa registrada/i, tasks: [tk("ligar", "Ligar de novo (ninguém atendeu)", 1)] },
  { node: /^obj_enviar$/, label: /passou o contato/i, tasks: [tk("email", "Enviar o material pedido (e-mail ou WhatsApp)", 0), LIGAR_2("Ligar para saber o que achou")] },
  { node: /^obj_tempo$/, label: /deu um hor/i, tasks: [tk("ligar", "Ligar no horário combinado", 1)] },
  { node: /^obj_estoque$/, label: /combinou/i, tasks: [tk("ligar", "Retomar o contato (estoque cheio)", 30)] },
  { node: /^obj_depois$/, label: /data ou um gatilho/i, tasks: [tk("ligar", "Ligar na data combinada", 30)] },
  { node: /^obj_verba$/, label: /combinou retorno/i, tasks: [tk("ligar", "Retomar o contato (sem verba no momento)", 30)] },
  { node: /^obj_pensar(_geral)?$/, label: /combinou o retorno/i, tasks: [tk("ligar", "Ligar para saber da decisão", 3)] },
  { node: /^p_assistente$/, label: /marcou um hor/i, tasks: [tk("ligar", "Ligar no horário marcado", 1)] },
  { node: /^reenviar$/, label: /combinado/i, tasks: [tk("cotacao", "Reenviar a cotação (e-mail e WhatsApp)", 0), LIGAR_2("Ligar para conversar sobre a cotação")] },
  { node: /^prazo$/, label: /deu uma data/i, tasks: [tk("ligar", "Ligar na data combinada", 3)] },
  { node: /^ret_ultima$/, label: /um m[eê]s/i, tasks: [tk("ligar", "Retomar o contato (despedida)", 30)] },
  { node: /^motivo$/, label: /novo contato/i, tasks: [tk("ligar", "Retomar o contato", 30)] },
  { node: /^(duvida_tec|fid_tecnica|reat_tecnica)$/, label: /explicou/i, tasks: [tk("outro", "Acionar o time técnico", 0), tk("ligar", "Retornar com a resposta do time técnico", 1)] },
  { node: /^(obj_certificado|obj_especial)$/, label: /informou|explicou/i, tasks: [tk("outro", "Acionar o time técnico", 0), tk("ligar", "Retornar com a resposta do time técnico", 1)] },
  { node: /^fid_pedido$/, label: /passou os dados/i, tasks: [tk("outro", "Verificar o pedido ou a entrega", 0), tk("ligar", "Retornar com a resposta sobre o pedido", 1)] },
  { node: /^fid_catalogo$/, label: /receber o cat/i, tasks: [tk("email", "Enviar o catálogo e a sugestão de itens", 0), LIGAR_2("Ligar para saber o que achou do catálogo")] },
  { node: /^fid_catalogo$/, label: /agora n/i, tasks: [tk("ligar", "Retomar o contato com novidades", 30)] },
  { node: /^fid_indica(_venda)?$/, label: /indicou/i, tasks: [tk("outro", "Cadastrar a indicação (nome e telefone)", 0), tk("ligar", "Ligar para a empresa indicada", 1)] },
  { node: /^fid_reposicao$/, label: /mais pra frente/i, tasks: [tk("ligar", "Retomar o contato para a próxima reposição", 30)] },
  { node: /^fid_indica$/, label: /n[aã]o lembra/i, tasks: [tk("ligar", "Retomar o contato e pedir indicação", 30)] },
  { node: /^reat_atualiza$/, label: /atualizou/i, tasks: [tk("outro", "Atualizar o cadastro do lead no sistema", 0), tk("ligar", "Retomar o contato mais pra frente", 30)] },
  { node: /^reat_depois$/, label: /combinou/i, tasks: [tk("ligar", "Ligar na data combinada", 2)] },
];
/** Padrão de cada passo final. Venda e conversa agendada não geram tarefa de ligação. */
const END_TASKS: Record<string, ScriptTask[]> = {
  fim_retorno: [tk("ligar", "Ligar de novo", 2)],
  fim_cotacao: [tk("cotacao", "Enviar a cotação", 0), LIGAR_2("Ligar para acompanhar a cotação")],
  fim_venda: [tk("pedido", "Abrir o pedido", 0)],
  fim_indicacao: [],
  fim_visita: [],
  fim_visita_ok: [tk("whatsapp", "Mandar a confirmação da visita por escrito", 0)],
  fim_remarcada: [tk("outro", "Avisar o representante da nova data", 0), tk("whatsapp", "Confirmar a nova data com o cliente", 0)],
  fim_encerrar: [],
};
function withTasks(nodes: ScriptNode[]): ScriptNode[] {
  return nodes.map((n) => ({
    ...n,
    ...(n.type === "fim" && END_TASKS[n.id] ? { tasks: END_TASKS[n.id] } : {}),
    options: n.options.map((x) => { const r = OPTION_TASKS.find((t) => t.node.test(n.id) && t.label.test(x.label)); return r ? { ...x, tasks: r.tasks } : x; }),
  }));
}

/** A visita não depende do tipo de cliente: um roteiro só (Geral) serve a todos. */
export const segmentsOf = (goal: ScriptGoal): string[] => (goal === "visita" ? ["geral"] : Object.keys(SEGMENTS));

function build(goal: ScriptGoal, segment: string) {
  const s = SEG[segment] ?? SEG.geral;
  return goal === "sdr" ? sdr(s) : goal === "vendas" ? vendas(s) : goal === "retorno" ? retorno(s) : goal === "reativar" ? reativar(s) : goal === "visita" ? visita() : fidelizar(s);
}

/** Cada final aponta para o desfecho do objetivo (um nó "fim" por resultado). Torna a árvore fechada e sem becos. */
function close(_goal: ScriptGoal, nodes: ScriptNode[], startId: string) {
  const ends: Record<string, ScriptNode> = {
    visita: fim("fim_visita", "Conversa agendada", T("Boa! Confirme o dia, o horário e o formato (presencial ou online) e registre a visita no sistema.", "Muito bem. Confirme o dia, o horário e o formato (presencial ou online) e registre a visita no sistema.", "Boa, mandou bem! Confirme o dia, o horário e o formato (presencial ou online) e registre a visita no sistema."), "visita"),
    cotacao: fim("fim_cotacao", "Cotação a enviar", T("Boa! Envie a cotação ainda hoje e deixe o retorno combinado.", "Muito bem. Envie a cotação ainda hoje e deixe o retorno combinado.", "Boa! Manda a cotação ainda hoje e deixa o retorno combinado."), "cotacao"),
    venda: fim("fim_venda", "Venda fechada", T("Excelente! Confirme itens, condições e prazo, e abra o pedido.", "Excelente. Confirme itens, condições e prazo, e abra o pedido.", "Show, parabéns! Confirma itens, condições e prazo, e abre o pedido."), "venda"),
    indicacao: fim("fim_indicacao", "Indicação recebida", T("Que ótimo! Anote o nome e o telefone da indicação, e ligue pra empresa dizendo quem indicou.", "Excelente. Anote o nome e o telefone da indicação e ligue para a empresa informando quem indicou.", "Boa demais! Anota o nome e o telefone da indicação e liga pra empresa falando quem indicou."), "indicacao"),
    retorno: fim("fim_retorno", "Retorno combinado", T("Combinado! Anote o dia e o horário do retorno na observação.", "Combinado. Anote o dia e o horário do retorno na observação.", "Combinado! Anota o dia e o horário do retorno na observação."), "retorno"),
    confirmada: fim("fim_visita_ok", "Visita confirmada", T("Visita confirmada! Registre quem recebe o representante e mande a confirmação por escrito.", "Visita confirmada. Registre quem receberá o representante e envie a confirmação por escrito.", "Visita confirmada! Anota quem recebe o representante e manda a confirmação por escrito."), "visita"),
    remarcada: fim("fim_remarcada", "Visita remarcada", T("Remarcada! Avise o representante da nova data e confirme com o cliente por escrito.", "Remarcada. Avise o representante da nova data e confirme com o cliente por escrito.", "Remarcada! Avisa o representante da nova data e confirma com o cliente por escrito."), "retorno"),
    encerrar: fim("fim_encerrar", "Conversa encerrada", T("Tudo bem, faz parte. Agradeça, registre o motivo e passe para o próximo lead.", "Tudo bem, faz parte. Agradeça pela atenção, registre o motivo e siga para o próximo lead.", "Sem estresse, faz parte! Agradece, registra o motivo e bora pro próximo lead."), "encerrar"),
  };
  const used = new Set<string>();
  const fixed = nodes.map((n) => ({ ...n, options: n.options.map((x) => {
    const k = x.to === null ? "encerrar" : x.to.startsWith("@") ? x.to.slice(1) : null;
    if (!k || !ends[k]) return x;
    used.add(k);
    return { ...x, to: ends[k].id };
  }) }));
  return { nodes: withTasks(withData([...fixed, ...[...used].map((k) => ends[k])])), startId };
}

/** Todos os scripts de fábrica (para o banco e para os testes). */
export function buildAll() {
  const out: { key: string; goal: ScriptGoal; segment: string; nodes: ScriptNode[]; startId: string }[] = [];
  for (const goal of Object.keys(GOALS) as ScriptGoal[]) for (const segment of segmentsOf(goal)) {
    const b = build(goal, segment);
    out.push({ key: `${goal}:${segment}`, goal, segment, ...close(goal, b.nodes, b.startId) });
  }
  return out;
}

/**
 * Cria os scripts de fábrica (um por objetivo e tipo de estabelecimento). Quando os textos de fábrica mudam (SEED_VERSION),
 * os que ninguém editou na tela são atualizados; os editados pelo Adm ficam como estão.
 */
let checkedAt = 0;
/** Grava (e, se a versão mudou, atualiza) os roteiros de fábrica numa transação só. O trava-aviso evita que várias instâncias façam o mesmo trabalho ao mesmo tempo. */
async function syncGlobalScripts(v: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [{ ok }] = await tx.execute<{ ok: boolean }>(sql`select pg_try_advisory_xact_lock(7201) as ok`);
    if (!ok) return; // outra instância já está cuidando disso
    for (const b of buildAll()) {
      const title = `${GOALS[b.goal].label.split(" (")[0]} · ${SEGMENTS[b.segment]}`;
      await tx.insert(scripts).values({ seedKey: b.key, ownerId: null, title, segment: b.segment, goal: b.goal, summary: GOALS[b.goal].hint, nodes: b.nodes, startId: b.startId }).onConflictDoNothing();
      if (v < SEED_VERSION) await tx.execute(sql`update scripts set title = ${title}, summary = ${GOALS[b.goal].hint}, nodes = ${JSON.stringify(b.nodes)}::jsonb, start_id = ${b.startId} where seed_key = ${b.key} and updated_at <= created_at + interval '2 seconds'`);
    }
    await tx.execute(sql`insert into settings (key, value) values ('scripts_seed_v', ${String(SEED_VERSION)}::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()`);
  });
}

export async function ensureGlobalScripts(): Promise<void> {
  if (Date.now() - checkedAt < 600_000) return; // já conferido há pouco neste servidor: poupa duas idas ao banco por visita
  const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from scripts where seed_key is not null`);
  const [{ v }] = await db.execute<{ v: number }>(sql`select coalesce((select (value #>> '{}')::int from settings where key = 'scripts_seed_v'), 0) as v`);
  const expected = (Object.keys(GOALS) as ScriptGoal[]).reduce((a, g) => a + segmentsOf(g).length, 0);
  if (n >= expected && v >= SEED_VERSION) { checkedAt = Date.now(); return; }
  checkedAt = Date.now();
  if (n < expected) { await syncGlobalScripts(v); return; } // faltam roteiros: precisa existir antes de seguir
  // Só a versão dos textos mudou: a pessoa não espera. Atualiza depois de responder (os roteiros antigos servem até lá).
  try { after(() => syncGlobalScripts(v).catch(() => { checkedAt = 0; })); } catch { await syncGlobalScripts(v); }
}

/** Restaura os roteiros de fábrica. "unedited" só atualiza os que ninguém editou; "all" sobrescreve também os editados (o texto antigo se perde). */
export async function restoreSeedScripts(mode: "unedited" | "all"): Promise<number> {
  let n = 0;
  for (const b of buildAll()) {
    const title = `${GOALS[b.goal].label.split(" (")[0]} · ${SEGMENTS[b.segment]}`;
    await db.insert(scripts).values({ seedKey: b.key, ownerId: null, title, segment: b.segment, goal: b.goal, summary: GOALS[b.goal].hint, nodes: b.nodes, startId: b.startId }).onConflictDoNothing();
    const guard = mode === "all" ? sql`` : sql` and updated_at <= created_at + interval '2 seconds'`;
    const r = await db.execute(sql`update scripts set title = ${title}, summary = ${GOALS[b.goal].hint}, nodes = ${JSON.stringify(b.nodes)}::jsonb, start_id = ${b.startId}, updated_at = now() where seed_key = ${b.key}${guard} returning id`);
    n += r.length;
  }
  await db.execute(sql`insert into settings (key, value) values ('scripts_seed_v', ${String(SEED_VERSION)}::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()`);
  return n;
}
