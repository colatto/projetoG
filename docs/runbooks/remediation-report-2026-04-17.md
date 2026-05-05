# Relatório executivo de remediação

Data de referência: 2026-04-17

## Resumo executivo

- `apps/api` e `workers` não falham mais em `eslint .`; o problema operacional atual do `pnpm -r run lint` está em `apps/web`.
- O CI também falha em `pnpm run format:check` por 6 arquivos em `workers`, o que caracteriza dívida de estilo separada do lint.
- O `pnpm audit` caiu de 12 achados em 12 caminhos afetados para 3 achados moderados em 3 caminhos, todos restritos ao toolchain de teste (`vitest > vite > esbuild`).
- Os testes de regressão passaram em `apps/api` e `workers` após as atualizações de segurança.
- O build continua quebrando em `apps/api` e `workers` por erros de tipagem Supabase já existentes no worktree atual.
- Os segredos ativos locais não estão versionados, mas há arquivos `.env.example` versionados com valores não-placeholder que devem ser tratados como comprometidos.

## 1. Lint e qualidade

### Estado observado

- `pnpm --filter @projetog/api run lint`: sucesso
- `pnpm --filter @projetog/workers run lint`: sucesso
- `pnpm -r run lint`: falha em `apps/web`, não em `apps/api`/`workers`
- `pnpm run format:check`: falha em:
  - `workers/src/jobs/process-webhook.ts`
  - `workers/src/jobs/sienge-reconcile.test.ts`
  - `workers/src/jobs/sienge-reconcile.ts`
  - `workers/src/jobs/sync-deliveries.ts`
  - `workers/src/jobs/sync-orders.ts`
  - `workers/src/jobs/sync-quotations.ts`

### Causa raiz

- Em `apps/api` e `workers`, a configuração ESLint é mínima e não tipada:
  - usa `@eslint/js` + `typescript-eslint` recomendado
  - usa `eslint-config-prettier`
  - não usa regras type-aware (`recommendedTypeChecked`)
  - não usa plugins de segurança, `import`, `n`, ou regras específicas de Fastify/Node
- Isso faz o lint atual aprovar código que ainda quebra no `tsc`.
- Há supressões locais de `@typescript-eslint/no-explicit-any`:
  - `apps/api/src/modules/webhooks/webhooks.controller.ts`
  - `workers/src/handlers/index.ts`
- O pipeline mistura qualidade sem alinhamento forte:
  - `lint` cobre apenas ESLint
  - `format:check` cobre Prettier separadamente
  - `build` cobre tipagem real

### Conflitos ESLint x Prettier

- Não há conflito direto de regras hoje.
- `eslint-config-prettier` desabilita regras de estilo conflitantes.
- O projeto não usa `eslint-plugin-prettier`, então formatação não entra no `lint`.
- O risco real não é conflito de regra, e sim cobertura incompleta: `lint` passa enquanto `format` e `build` falham.

### Severidade

- Erro crítico:
  - Falha do lint recursivo do monorepo em `apps/web`
  - Falha do `tsc` em `apps/api` e `workers`
- Aviso:
  - Uso de `any` suprimido
  - Ausência de lint type-aware
- Estilo:
  - 6 arquivos do worker fora do padrão Prettier

### Plano prioritário

1. Corrigir `apps/web` para destravar `pnpm -r run lint`
2. Corrigir os erros `tsc` em `apps/api` e `workers`
3. Promover `typescript-eslint` para regras type-aware por workspace
4. Adicionar `--max-warnings=0` ao lint de CI
5. Manter Prettier fora do lint, mas exigir `format:check` no merge

## 2. Vulnerabilidades

### Resultado antes e depois

- Antes: 12 achados em 12 caminhos afetados
- Depois: 3 achados moderados em 3 caminhos afetados
- Remanescentes:
  - `esbuild` moderado, CVSS 5.3, via `apps/api > vitest > vite > esbuild`
  - `vite` moderado, 2 caminhos, via `apps/api > vitest > vite` e `workers > vitest > vite`

### Achados avaliados

