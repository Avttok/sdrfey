/** Guia de colunas mostrado nos exemplos de CSV: o que cada coluna significa e TODOS os valores que ela aceita. */
export type GuideCol = {
  col: string;
  required?: boolean;
  what: string;
  /** Valores aceitos, um por chip. Ex.: ["cotacao", "ganho"] */
  values?: string[];
  /** Explicação curta do formato quando não há lista fechada (data, dinheiro...). */
  format?: string;
  /** Outros nomes aceitos para a mesma coluna. */
  alias?: string[];
};

const YES_NO = ["SIM", "NAO"];

export const DEAL_GUIDE: GuideCol[] = [
  { col: "CNPJ", required: true, what: "Identifica o cliente. Com ou sem pontos.", format: "00.000.000/0001-91 ou 00000000000191" },
  { col: "EMPRESA", what: "Razão social. Se o CNPJ já existe, o cadastro atual é mantido.", alias: ["RAZAO SOCIAL", "CLIENTE", "NOME"] },
  { col: "CONTATO", what: "Nome da pessoa que atende.", alias: ["NOME CONTATO"] },
  { col: "TELEFONE", what: "Pode ter vários, separados por barra ou vírgula.", alias: ["TEL", "FONE", "CELULAR", "WHATSAPP"], format: "(47) 99999-0000" },
  { col: "EMAIL", what: "Um e-mail válido." },
  { col: "CIDADE", what: "Cidade do cliente." },
  { col: "UF", what: "Sigla do estado, com 2 letras.", alias: ["ESTADO"], format: "SC, SP, PR…" },
  { col: "COD SAP", what: "Código do cliente no SAP. Zeros à esquerda são ignorados.", alias: ["SAP", "CODIGO SAP"] },
  { col: "ETAPA", what: "Em que pé está a negociação. Vazio = o sistema deduz: com pedido ou data fechada vira ganho; com cotação vira cotação enviada; senão, em contato.", alias: ["STATUS", "SITUACAO", "FASE"],
    values: ["novo", "contato", "em contato", "prospeccao", "cotacao", "cotacao enviada", "orcamento", "negociacao", "ganho", "fechado", "vendido", "faturado", "perdido", "perdeu", "cancelado"] },
  { col: "FRETE", what: "Tipo de frete da cotação.", alias: ["ICOTERMS"], values: ["CIF", "FOB", "RED"] },
  { col: "CONDICAO DE PAGAMENTO", what: "Texto livre; condições novas são criadas na hora. Escreva igual às já cadastradas para não duplicar.", alias: ["PAGAMENTO", "COND PAGAMENTO"], format: "3X 35/63/91 DIAS" },
  { col: "N COTACAO", what: "Número da cotação enviada.", alias: ["NUMERO COTACAO", "COTACAO"] },
  { col: "DATA COTACAO", what: "Quando a cotação foi enviada.", format: "dd/mm/aaaa ou aaaa-mm-dd" },
  { col: "VALOR COTACAO", what: "Valor total da cotação, com impostos.", alias: ["VALOR TOTAL", "TOTAL"], format: "10.127,44 · R$ 10.127,44 · 10127,44" },
  { col: "VALOR SEM IMPOSTOS", what: "Valor líquido da cotação.", alias: ["VALOR LIQUIDO"], format: "mesmo formato do valor da cotação" },
  { col: "N PEDIDO", what: "Número do pedido (vendas).", alias: ["PEDIDO"] },
  { col: "DATA FECHADA", what: "Dia em que a venda foi fechada.", alias: ["DATA VENDA", "DATA FECHAMENTO"], format: "dd/mm/aaaa ou aaaa-mm-dd" },
  { col: "VALOR FECHADO", what: "Valor vendido.", alias: ["VALOR VENDA"], format: "10.127,44" },
  { col: "VALOR REAL", what: "Valor real faturado, se for diferente do fechado.", format: "10.127,44" },
  { col: "REATIVADO", what: "A venda reativou um cliente parado?", alias: ["REATIVACAO"], values: [...YES_NO, "S", "X", "1", "VERDADEIRO"] },
  { col: "MOTIVO PERDA", what: "Por que perdeu (só para etapa perdido).", alias: ["MOTIVO"], format: "texto livre" },
  { col: "PROXIMO CONTATO", what: "Quando voltar a falar com o cliente.", alias: ["RETORNO"], format: "dd/mm/aaaa" },
  { col: "OBSERVACAO", what: "Anotação livre que vai para o histórico.", alias: ["OBS", "ANOTACAO"] },
];

