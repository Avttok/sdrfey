# SDR Fey

Sistema de gestão e atendimento de leads para a equipe de SDR: sorteio de leads, atendimento guiado
(contatos → e-mail → WhatsApp → ligação → resultado), painel do gestor, registro de tudo que muda e
controle total do Adm (usuários, cargos, abas, tags, parâmetros, modelos de e-mail, modo teste).

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Drizzle ORM · Postgres (Neon) · Vercel.

## Rodar no computador

```bash
npm install
cp .env.example .env.local        # preencha DATABASE_URL e SESSION_SECRET
npm run db:setup                  # migrações + dados iniciais (idempotente)
npm run import:csv -- reps DB_RP.csv
npm run import:csv -- leads DB_LD.csv
npm run dev
```

Contas iniciais (senha `12345`, troca obrigatória no primeiro acesso): `ruan.carlos`, `suane.oliveira`,
`jaisson.dias`, `rejeane.uler`.

## Publicar na Vercel

1. Importe o repositório na Vercel.
2. **Storage → Create Database → Neon** (isso cria `DATABASE_URL` sozinho).
3. Em **Environment Variables** acrescente `SESSION_SECRET` (texto aleatório de 32+ caracteres) e,
   se quiser, `SEED_INITIAL_PASSWORD`.
4. Deploy. O build aplica as migrações e cria usuários, tags e modelo de e-mail iniciais.
5. Entre com o Adm e use **Importar** para subir `DB_RP.csv` e `DB_LD.csv`.

> O plano Hobby da Vercel é só para uso não comercial; para a empresa use o Pro.

## Como o código está organizado

- `src/modules/*` — regras de negócio, uma pasta por assunto (leads, tags, enrich, import, admin, audit…).
- `src/config/*` — o que se configura em código: cargos, **permissões**, menu, tags iniciais, cores.
- `src/app/(app)/*` — telas. `src/components/*` — peças de tela reutilizáveis.
- **Auditoria:** tudo que muda dados passa por `logAudit` ou `setLeadTags`. O teste
  `tests/audit-coverage.test.ts` falha se alguém criar uma alteração que não registra no histórico.
- **Permissões:** acrescentar uma linha em `src/config/permissions.ts` cria a opção na tela do Adm.
- **Datas:** sempre DD/MM/AAAA e horário de Brasília (`src/lib/format.ts`); no banco ficam em UTC.

## Testes

```bash
npm test      # os testes de banco rodam quando DATABASE_URL está definida
npm run typecheck
```
