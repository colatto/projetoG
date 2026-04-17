# Apps

`apps/` é apenas o contêiner das aplicações executáveis do monorepo.

## Aplicações válidas

- `apps/web`: SPA principal do produto
- `apps/api`: backend dedicado do produto

## Observação importante

O diretório também contém um `package.json` e arquivos de scaffold Vite herdados do bootstrap inicial. Esses artefatos não representam uma terceira aplicação do produto e não devem ser usados como referência documental ou de deploy.

Use sempre:

- `pnpm --filter @projetog/web ...`
- `pnpm --filter @projetog/api ...`
