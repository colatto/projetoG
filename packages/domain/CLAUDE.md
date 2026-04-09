# Contexto do Dominio

## Objetivo

Centralizar o nucleo de negocio independente de framework.

## Subdominios esperados

- autenticacao e acesso;
- cotacao;
- resposta de cotacao;
- pedido e follow-up;
- entrega;
- avaria;
- notificacao;
- auditoria;
- integracao.

## Regra de ouro

Se uma regra do PRD define comportamento operacional, ela deve nascer aqui ou ser claramente orquestrada por esta camada.

## Referencias <!-- atualizado -->

- Entidades centrais e identificadores minimos persistidos: ver secao `## Entidades centrais` e `## Identificadores minimos persistidos` no `CLAUDE.md` raiz.
- Fonte de verdade de produto: `PRDGlobal.md`.
- PRDs de modulo por subdominio: `docs/prd/` (prd-01 a prd-09).