export const LEAD_GUIDE: GuideCol[] = [
  { col: "CNPJ", required: true, what: "Identifica a empresa. Com ou sem pontos.", format: "00.000.000/0001-91" },
  { col: "EMPRESA", what: "Razão social.", alias: ["RAZAO SOCIAL", "NOME"] },
  { col: "COD SAP", what: "Código do cliente no SAP.", alias: ["SAP"] },
  { col: "CODEOX", what: "Código EOX: número do perfil da empresa (o record= do link). É o que o sistema usa para ligar e qualificar.", alias: ["COD EOX", "CODIGO EOX", "IDEMPRESA", "RECORD"], format: "1293925" },
  { col: "IDEOX", what: "ID EOX: número que acha o cadastro no site da EOX (ex.: 117805). Não serve para ligar nem qualificar.", alias: ["ID EOX"], format: "117805" },
  { col: "IDSF", what: "Id da conta no Salesforce (15 ou 18 letras e números).", alias: ["ID SF", "ID SALESFORCE"] },
  { col: "CONTATO", what: "Nome de quem atende." },
  { col: "TELEFONE", what: "Pode ter vários, separados por barra ou vírgula.", alias: ["TEL", "FONE", "CELULAR"], format: "(47) 99999-0000" },
  { col: "CARGO", what: "Cargo do contato." },
  { col: "EMAIL", what: "Um e-mail válido." },
  { col: "OBSERVACAO", what: "Anotação livre.", alias: ["OBS"] },
  { col: "INTERESSE", what: "Temperatura do lead.", alias: ["TEMPERATURA"], values: ["FRIO", "MORNO", "QUENTE"] },
  { col: "MEIO", what: "Meio de contato já usado. Pode ter mais de um, separados por vírgula.", alias: ["MEIO DE CONTATO"], values: ["LIGACAO", "WHATSAPP", "WPP", "EMAIL", "PESSOALMENTE", "REPRESENTANTE", "BOT"] },
  { col: "QUALIFICADO", what: "Lead qualificado ou não.", values: ["SIM (qualificado)", "NAO (desqualificado)", "vazio (sem qualificação)"] },
  { col: "AGENDADO", what: "Tem visita agendada.", values: ["SIM", "vazio"] },
  { col: "SITUACAO", what: "Situação atual do lead. Pode ter mais de uma, separadas por vírgula.", values: ["SEM CONTATO", "ATENDENDO", "CONVERSANDO", "CLIENTE", "CONTABILIDADE", "INAPTA", "BAIXADA", "SUSPENSA", "TELEFONE ERRADO", "EMAIL ERRADO", "DADOS ERRADOS", "INEXISTENTE", "AUTO DESCARTE"] },
  { col: "OPSDR", what: "Nome do SDR responsável (o mesmo que está no sistema).", alias: ["RESPONSAVEL"], format: "nome do usuário" },
  { col: "VISITA", what: "Código ou texto da visita antiga.", format: "V-12345" },
  { col: "PORTE", what: "Porte da empresa.", format: "texto livre (ME, EPP, DEMAIS…)" },
  { col: "CAPITAL", what: "Capital social.", alias: ["CAPITAL SOCIAL"], format: "10.000,00" },
  { col: "ATT", what: "Data da última atualização.", format: "dd/mm/aaaa" },
  { col: "SHUFFLADO", what: "Marca que o lead já foi trabalhado.", values: ["SIM", "vazio"] },
];

export const REP_GUIDE: GuideCol[] = [
  { col: "ESC", what: "Escritório ou região do representante.", format: "ESC 01" },
  { col: "GESTOR", what: "Gestor responsável." },
  { col: "EQUIPE", what: "Equipe do representante." },
  { col: "COD SAP", required: true, what: "Código do representante no SAP.", alias: ["SAP"] },
  { col: "CNPJ", what: "CNPJ do representante." },
  { col: "ENDERECO", what: "Rua e número." },
  { col: "CEP", what: "CEP.", format: "89130-000" },
  { col: "CIDADE", what: "Cidade." },
  { col: "UF", what: "Sigla do estado.", format: "SC" },
  { col: "NOME REP", required: true, what: "Nome do representante.", alias: ["REPRESENTANTE", "NOME"] },
  { col: "ATIVO", what: "Se o representante está ativo. Vazio = ativo.", values: ["SIM", "NAO", "N", "0", "FALSE", "INATIVO"] },
];

