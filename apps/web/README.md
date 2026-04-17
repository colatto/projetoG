# `@projetog/web`

SPA React + TypeScript + Vite do portal/backoffice.

## Escopo atualmente implementado

- login
- recuperação e redefinição de senha
- shell administrativo com sidebar e header
- gestão de usuários
- monitoramento básico de eventos de integração

## Rotas atuais

- `/login`
- `/esqueci-senha`
- `/reset-password`
- `/`
- `/admin/users`
- `/admin/users/new`
- `/admin/users/:id`
- `/admin/integration`

## Dependências principais

- `react 19.2.4`
- `react-router-dom 7.14.0`
- `react-hook-form 7.72.1`
- `axios 1.15.0`
- `date-fns 4.1.0`
- `lucide-react 1.8.0`
- `vite 8.0.7`

## Ambiente

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:3000/api
```

## Comandos

```bash
pnpm --filter @projetog/web dev
pnpm --filter @projetog/web build
pnpm --filter @projetog/web test
pnpm --filter @projetog/web lint
```

## Observações

- autenticação é mantida via token JWT próprio da API em `localStorage`
- não há integração direta com Sienge no frontend
- a maior parte do styling usa CSS global e inline styles; ainda não existe design system consolidado
