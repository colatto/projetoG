# Identidade Visual

## Objetivo

Registrar os assets oficiais de marca que devem ser usados no projeto para que pessoas e agentes encontrem a referencia correta sem ambiguidade.

## Assets oficiais atuais

### Favicon oficial

- arquivo atual: `src/assets/faviconGRF.png`
- finalidade: favicon padrao do projeto e do app web
- origem visual: simbolo isolado da marca GRF, sem o texto "GRF Incorporadora"

### Logo oficial

- arquivo atual: `src/assets/GRFlogo.png`
- finalidade: logotipo institucional do produto em cabecalhos, telas de autenticacao, navegacao e materiais internos
- origem visual: simbolo da marca acompanhado do texto "GRF Incorporadora"

## Regras de uso

- sempre usar `src/assets/faviconGRF.png` como referencia oficial de favicon, salvo substituicao explicita desta documentacao;
- sempre usar `src/assets/GRFlogo.png` como referencia oficial de logo, salvo substituicao explicita desta documentacao;
- evitar criar copias com nomes diferentes sem atualizar este documento;
- quando houver duvida entre simbolo e logotipo completo, usar o simbolo para favicon e a logo completa para identificacao institucional.

## Diretriz para o modulo web

O repositorio ainda nao possui a aplicacao Vite inicializada em `apps/web`, entao os arquivos estao guardados provisoriamente em `src/assets/`.

Quando o frontend for implementado:

- o favicon deve ser publicado em `apps/web/public/` e configurado no HTML base do app;
- a logo deve ficar em um caminho de assets consumido pelo frontend, preferencialmente `apps/web/src/assets/` ou outro local equivalente definido pela implementacao.
- a paleta de cores de referencia para implementacao visual deve ser consultada em `docs/paleta_de_cores.md`.

## Descoberta por agentes

Este arquivo deve ser tratado como a fonte de verdade de identidade visual do projeto e ser consultado junto de:

- `CLAUDE.md`
- `apps/web/CLAUDE.md`
- `.claude/settings.json`
