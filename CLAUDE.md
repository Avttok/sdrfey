# SDR Fey — guia para o Claude Code

Gestão de leads para um time de ~5 pessoas (SDR, vendedores, gestores, Adm). Dono: Ruan (fala português do Brasil; responda sempre em português, curto e direto, e seja honesto sobre o que não foi verificado).

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Drizzle ORM · Postgres (Neon) · Vercel. Leia `AGENTS.md`: esta versão do Next tem mudanças; consulte `node_modules/next/dist/docs/` antes de usar APIs que você não conhece.

## Comandos
- `npm run dev` — servidor local (precisa de `.env.local`: `DATABASE_URL`, `SESSION_SECRET`; traga com `vercel env pull .env.local`).
- `npm run typecheck` — `tsc --noEmit`. `npm test` — vitest (os testes "banco real" precisam de um Postgres acessível por `DATABASE_URL`; use um banco de teste, nunca o de produção).
- `npm run build` — roda `scripts/setup.ts` (aplica as migrações e dados iniciais) e depois `next build`. Ou seja: **cada deploy aplica as migrações sozinho**.
- Antes de commitar: typecheck + testes + build. Commits em português, ao final: as linhas de atribuição pedidas pela sessão.

## Mapa
- `src/app/(app)/**` páginas (autenticadas), `src/app/(auth)/**` login, `src/app/api/**` rotas (cron em `api/cron/*`, agendadas em `vercel.json`).
- `src/modules/<área>/` regra de negócio e server actions (`leads`, `lists`, `sales`, `deals`, `eox`, `enrich`, `vocall`, `notifications`…). `src/config/` listas, textos e constantes (puros, sem banco, usados também no navegador).
- `src/components/` UI. `src/db/schema.ts` esquema Drizzle; `drizzle/` migrações SQL + `meta/_journal.json`.
- Tema: `theme-kit` (`glass`, `Mark`, `Tile`, `StatRow`, `Panel`) e `PageHead` com `hex`/`stats`. Novas telas seguem o cartão de vidro com cor própria, ícone-marca d'água e tile em degradê.

## Armadilhas (já nos pegaram)
- **Migrações:** o campo `when` do `_journal.json` precisa ser MAIOR que o da última migração aplicada, senão o Drizzle a ignora em silêncio. Escreva SQL idempotente à mão (`IF NOT EXISTS`); `drizzle-kit generate` já gerou desvio indevido. Última: `0068_check_number`.
- **Menus, calendários e janelas:** `.card-surface` usa `backdrop-filter`, que PRENDE qualquer descendente `position: fixed` e é cortado por `overflow-hidden`. Popups vão em portal: use `components/floating.tsx` (menus/listas/calendário, ancorado ao botão) e `components/portal.tsx` (janelas, barras, painéis). Nunca ponha `absolute`/`fixed` de popup dentro de um cartão. Ao mover para portal, o "clicar fora" não pode fechar por clique dentro do portal.
- **Docks laterais** (CNPJ e EOX): os dois ficam `pointer-events-none`; só o botão e o painel aberto recebem clique, senão um cobre o outro.
- **Postgres local** cai entre chamadas no ambiente de nuvem: religue antes de rodar testes.

## Domínios importantes
- **Shufflers** (Prospecção em `/atender`, Vendas em `/shuffler-vendas`): `claimNext`/`claimInactive` sorteiam; se a pessoa tem lista ativa, o próximo sai DELA. Lead atendido/descartado (ou trabalhado no Vendas) sai da lista (`leaveLists`); pular/devolver mantém. Cartas de lista: a do meio fica na frente.
- **Contatos:** `lead_channels` (`wrong` = inválido; `check_number` = "Conferir número", marca para revisar sem invalidar). Resultados de toque em `config/touches.ts`, menu em `components/result-menu.tsx`.
- **Atalhos do lead:** `components/lead-links.tsx` (EOX, Salesforce, site, redes) mostra só o que está salvo, nunca botão vazio.
- **EOX** (CRM Vtiger em fey.vocallcontact.com.br; webservice getchallenge + login md5, query, describe). Campos reais da conta: `cnpj`, `id_erp_original` (ID EOX), `accountname`, etc. `healConfig` troca campo configurado inexistente por esses. `leads.eoxId` = número do cadastro (record, ≥7 dígitos, abre o perfil e vira `parent_id`); `eoxCode` = ID EOX (ERP); botão EOX só aparece com `eoxId` válido. Consulta em `src/modules/eox/consult*.ts`: lista de filas em `config/eox-lists.ts`, consulta contínua roda no navegador de quem iniciou (dock) até o Adm parar; lead pesquisado (`eoxCheckedAt`) não volta à fila, só por repesquisa ("Atualizar leads EOX (todos)", listas por idade, botão "Repesquisar" no lead). Admin → Consulta EOX tem "Testar um cliente".
- **Consulta de CNPJ** (enriquecimento BrasilAPI/ReceitaWS/etc.): `src/modules/enrich`, dock próprio.
- **VocallPhone/EOX na ligação:** `src/modules/vocall`, `components/vocall-provider.tsx`; link de qualificação usa `parent_id` = cadastro da EOX.

## Não verificado
APIs externas reais (EOX, VocallPhone, BrasilAPI) nunca puderam ser testadas do ambiente de nuvem; só com respostas simuladas. Diga isso ao relatar mudanças nelas. Arquivos sem uso conhecido: `components/call-result-menu.tsx`, `role-permissions.tsx`.
