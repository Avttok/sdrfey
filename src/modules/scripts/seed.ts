import { sql } from "drizzle-orm";
import { db, scripts } from "@/db";
import type { ScriptGoal, ScriptNode } from "@/config/scripts";
import { GOALS, SEGMENTS } from "@/config/scripts";
import { NEXT, ONLINE, PARES, SEG, T, fala, fim, o, type Alvo } from "./seed-core";
import { confirma, enriquece, entrada, minimo, objecoes, perfis } from "./seed-parts";

/** Muda quando os textos de fábrica são reescritos: os scripts do time que ninguém editou são atualizados. */
export const SEED_VERSION = 14;

type Seg = (typeof SEG)[string];

function sdr(s: Seg): { nodes: ScriptNode[]; startId: string } {
  const alvo: Alvo = { quem: "quem cuida das compras", motivo: T(
    `Estou ligando porque atendemos ${PARES[s.tipo]} e queria ver se faz sentido apresentar nossa linha.`,
    `Entro em contato porque atendemos ${PARES[s.tipo]} e gostaria de avaliar se faz sentido apresentar nossa linha.`,
    `Tô ligando porque a gente atende ${PARES[s.tipo]} e queria ver se faz sentido te mostrar nossa linha.`,
  ) };
  const decisor = (note: string, to: string) => [o("Topou ouvir", to, "ok", note), o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Pediu e-mail ou WhatsApp", "obj_enviar", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Sem interesse", "obj_nao", "objecao")];
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", T(
      "{saudacao}! Aqui é {meunome}, da Fey, uma metalúrgica de fixadores. Estou ligando para a área de compras. Com quem eu falo, por favor?",
      "{saudacao}! Aqui é {meunome}, da Fey, metalúrgica de fixadores. Entro em contato com a área de compras. Com quem tenho o prazer de falar?",
      "{saudacao}! Aqui é {meunome}, da Fey, a metalúrgica de fixadores. Tô ligando pra área de compras. Com quem eu falo?",
    ), [o("Disse quem é", "nome", "ok"), o("Vai transferir a ligação", "transferido", "ok"), o("Perguntou o assunto", "assunto"), o("Pessoa errada ou não trabalha mais aqui", "quem", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Caixa postal, URA ou ninguém atendeu", "sem_resp"), o("Não é essa empresa", "@encerrar", "objecao", "Telefone não pertence à empresa")], "Abertura neutra de propósito: você não sabe quem atendeu (dono, balcão, recepção…), então só se identifica, diz a área e pergunta o nome. O pitch vem depois, quando souber a função da pessoa. A Gong mediu que abrir com o motivo e candura rende cerca de 11% de sucesso; evite “como vai o dia?” e “estou atrapalhando?”.", "abertura"),
    ...entrada("conf_empresa", s.itens, alvo, s.tipo),
    ...confirma("pitch", s.itens, s.tipo),
    ...perfis({
      itens: s.itens, dor: s.dor, tipo: s.tipo, alvo, next: "conf_segmento", alcada: true, ok: decisor,
      falas: {
        socio: T(
          `Que bom falar direto com quem decide! Vou direto ao ponto, que seu tempo vale. Somos uma metalúrgica e fabricamos ${s.itens}. Atendemos ${PARES[s.tipo]}, e queria entender se faz sentido apresentar nossa linha pra {empresa}. Posso te explicar em trinta segundos e você decide se vale continuar?`,
          `Que bom falar diretamente com quem decide. Serei breve, pois seu tempo é valioso. A Fey é uma metalúrgica e fabrica ${s.itens}. Atendemos ${PARES[s.tipo]} e gostaria de entender se faz sentido apresentar nossa linha à {empresa}. Posso explicar em trinta segundos, para que você decida se vale continuar?`,
          `Que bom falar direto com quem decide! Vou direto ao ponto, que seu tempo é precioso. A gente é uma metalúrgica e fabrica ${s.itens}. Atendemos ${PARES[s.tipo]}, e queria entender se faz sentido mostrar nossa linha pra {empresa}. Te explico em trinta segundos e você decide se vale seguir, pode ser?`),
        compras: T(
          `Então estou falando com a pessoa certa! Somos uma metalúrgica e fabricamos ${s.itens}. Estou ligando pra apresentar a Fey como mais uma opção na sua lista de fornecedores, com fabricação própria e prazo firme. Posso te fazer duas perguntas rápidas sobre como vocês compram hoje, pra ver se faz sentido?`,
          `Então estou falando com a pessoa certa. A Fey é uma metalúrgica e fabrica ${s.itens}. Entro em contato para que a Fey seja mais uma opção em sua lista de fornecedores, com fabricação própria e prazo firme. Posso lhe fazer duas perguntas rápidas sobre como a empresa compra hoje, para avaliarmos se faz sentido?`,
          `Então tô falando com a pessoa certa! A gente é uma metalúrgica e fabrica ${s.itens}. Tô ligando pra apresentar a Fey como mais uma opção na sua lista de fornecedores, com fabricação própria e prazo firme. Posso te fazer duas perguntinhas sobre como vocês compram hoje, pra ver se faz sentido?`),
        gestor: T(
          `Boa! Quem vive o dia a dia sabe o que pesa. Somos uma metalúrgica e fabricamos ${s.itens}. Estou ligando porque ajudamos ${PARES[s.tipo]} a evitar ${s.dor}. Me conta: quando falta ou quebra um fixador aí, o que acontece, e você participa da escolha do fornecedor?`,
          `Ótimo. Quem vive o dia a dia sabe o que pesa. A Fey é uma metalúrgica e fabrica ${s.itens}. Entro em contato porque ajudamos ${PARES[s.tipo]} a evitar ${s.dor}. Poderia me contar: quando falta ou quebra um fixador, o que acontece, e você participa da escolha do fornecedor?`,
          `Boa! Quem vive o dia a dia sabe o que pesa. A gente é uma metalúrgica e fabrica ${s.itens}. Tô ligando porque a gente ajuda ${PARES[s.tipo]} a evitar ${s.dor}. Me conta: quando falta ou quebra um fixador aí, o que rola, e você participa da escolha do fornecedor?`),
      },
      tips: {
        socio: "Dono e sócio valorizam tempo, margem e risco: fale curto, vá ao ponto e respeite os trinta segundos prometidos. Não aceite “manda por e-mail” de primeira: ofereça a conversa de vinte minutos. Tom firme e cordial, de igual para igual.",
        compras: "Comprador compara preço, prazo e confiabilidade o dia todo: seja específico (fabricação própria, prazo firme), não vago. Ele quer uma alternativa que o faça ficar bem com o chefe, então pergunte como compra hoje e o que já falhou. Descubra se ele decide ou só recomenda.",
        gestor: "Gerente e encarregado sentem a dor (máquina parada, cliente esperando), mas nem sempre decidem a compra. Comece pelo problema, não pelo produto, e descubra cedo se ele participa da decisão; se não, ele vira o seu aliado para chegar a quem decide.",
      },
    }),
    fala("pitch", "Despertar interesse", T(
      `Então, vou te contar o que a gente mais ouve de quem trabalha com ${s.itens}: o problema de ${s.dor}. A gente fabrica direto, com linha premium e prazo de entrega firme, e isso tira essa dor. Soa familiar aí, ou vocês já têm isso redondo?`,
      `Vou lhe contar o que mais ouvimos de quem trabalha com ${s.itens}: o problema de ${s.dor}. Fabricamos diretamente, com linha premium e prazo de entrega firme, o que elimina essa dor. Isso soa familiar, ou a empresa já tem isso bem resolvido?`,
      `Olha, vou te contar o que a gente mais escuta de quem trabalha com ${s.itens}: o perrengue de ${s.dor}. A gente fabrica direto, com linha premium e prazo de entrega firme, e isso resolve essa dor. Soa familiar aí, ou vocês já têm isso redondo?`,
    ), [o("Reconheceu o problema ou contou como compra", "impl", "ok"), o("Já tem fornecedor", "obj_fornecedor", "objecao"), o("Disse que é caro", "obj_preco", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Não tem interesse", "obj_nao", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Fale do problema do cliente, não do seu produto. Depois da pergunta, escute: quem fala menos conduz mais a conversa. Uma pergunta por vez.", "proposta"),
    fala("impl", "Entender o impacto", T(
      "Poxa, imagino. E quando isso acontece, o que rola na prática? O cliente fica esperando, vocês saem correndo atrás em outro lugar, ou nem chega a ser um problema?",
      "Compreendo. E quando isso ocorre, o que acontece na prática? O cliente fica esperando, vocês buscam em outro lugar às pressas, ou nem chega a ser um problema?",
      "Poxa, imagino! E quando isso acontece, o que rola na prática? O cliente fica esperando, vocês saem correndo atrás em outro lugar, ou nem chega a incomodar?",
    ), [o("Cliente espera ou desiste da venda", "ganho", "ok", "Impacto: cliente espera ou venda perdida"), o("Compra em outro lugar, mais caro", "ganho", "ok", "Impacto: compra de emergência mais cara"), o("Para o serviço ou a produção", "ganho", "ok", "Impacto: serviço ou produção parados"), o("Quase não acontece", "contrato", "neutro", "Pouco impacto percebido")], "Implicação (SPIN): deixe ele mesmo dizer o quanto isso pesa. Rotule: “parece que isso incomoda”. Não proponha solução ainda.", "pergunta"),
    fala("ganho", "O valor de resolver", T(
      "Entendi. E se vocês tivessem um fornecedor que entrega no prazo combinado e não deixa faltar o item de giro, isso mudaria alguma coisa pra vocês?",
      "Entendi. E se a empresa contasse com um fornecedor que entrega no prazo combinado e não deixa faltar o item de giro, isso mudaria algo para vocês?",
      "Entendi! E se vocês tivessem um fornecedor que entrega no prazo combinado e não deixa faltar o item de giro, isso mudaria alguma coisa pra vocês?",
    ), [o("Mudaria bastante", "contrato", "ok", "Vê valor em prazo firme e item de giro"), o("Ajudaria um pouco", "contrato", "neutro"), o("Já está resolvido", "contrato", "neutro", "Diz ter o assunto resolvido")], "Ganho (SPIN): é ele quem diz o valor, não você. Se ele descreve o benefício, o “sim” da reunião fica fácil.", "pergunta"),
    fala("contrato", "Pedir licença para perguntar", T(
      "Beleza! Posso te fazer umas perguntinhas rápidas, só pra eu ver se a Fey serve mesmo pra vocês? Se não servir, eu mesmo te falo, combinado?",
      "Perfeito. Posso fazer algumas perguntas rápidas, apenas para avaliar se a Fey realmente atende às necessidades de vocês? Se não atender, eu mesmo lhe direi, combinado?",
      "Beleza! Posso te fazer umas perguntinhas rápidas, só pra ver se a Fey serve mesmo pra vocês? Se não servir, eu mesmo te falo, combinado?",
    ), [o("Pode perguntar", "enr_conhece", "ok"), o("Está com pouco tempo", "obj_tempo", "objecao")], "Contrato inicial (Sandler): alinha a expectativa e tira a pressão. Dar permissão para dizer “não” aumenta o “sim”.", "ponte"),
    ...enriquece("conf_minimo", s.tipo, "sdr"),
    minimo("visita"),
    fala("visita", "Marcar a conversa", T(
      "{contato}, pelo que a gente conversou, acho que vale você ver isso de perto. Seria um papo de uns vinte minutinhos com o nosso especialista, que já leva uma proposta pensada pra {empresa}, e você mesmo julga se faz sentido, sem compromisso. Prefere presencial, com nosso representante, ou online, por ligação ou WhatsApp? Terça de manhã ou quinta à tarde fica melhor?",
      "{contato}, pelo que conversamos, acredito que vale a pena você ver isso de perto. Seria uma conversa de cerca de vinte minutos com nosso especialista, que já leva uma proposta pensada para a {empresa}, e você mesmo avalia se faz sentido, sem compromisso. Prefere presencial, com nosso representante, ou online, por ligação ou WhatsApp? Terça pela manhã ou quinta à tarde seria melhor?",
      "{contato}, pelo que a gente conversou, acho que vale você ver isso de pertinho. É um papo de uns vinte minutinhos com nosso especialista, que já leva uma proposta pensada pra {empresa}, e você mesmo vê se faz sentido, sem compromisso. Prefere presencial, com nosso representante, ou online, por ligação ou WhatsApp? Terça de manhã ou quinta à tarde fica melhor pra você?",
    ), [o("Visita presencial (representante)", "visita_confirma", "ok", "Agendado: visita presencial"), o("Conversa online (vendedor SDR, por ligação ou WhatsApp)", "visita_confirma", "ok", "Agendado: conversa online por ligação ou WhatsApp"), o("Prefere receber por e-mail ou WhatsApp", "digital"), o("Sem disponibilidade agora", "obj_tempo", "objecao"), o("Recusou", "obj_nao", "objecao")], `Venda a reunião, não o produto (“você mesmo julga”). Dê sempre duas opções de dia e horário, nunca “quer marcar?”. Peça a agenda: “você está com a agenda aí?”. ${ONLINE}`, "proposta"),
    fala("visita_confirma", "Confirmar o combinado", T(
      "Então ficamos assim: [dia e horário combinados], com {contato}, pra falar da reposição da {empresa}. Vou te mandar o convite agora, enquanto a gente fala, e uma mensagem no WhatsApp pra lembrar. Qual o melhor número e e-mail pra eu enviar?",
      "Então ficamos assim: [dia e horário combinados], com {contato}, para tratar da reposição da {empresa}. Enviarei o convite agora, durante a ligação, e uma mensagem de WhatsApp como lembrete. Qual é o melhor número e e-mail para o envio?",
      "Então fechou: [dia e horário combinados], com {contato}, pra gente falar da reposição da {empresa}. Vou te mandar o convite agora mesmo, enquanto a gente fala, e um WhatsApp só pra lembrar. Qual o melhor número e e-mail pra eu mandar?",
    ), [o("Confirmou os dados", "@visita", "ok", "Convite enviado durante a ligação e lembrete combinado"), o("Quer trocar o horário", "visita", "neutro")], "Reunião agendada só vale se o lead aparece: recapitule dia e horário, diga a pauta em uma linha e envie o convite ainda na ligação (Rework, Pipedrive). Anote o dia e o horário na observação.", "fechamento"),
    fala("digital", "Seguir pelo digital", T(
      "Perfeito! Te mando agora um material curtinho, só com o que importa pro seu perfil. Posso te ligar depois de amanhã, uns cinco minutinhos, pra saber o que você achou? Se fizer sentido, a gente já marca a conversa.",
      "Perfeito. Enviarei agora um material resumido, apenas com o que importa ao seu perfil. Posso ligar depois de amanhã, por cerca de cinco minutos, para saber sua opinião? Se fizer sentido, já agendamos a conversa.",
      "Perfeito! Te mando agora um material curtinho, só com o que importa pro seu perfil. Posso te ligar depois de amanhã, uns cinco minutinhos, pra saber o que achou? Se fizer sentido, a gente já marca a conversa.",
    ), [o("Concordou", "@retorno", "ok", "Enviar material e retornar em 2 dias"), o("Mesmo assim recusou", "obj_nao", "objecao")], "Combine o dia do retorno antes de desligar. Mensagem curta para o WhatsApp: “Oi! Aqui é [seu nome], da Fey, a metalúrgica de fixadores. Conforme conversamos, segue o material. Qualquer dúvida, é só chamar.”", "apoio"),
    ...objecoes("visita", "visita"),
  ];
  return { nodes, startId: "abertura" };
}

function vendas(s: Seg): { nodes: ScriptNode[]; startId: string } {
  const alvo: Alvo = { quem: "quem cuida das compras", para: T("pra montar uma cotação pra vocês", "para montar uma cotação para a empresa", "pra montar uma cotação pra vocês"), motivo: T("Estou ligando pra ajudar na reposição e montar uma cotação certa.", "Entro em contato para ajudar na reposição e montar uma cotação adequada.", "Tô ligando pra te ajudar na reposição e montar uma cotação certinha.") };
  const decisor = (note: string, to: string) => [o("Topou conversar", to, "ok", note), o("Pediu a tabela de preços", "tabela"), o("Já tem fornecedor fechado", "obj_fornecedor", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Sem interesse", "obj_nao", "objecao")];
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", T(
      `{saudacao}! Aqui é {meunome}, da Fey, uma metalúrgica de fixadores. Estou ligando para falar da reposição de ${s.itens} com quem cuida das compras. Com quem eu falo, por favor?`,
      `{saudacao}! Aqui é {meunome}, da Fey, metalúrgica de fixadores. Entro em contato para tratar da reposição de ${s.itens} com quem cuida das compras. Com quem tenho o prazer de falar?`,
      `{saudacao}! Aqui é {meunome}, da Fey, a metalúrgica de fixadores. Tô ligando pra falar da reposição de ${s.itens} com quem cuida das compras. Com quem eu falo?`,
    ), [o("Disse quem é", "nome", "ok"), o("Vai transferir a ligação", "transferido", "ok"), o("Perguntou o assunto", "assunto"), o("Pessoa errada ou não trabalha mais aqui", "quem", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Caixa postal, URA ou ninguém atendeu", "sem_resp")], "Aqui o objetivo é cotar e vender, mas você ainda não sabe quem atendeu: abra neutro, pegue o nome e a função, e só então consulte. Seja consultivo: você quer ajudar a resolver a reposição, não empurrar produto.", "abertura"),
    ...entrada("papel", s.itens, alvo, s.tipo),
    ...perfis({
      itens: s.itens, dor: s.dor, tipo: s.tipo, alvo, next: "desc_itens", alcada: false, ok: decisor,
      falas: {
        socio: T(
          `Que bom falar com quem decide! Somos uma metalúrgica e fabricamos ${s.itens}. Estou ligando pra ajudar na reposição da {empresa}: com duas perguntas rápidas eu já monto uma cotação certa. Pode ser agora?`,
          `Que bom falar com quem decide. A Fey é uma metalúrgica e fabrica ${s.itens}. Entro em contato para ajudar na reposição da {empresa}: com duas perguntas rápidas, já monto uma cotação adequada. Pode ser agora?`,
          `Que bom falar com quem decide! A gente é uma metalúrgica e fabrica ${s.itens}. Tô ligando pra ajudar na reposição da {empresa}: com duas perguntinhas eu já monto uma cotação certinha. Pode ser agora?`),
        compras: T(
          `Perfeito, então é com você! Somos uma metalúrgica e fabricamos ${s.itens}. Quero te ajudar com a reposição: com duas perguntas eu já monto uma cotação certa, com prazo firme. Pode ser agora?`,
          `Perfeito, então é com você. A Fey é uma metalúrgica e fabrica ${s.itens}. Gostaria de ajudar na reposição: com duas perguntas, já monto uma cotação adequada, com prazo firme. Pode ser agora?`,
          `Perfeito, então é com você! A gente é uma metalúrgica e fabrica ${s.itens}. Quero te ajudar com a reposição: com duas perguntinhas eu já monto uma cotação certinha, com prazo firme. Pode ser agora?`),
        gestor: T(
          `Boa! Quem vive o dia a dia sabe o que falta. Somos uma metalúrgica e fabricamos ${s.itens}. Queria ajudar com a reposição: o que mais acaba ou atrasa aí, e você participa da compra?`,
          `Ótimo. Quem vive o dia a dia sabe o que falta. A Fey é uma metalúrgica e fabrica ${s.itens}. Gostaria de ajudar na reposição: o que mais acaba ou atrasa, e você participa da compra?`,
          `Boa! Quem vive o dia a dia sabe o que falta. A gente é uma metalúrgica e fabrica ${s.itens}. Queria ajudar com a reposição: o que mais acaba ou atrasa aí, e você participa da compra?`),
      },
      tips: {
        socio: "Dono quer resolver rápido e ter número: ofereça cotação ainda hoje e fale de prazo e valor. Seja direto.",
        compras: "Comprador quer cotação comparável: peça itens e quantidades e prometa prazo de resposta. Compare em itens, não em adjetivos.",
        gestor: "Gerente sabe o que falta; confirme se ele compra ou indica quem compra. Se participa, colete itens e quantidades.",
      },
    }),
    fala("desc_itens", "Descobrir a necessidade", T(
      "Show! Pra eu montar uma cotação certinha pra {empresa}: quais itens vocês mais compram e mais ou menos quanto por mês? Se tiver a lista dos de maior giro, já me ajuda bastante.",
      "Ótimo. Para montar uma cotação adequada para a {empresa}: quais itens a empresa mais compra e aproximadamente quanto por mês? Se tiver a lista dos de maior giro, já me ajuda bastante.",
      "Show! Pra eu montar uma cotação certinha pra {empresa}: quais itens vocês mais compram e mais ou menos quanto por mês? Se tiver a lista dos de maior giro, já ajuda demais.",
    ), [o("Passou itens e quantidades", "enr_mix", "ok", "Passou itens e quantidades para a cotação"), o("Pediu a tabela de preços", "tabela"), o("Já tem fornecedor fechado", "obj_fornecedor", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Anote itens e quantidades: é isso que vira a cotação. Reaja ao que ele disser antes da próxima pergunta.", "pergunta"),
    fala("tabela", "Só a tabela", T(
      "Posso mandar a tabela, sim! Só que, sem saber o que vocês compram, ela vira um catálogo enorme e pouco útil. Se você me disser os três itens de maior giro, eu já te devolvo o valor com desconto ainda hoje. Pode ser?",
      "Posso enviar a tabela, sim. Porém, sem saber o que a empresa compra, ela se torna um catálogo extenso e pouco útil. Se me informar os três itens de maior giro, devolvo o valor com desconto ainda hoje. Pode ser?",
      "Mando a tabela sim! Só que, sem saber o que vocês compram, ela vira um catálogo enorme e pouco útil. Se você me disser os três itens de maior giro, eu já te devolvo o valor com desconto ainda hoje. Pode ser?",
    ), [o("Passou os itens", "enr_mix", "ok"), o("Quer só a tabela mesmo", "@cotacao", "neutro", "Pediu somente a tabela")], undefined, "proposta"),
    ...enriquece("conf_minimo", s.tipo, "vendas"),
    minimo("proposta"),
    fala("proposta", "Apresentar a proposta", T(
      "Com o que você me passou, eu monto a cotação ainda hoje. É linha premium, com prazo de entrega firme, e eu aplico 25% de desconto no pedido: o valor mínimo continua o mesmo, só que você leva mais produto por ele. Prefere receber por e-mail ou por WhatsApp?",
      "Com as informações que me passou, monto a cotação ainda hoje. É linha premium, com prazo de entrega firme, e aplicamos 25% de desconto no pedido: o valor mínimo se mantém, e a empresa leva mais produto. Prefere receber por e-mail ou por WhatsApp?",
      "Com o que você me passou, eu monto a cotação ainda hoje. É linha premium, com prazo de entrega firme, e eu dou 25% de desconto no pedido: o mínimo continua o mesmo, só que você leva mais produto. Prefere receber por e-mail ou por WhatsApp?",
    ), [o("Quer receber a cotação", "@cotacao", "ok", "Cotação enviada por e-mail ou WhatsApp"), o("Quer fechar já", "fechar", "ok"), o("Disse que é caro", "obj_preco", "objecao"), o("Quer pensar", "obj_pensar", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")], "Ofereça 25% primeiro, e só depois, se precisar, 26%. Depois de pedir o próximo passo, fique em silêncio e deixe ele responder.", "proposta"),
    fala("fechar", "Fechar o pedido", T(
      "Perfeito! Vou confirmar com você: itens, quantidades, forma de pagamento e endereço de entrega. Se estiver tudo certo, já abro o pedido agora. Pode ser?",
      "Perfeito. Vou confirmar com você: itens, quantidades, forma de pagamento e endereço de entrega. Estando tudo correto, abro o pedido agora. Pode ser?",
      "Perfeito! Vou confirmar com você: itens, quantidades, forma de pagamento e endereço de entrega. Se estiver tudo certo, já abro o pedido agora, tá bom?",
    ), [o("Confirmou tudo", "venda_extra", "ok"), o("Faltou ajustar algo", "proposta", "neutro"), o("Quer pensar mais um pouco", "obj_pensar", "objecao")], "Repita itens, valores e prazo em voz alta antes de abrir o pedido. Resolvida a dúvida, peça o fechamento de novo (Blount).", "fechamento"),
    fala("venda_extra", "Incluir mais itens", T(
      "Aproveitando que o pedido está aberto: tem mais algum item que costuma faltar aí? Dá pra incluir agora e já entra no desconto.",
      "Aproveitando que o pedido está aberto: há mais algum item que costuma faltar? É possível incluir agora, já com o desconto.",
      "Aproveitando que o pedido tá aberto: tem mais algum item que costuma faltar aí? Dá pra incluir agora e já entra no desconto!",
    ), [o("Incluiu mais itens", "@venda", "ok", "Pedido fechado com itens extras"), o("Só isso mesmo", "@venda", "ok", "Pedido confirmado na ligação")], "Quem acabou de decidir está aberto a complementar. Sugira um item ligado ao que ele comprou, sem insistir.", "fechamento"),
    fala("obj_pensar", "Quer pensar", T(
      "Claro, decisão importante a gente pensa mesmo! Pra eu te ajudar a decidir: o que você ainda precisa ver, o prazo, a condição de pagamento ou a garantia? Se quiser, a gente combina de conversar de novo daqui a dois dias.",
      "Claro, uma decisão importante merece reflexão. Para eu ajudar: o que ainda precisa avaliar, o prazo, a condição de pagamento ou a garantia? Se preferir, combinamos de conversar novamente em dois dias.",
      "Claro, decisão importante a gente pensa mesmo! Pra eu te ajudar nessa: o que você ainda quer ver, o prazo, o pagamento ou a garantia? Se quiser, a gente conversa de novo daqui a dois dias.",
    ), [o("Combinou o retorno", "@retorno", "ok", "Combinado retorno em 2 dias"), o("Disse o que falta decidir", "obj_menu", "neutro"), o("Não quer retorno", "@encerrar", "objecao")], "“Vou pensar” quase sempre esconde uma dúvida: descubra qual é, com calma, sem pressionar.", "objecao"),
    ...objecoes("proposta", "venda"),
  ];
  return { nodes, startId: "abertura" };
}

function retorno(s: Seg): { nodes: ScriptNode[]; startId: string } {
  const alvo: Alvo = { quem: "quem recebeu a nossa cotação", para: T("pra conversar sobre ela", "para conversar sobre ela", "pra bater um papo sobre ela"), gk: T("Estou ligando porque enviamos uma cotação para a empresa.", "Entro em contato porque enviamos uma cotação para a empresa.", "Tô ligando porque mandamos uma cotação pra empresa."), fecha: T("É coisa rápida. Quem cuida disso consegue falar agora?", "É um assunto breve. Quem cuida disso poderia me atender agora?", "É rapidinho. Dá pra chamar quem cuida disso?"), motivo: T("Estou retornando uma cotação que enviei pra empresa.", "Entro em contato para retomar uma cotação enviada à empresa.", "Tô retomando uma cotação que mandei pra empresa.") };
  const decisor = (note: string, _to: string) => [o("Já viu e está analisando", "duvidas", "ok", note), o("Ainda não viu", "reenviar"), o("Quer fechar", "fechar", "ok"), o("Achou caro", "obj_preco", "objecao"), o("Fechou com outro", "motivo", "objecao"), o("Outra dúvida ou objeção", "obj_menu", "objecao")];
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", T(
      "{saudacao}! Aqui é {meunome}, da Fey. Estou retornando a cotação que enviei pra {empresa}. Com quem eu falo, por favor?",
      "{saudacao}! Aqui é {meunome}, da Fey. Entro em contato para retomar a cotação enviada à {empresa}. Com quem tenho o prazer de falar?",
      "{saudacao}! Aqui é {meunome}, da Fey. Tô retomando a cotação que mandei pra {empresa}. Com quem eu falo?",
    ), [o("Disse quem é", "nome", "ok"), o("Vai transferir a ligação", "transferido", "ok"), o("Perguntou o assunto", "assunto"), o("Pessoa errada ou não trabalha mais aqui", "quem", "objecao"), o("Caixa postal, URA ou ninguém atendeu", "sem_resp")], "Ligue em até dois dias úteis depois do envio, no horário combinado. Quem cumpre o que prometeu ganha confiança. Mesmo esperando o contato certo, abra perguntando com quem fala: pode ser outra pessoa.", "abertura"),
    ...entrada("papel", s.itens, alvo, s.tipo),
    ...perfis({
      itens: s.itens, dor: s.dor, tipo: s.tipo, alvo, next: "duvidas", alcada: false, ok: decisor,
      falas: {
        socio: T("Que bom falar com você! Estou retornando a cotação que enviei pra {empresa}, como combinamos. Você já teve chance de olhar?", "Que bom falar com você. Retomo a cotação enviada à {empresa}, conforme combinamos. Já teve oportunidade de analisar?", "Que bom falar com você! Tô retomando a cotação que mandei pra {empresa}, como combinamos. Já deu pra dar uma olhada?"),
        compras: T("Perfeito, então é com você! Estou retornando a cotação que enviei pra {empresa}, como combinamos. Você já teve chance de olhar?", "Perfeito, então é com você. Retomo a cotação enviada à {empresa}, conforme combinamos. Já teve oportunidade de analisar?", "Perfeito, então é com você! Tô retomando a cotação que mandei pra {empresa}, como combinamos. Já deu pra dar uma olhada?"),
        gestor: T("Boa! Estou retornando a cotação que enviei pra {empresa}. Você participa dessa decisão? Já deu pra olhar?", "Ótimo. Retomo a cotação enviada à {empresa}. Você participa dessa decisão? Já pôde analisá-la?", "Boa! Tô retomando a cotação que mandei pra {empresa}. Você participa dessa decisão? Já deu pra olhar?"),
      },
      tips: {
        socio: "Quem decide quer ir ao ponto: pergunte se viu e qual a decisão. Se disser que está tudo certo, vá direto ao fechamento.",
        compras: "Comprador compara cotações: pergunte o que ficou de fora (itens, prazo, condição) e ofereça ajustar na hora.",
        gestor: "Descubra se ele participa da decisão; se não, peça para falar com quem recebeu a cotação.",
      },
    }),
    fala("duvidas", "Tirar dúvidas", T(
      "Que bom! E o que ficou mais em aberto pra você: os itens, o prazo ou a forma de pagamento? Se quiser, eu ajusto a cotação agora, enquanto a gente conversa.",
      "Que bom. E o que ficou mais em aberto: os itens, o prazo ou a forma de pagamento? Se desejar, ajusto a cotação agora, durante a conversa.",
      "Que bom! E o que ficou mais em aberto pra você: os itens, o prazo ou o pagamento? Se quiser, eu ajusto a cotação agora, enquanto a gente conversa.",
    ), [o("Sem dúvidas, vai fechar", "fechar", "ok"), o("Pediu um ajuste", "@cotacao", "neutro", "Pediu ajuste na cotação"), o("Dúvida sobre o produto", "duvida_tec", "neutro"), o("Ainda vai decidir", "prazo", "neutro"), o("Levantou uma objeção", "obj_menu", "objecao")], "Pergunta aberta, e depois silêncio. Se ele disser “está tudo certo”, vá direto ao fechamento.", "pergunta"),
    fala("duvida_tec", "Dúvida sobre o produto", T(
      `Boa pergunta! Em qual aplicação você vai usar? Assim eu confirmo direitinho se o ${s.um} serve, ou peço pro nosso time técnico te responder ainda hoje.`,
      `Boa pergunta. Em qual aplicação será usado? Assim confirmo se o ${s.um} atende, ou solicito ao nosso time técnico que responda ainda hoje.`,
      `Boa pergunta! Em qual aplicação você vai usar? Assim eu confirmo direitinho se o ${s.um} serve, ou peço pro nosso time técnico te responder ainda hoje.`,
    ), [o("Explicou a aplicação", "@retorno", "ok", "Dúvida técnica: confirmar com o time técnico e retornar"), o("Resolveu na hora", "fechar", "ok")], "Anote a aplicação com o máximo de detalhe. Nunca invente uma resposta técnica: confirme antes e retorne no prazo prometido.", "pergunta"),
    fala("reenviar", "Reenviar a cotação", T(
      "Sem problema! Reenvio agora, por e-mail e por WhatsApp. Posso te ligar daqui a dois dias, uns cinco minutinhos, pra gente conversar sobre ela?",
      "Sem problema. Reenvio agora, por e-mail e por WhatsApp. Posso ligar em dois dias, por cerca de cinco minutos, para conversarmos sobre ela?",
      "Sem problema! Reenvio agora, por e-mail e por WhatsApp. Posso te ligar daqui a dois dias, uns cinco minutinhos, pra gente bater um papo sobre ela?",
    ), [o("Combinado", "@retorno", "ok", "Cotação reenviada, retornar em 2 dias")], undefined, "apoio"),
    fala("fechar", "Fechar o pedido", T(
      "Que bom! Vou confirmar com você: itens, quantidades, forma de pagamento e endereço de entrega. Se estiver tudo certo, já abro o pedido agora.",
      "Que bom. Vou confirmar com você: itens, quantidades, forma de pagamento e endereço de entrega. Estando tudo correto, abro o pedido agora.",
      "Que bom! Vou confirmar com você: itens, quantidades, forma de pagamento e endereço de entrega. Se estiver tudo certo, já abro o pedido agora.",
    ), [o("Confirmou tudo", "@venda", "ok", "Pedido confirmado na ligação"), o("Faltou ajustar algo", "duvidas", "neutro")], "Repita itens, valores e prazo em voz alta antes de abrir o pedido.", "fechamento"),
    fala("prazo", "Combinar o retorno", T(
      "Sem pressa! Quando você acha que consegue me dar uma resposta? Eu anoto e te ligo exatamente nesse dia.",
      "Sem pressa. Quando acredita que poderá me dar uma resposta? Anoto e ligo exatamente nesse dia.",
      "Sem pressa! Quando você acha que dá pra me responder? Eu anoto e te ligo bem nesse dia.",
    ), [o("Deu uma data", "@retorno", "ok", "Retornar na data combinada"), o("Já tentei várias vezes sem resposta", "ret_ultima", "neutro")], undefined, "apoio"),
    fala("ret_ultima", "Última tentativa", T(
      "Pelo que vejo, talvez o momento não seja esse, e tudo bem. Vou deixar a cotação com você e não vou te incomodar mais por enquanto. Se mudar alguma coisa, é só me chamar neste número. Posso te procurar de novo daqui a um mês?",
      "Pelo que percebo, talvez este não seja o momento, e está tudo bem. Deixo a cotação com você, sem incomodar por ora. Se algo mudar, basta me contatar neste número. Posso entrar em contato novamente em um mês?",
      "Pelo jeito o momento não é esse, e tá tudo bem! Deixo a cotação com você e não te incomodo mais por enquanto. Se mudar alguma coisa, é só me chamar nesse número. Posso te procurar de novo daqui a um mês?",
    ), [o("Pode procurar em um mês", "@retorno", "neutro", "Sem resposta à cotação: procurar de novo em 1 mês"), o("Prefere encerrar", "@encerrar", "objecao", "Sem interesse na cotação")], "Mensagem de despedida (break-up): reconhece o silêncio, deixa a porta aberta e tira a pressão. É comum o lead responder justamente aqui. Faça só depois de várias tentativas.", "apoio"),
    fala("motivo", "Entender o motivo", T(
      "Agradeço por me avisar, é bom saber. Só pra eu melhorar: o que pesou mais, o preço, o prazo ou outra coisa? E posso te procurar de novo daqui a um mês?",
      "Agradeço por me avisar. Para eu melhorar: o que pesou mais, o preço, o prazo ou outro fator? E posso entrar em contato novamente em um mês?",
      "Valeu por me avisar, é bom saber! Só pra eu melhorar: o que pesou mais, o preço, o prazo ou outra coisa? E posso te procurar de novo daqui a um mês?",
    ), [o("Contou o motivo e permitiu novo contato", "@retorno", "neutro", "Fechou com outro: procurar de novo em 1 mês"), o("Encerrou a conversa", "@encerrar", "objecao", "Fechou com outro fornecedor")], "Registre o motivo no sistema: ele ajuda o time inteiro. Saia bem, sem insistir.", "pergunta"),
    ...objecoes("fechar", "venda"),
  ];
  return { nodes, startId: "abertura" };
}

/** 3. Fidelizadores: quem já compra (Televendas). */
function fidelizar(s: Seg): { nodes: ScriptNode[]; startId: string } {
  const alvo: Alvo = { quem: "quem cuida das compras com a Fey", para: T("pra saber como têm sido os pedidos", "para saber como têm sido os pedidos", "pra saber como têm sido os pedidos"), gk: T("A empresa já compra com a gente, e estou ligando só pra saber como estão as coisas.", "A empresa já é cliente, e entro em contato apenas para saber como estão as coisas.", "A empresa já compra com a gente, e tô ligando só pra saber como andam as coisas."), fecha: T("É coisa rápida. Quem cuida disso consegue falar agora?", "É um assunto breve. Quem cuida disso poderia me atender agora?", "É rapidinho. Dá pra chamar quem cuida disso?"), motivo: T("Estou ligando só pra saber como estão as coisas com a gente.", "Entro em contato apenas para saber como está o relacionamento com a Fey.", "Tô ligando só pra saber como andam as coisas com a gente.") };
  const decisor = (note: string, to: string) => [o("Atendeu e quer conversar", to, "ok", note), o("Está sem tempo agora", "obj_tempo", "objecao")];
  const bom = T("Que bom falar com você! Não estou ligando pra vender nada agora: queria saber como estão as coisas com a Fey e se posso ajudar em alguma coisa. Tem um minutinho?", "Que bom falar com você. Não ligo para vender nada agora: gostaria de saber como estão as coisas com a Fey e se posso ajudar em algo. Tem um minuto?", "Que bom falar com você! Não tô ligando pra vender nada agora: queria saber como andam as coisas com a Fey e se posso ajudar em algo. Tem um minutinho?");
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", T(
      "{saudacao}! Aqui é {meunome}, da Fey. Não estou ligando pra vender nada agora: só queria saber como estão as coisas com a gente. Com quem eu falo, por favor?",
      "{saudacao}! Aqui é {meunome}, da Fey. Não entro em contato para vender nada agora: apenas para saber como estão as coisas conosco. Com quem tenho o prazer de falar?",
      "{saudacao}! Aqui é {meunome}, da Fey. Não tô ligando pra vender nada agora: só queria saber como andam as coisas com a gente. Com quem eu falo?",
    ), [o("Disse quem é", "nome", "ok"), o("Vai transferir a ligação", "transferido", "ok"), o("Perguntou o assunto", "assunto"), o("Pessoa errada ou não trabalha mais aqui", "quem", "objecao"), o("Está sem tempo agora", "obj_tempo", "objecao"), o("Caixa postal, URA ou ninguém atendeu", "sem_resp")], "Cliente que compra precisa sentir que é lembrado, e não só cobrado. Abra com interesse sincero e pegue o nome: quem comprou pode já ter saído da empresa.", "fideliza"),
    ...entrada("papel", s.itens, alvo, s.tipo),
    ...perfis({
      itens: s.itens, dor: s.dor, tipo: s.tipo, alvo, next: "fid_continua", alcada: false, ok: decisor,
      falas: {
        socio: bom,
        compras: bom,
        gestor: T("Que bom falar com você! Queria saber como estão as coisas com a Fey, principalmente entrega e produto. Você acompanha isso aí?", "Que bom falar com você. Gostaria de saber como estão as coisas com a Fey, principalmente entrega e produto. Você acompanha isso?", "Que bom falar com você! Queria saber como andam as coisas com a Fey, principalmente entrega e produto. Você acompanha isso aí?"),
      },
      tips: {
        socio: "Cliente antigo gosta de ser lembrado pelo dono da fábrica: tom caloroso, sem pressa de vender.",
        compras: "Comprador do dia a dia é quem mais fala das entregas: escute o que funciona e o que não funciona.",
        gestor: "Quem usa o produto sabe a verdade sobre a qualidade: pergunte como o item se comporta na prática.",
      },
    }),
    fala("fid_continua", "Continua comprando?", T(
      "Que bom falar com você! Me conta: vocês continuam comprando com a Fey? Como tem sido a experiência com os produtos e com a entrega?",
      "Que bom falar com você. Poderia me contar: vocês continuam comprando com a Fey? Como tem sido a experiência com os produtos e com a entrega?",
      "Que bom falar com você! Me conta: vocês seguem comprando com a Fey? Como tem sido a experiência com os produtos e com a entrega?",
    ), [o("Sim, segue comprando normalmente", "fid_nps", "ok", "Continua comprando com a Fey"), o("Está comprando menos que antes", "fid_motivo", "neutro", "Reduziu as compras"), o("Parou de comprar", "fid_motivo", "objecao", "Parou de comprar"), o("Está comprando de outro fornecedor", "obj_concorrente", "objecao", "Comprando de outro fornecedor")], "Escute com atenção. Queixa bem recebida vira fidelidade; rotule o que ouvir: “parece que o prazo te incomodou”.", "fideliza"),
    fala("fid_nps", "Nota de 0 a 10", T(
      "Que bom! Uma pergunta rápida: de 0 a 10, o quanto você recomendaria a Fey pra outra empresa? E o que faria essa nota subir?",
      "Que bom. Uma pergunta rápida: de 0 a 10, o quanto recomendaria a Fey a outra empresa? E o que faria essa nota aumentar?",
      "Que bom! Uma perguntinha rápida: de 0 a 10, o quanto você indicaria a Fey pra outra empresa? E o que faria essa nota subir?",
    ), [o("Nota 9 ou 10", "fid_indica", "ok", "Satisfeito (nota 9 ou 10): pedir indicação"), o("Nota 7 ou 8", "fid_duvidas", "neutro", "Nota 7 ou 8: descobrir o que falta"), o("Nota 6 ou menos", "fid_motivo", "objecao", "Nota 6 ou menos: entender o motivo")], "Pergunta de recomendação (NPS): 9 e 10 são promotores e é a hora de pedir indicação; 7 e 8 mostram o que melhorar; até 6 pede atenção e escuta. Anote a nota e o comentário.", "fideliza"),
    fala("fid_motivo", "Entender a mudança", T(
      "Agradeço por contar, de verdade. O que mudou desde a última compra: foi preço, prazo, algum problema com o produto, ou o volume mesmo que caiu?",
      "Agradeço por contar. O que mudou desde a última compra: preço, prazo, algum problema com o produto, ou foi o volume que diminuiu?",
      "Valeu por contar, de verdade! O que mudou desde a última compra: foi preço, prazo, algum problema com o produto, ou o volume mesmo que caiu?",
    ), [o("Foi preço", "obj_preco", "objecao", "Motivo da queda: preço"), o("Foi prazo ou entrega", "obj_prazo", "objecao", "Motivo da queda: prazo de entrega"), o("Teve problema com produto", "fid_tecnica", "objecao", "Motivo da queda: problema com produto"), o("O volume caiu mesmo", "fid_reposicao", "neutro", "Motivo da queda: menos necessidade")], undefined, "fideliza"),
    fala("fid_duvidas", "Dúvidas pendentes", T(
      "Que bom ouvir isso! E tem alguma coisa pendente com a gente, sobre produto, pedido ou entrega? Se tiver, eu resolvo agora.",
      "Que bom ouvir isso. Há alguma pendência conosco, sobre produto, pedido ou entrega? Se houver, resolvo agora.",
      "Que bom ouvir isso! E tem alguma coisa pendente com a gente, sobre produto, pedido ou entrega? Se tiver, eu resolvo agora mesmo.",
    ), [o("Sem dúvidas", "fid_reposicao", "ok"), o("Dúvida sobre produto", "fid_tecnica", "neutro", "Dúvida sobre produto"), o("Dúvida sobre pedido ou entrega", "fid_pedido", "neutro", "Dúvida sobre pedido ou entrega")], undefined, "fideliza"),
    fala("fid_tecnica", "Dúvida ou problema técnico", T(
      "Pode me explicar em qual aplicação foi e o que aconteceu? Assim eu levo pro nosso time técnico e te retorno ainda hoje, sem enrolação.",
      "Poderia explicar em qual aplicação foi e o que ocorreu? Assim encaminho ao nosso time técnico e retorno ainda hoje.",
      "Me explica em qual aplicação foi e o que aconteceu? Assim eu levo pro nosso time técnico e te retorno ainda hoje, sem enrolação.",
    ), [o("Explicou o caso", "@retorno", "ok", "Caso técnico: acionar o time técnico e retornar hoje"), o("Resolveu na hora", "fid_reposicao", "ok")], "Anote tudo e acione o time técnico. Nunca invente uma resposta técnica: confirme e retorne no prazo prometido.", "fideliza"),
    fala("fid_pedido", "Pedido ou entrega", T(
      "Me passa o número do pedido ou a data, que eu verifico agora e já te digo o que aconteceu.",
      "Poderia me informar o número do pedido ou a data? Verifico agora e já lhe digo o que ocorreu.",
      "Me passa o número do pedido ou a data, que eu confiro agora e já te conto o que rolou.",
    ), [o("Passou os dados", "@retorno", "ok", "Verificar pedido ou entrega e retornar"), o("Resolveu na hora", "fid_reposicao", "ok")], undefined, "fideliza"),
    fala("fid_reposicao", "Oferecer reposição", T(
      `Pra vocês não serem pegos de surpresa: quer que eu já monte a reposição dos itens que mais giram? Eu aplico 25% de desconto no pedido, e o mínimo é de ${NEXT} do segundo pedido em diante, então você leva bastante produto.`,
      `Para que a empresa não seja surpreendida: deseja que eu já monte a reposição dos itens que mais giram? Aplico 25% de desconto no pedido, e o mínimo é de ${NEXT} do segundo pedido em diante, de modo que vocês levam bastante produto.`,
      `Pra vocês não serem pegos de surpresa: quer que eu já monte a reposição dos itens que mais giram? Eu dou 25% de desconto no pedido, e o mínimo é de ${NEXT} do segundo pedido em diante, então você leva bastante produto.`,
    ), [o("Quer repor agora", "fid_indica", "ok", "Reposição fechada na ligação"), o("Quer ver novidades do catálogo", "fid_catalogo", "ok"), o("Vai precisar mais pra frente", "fid_indica", "neutro", "Retornar para a próxima reposição"), o("Levantou uma objeção", "obj_menu", "objecao")], "Pergunte o que está acabando e sugira itens complementares: quem já compra tende a comprar mais.", "proposta"),
    fala("fid_catalogo", "Apresentar novidades", T(
      `Olha, temos itens como ${s.itens}, além de peças especiais que combinam com o que vocês já compram. Posso te mandar o catálogo atualizado e uma sugestão de itens pro seu perfil. Prefere por e-mail ou por WhatsApp?`,
      `Temos itens como ${s.itens}, além de peças especiais que combinam com o que vocês já compram. Posso enviar o catálogo atualizado e uma sugestão de itens para o seu perfil. Prefere por e-mail ou por WhatsApp?`,
      `Olha, temos itens como ${s.itens}, além de peças especiais que combinam com o que vocês já compram. Posso te mandar o catálogo atualizado e uma sugestão de itens pro seu perfil. Prefere por e-mail ou por WhatsApp?`,
    ), [o("Quer receber o catálogo", "@retorno", "ok", "Enviar catálogo e sugestão de itens"), o("Quer um pedido com novidades", "@venda", "ok", "Pedido com itens novos"), o("Agora não", "@retorno", "neutro", "Retornar em outro momento")], undefined, "proposta"),
    fala("fid_indica", "Pedir indicação", T(
      "Antes de desligar, uma última coisa, e fica à vontade pra dizer que não: você conhece alguém, de outra empresa, que também sofre com falta de parafuso ou prazo? Se quiser, eu ligo e digo que foi você quem indicou.",
      "Antes de encerrar, uma última coisa, e fique à vontade para dizer que não: você conhece alguém, de outra empresa, que também enfrente falta de parafusos ou problemas de prazo? Se desejar, entro em contato e menciono que foi você quem indicou.",
      "Antes de desligar, uma última coisinha, e fica à vontade pra dizer que não: você conhece alguém, de outra empresa, que também sofre com falta de parafuso ou prazo? Se quiser, eu ligo e digo que foi você quem indicou!",
    ), [o("Indicou alguém", "@venda", "ok", "Indicação recebida: anotar nome e telefone"), o("Agora não lembra de ninguém", "@retorno", "neutro", "Retornar em outro momento"), o("Prefere não indicar", "@encerrar", "neutro")], "Indicação é o jeito mais barato de prospectar: cliente satisfeito indica. Peça com leveza e anote nome e telefone na observação.", "fideliza"),
    ...objecoes("fid_reposicao", "venda"),
  ];
  return { nodes, startId: "abertura" };
}

function build(goal: ScriptGoal, segment: string) {
  const s = SEG[segment] ?? SEG.geral;
  return goal === "sdr" ? sdr(s) : goal === "vendas" ? vendas(s) : goal === "retorno" ? retorno(s) : fidelizar(s);
}

/** Cada final aponta para o desfecho do objetivo (um nó "fim" por resultado). Torna a árvore fechada e sem becos. */
function close(_goal: ScriptGoal, nodes: ScriptNode[], startId: string) {
  const ends: Record<string, ScriptNode> = {
    visita: fim("fim_visita", "Conversa agendada", T("Boa! Confirme o dia, o horário e o formato (presencial ou online) e registre a visita no sistema.", "Muito bem. Confirme o dia, o horário e o formato (presencial ou online) e registre a visita no sistema.", "Boa, mandou bem! Confirme o dia, o horário e o formato (presencial ou online) e registre a visita no sistema."), "visita"),
    cotacao: fim("fim_cotacao", "Cotação a enviar", T("Boa! Envie a cotação ainda hoje e deixe o retorno combinado.", "Muito bem. Envie a cotação ainda hoje e deixe o retorno combinado.", "Boa! Manda a cotação ainda hoje e deixa o retorno combinado."), "cotacao"),
    venda: fim("fim_venda", "Venda fechada", T("Excelente! Confirme itens, condições e prazo, e abra o pedido.", "Excelente. Confirme itens, condições e prazo, e abra o pedido.", "Show, parabéns! Confirma itens, condições e prazo, e abre o pedido."), "venda"),
    retorno: fim("fim_retorno", "Retorno combinado", T("Combinado! Anote o dia e o horário do retorno na observação.", "Combinado. Anote o dia e o horário do retorno na observação.", "Combinado! Anota o dia e o horário do retorno na observação."), "retorno"),
    encerrar: fim("fim_encerrar", "Conversa encerrada", T("Tudo bem, faz parte. Agradeça, registre o motivo e passe para o próximo lead.", "Tudo bem, faz parte. Agradeça pela atenção, registre o motivo e siga para o próximo lead.", "Sem estresse, faz parte! Agradece, registra o motivo e bora pro próximo lead."), "encerrar"),
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
let checkedAt = 0;
export async function ensureGlobalScripts(): Promise<void> {
  if (Date.now() - checkedAt < 600_000) return; // já conferido há pouco neste servidor: poupa duas idas ao banco por visita
  const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from scripts where seed_key is not null`);
  const [{ v }] = await db.execute<{ v: number }>(sql`select coalesce((select (value #>> '{}')::int from settings where key = 'scripts_seed_v'), 0) as v`);
  const expected = Object.keys(GOALS).length * Object.keys(SEGMENTS).length;
  if (n >= expected && v >= SEED_VERSION) { checkedAt = Date.now(); return; }
  for (const b of buildAll()) {
    const title = `${GOALS[b.goal].label.split(" (")[0]} · ${SEGMENTS[b.segment]}`;
    await db.insert(scripts).values({ seedKey: b.key, ownerId: null, title, segment: b.segment, goal: b.goal, summary: GOALS[b.goal].hint, nodes: b.nodes, startId: b.startId }).onConflictDoNothing();
    if (v < SEED_VERSION) await db.execute(sql`update scripts set title = ${title}, summary = ${GOALS[b.goal].hint}, nodes = ${JSON.stringify(b.nodes)}::jsonb, start_id = ${b.startId} where seed_key = ${b.key} and updated_at <= created_at + interval '2 seconds'`);
  }
  await db.execute(sql`insert into settings (key, value) values ('scripts_seed_v', ${String(SEED_VERSION)}::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()`);
  checkedAt = Date.now();
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
