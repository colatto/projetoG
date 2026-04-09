# ADR-0001: Estrutura Inicial do Repositorio

## Status

Aceito

## Contexto

O PRD define uma aplicacao web para operacao e administracao, persistencia relacional, integracoes assincronas com Sienge e uma camada forte de regras operacionais. A stack escolhida precisa acomodar frontend web com deploy simples, backend dedicado para regra critica e uma base operacional confiavel para autenticacao, persistencia e processamento assincrono.

## Decisao

Adotar um monorepo com:

- `apps/web` para a aplicacao web em Vite usada na operacao e administracao, com deploy principal na Vercel;
- `apps/api` para a API dedicada em TypeScript responsavel por autenticacao de aplicacao, RBAC, webhooks, orquestracao e regras operacionais;
- uso de Supabase como plataforma principal de PostgreSQL gerenciado, autenticacao e apoio de persistencia;
- `supabase/` para configuracoes, convencoes e artefatos da plataforma de dados;
- `workers/` para polling, retries, reprocessamentos e follow-up assincrono;
- `packages/integration-sienge` para a integracao externa, consumida pelo backend e pelos workers;
- `packages/shared` para contratos, tipos e utilitarios compartilhados;
- `docs/` para arquitetura, ADRs e runbooks;
- `.claude/` para contexto operacional de assistentes.

## Consequencias

### Positivas

- separacao clara de responsabilidades;
- alinhamento entre estrutura do repositorio e o PRD, que exige backend com regra critica, auditoria e jobs independentes do cliente;
- compartilhamento controlado de tipos e utilitarios entre web, API, workers e integracoes;
- Supabase reduz custo operacional de banco e autenticacao sem empurrar a regra principal para o frontend;
- Vercel simplifica o deploy do app web e dos fluxos HTTP curtos;
- melhor base para migracoes, politicas, integracoes e observabilidade;
- evolucao futura para CI/CD e workspace compartilhado.

### Negativas

- a estrutura inicial fica maior do que um projeto de pasta unica;
- exige disciplina para decidir o que fica no frontend, na API, no Supabase e nos workers;
- adiciona uma camada operacional de backend dedicada desde o inicio;
- requer estrategia clara de execucao para tarefas assincronas fora do request lifecycle.

## Alternativas consideradas

### Estrutura unica em `src/`

Nao adotada porque mistura responsabilidades cedo demais para um produto com aplicacao web, banco, funcoes de backend e integracoes externas criticas.

### Supabase como backend principal sem API dedicada

Nao adotada porque conflita com a necessidade de centralizar regra critica de negocio, webhooks, auditoria e orquestracao de integracoes em uma camada propria.

### API apenas em funcoes serverless curtas

Nao adotada como estrategia unica porque o produto exige polling, retries, reprocessamentos e follow-up assincrono, o que pede workers independentes de requisicoes web.