1. `fast-jwt` `GHSA-mvf2-f6gm-w987` / `CVE-2026-34950`, crítico, CVSS 9.1
   Risco: confusão de algoritmo com chave pública RSA prefixada por whitespace.
   Impacto no projeto: baixo na configuração atual, porque a API usa segredo HMAC e não chave pública PEM.
   Remediação: upgrade para `@fastify/jwt@10` + override `fast-jwt@6.2.1` + verificação explícita de `HS256`.

2. `fast-jwt` `GHSA-rp9m-7r4c-75qg` / `CVE-2026-35039`, crítico, CVSS 9.1
   Risco: colisão em `cacheKeyBuilder` pode misturar identidade e autorização.
   Impacto no projeto: não aplicável hoje, porque o projeto não usa cache customizado de verificação.
   Remediação: override `fast-jwt@6.2.1`.

3. `fast-jwt` `GHSA-hm7r-c7qw-ghp6` / `CVE-2026-35042`, alto, CVSS 7.5
   Risco: aceitação de `crit` headers desconhecidos.
   Impacto no projeto: aplicável a qualquer `jwtVerify()`.
   Remediação: upgrade para `fast-jwt@6.2.1` e mitigação adicional em código rejeitando `crit` não suportado antes do verify.

4. `fastify` `GHSA-247c-9743-5963` / `CVE-2026-33806`, alto, CVSS 7.5
   Risco: bypass de validação de `schema.body.content` com espaço em `Content-Type`.
   Impacto no projeto: aplicável, porque a API usa validação de schema em rotas HTTP.
   Remediação: upgrade `fastify` de `5.8.4` para `5.8.5`.

5. `fast-jwt` `GHSA-cjw9-ghj4-fwxf` / `CVE-2026-35041`, moderado, CVSS 4.2
   Risco: ReDoS quando `allowed*` usa regex custosa.
   Impacto no projeto: não aplicável na configuração atual.
   Remediação: override `fast-jwt@6.2.1`.

6. `fast-jwt` `GHSA-3j8v-cgw4-2g6q` / `CVE-2026-35040`, moderado, CVSS 5.3
   Risco: regex com `/g` ou `/y` causa falha intermitente de autenticação.
   Impacto no projeto: não aplicável hoje.
   Remediação: override `fast-jwt@6.2.1`.

7. `@fastify/static` `GHSA-pr96-94w5-mx2h` / `CVE-2026-6410`, moderado, CVSS 5.3
   Risco: path traversal em listagem de diretório.
   Impacto no projeto: baixo, porque `swagger-ui` não depende de listagem pública, mas o pacote vulnerável estava no grafo.
   Remediação: override `@fastify/static@9.1.1`.

8. `@fastify/static` `GHSA-x428-ghpx-8j92` / `CVE-2026-6414`, moderado, CVSS 5.9
   Risco: bypass de guardas de rota com `%2F`.
   Impacto no projeto: baixo a moderado.
   Remediação: override `@fastify/static@9.1.1`.

9. `follow-redirects` `GHSA-r4q5-vmmm-2653`, moderado
   Risco: vazamento de headers de autenticação customizados em redirect cross-domain.
   Impacto no projeto: mais relevante em Node/SSR do que no browser puro, mas a dependência estava vulnerável no grafo.
   Remediação: override `follow-redirects@1.16.0`.

10. `esbuild` `GHSA-67mh-4wv8-2f99`, moderado, CVSS 5.3
    Risco: qualquer site pode ler respostas do dev server.
    Impacto no projeto: restrito a ambiente de desenvolvimento/teste.
    Estado: remanescente.

11. `vite` `GHSA-4w7w-66w2-5vf9` / `CVE-2026-39365`, moderado
    Risco: path traversal em `.map` de deps otimizadas.
    Impacto no projeto: restrito ao dev server do Vitest.
    Estado: remanescente em 2 caminhos.

12. O 12º achado do `pnpm audit` era a segunda ocorrência do advisory de `vite`, em outro caminho do grafo (`workers`), não um advisory adicional.

### Testes de regressão executados

