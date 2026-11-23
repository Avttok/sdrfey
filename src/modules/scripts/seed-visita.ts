import type { ScriptNode } from "@/config/scripts";
import { T, fala, o } from "./seed-core";

/**
 * Roteiro de visita (para o SDR): confirmar a visita marcada, lembrar quem esqueceu, remarcar, falar depois que a visita aconteceu.
 * Serve para todos os tipos de cliente: o texto não depende do segmento.
 */
export function visita(): { nodes: ScriptNode[]; startId: string } {
  const nodes: ScriptNode[] = [
    fala("abertura", "Abertura", T(
      "{saudacao}, tudo bem? Aqui é {meunome}, da Fey. Estou ligando sobre a visita que combinamos com a {empresa}. Com quem eu falo, por favor?",
      "{saudacao}, tudo bem? Aqui é {meunome}, da Fey. Entro em contato a respeito da visita combinada com a {empresa}. Com quem tenho o prazer de falar?",
      "{saudacao}, tudo bem? Aqui é {meunome}, da Fey. Tô ligando sobre a visita que a gente combinou com a {empresa}. Com quem eu falo?",
    ), [o("Disse quem é", "v_confirma", "ok"), o("Perguntou que visita é essa", "v_lembra"), o("A visita já aconteceu", "v_pos", "ok"), o("Pessoa errada ou o contato não está", "v_horario", "neutro"), o("Está sem tempo agora", "v_horario", "objecao"), o("Caixa postal, URA ou ninguém atendeu", "v_wa")],
    "Abra pelo assunto: quem combinou a visita lembra rápido. Se a recepção atender, peça pela pessoa que marcou e diga que é sobre a visita combinada.", "abertura"),
    fala("v_confirma", "Confirmar a visita", T(
      "Que bom falar com você! Estou ligando só pra confirmar a visita que combinamos: o representante da Fey vai passar aí pra apresentar as nossas linhas e entender o que vocês mais usam. Continua bom pra vocês?",
      "É um prazer falar com você. Entro em contato para confirmar a visita combinada: o representante da Fey irá até a empresa para apresentar nossas linhas e entender o que mais utilizam. Segue conveniente para vocês?",
      "Que bom falar com você! Tô ligando só pra confirmar a visita que a gente combinou: o representante da Fey vai passar aí pra mostrar as nossas linhas e entender o que vocês mais usam. Continua bom pra vocês?",
    ), [o("Confirmou", "v_prep", "ok", "Visita confirmada pelo cliente"), o("Quer remarcar", "v_remarca", "neutro"), o("Não lembra da visita", "v_lembra"), o("Cancelou", "v_cancela", "objecao")],
    "Confirme com uma pergunta simples, que se responde com sim ou não. Visita confirmada de véspera falta bem menos.", "confirma"),
    fala("v_lembra", "Lembrar o combinado", T(
      "Claro! A visita foi combinada com a {empresa} pra o representante apresentar a linha de fixadores da Fey e ver como podemos ajudar na reposição de vocês. É rápida, uns vinte minutos, e sem compromisso: você mesmo julga se faz sentido. Ainda é um bom momento?",
      "Claro. A visita foi combinada com a {empresa} para que o representante apresente a linha de fixadores da Fey e avalie como podemos apoiar a reposição. É breve, cerca de vinte minutos, e sem compromisso: a avaliação é sua. Ainda é um bom momento?",
      "Claro! A visita foi combinada com a {empresa} pro representante mostrar a linha de fixadores da Fey e ver como a gente ajuda na reposição de vocês. É rapidinha, uns vinte minutos, e sem compromisso: você mesmo vê se vale. Ainda tá bom?",
    ), [o("Lembrou e confirmou", "v_prep", "ok", "Visita confirmada pelo cliente"), o("Quer remarcar", "v_remarca", "neutro"), o("Não tem interesse", "v_cancela", "objecao")],
    "Nunca insista em uma visita de quem não lembra de ter marcado. Explique o que é, quanto tempo leva e que não compromete.", "pergunta"),
    fala("v_prep", "Preparar a visita", T(
      "Perfeito! Pra visita render: quem vai receber o representante, você mesmo ou alguém de compras? E se puder deixar à mão o que vocês mais compram hoje, ele já chega com a sugestão certa. Vou te mandar a confirmação por WhatsApp, por escrito, pra ninguém esquecer.",
      "Perfeito. Para a visita ser proveitosa: quem receberá o representante, o senhor ou a senhora ou alguém de compras? Se possível, deixe à mão os itens que mais compram; assim ele traz a sugestão adequada. Enviarei a confirmação por escrito, por WhatsApp ou e-mail.",
      "Show! Pra visita render: quem vai receber o representante, você ou alguém de compras? Se puder deixar à mão o que vocês mais compram, ele já chega com a sugestão certa. Vou te mandar a confirmação no WhatsApp, por escrito, pra ninguém esquecer.",
    ), [o("Passou quem recebe e o canal", "@confirmada", "ok", "Visita confirmada: quem recebe e canal da confirmação anotados"), o("Pediu para mandar só por e-mail", "@confirmada", "ok", "Confirmação da visita por e-mail")],
    "Combine QUEM recebe e o canal da confirmação. Anote nome e telefone de quem vai receber e passe tudo ao representante.", "fechamento"),
    fala("v_remarca", "Remarcar a visita", T(
      "Sem problema, a gente ajusta! Qual dia e período ficam melhores pra vocês, de manhã ou à tarde? Eu aviso o representante e te confirmo a nova data por escrito.",
      "Sem problema, ajustamos. Qual dia e período são mais convenientes, manhã ou tarde? Avisarei o representante e confirmarei a nova data por escrito.",
      "Sem problema, a gente ajusta! Que dia e período ficam melhores, manhã ou tarde? Eu aviso o representante e te confirmo a nova data no WhatsApp.",
    ), [o("Combinou nova data", "@remarcada", "ok", "Visita remarcada: nova data combinada"), o("Ficou de avisar depois", "@retorno", "neutro", "Cliente vai avisar a melhor data para a visita"), o("Prefere cancelar", "v_cancela", "objecao")],
    "Remarcar é um bom resultado: o cliente ainda quer a visita. Feche dia e período na hora, sem deixar em aberto.", "proposta"),
    fala("v_cancela", "Cancelamento", T(
      "Tudo bem, agradeço por avisar! Só pra eu entender: foi o momento da empresa, ou o assunto não faz sentido pra vocês? Pergunto pra melhorar. Posso te procurar de novo daqui a um mês?",
      "Tudo bem, agradeço por avisar. Para eu compreender: foi o momento da empresa ou o assunto não faz sentido? Pergunto para aprimorarmos. Posso entrar em contato novamente em um mês?",
      "Tudo bem, valeu por avisar! Só pra eu entender: foi o momento da empresa, ou o assunto não faz sentido? Pergunto pra gente melhorar. Posso te procurar de novo daqui a um mês?",
    ), [o("Contou o motivo e permitiu novo contato", "@retorno", "neutro", "Visita cancelada: procurar de novo em 1 mês"), o("Encerrou a conversa", "@encerrar", "objecao", "Visita cancelada pelo cliente")],
    "Registre o motivo no sistema, e se foi o momento, combine voltar a falar. Saia bem, sem insistir.", "pergunta"),
    fala("v_horario", "Combinar outro horário", T(
      "Sem problema! Pra eu não atrapalhar: qual o nome da pessoa que combinou a visita e em que horário ela costuma estar por aí? Eu ligo bem nessa hora.",
      "Sem problema. Para não atrapalhar, poderia me informar o nome da pessoa que combinou a visita e o melhor horário para falar com ela? Retornarei nesse horário.",
      "Beleza! Pra eu não atrapalhar: como é o nome de quem combinou a visita e que horas ela costuma estar aí? Eu ligo bem nessa hora, combinado?",
    ), [o("Deu o nome e o horário", "@retorno", "ok", "Retornar no horário combinado para confirmar a visita")], "Anote nome, horário e quem informou. Na volta, abra com “a recepção me indicou este horário”.", "apoio"),
    fala("v_wa", "Mensagem de WhatsApp", T(
      "Mande no WhatsApp, logo depois da ligação: “Oi, tudo bem? Aqui é {meunome}, da Fey. Tentei falar com você sobre a visita que combinamos. Ela continua bom pra vocês? Se preferir, me diga por aqui o melhor dia e horário. Um abraço!”",
      "Envie no WhatsApp, logo depois da ligação: “{saudacao}! Aqui é {meunome}, da Fey. Tentei contato a respeito da visita combinada. Segue conveniente para vocês? Se preferir, informe por aqui o melhor dia e horário. Agradeço a atenção.”",
      "Mande no WhatsApp, logo depois da ligação: “Oi, tudo bem? Aqui é {meunome}, da Fey. Tentei te ligar sobre a nossa visita. Continua bom pra vocês? Se quiser, me fala aqui o melhor dia e horário. Valeu!”",
    ), [o("Mensagem enviada", "@retorno", "ok", "Visita: mensagem de WhatsApp enviada, aguardar resposta"), o("Não tem WhatsApp", "@retorno", "neutro", "Sem WhatsApp: tentar outro horário")], "Mensagem curta, uma pergunta só. Tente de novo em 2 a 3 dias, se não houver resposta.", "apoio"),
    fala("v_pos", "Depois da visita", T(
      "Que bom! Como foi a visita? O representante conseguiu mostrar o que vocês precisavam? Ficou alguma dúvida que eu possa resolver?",
      "Que bom. Como foi a visita? O representante conseguiu apresentar o que precisavam? Ficou alguma dúvida que eu possa esclarecer?",
      "Que bom! Como foi a visita? O representante conseguiu mostrar o que vocês precisavam? Ficou alguma dúvida que eu possa tirar?",
    ), [o("Gostou e quer cotação", "@cotacao", "ok", "Pós-visita: quer receber cotação"), o("Quer fechar um pedido", "@venda", "ok", "Pós-visita: quer fechar pedido"), o("Precisa de um tempo", "v_tempo", "neutro"), o("Teve um problema na visita", "v_problema", "objecao"), o("Sem interesse", "@encerrar", "objecao", "Pós-visita: sem interesse")],
    "Ligue em até dois dias depois da visita: o cliente ainda lembra da conversa. Escute primeiro; só então ofereça a cotação.", "pergunta"),
    fala("v_tempo", "Combinar o retorno", T(
      "Sem pressa! Quando você acha que consegue me dar uma posição? Eu anoto e te ligo exatamente nesse dia, e já te mando um resumo por escrito do que o representante apresentou.",
      "Sem pressa. Quando acredita que poderá me dar uma posição? Anoto e ligo exatamente nesse dia, e envio antes um resumo por escrito do que o representante apresentou.",
      "Sem pressa! Quando você acha que dá pra me dar uma posição? Eu anoto e te ligo bem nesse dia, e já te mando um resumo por escrito do que o representante mostrou.",
    ), [o("Combinou o dia do retorno", "@retorno", "ok", "Pós-visita: retorno combinado")], undefined, "fechamento"),
    fala("v_problema", "Problema na visita", T(
      "Sinto muito por isso, e agradeço por me contar. O que aconteceu? Quero entender pra resolver e passar ao responsável aqui.",
      "Lamento o ocorrido e agradeço por me informar. O que aconteceu? Gostaria de compreender para resolver e repassar ao responsável.",
      "Poxa, sinto muito, e valeu por me contar. O que rolou? Quero entender pra resolver e passar pro responsável aqui.",
    ), [o("Contou e aceitou novo contato", "@retorno", "neutro", "Problema na visita registrado: tratar e retornar"), o("Não quer mais contato", "@encerrar", "objecao", "Problema na visita: não quer mais contato")],
    "Escute sem defender. Registre exatamente o que foi dito e avise o gestor: um problema bem tratado vira confiança.", "objecao"),
  ];
  return { nodes, startId: "abertura" };
}
