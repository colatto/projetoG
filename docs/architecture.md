# Arquitetura Inicial

## Visao geral

O projeto foi estruturado como um monorepo com separacao explicita entre interface web, API, dominio, persistencia e integracao com Sienge. A stack alvo combina `Vite + Vercel` no frontend, `apps/api` como backend dedicado em TypeScript, `Supabase` para PostgreSQL e autenticacao, e uma camada explicita de jobs/workers para processamento assincrono.

## Modulos principais

### `apps/web`

Frontend SPA em React + TypeScript para:

- portal do fornecedor;
- backoffice interno;
- dashboards;
- autenticacao por e-mail e senha;
- experiencia responsiva para desktop e mobile;
- build com Vite;
- deploy principal na Vercel.

### `apps/api`

Backend em TypeScript para:

- autenticacao e RBAC;
- API interna do sistema;
- aprovacao de respostas de cotacao;
- workflow de follow-up;
- auditoria;
- webhooks;
- orquestracao de integracoes;
- coordenacao de jobs e reprocessamentos.

### `supabase/`

Plataforma de dados e identidade para:

- PostgreSQL gerenciado;
- autenticacao por e-mail e senha;
- politicas de acesso e suporte operacional;
- armazenamento de configuracoes e dados persistidos do sistema.

### `workers/`

Processamento assincrono fora do ciclo HTTP para:

- polling das APIs do Sienge;
- retries e reprocessamentos;
- follow-up logistico agendado;
- reconciliacao disparada por webhook;
- tarefas demoradas que nao devem depender de funcoes serverless curtas.

### `packages/domain`

Camada de dominio com:

- entidades;
- enums de status;
- regras operacionais;
- casos de uso;
- validacoes;
- contratos internos independentes de framework.

### `packages/integration-sienge`

Camada de integracao com:

- clientes HTTP;
- mapeadores de payload;
- sincronizacao por polling e webhook;
- idempotencia;
- retry;
- rastreabilidade;
- tratamento de falhas.

### `packages/shared`

Elementos compartilhados entre apps:

- tipos;
- schemas;
- utilitarios;
- constantes;
- contratos de API;
- funcoes de formatacao.

## Primeiras fatias verticais recomendadas

1. Autenticacao e RBAC.
2. Sincronizacao de fornecedores e cotacoes.
3. Lista de cotacoes do fornecedor e do backoffice.
4. Resposta de cotacao com aprovacao por `Compras`.
5. Integracao controlada da resposta aprovada com o Sienge.
6. Follow-up logistico com agenda assincrona.

## Topologia recomendada de deploy

- `apps/web` publicado na Vercel;
- `apps/api` publicado como backend dedicado para rotas sincronas e recebimento de webhooks;
- `supabase/` conectado ao banco relacional principal e ao servico de autenticacao;
- `workers/` publicado em ambiente apropriado para execucao assincrona continua, compartilhando `packages/domain` e `packages/integration-sienge`.

## Principios de modelagem

- O Sienge permanece como fonte principal de verdade dos dados operacionais mestres.
- O sistema local persiste excecoes, controle operacional, auditoria e rastreabilidade.
- Todo evento critico gera trilha de auditoria.
- Toda integracao externa deve ser reprocessavel.
- O frontend consome contratos do backend; nao replica regra critica.
- O frontend nao depende diretamente do Sienge.
- Jobs de longa duracao nao devem depender apenas da infraestrutura de requisicao da Vercel.

## Areas de persistencia esperadas

- usuarios e acessos;
- fornecedores e credenciais locais;
- cotacoes importadas;
- respostas de cotacoes;
- pedidos e entregas sincronizados;
- avarias;
- notificacoes;
- eventos de integracao;
- auditoria;
- parametrizacoes operacionais.
