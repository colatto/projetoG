# ADR-0003: Gerenciador de Workspace — pnpm

## Status

Aceito

## Contexto

O repositorio `projetoG` e um monorepo com multiplos modulos independentes:

- `apps/web` — frontend SPA
- `apps/api` — backend Fastify
- `packages/domain` — nucleo de dominio
- `packages/integration-sienge` — adaptadores de integracao
- `packages/shared` — tipos e utilitarios compartilhados
- `workers/` — processamento assincrono

A escolha do gerenciador de workspace define como as dependencias sao instaladas e compartilhadas entre modulos, como os scripts sao executados em paralelo e como o monorepo e inicializado.

Tres opcoes foram avaliadas: **pnpm**, **npm workspaces** e **yarn workspaces**.

## Decisao

Adotar **pnpm** como gerenciador de workspace e de dependencias do monorepo.

### Justificativa

- **Eficiencia de disco:** pnpm usa um content-addressable store global, evitando duplicacao de pacotes entre modulos — critico em monorepos com muitas dependencias compartilhadas.
- **Isolamento de dependencias:** o modelo de `node_modules` do pnpm impede acesso acidental a dependencias nao declaradas (phantom dependencies), reduzindo bugs silenciosos de resolucao.
- **Workspace nativo:** `pnpm-workspace.yaml` e a convencao padrao para monorepos TypeScript modernos — simples, explicito e sem ambiguidade (ao contrario do yarn v1 vs berry).
- **Compatibilidade com a stack:** Vite, Fastify e Vitest sao testados e recomendados com pnpm. O `.gitignore` ja inclui `.turbo/`, sugerindo compatibilidade com Turborepo para orchestracao de builds futura.
- **Scripts por filtro:** `pnpm --filter <modulo> <script>` permite rodar comandos em modulos especificos sem configuracao extra.
- **Performance:** instalacao significativamente mais rapida que npm em projetos grandes, semelhante ao yarn berry.
- **Adocao:** padrao de fato em projetos TypeScript modernos (Vite, Astro, TurboRepo usam pnpm por padrao).

## Consequencias

### Positivas

- `pnpm-workspace.yaml` na raiz define os workspaces de forma declarativa e legivel.
- `pnpm install` na raiz instala todas as dependencias de todos os modulos.
- `pnpm --filter apps/web dev` executa o script `dev` apenas no modulo web.
- `pnpm -r run build` executa `build` em todos os modulos recursivamente.
- Compativel com Turborepo para caching e paralelizacao de builds futura.
- `pnpm dlx` substitui `npx` para execucao de binarios sem instalacao global.

### Negativas

- Requer instalacao previa do pnpm (`npm install -g pnpm` ou `corepack enable`).
- Colaboradores precisam usar pnpm — misturar com npm ou yarn quebra o lockfile (`pnpm-lock.yaml`).
- Alguns tutoriais e exemplos da comunidade ainda mostram npm ou yarn — requer adaptacao.

## Alternativas consideradas

### npm workspaces

Nao adotado porque:

- Mais lento em instalacoes grandes.
- Sem otimizacao de disco (duplicacao de pacotes).
- Sem isolamento de phantom dependencies.

### yarn workspaces

Nao adotado porque:

- Dois sabores incompativeis (v1 Classic vs v4 Berry) geram confusao.
- yarn berry introduz PnP (Plug'n'Play) que pode ser incompativel com algumas ferramentas.
- Sem vantagem clara sobre pnpm para este projeto.

## Estrutura de workspace esperada

```
projetoG/
├── pnpm-workspace.yaml       # declara os workspaces
├── package.json              # scripts e dependencias raiz (devDependencies globais)
├── pnpm-lock.yaml            # lockfile gerado pelo pnpm (versionado)
├── apps/
│   ├── web/package.json
│   └── api/package.json
├── packages/
│   ├── domain/package.json
│   ├── integration-sienge/package.json
│   └── shared/package.json
└── workers/
    └── package.json
```

### Conteudo esperado do `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'workers'
```

## Comandos principais apos inicializacao

| Acao                               | Comando                               |
| ---------------------------------- | ------------------------------------- |
| Instalar todas as dependencias     | `pnpm install`                        |
| Adicionar dep a um modulo          | `pnpm --filter <modulo> add <pacote>` |
| Adicionar dep global (devDep raiz) | `pnpm add -D <pacote> -w`             |
| Iniciar frontend em dev            | `pnpm --filter apps/web dev`          |
| Iniciar API em dev                 | `pnpm --filter apps/api dev`          |
| Rodar testes em todos os modulos   | `pnpm -r run test`                    |
| Rodar lint em todos os modulos     | `pnpm -r run lint`                    |
| Build do frontend                  | `pnpm --filter apps/web build`        |
| Migracoes Supabase                 | `pnpm dlx supabase db push`           |

## Inicializacao

Antes de qualquer `pnpm install`, o workspace precisa ser inicializado:

```bash
# 1. Garantir que pnpm esta disponivel
corepack enable   # recomendado (ja incluso no Node.js 16.9+)
# ou: npm install -g pnpm

# 2. Criar package.json raiz
pnpm init

# 3. Criar pnpm-workspace.yaml
# (conteudo conforme secao acima)

# 4. Criar package.json em cada modulo
# apps/web, apps/api, packages/domain, packages/integration-sienge,
# packages/shared, workers

# 5. Instalar dependencias
pnpm install
```

Consultar `docs/runbooks/setup.md` para a ordem completa de inicializacao.

## Referencias

- `docs/decisions/ADR-0001-repo-structure.md` — decisao de monorepo e fronteiras
- `docs/decisions/ADR-0002-backend-framework.md` — Fastify como framework da API
- `CLAUDE.md` — comandos essenciais e convencoes de codigo
- `docs/runbooks/setup.md` — runbook de inicializacao