- `pnpm --filter @projetog/api run lint`: sucesso
- `pnpm --filter @projetog/api run test`: 40 testes, sucesso
- `pnpm --filter @projetog/workers run lint`: sucesso
- `pnpm --filter @projetog/workers run test`: 26 testes, sucesso

### Risco residual

- Restam 3 achados moderados, todos em toolchain de teste.
- A correção definitiva exige upgrade de `vitest` para `4.x`, que por sua vez exige `Vite >= 6`.

## 3. Dependências desatualizadas

### Atualização imediata

- `prettier 3.8.1 -> 3.8.3`
- `react-router-dom 7.14.0 -> 7.14.1`
- `typescript-eslint 8.58.1 -> 8.58.2`
- `vite 8.0.7 -> 8.0.8` em `apps/web`
- `@supabase/supabase-js 2.102.1 -> 2.103.3`
- `eslint-plugin-react-hooks 7.0.1 -> 7.1.0`
- `globals 17.4.0 -> 17.5.0`

### Atualização planejada em sprint

- `dotenv 16.6.1 -> 17.4.2`
- `@types/node 20/22/24 -> 25.6.0`

### Majors com análise de breaking change

- `@eslint/js` e `eslint` `9 -> 10`
  - Fonte oficial indica suporte mínimo `Node >= 20.19.0` e remoção de APIs deprecated.
  - Esforço: baixo a médio.
  - Plano: validar compatibilidade do ecossistema de plugins antes do bump.

- `@fastify/cors` `10 -> 11`
  - A release `11.0.0` muda o default de `methods` para o conjunto safelisted.
  - Esforço: baixo, porque a API já define `methods` explicitamente.
  - Plano: atualizar junto de smoke test HTTP.

- `fastify-type-provider-zod` `4 -> 6`
  - `5.0.0` troca a API para Zod v4 e revisa a estrutura de erro.
  - `6.0.0` muda a compatibilidade OpenAPI 3.0/3.1.
  - Esforço: alto.
  - Plano: migrar `zod` em `api/shared/web` antes do bump.

- `pg-boss` `9 -> 12`
  - `12.0.0` migra para ESM/TypeScript, remove default export e exige `Node >= 22.12`.
  - Esforço: alto.
  - Plano: somente após atualização de runtime do projeto para Node 22+.

- `typescript` `5.9 -> 6.0`
  - Release oficial destaca defaults novos de `rootDir` e `types`, além de deprecações de opções legadas.
  - Esforço: médio.
  - Plano: corrigir primeiro a dívida de tipos do Supabase.

- `vitest` `1/2 -> 4`
  - Guide oficial exige `Vite >= 6` e `Node >= 20`, além de mudanças em coverage.
  - Esforço: médio a alto.
  - Plano: usar esta migração para eliminar os 3 advisories moderados remanescentes.

- `zod` `3 -> 4`
  - Guide oficial descreve unificação de customização de erros, mudanças em `z.coerce` e deprecações como `strict/passthrough/nativeEnum`.
  - Esforço: alto.
  - Plano: spike dedicado com atualização de schemas compartilhados e testes de contrato.

## 4. Secrets e variáveis de ambiente

### Estado atual

- Arquivos locais `.env` existem em:
  - `apps/api/.env`
  - `apps/web/.env`
  - `workers/.env`
- Esses arquivos estão ignorados pelo Git e não aparecem versionados no HEAD atual.
- Arquivos versionados:
  - `.env.example`
  - `apps/api/.env.example`
  - `workers/.env.example`

### Risco identificado

- `apps/api/.env.example` e `workers/.env.example` contêm variáveis que aparentam ter valores reais ou não-placeholder para:
  - `JWT_SECRET`
  - `SIENGE_WEBHOOK_SECRET`
  - `SIENGE_ENCRYPTION_KEY`
- Isso deve ser tratado como comprometimento.
- Os `.env` locais contêm segredos ativos:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_URL`
  - `SIENGE_API_SECRET`
  - `JWT_SECRET`

### Criticidade

- Crítico:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_URL`
  - `JWT_SECRET`
- Alto:
  - `SIENGE_API_SECRET`
  - `SIENGE_WEBHOOK_SECRET`
  - `SIENGE_ENCRYPTION_KEY`
