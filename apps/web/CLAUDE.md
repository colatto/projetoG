# Contexto do Modulo Web

## Objetivo

Implementar a SPA em React + TypeScript com Vite para:

- portal do fornecedor;
- backoffice interno;
- dashboards.

## Regras locais

- nenhuma regra critica de negocio fica no cliente;
- o cliente apenas apresenta estados e envia comandos ao backend;
- o cliente consome autenticacao e dados atraves da API dedicada e dos servicos de identidade definidos para o projeto;
- o isolamento por fornecedor deve refletir contratos ja filtrados pelo backend;
- a aplicacao deve operar em portugues do Brasil e suportar desktop e mobile;
- o deploy principal esperado e na Vercel.
- o favicon oficial do modulo web esta em `public/faviconGRF.png`;
- a logo oficial do modulo web esta em `src/assets/GRFlogo.png`;
- quando o frontend for iniciado, a paleta de cores de referencia deve ser consultada em `docs/paleta_de_cores.md`;
- em caso de duvida sobre branding, consultar `docs/identidade_visual.md`;
- os PRDs de modulo que impactam este frontend estao em `docs/prd/` (prd-01 a prd-09). <!-- atualizado -->

## Telas iniciais sugeridas

- login;
- primeiro acesso e redefinicao de senha;
- lista e detalhe de cotacoes;
- lista e detalhe de pedidos;
- aprovacao de cotacoes no backoffice;
- monitoramento de integracoes;
- dashboard operacional.

## Contexto de testes <!-- atualizado -->

- **Framework**: Vitest + `@testing-library/react` + `jsdom` (integrado na etapa de testes do pipeline CI).
- Padrao: testes de componente para fluxos criticos (login, cotacao, aprovacao).
- Localizacao: `apps/web/src/**/*.test.tsx` ou subpastas `__tests__/`.
