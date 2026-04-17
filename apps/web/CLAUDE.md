# Contexto do Módulo Web

## Objetivo

Fornecer a SPA do portal/backoffice em React + Vite.

## Escopo atual implementado

- login
- recuperação e redefinição de senha
- rotas protegidas por autenticação
- shell administrativo
- gestão de usuários
- monitoramento básico de integração

## Regras locais

- nenhuma lógica crítica de negócio fica no cliente
- o cliente fala apenas com `apps/api`
- o frontend não integra diretamente com o Sienge
- mensagens para usuário permanecem em português

## Arquivos centrais

- `src/App.tsx`
- `src/contexts/AuthContext.tsx`
- `src/lib/api.ts`
- `src/pages/auth/*`
- `src/pages/admin/*`

## Ambiente

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`

## Estado atual

- rotas de cotação, pedidos, follow-up, avaria e dashboard analítico ainda não estão implementadas
- build e testes passam
- o módulo já contém uma tela administrativa de integração em evolução