export const CARRIER_GUIDE: GuideCol[] = [
  { col: "UF", required: true, what: "Estado a que a tabela de frete se refere.", alias: ["ESTADO"], format: "SC, SP, PR…" },
  { col: "TIPO", required: true, what: "Modalidade do frete.", alias: ["FRETE", "MODALIDADE"], values: ["CIF", "FOB", "RED"] },
  { col: "TRANSPORTADORA", required: true, what: "Nome da transportadora. Estado + tipo + nome identificam a linha: se já existir, ela é atualizada.", alias: ["NOME", "EMPRESA"] },
  { col: "% CAPITAL", what: "Percentual do frete para a capital.", alias: ["CAPITAL", "FRETE CAPITAL"], format: "3,5 ou 3,5%" },
  { col: "% INTERIOR", what: "Percentual do frete para o interior.", alias: ["INTERIOR", "FRETE INTERIOR"], format: "5,2 ou 5,2%" },
  { col: "DIAS CAPITAL", what: "Prazo de entrega na capital, em dias.", alias: ["PRAZO CAPITAL"], format: "número de 0 a 365" },
  { col: "DIAS INTERIOR", what: "Prazo de entrega no interior, em dias.", alias: ["PRAZO INTERIOR"], format: "número de 0 a 365" },
  { col: "FRETE MÍNIMO", what: "Valor mínimo do frete.", alias: ["MINIMO", "MIN"], format: "80,00" },
  { col: "CONTATO", what: "Nome ou telefone da transportadora.", alias: ["TELEFONE", "FONE"] },
  { col: "OBS", what: "Texto livre, como dia de coleta.", alias: ["OBSERVACAO", "OBSERVACOES"] },
];

/** Planilha de Empresas exportada da EOX (Admin → Integração com a EOX → Importar). */
export const EOX_EMPRESAS_GUIDE: GuideCol[] = [
  { col: "CNPJ", required: true, what: "Liga a linha ao lead. Linhas sem CNPJ válido são ignoradas.", format: "00.000.000/0001-91" },
  { col: "EMPRESA", required: true, what: "Nome da empresa. Também liga os Contatos à empresa (pelo nome, quando só há uma com aquele nome)." },
  { col: "IdEOX", what: "ID EOX: número que acha o cadastro no site da EOX (ex.: 117805). Não serve para ligar nem qualificar.", alias: ["ID EOX"], format: "117805" },
  { col: "Telefone", what: "Telefones da empresa (também lê Outro Telefone, Telefone Alternativo e WhatsApp).", format: "(47) 99999-0000" },
  { col: "Email", what: "E-mail da empresa.", alias: ["Email Alternativo"] },
  { col: "Nome Fantasia", what: "Entra se o lead ainda não tem (ou sempre, se marcar “sobrescrever”)." },
  { col: "Endereço / Número / Bairro / CEP / Cidade / Estado Faturamento", what: "Endereço de faturamento. Completa o que está vazio no lead." },
  { col: "Tipo", what: "Customer = cliente da Fey; Prospect = ainda não comprou. Aparece no retrato da EOX e define Vendas × Prospecção em leads criados.", values: ["Customer", "Prospect", "Lead"] },
  { col: "Discagens bloqueadas", what: "Sim = a EOX proíbe ligar. O Ligar pergunta antes e o sorteio pula o lead.", values: ["Sim", "Não"] },
  { col: "Motivo bloqueio", what: "Por que a discagem foi bloqueada." },
  { col: "Código Vendedor / Descrição Vendedor / Responsável", what: "Quem cuida do cliente na EOX." },
  { col: "Classificação ABC, Segmento, Porte, Avaliação", what: "Retrato do cliente na EOX." },
  { col: "Data/Valor Último Pedido e Faturamento, Ticket Médio, Recompra Média, Dias Venda, Situação Financeira, Saldo Devedor…", what: "Retrato de compras e financeiro, mostrado na ficha do lead e no telefone." },
];

/** Planilha de Contatos exportada da EOX. */
export const EOX_CONTATOS_GUIDE: GuideCol[] = [
  { col: "idEmpresa", required: true, what: "Código EOX: número do perfil da empresa (o record= do link). É o que o sistema usa para ligar e qualificar.", format: "1293925" },
  { col: "Nome Empresa", required: true, what: "Liga o contato à empresa da planilha de Empresas, pelo nome." },
  { col: "Nome", what: "Pessoa. Vira um contato do lead, sem duplicar." },
  { col: "Cargo", what: "Define o papel na compra (portaria, secretaria, comprador, dono…)." },
  { col: "Celular / Telefone Escritório / Residencial / Alternativo", what: "Telefones da pessoa. Quando você liga para o número, o telefone mostra quem costuma atender.", format: "(47) 99999-0000" },
  { col: "Email", what: "E-mail da pessoa." },
];
