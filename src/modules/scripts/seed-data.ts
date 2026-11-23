import type { ScriptNode } from "@/config/scripts";

/**
 * Liga os roteiros de fábrica aos dados do lead: respostas que gravam sozinhas (fact) e perguntas extras (ask).
 * As chaves são as de config/facts.ts. O Adm pode ajustar isso por passo, no editor do roteiro.
 */
type OptRule = { node: RegExp; label: RegExp; key: string; value: string };
const OPT: OptRule[] = [
  { node: /^enr_conhece$/, label: /^É ou já foi cliente/, key: "ja_cliente", value: "É ou já foi cliente" },
  { node: /^enr_conhece$/, label: /distribuidor/, key: "ja_cliente", value: "Compra por um distribuidor" },
  { node: /^enr_conhece$/, label: /^Não conhece/, key: "ja_cliente", value: "Nunca comprou" },
  { node: /^enr_mix$/, label: /^Mix variado/, key: "mix", value: "Mix variado de itens" },
  { node: /^enr_mix$/, label: /^Poucos itens/, key: "mix", value: "Poucos itens específicos" },
  { node: /^enr_mix$/, label: /^Só um item/, key: "mix", value: "Só um item" },
  { node: /^enr_aplicacao$/, label: /^(Um pouco de tudo|Mais de uma aplicação)$/, key: "aplicacao", value: "Mais de uma aplicação" },
  { node: /^enr_freq$/, label: /^Toda semana$/, key: "frequencia", value: "Toda semana" },
  { node: /^enr_freq$/, label: /^Todo mês$/, key: "frequencia", value: "Todo mês" },
  { node: /^enr_freq$/, label: /^A cada dois ou três meses$/, key: "frequencia", value: "A cada dois ou três meses" },
  { node: /^enr_freq$/, label: /^Só quando precisa$/, key: "frequencia", value: "Só quando precisa" },
  { node: /^enr_func$/, label: /^Até 5$/, key: "porte", value: "Até 5 funcionários" },
  { node: /^enr_func$/, label: /^De 6 a 20$/, key: "porte", value: "6 a 20" },
  { node: /^enr_func$/, label: /^De 21 a 100$/, key: "porte", value: "21 a 100" },
  { node: /^enr_func$/, label: /^Mais de 100$/, key: "porte", value: "Mais de 100" },
  { node: /^enr_quando$/, label: /^Esta semana$/, key: "quando", value: "Agora" },
  { node: /^enr_quando$/, label: /^Neste mês$/, key: "quando", value: "Nos próximos 30 dias" },
  { node: /^enr_quando$/, label: /^Nos próximos meses$/, key: "quando", value: "De 1 a 3 meses" },
  { node: /^enr_quando$/, label: /^Sem previsão$/, key: "quando", value: "Sem previsão" },
  { node: /^p_socio$/, label: /./, key: "decisor", value: "O dono" },
  // comprador nem sempre decide: só vira "quem decide" quando ele mesmo diz que decide sozinho
  { node: /^p_alcada$/, label: /^Decide sozinho/, key: "decisor", value: "O comprador" },
];
const APLICACAO = /^(Balcão e varejo|Oficinas e frotas|Indústrias e construtoras|Montagem do produto final|Manutenção das máquinas|Reposição e assistência técnica|Manutenção da própria frota|Serviço para clientes|Reposição e estoque)$/;

const ASK: { node: RegExp; ask: NonNullable<ScriptNode["ask"]> }[] = [
  { node: /^abertura$/, ask: [{ key: "atendimento", q: "Quem atendeu o telefone?" }] },
  { node: /^transferido$/, ask: [{ key: "papel", q: "Qual o papel dessa pessoa na compra?" }] },
  { node: /^enr_conhece$/, ask: [{ key: "fornecedor", q: "De quem compram hoje, se ele disser?" }] },
  { node: /^enr_freq$/, ask: [{ key: "volume", q: "Mais ou menos quanto compram por mês?" }] },
  { node: /^enr_quando$/, ask: [{ key: "melhor_horario", q: "Qual o melhor horário para falar com ele(a)?" }, { key: "canal_preferido", q: "E por onde prefere que eu chame?" }] },
];

export function withData(nodes: ScriptNode[]): ScriptNode[] {
  return nodes.map((n) => {
    const ask = ASK.find((a) => a.node.test(n.id))?.ask;
    return {
      ...n,
      ...(ask && n.type === "fala" ? { ask } : {}),
      options: n.options.map((x) => {
        if (x.fact) return x;
        const r = OPT.find((t) => t.node.test(n.id) && t.label.test(x.label) && (t.key !== "decisor" || x.kind === "ok"));
        if (r) return { ...x, fact: { key: r.key, value: r.value } };
        if (n.id === "enr_aplicacao" && APLICACAO.test(x.label)) return { ...x, fact: { key: "aplicacao", value: x.label } };
        return x;
      }),
    };
  });
}
