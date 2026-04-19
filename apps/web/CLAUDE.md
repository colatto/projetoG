# Contexto do Módulo Web

## Objetivo

Fornecer a SPA do portal/backoffice em React + Vite.

## Escopo atual implementado

- login, recuperação e redefinição de senha
- rotas protegidas por autenticação e perfil (RBAC)
- shell administrativo com navegação lateral dinâmica por perfil
- gestão de usuários (listagem, criação, edição/bloqueio)
- monitoramento de eventos de integração
- listagem e detalhe de cotações (backoffice — Administrador/Compras)
- portal do fornecedor com listagem e detalhe de cotações, marcação de leitura e resposta

## Componentes reutilizáveis

- `ProtectedRoute`: guard de rota com checagem por perfil
- `AuthContext`: context API com persistência de token em `localStorage`
- `AdminLayout`: shell com sidebar responsiva e navegação por perfil
- `Button`: componente UI genérico
- `Input`: componente UI de formulário
- `IntegrationStatusBadge`: badge de status de integração

## Rotas existentes

| Rota                       | Componente                | Perfis permitidos      |
| -------------------------- | ------------------------- | ---------------------- |
| `/login`                   | `Login`                   | público                |
| `/esqueci-senha`           | `ForgotPassword`          | público                |
| `/reset-password`          | `ResetPassword`           | público                |
| `/`                        | `PlaceholderDashboard`    | qualquer autenticado   |
| `/admin/users`             | `UserList`                | Administrador          |
| `/admin/users/new`         | `UserCreate`              | Administrador          |
| `/admin/users/:id`         | `UserManage`              | Administrador          |
| `/admin/integration`       | `IntegrationEvents`       | Administrador, Compras |
| `/admin/quotations`        | `QuotationList`           | Administrador, Compras |
| `/admin/quotations/:id`    | `QuotationDetail`         | Administrador, Compras |
| `/supplier/quotations`     | `SupplierQuotationList`   | Fornecedor             |
| `/supplier/quotations/:id` | `SupplierQuotationDetail` | Fornecedor             |

## Regras locais

- nenhuma lógica crítica de negócio fica no cliente
- o cliente fala apenas com `apps/api`
- o frontend não integra diretamente com o Sienge
- mensagens para usuário permanecem em português

## Arquivos centrais

- `src/App.tsx`
- `src/contexts/AuthContext.tsx`
- `src/lib/api.ts`
- `src/lib/error-utils.ts`
- `src/pages/auth/*`
- `src/pages/admin/*`
- `src/pages/supplier/*`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/ui/*`

## Ambiente

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`

## Estado de qualidade

- build: passa
- testes: passam (com `--passWithNoTests`)
- lint: passa (0 errors, 1 warning — `react-hooks/incompatible-library` em UserCreate por uso de `watch()` do react-hook-form; não acionável)

## Funcionalidades ainda não implementadas

- rotas de pedidos, follow-up, avaria e dashboard analítico
- portal completo do Visualizador de Pedidos
- notificações in-app