- Médio:
  - `SUPABASE_URL`
  - `SIENGE_BASE_URL`

### Remediação aplicada

- Hook `pre-commit` reforçado com scanner local de secrets
- Workflow `Security` com `pnpm audit`, `gitleaks` e `dependency-review`
- `.gitleaks.toml` versionado

### Rotação recomendada

1. Rotacionar imediatamente `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `JWT_SECRET`, `SIENGE_API_SECRET`, `SIENGE_WEBHOOK_SECRET`, `SIENGE_ENCRYPTION_KEY`
2. Invalidar credenciais antigas no provedor correspondente
3. Regravar valores apenas em secret manager ou variáveis de ambiente do runtime
4. Sanitizar histórico Git se algum segredo real tiver sido commitado no passado

## 5. Deploy e observabilidade

### Entregas implementadas

- _(Atualização 2026-05: Dockerfiles, manifests Kubernetes e workflow `Deploy` foram removidos do repositório; produção documentada via bundles Hostinger.)_
- Endpoint `/metrics` na API
- Servidor de observabilidade do worker:
  - `/health`
  - `/ready`
  - `/metrics`
- Logs estruturados JSON no processo do worker

### Limitação importante

- Os workspaces `@projetog/domain`, `@projetog/shared` e `@projetog/integration-sienge` ainda exportam TypeScript fonte; desenvolvimento local usa `tsx` / `tsc`. Produção usa bundles `hostinger-entry.js` gerados na raiz.

## 6. Branching e code review

### Entregas implementadas

- `docs/runbooks/branching-and-review.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/*`
- `scripts/github/apply-branch-protection.sh`

### Regra-alvo

- PR obrigatório para `main`
- 2 aprovações mínimas
- status checks obrigatórios
- bloqueio de force-push
- linear history
- branch atualizada antes do merge

## 7. Bloqueios remanescentes

- `apps/web` continua quebrando o lint recursivo
- `apps/api` build falha em [users.controller.ts](../../apps/api/src/modules/users/users.controller.ts) por incompatibilidade entre `updates: Record<string, string>` e o tipo esperado de update do Supabase
- `workers` build falha em múltiplos `insert()` de `integration_events` por incompatibilidade entre os tipos JSON gerados e `Record<string, unknown>`
- `format:check` continua falhando em 6 arquivos alterados no worker

## 8. Timeline sugerida

- Milestone 0, hoje:
  - rotacionar credenciais
  - corrigir `apps/web` lint
  - corrigir `format:check`
- Milestone 1, 1 a 2 dias:
  - corrigir `tsc` de `apps/api` e `workers`
  - aplicar branch protection real no GitHub
- Milestone 2, 1 sprint:
  - atualizar patches e minors de baixo risco
  - subir imagens em ambiente de homologação com os manifests adicionados
- Milestone 3, 1 a 2 sprints:
  - migrar `vitest` para `4.x`
  - migrar `zod` para `4.x`
  - planejar `pg-boss@12` junto da atualização para Node 22+

## 9. Métricas de sucesso

- `pnpm -r run lint` verde
- `pnpm run format:check` verde
- `pnpm -r run test` verde
- `pnpm -r run build` verde
- `pnpm audit` sem high/critical
- zero commit com segredo detectado pelo hook ou pelo `gitleaks`

## Fontes externas usadas para breaking changes

- ESLint v10 release notes: https://eslint.org/blog/2026/02/eslint-v10.0.0-released/
- `@fastify/cors` v11 release: https://github.com/fastify/fastify-cors/releases
- `@fastify/jwt` v10 release: https://github.com/fastify/fastify-jwt/releases
- `fast-jwt` v6 release: https://github.com/nearform/fast-jwt/releases
- `fastify-type-provider-zod` releases: https://github.com/turkerdev/fastify-type-provider-zod/releases
- Zod v4 migration guide: https://zod.dev/v4/changelog?id=drops-symbol-support
- `pg-boss` 12.0.0 release: https://github.com/timgit/pg-boss/releases
- TypeScript 6 release notes: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- Vitest migration guide: https://vitest.dev/guide/migration.html
