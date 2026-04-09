# PRD Filho — Autenticação e Perfis

> Módulo: 1 de 9
> Seções do PRDGlobal: §3, §11
> Dependências: Nenhuma (módulo fundacional)
> Data de geração: 2026-04-06

---

## 1. Objetivo do módulo

Este módulo estabelece toda a infraestrutura de identidade, autenticação e controle de acesso do sistema. Ele é o módulo fundacional: nenhum outro módulo pode operar sem que usuários estejam autenticados e seus perfis e permissões estejam corretamente aplicados.

O módulo cobre o cadastro e a gestão de ciclo de vida de usuários internos (`Compras`, `Administrador`, `Visualizador de Pedidos`) e externos (`Fornecedor`), incluindo criação de acesso, primeiro acesso por link seguro, login por e-mail e senha, redefinição de senha, bloqueio, reativação e remoção de acesso. Também define o modelo de RBAC (Role-Based Access Control) que será consumido por todos os demais módulos para autorização de operações.

O valor entregue ao produto é a garantia de que cada ação no sistema é rastreável a um usuário autenticado, que cada perfil acessa apenas o que lhe é permitido, e que o ciclo de vida de credenciais é controlado exclusivamente pelo `Administrador`, em conformidade com as regras operacionais da V1.0.

## 2. Escopo funcional

### 2.1 Incluso neste PRD

- Modelagem dos 4 perfis oficiais (`Fornecedor`, `Compras`, `Administrador`, `Visualizador de Pedidos`) e suas permissões.
- Cadastro e gestão de ciclo de vida de usuários internos pelo `Administrador`.
- Criação de acesso de fornecedor pelo `Administrador`, vinculando o `supplierId` do Sienge ao usuário local.
- Alteração do e-mail local do fornecedor pelo `Administrador` (sem retorno ao Sienge).
- Fluxo de primeiro acesso por link seguro com validade de 24 horas.
- Login por e-mail e senha para todos os perfis.
- Redefinição de senha (autosserviço e iniciada pelo `Administrador`).
- Política mínima de senha da V1.0.
- Regras de sessão da V1.0.
- Bloqueio, reativação e remoção de acesso pelo `Administrador`.
- RBAC persistido e aplicado por toda a API.
- Regras mínimas de LGPD e retenção de dados aplicáveis a este módulo.
- Auditoria de eventos relacionados a autenticação e gestão de acesso.

### 2.2 Excluído deste PRD

- Envio de notificação de cotação por e-mail ao fornecedor → **Módulo 3 (Notificações de Cotação)**.
- Aprovação/reprovação de respostas de cotação por `Compras` → **Módulo 2 (Fluxo de Cotação)**.
- Parametrização de workflow e réguas de follow-up → **Módulo 4 (Follow-up Logístico)**.
- Dashboards e indicadores → **Módulo 8 (Dashboard e Indicadores)**.
- Templates de notificação editáveis → **Módulo 3 (Notificações de Cotação)** e **Módulo 9 (Backoffice)**.
- Sincronização de dados cadastrais de fornecedor via API do Sienge → **Módulo 7 (Integração com o Sienge)**.

### 2.3 Fora de escopo da V1.0

Conforme PRDGlobal §2.3:

- Auto cadastro de fornecedor.
- Ativação autônoma de credenciais sem ação do `Administrador`.
- Políticas avançadas de segurança além do mínimo operacional definido (sem exigência de complexidade de senha, sem histórico de senha, sem bloqueio automático por tentativas inválidas, sem expiração de sessão por inatividade).

## 3. Perfis envolvidos

| Perfil | Permissões neste módulo | Restrições |
|--------|------------------------|------------|
| **Administrador** | Cria, edita, bloqueia, reativa e remove usuários internos. Cria acesso, bloqueia, reativa e redefine acesso de fornecedor. Altera e-mail local do fornecedor. | Não pode aprovar respostas de cotação nem definir ação corretiva de avaria. *(PRDGlobal §3.3)* |
| **Compras** | Faz login, redefine a própria senha. | Não pode gerir acessos ou parametrizar sistema. *(PRDGlobal §3.3)* |
| **Fornecedor** | Faz login, redefine a própria senha. | Acessa apenas os próprios dados. Não pode aprovar a própria resposta de cotação nem a própria sugestão de nova data. *(PRDGlobal §3.2, §3.3)* |
| **Visualizador de Pedidos** | Faz login, redefine a própria senha. | Não altera dados. Não acessa dashboards, indicadores, parametrizações ou ações operacionais. *(PRDGlobal §3.2)* |

*(PRDGlobal §3.1, §3.2, §3.3)*

## 4. Entidades e modelagem

### 4.1 `users`

Entidade central de todos os usuários do sistema (internos e fornecedores).

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | `UUID` | Sim | Identificador único, gerado pelo Supabase Auth. |
| `email` | `VARCHAR(255)` | Sim | E-mail de login (único). Para fornecedor, pode ser alterado localmente pelo `Administrador`. |
| `role` | `ENUM('fornecedor', 'compras', 'administrador', 'visualizador_pedidos')` | Sim | Perfil do usuário. |
| `name` | `VARCHAR(255)` | Sim | Nome completo do usuário. |
| `status` | `ENUM('pendente', 'ativo', 'bloqueado', 'removido')` | Sim | Estado do ciclo de vida do acesso. |
| `supplier_id` | `INTEGER` | Não | `supplierId` do Sienge. Preenchido apenas para perfil `fornecedor`. |
| `original_email` | `VARCHAR(255)` | Não | E-mail original vindo do Sienge, preservado quando o `Administrador` altera o e-mail local. |
| `created_at` | `TIMESTAMPTZ` | Sim | Data/hora de criação do registro. |
| `updated_at` | `TIMESTAMPTZ` | Sim | Data/hora da última atualização. |
| `created_by` | `UUID` | Sim | ID do `Administrador` que criou o acesso. |
| `blocked_at` | `TIMESTAMPTZ` | Não | Data/hora do bloqueio, quando aplicável. |
| `blocked_by` | `UUID` | Não | ID do `Administrador` que bloqueou. |

**Relacionamentos:**
- `id` referencia `auth.users.id` do Supabase Auth.
- `supplier_id` referencia o `supplierId` originado do Sienge (não há FK direta para o Sienge, mas deve manter unicidade local para fornecedores ativos).
- `created_by` e `blocked_by` referenciam `users.id`.

**Índices sugeridos:**
- Único em `email`.
- Único em `supplier_id` (parcial, apenas quando `role = 'fornecedor'` e `status != 'removido'`).
- Índice em `role`.
- Índice em `status`.

**Regras de integridade:**
- `supplier_id` é obrigatório quando `role = 'fornecedor'` e proibido para outros perfis.
- `email` deve ser único no escopo de usuários não-removidos.
- Não é possível ter dois fornecedores ativos com o mesmo `supplier_id`.

### 4.2 `audit_log`

Entidade de auditoria para eventos deste módulo e reutilizada pelos demais.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | `UUID` | Sim | Identificador único do evento. |
| `event_type` | `VARCHAR(100)` | Sim | Tipo do evento (ex.: `user.created`, `user.blocked`, `user.login`, `password.reset`). |
| `actor_id` | `UUID` | Não | ID do usuário que executou a ação (nulo para eventos de sistema). |
| `target_user_id` | `UUID` | Não | ID do usuário afetado, quando aplicável. |
| `metadata` | `JSONB` | Não | Dados adicionais do evento (ex.: campos alterados, IP, user agent). |
| `created_at` | `TIMESTAMPTZ` | Sim | Data/hora do evento. |

**Índices sugeridos:**
- Índice em `event_type`.
- Índice em `actor_id`.
- Índice em `target_user_id`.
- Índice em `created_at`.

**Regras de integridade:**
- Registros de auditoria nunca devem ser atualizados ou removidos (append-only).
- Retenção mínima de 1 ano. *(PRDGlobal §11.5)*

## 5. Regras de negócio

- **RN-01:** O login de todos os perfis é por e-mail e senha. *(PRDGlobal §11.1)*
- **RN-02:** O e-mail inicial do fornecedor vem do Sienge (primeiro `contacts[].email` preenchido no endpoint `GET /creditors/{creditorId}`). *(PRDGlobal §9.5, §11.1)*
- **RN-03:** O `Administrador` pode alterar o e-mail local do fornecedor no sistema. Essa alteração não volta para o Sienge. *(PRDGlobal §11.1)*
- **RN-04:** Quando o e-mail do fornecedor for alterado localmente, o novo e-mail passa a valer imediatamente para login, primeiro acesso, redefinição de senha e notificações. *(PRDGlobal §11.1)*
- **RN-05:** O primeiro acesso de fornecedor e usuário interno acontece por link seguro para definição de senha, com validade de 24 horas. *(PRDGlobal §11.1)*
- **RN-06:** Após expiração do link de primeiro acesso, é necessário gerar novo link. *(PRDGlobal §11.1)*
- **RN-07:** O link de redefinição de senha expira em 24 horas. Após expiração, é necessário gerar novo link. *(PRDGlobal §11.1)*
- **RN-08:** O `Fornecedor` e os usuários internos podem redefinir a própria senha. *(PRDGlobal §11.2)*
- **RN-09:** O `Administrador` também pode iniciar redefinição de senha para fornecedor e usuário interno. *(PRDGlobal §11.2)*
- **RN-10:** Política mínima de senha da V1.0 — mínimo de 8 caracteres, sem exigência de maiúscula, minúscula, número ou caractere especial, sem histórico de senha, sem bloqueio automático por tentativas inválidas. *(PRDGlobal §11.3)*
- **RN-11:** Na V1.0, a sessão não expira automaticamente por inatividade. O encerramento ocorre por logout manual. *(PRDGlobal §11.4)*
- **RN-12:** Apenas o `Administrador` pode criar, editar, bloquear, reativar e remover acessos internos e de fornecedores. *(PRDGlobal §3.3)*
- **RN-13:** Se o fornecedor estiver bloqueado, o sistema interrompe imediatamente notificações e operação no portal. *(PRDGlobal §4.2)*
- **RN-14:** Se não houver e-mail válido no Sienge e também não houver e-mail cadastrado localmente pelo `Administrador`, o sistema deve bloquear o envio de notificações e a operação desse fornecedor no portal. *(PRDGlobal §9.5)*
- **RN-15:** A retenção padrão de logs e trilhas de auditoria é de 1 ano. Após esse prazo, os dados podem ser arquivados. *(PRDGlobal §11.5)*
- **RN-16:** Na V1.0, a LGPD fica no nível básico operacional: manter apenas dados necessários, restringir acesso conforme perfil, sem regras avançadas adicionais. *(PRDGlobal §11.5)*
- **RN-17:** O `Fornecedor` acessa apenas os próprios dados. *(PRDGlobal §3.2)*
- **RN-18:** O `Visualizador de Pedidos` consulta pedidos e entregas, não altera dados, não acessa dashboards, indicadores, parametrizações ou ações operacionais. *(PRDGlobal §3.2)*
- **RN-19:** A cotação só deve ser enviada para fornecedores com acesso já liberado no portal. *(PRDGlobal §4.2)*
- **RN-20:** O `Administrador` pode editar templates de notificação dentro dos limites aprovados. *(PRDGlobal §3.2)*

## 6. Fluxos operacionais

### 6.1 Criação de acesso de usuário interno

1. `Administrador` acessa a tela de gestão de usuários no backoffice.
2. Seleciona "Criar usuário interno".
3. Informa: nome, e-mail e perfil (`Compras`, `Administrador` ou `Visualizador de Pedidos`).
4. O sistema valida se o e-mail já está em uso (entre usuários não-removidos).
5. O sistema cria o registro na tabela `users` com `status = 'pendente'`.
6. O sistema cria a conta correspondente no Supabase Auth e dispara o link de primeiro acesso por e-mail.
7. O link tem validade de 24 horas.
8. O sistema registra evento de auditoria `user.created`.
9. O usuário recebe o e-mail, acessa o link e define sua senha (mínimo 8 caracteres).
10. Após definir a senha, o `status` muda para `ativo`.

**Exceções:**
- E-mail duplicado → erro de validação, operação não prossegue.
- Link expirado → o `Administrador` deve gerar um novo link.

### 6.2 Criação de acesso de fornecedor

1. `Administrador` acessa a tela de gestão de fornecedores.
2. Seleciona "Criar acesso de fornecedor".
3. Informa o `supplier_id` (identificador do fornecedor no Sienge).
4. O sistema busca o e-mail do fornecedor via integração (`GET /creditors/{creditorId}`, primeiro `contacts[].email` preenchido). *Nota: esta busca depende do Módulo 7 estar implementado; alternativamente, o `Administrador` informa o e-mail manualmente.*
5. Se não houver e-mail disponível, o `Administrador` pode informar um e-mail manual.
6. O sistema valida unicidade de `supplier_id` (entre fornecedores não-removidos) e de `email`.
7. O sistema cria registro com `role = 'fornecedor'` e `status = 'pendente'`.
8. O sistema cria a conta no Supabase Auth e dispara link de primeiro acesso.
9. O sistema registra evento de auditoria `user.created`.
10. O fornecedor acessa o link, define a senha e o `status` muda para `ativo`.

**Exceções:**
- `supplier_id` duplicado → erro de validação.
- Nenhum e-mail disponível e nenhum e-mail informado manualmente → o acesso é criado com `status = 'pendente'` mas sem link enviado; o `Administrador` é avisado.

### 6.3 Login

1. Usuário (qualquer perfil) acessa a tela de login.
2. Informa e-mail e senha.
3. O sistema autentica via Supabase Auth.
4. O sistema verifica se o `status` do usuário na tabela `users` é `'ativo'`.
5. Se `status != 'ativo'` (bloqueado, pendente ou removido), o login é negado com mensagem genérica.
6. Se válido, o sistema retorna a sessão autenticada com o perfil (`role`) para uso em RBAC.
7. O sistema registra evento de auditoria `user.login`.

**Exceções:**
- Credenciais inválidas → mensagem genérica de erro (sem revelar se o e-mail existe).
- Usuário bloqueado → mesma mensagem genérica.

### 6.4 Redefinição de senha (autosserviço)

1. Usuário acessa "Esqueci minha senha" na tela de login.
2. Informa o e-mail.
3. O sistema dispara link de redefinição via Supabase Auth (validade de 24 horas).
4. O sistema registra evento de auditoria `password.reset_requested`.
5. O usuário acessa o link e define nova senha (mínimo 8 caracteres).
6. O sistema registra evento de auditoria `password.reset_completed`.

### 6.5 Redefinição de senha (pelo Administrador)

1. `Administrador` acessa o cadastro do usuário.
2. Seleciona "Enviar link de redefinição de senha".
3. O sistema dispara o link de redefinição via Supabase Auth para o e-mail do usuário.
4. O sistema registra evento de auditoria `password.reset_by_admin`.

### 6.6 Bloqueio de acesso

1. `Administrador` localiza o usuário e seleciona "Bloquear".
2. O sistema atualiza `status = 'bloqueado'`, registra `blocked_at` e `blocked_by`.
3. Se o usuário for `Fornecedor`, o sistema interrompe imediatamente notificações e a operação desse fornecedor no portal. *(PRDGlobal §4.2)*
4. A sessão ativa do usuário deve ser invalidada.
5. O sistema registra evento de auditoria `user.blocked`.

### 6.7 Reativação de acesso

1. `Administrador` localiza o usuário bloqueado e seleciona "Reativar".
2. O sistema atualiza `status = 'ativo'`, limpa `blocked_at` e `blocked_by`.
3. O sistema registra evento de auditoria `user.reactivated`.

### 6.8 Remoção de acesso

1. `Administrador` localiza o usuário e seleciona "Remover".
2. O sistema atualiza `status = 'removido'`.
3. A conta no Supabase Auth é desativada (soft delete).
4. O sistema registra evento de auditoria `user.removed`.

### 6.9 Alteração de e-mail do fornecedor

1. `Administrador` acessa o cadastro do fornecedor.
2. Altera o campo de e-mail.
3. O sistema preserva o `original_email` (e-mail original do Sienge).
4. O novo e-mail é validado quanto à unicidade.
5. O e-mail no Supabase Auth é atualizado.
6. O novo e-mail passa a valer para login, redefinição de senha e notificações.
7. O sistema registra evento de auditoria `user.email_changed` com os valores anterior e novo.

### 6.10 Logout

1. O usuário seleciona "Sair".
2. A sessão é encerrada via Supabase Auth.
3. O sistema registra evento de auditoria `user.logout`.

## 7. Contratos de API / Serviços

### 7.1 POST `/api/auth/login`

- **Entrada:** `{ email: string, password: string }`
- **Saída (sucesso):** `{ user: { id, email, name, role }, session: { access_token, refresh_token, expires_at } }`
- **Erros:**
  - `401` — Credenciais inválidas.
  - `403` — Usuário bloqueado, pendente ou removido.
- **Perfis autorizados:** Público.

### 7.2 POST `/api/auth/logout`

- **Entrada:** Sessão ativa (header `Authorization: Bearer <token>`).
- **Saída:** `{ success: true }`
- **Erros:**
  - `401` — Sessão inválida ou expirada.
- **Perfis autorizados:** Qualquer usuário autenticado.

### 7.3 POST `/api/auth/forgot-password`

- **Entrada:** `{ email: string }`
- **Saída:** `{ success: true }` (sempre, para não revelar existência do e-mail).
- **Erros:** Nenhum exposto ao cliente.
- **Perfis autorizados:** Público.

### 7.4 POST `/api/auth/reset-password`

- **Entrada:** `{ token: string, new_password: string }`
- **Saída:** `{ success: true }`
- **Erros:**
  - `400` — Token inválido ou expirado.
  - `400` — Senha não atende política mínima (< 8 caracteres).
- **Perfis autorizados:** Público (via token temporário).

### 7.5 GET `/api/users`

- **Entrada:** Query params opcionais: `role`, `status`, `search` (busca por nome ou e-mail), `page`, `per_page`.
- **Saída:** `{ data: User[], pagination: { total, page, per_page } }`
- **Erros:**
  - `401` — Não autenticado.
  - `403` — Perfil não autorizado.
- **Perfis autorizados:** `Administrador`.

### 7.6 GET `/api/users/:id`

- **Entrada:** `id` (UUID) na URL.
- **Saída:** `{ data: User }`
- **Erros:**
  - `401` — Não autenticado.
  - `403` — Perfil não autorizado.
  - `404` — Usuário não encontrado.
- **Perfis autorizados:** `Administrador` (qualquer usuário); qualquer perfil para o próprio registro.

### 7.7 POST `/api/users`

- **Entrada:** `{ name: string, email: string, role: string, supplier_id?: number }`
- **Saída:** `{ data: User }` (status `201`).
- **Erros:**
  - `400` — Validação falhou (e-mail duplicado, `supplier_id` duplicado, `supplier_id` ausente para perfil `fornecedor`).
  - `401` — Não autenticado.
  - `403` — Perfil não autorizado.
- **Perfis autorizados:** `Administrador`.

### 7.8 PATCH `/api/users/:id`

- **Entrada:** `{ name?: string, email?: string, status?: string }`
- **Saída:** `{ data: User }`
- **Erros:**
  - `400` — Validação falhou.
  - `401` — Não autenticado.
  - `403` — Perfil não autorizado.
  - `404` — Usuário não encontrado.
- **Perfis autorizados:** `Administrador`.

### 7.9 POST `/api/users/:id/block`

- **Entrada:** `id` (UUID) na URL.
- **Saída:** `{ data: User }`
- **Erros:**
  - `401` — Não autenticado.
  - `403` — Perfil não autorizado.
  - `404` — Usuário não encontrado.
  - `409` — Usuário já está bloqueado.
- **Perfis autorizados:** `Administrador`.

### 7.10 POST `/api/users/:id/reactivate`

- **Entrada:** `id` (UUID) na URL.
- **Saída:** `{ data: User }`
- **Erros:**
  - `401` — Não autenticado.
  - `403` — Perfil não autorizado.
  - `404` — Usuário não encontrado.
  - `409` — Usuário não está bloqueado.
- **Perfis autorizados:** `Administrador`.

### 7.11 DELETE `/api/users/:id`

- **Entrada:** `id` (UUID) na URL.
- **Saída:** `{ success: true }`
- **Erros:**
  - `401` — Não autenticado.
  - `403` — Perfil não autorizado.
  - `404` — Usuário não encontrado.
- **Perfis autorizados:** `Administrador`.

### 7.12 POST `/api/users/:id/reset-password`

- **Entrada:** `id` (UUID) na URL.
- **Saída:** `{ success: true }`
- **Erros:**
  - `401` — Não autenticado.
  - `403` — Perfil não autorizado.
  - `404` — Usuário não encontrado.
- **Perfis autorizados:** `Administrador`.

### 7.13 GET `/api/auth/me`

- **Entrada:** Sessão ativa (header `Authorization: Bearer <token>`).
- **Saída:** `{ data: { id, email, name, role, status } }`
- **Erros:**
  - `401` — Não autenticado.
- **Perfis autorizados:** Qualquer usuário autenticado.

## 8. Interface do usuário

### 8.1 Tela de Login

- **Propósito:** Ponto de entrada de todos os usuários.
- **Campos exibidos:** E-mail, senha.
- **Ações disponíveis:** Entrar, "Esqueci minha senha".
- **Referências visuais:**
  - Logo institucional (`GRFlogo.png`) centralizada acima do formulário.
  - Fundo com gradiente usando Azul Escuro `#324598` e Azul Médio `#465EBE`.
  - Botão primário em Turquesa `#19B4BE`.
  - Card de formulário em Branco `#FFFFFF` com sombra suave.

### 8.2 Tela de Definição de Senha (Primeiro Acesso)

- **Propósito:** Permitir que o usuário defina sua senha no primeiro acesso.
- **Campos exibidos:** Nova senha, confirmação de senha.
- **Ações disponíveis:** Definir senha.
- **Validação visual:** Indicador de requisito mínimo (8 caracteres).
- **Referências visuais:** Mesma identidade da tela de login.

### 8.3 Tela de Redefinição de Senha (Solicitação)

- **Propósito:** Solicitar link de redefinição.
- **Campos exibidos:** E-mail.
- **Ações disponíveis:** Enviar link, voltar ao login.
- **Referências visuais:** Mesma identidade da tela de login.

### 8.4 Tela de Redefinição de Senha (Nova Senha)

- **Propósito:** Definir nova senha via link recebido por e-mail.
- **Campos exibidos:** Nova senha, confirmação de senha.
- **Ações disponíveis:** Redefinir senha.
- **Referências visuais:** Mesma identidade da tela de login.

### 8.5 Tela de Gestão de Usuários (Backoffice)

- **Propósito:** Permitir ao `Administrador` gerir todos os acessos do sistema.
- **Campos exibidos na listagem:** Nome, e-mail, perfil, status, data de criação.
- **Filtros:** Por perfil (`role`), por status, busca por nome ou e-mail.
- **Ações disponíveis por perfil:**
  - `Administrador`: Criar usuário, editar, bloquear, reativar, remover, enviar link de redefinição de senha.
- **Referências visuais:**
  - Tabela com linhas alternadas em Branco `#FFFFFF` e Azul Claro `#6ED8E0` com opacidade reduzida.
  - Status `ativo` em verde, `bloqueado` em vermelho, `pendente` em amarelo, `removido` em cinza.
  - Botões de ação em Azul Médio `#465EBE`.
  - Ação destrutiva (bloqueio/remoção) com confirmação em modal.

### 8.6 Tela de Detalhe/Edição de Usuário (Backoffice)

- **Propósito:** Visualizar e editar dados de um usuário específico.
- **Campos exibidos:** Nome, e-mail, perfil, status, `supplier_id` (para fornecedores), e-mail original (quando alterado), data de criação, data de bloqueio.
- **Ações disponíveis:**
  - `Administrador`: Editar nome, editar e-mail (para fornecedor), bloquear, reativar, enviar link de redefinição, remover.
- **Referências visuais:** Card em Branco `#FFFFFF` com cabeçalho em Azul Escuro `#324598`.

### 8.7 Componente de Perfil do Usuário Logado

- **Propósito:** Exibir informações do usuário logado e permitir ações de conta.
- **Campos exibidos:** Nome, e-mail, perfil.
- **Ações disponíveis:** Alterar senha, logout.
- **Localização:** Presente no header/navbar de todas as telas, como dropdown ou sidebar.

## 9. Integrações e dependências externas

### 9.1 Integração com Supabase Auth

- Este módulo utiliza o Supabase Auth como serviço de identidade para:
  - Criação de contas (`signUp`).
  - Login por e-mail e senha (`signInWithPassword`).
  - Disparo de link de definição/redefinição de senha (`resetPasswordForEmail`, magic links/invites).
  - Gerenciamento de sessão (tokens JWT).
  - Atualização de e-mail (`updateUser`).
- O Supabase Auth é o provedor de identidade, mas a tabela `users` no schema `public` complementa com perfil, status e dados operacionais que o Auth não cobre nativamente.

### 9.2 Dependência do Módulo 7 (Integração com o Sienge)

- O e-mail inicial do fornecedor é obtido via `GET /creditors/{creditorId}`, campo `contacts[].email` (primeiro preenchido). *(PRDGlobal §9.5)*
- Esta dependência não bloqueia a implementação deste módulo: o `Administrador` pode informar o e-mail manualmente na criação do acesso.
- Quando o Módulo 7 estiver implementado, o fluxo de criação de acesso de fornecedor pode ser enriquecido com busca automática.

## 10. Auditoria e rastreabilidade

Eventos auditáveis gerados por este módulo, conforme §12.6 do PRDGlobal:

| Evento | Descrição | Dados mínimos |
|--------|-----------|---------------|
| `user.created` | Novo acesso criado | Actor, target_user, role, email |
| `user.login` | Login bem-sucedido | Actor, IP, timestamp |
| `user.login_failed` | Tentativa de login falhada | Email tentado, IP, timestamp |
| `user.logout` | Logout executado | Actor, timestamp |
| `user.blocked` | Acesso bloqueado | Actor, target_user |
| `user.reactivated` | Acesso reativado | Actor, target_user |
| `user.removed` | Acesso removido | Actor, target_user |
| `user.email_changed` | E-mail do fornecedor alterado | Actor, target_user, old_email, new_email |
| `user.edited` | Dados do usuário editados | Actor, target_user, campos alterados |
| `password.reset_requested` | Solicitação de redefinição de senha | Email, IP |
| `password.reset_completed` | Senha redefinida | User ID |
| `password.reset_by_admin` | Redefinição iniciada pelo Administrador | Actor, target_user |
| `password.set_first_access` | Senha definida no primeiro acesso | User ID |

## 11. Validações pendentes de homologação

Da §17 do PRDGlobal, os itens que se aplicam diretamente a este módulo:

| # | Item | Relevância para este módulo |
|---|------|-----------------------------|
| 1 | Validar se `supplierId` corresponde a `creditorId` | O `supplier_id` armazenado na tabela `users` para fornecedores precisa corresponder ao `creditorId` usado para buscar e-mail. Se não houver correspondência, o fluxo de criação de acesso de fornecedor pode ter inconsistências. |
| 2 | Validar regra do primeiro `contacts[].email` preenchido | Impacta diretamente a obtenção do e-mail para criação de acesso do fornecedor. |

## 12. Critérios de aceite

- [ ] O sistema permite login por e-mail e senha para os 4 perfis (`Fornecedor`, `Compras`, `Administrador`, `Visualizador de Pedidos`).
- [ ] O primeiro acesso de qualquer perfil ocorre por link seguro com validade de 24 horas.
- [ ] Após expiração do link de primeiro acesso, um novo pode ser gerado pelo `Administrador`.
- [ ] O `Fornecedor` e usuários internos conseguem redefinir a própria senha via "Esqueci minha senha".
- [ ] O `Administrador` consegue iniciar redefinição de senha para qualquer usuário.
- [ ] O link de redefinição de senha expira em 24 horas.
- [ ] A política de senha da V1.0 exige apenas mínimo de 8 caracteres.
- [ ] A sessão não expira por inatividade; o encerramento ocorre por logout manual.
- [ ] Apenas o `Administrador` pode criar, editar, bloquear, reativar e remover acessos.
- [ ] O `Administrador` consegue alterar o e-mail local do fornecedor, e o novo e-mail vale imediatamente para login e notificações.
- [ ] A alteração de e-mail do fornecedor não retorna ao Sienge.
- [ ] O e-mail original do Sienge é preservado quando o `Administrador` altera o e-mail local.
- [ ] O bloqueio de um fornecedor interrompe imediatamente notificações e operação no portal.
- [ ] Se não houver e-mail válido (nem do Sienge, nem cadastrado localmente), o fornecedor não pode operar no portal.
- [ ] O `Fornecedor` acessa apenas os próprios dados.
- [ ] O `Visualizador de Pedidos` não pode alterar dados nem acessar dashboards.
- [ ] Cada ação relevante gera um registro na trilha de auditoria com data/hora, tipo, ator e alvo.
- [ ] Os registros de auditoria são imutáveis (append-only).
- [ ] Os endpoints da API aplicam RBAC por perfil conforme especificado.
- [ ] Tentativas de acesso não autorizado retornam `403` sem revelar informações internas.
- [ ] A tela de login exibe a logo GRF e segue a paleta de cores institucional.

## 13. Fases de implementação sugeridas

### Fase 1 — Infraestrutura de identidade
1. Configurar Supabase Auth (e-mail/senha) no projeto `dbGRF`.
2. Criar migration da tabela `users` com campos, constraints e índices.
3. Criar migration da tabela `audit_log`.
4. Configurar RLS (Row Level Security) mínimo nas tabelas.

### Fase 2 — Backend de autenticação
5. Implementar endpoint de login (`POST /api/auth/login`).
6. Implementar endpoint de logout (`POST /api/auth/logout`).
7. Implementar endpoint "esqueci minha senha" (`POST /api/auth/forgot-password`).
8. Implementar endpoint de redefinição de senha (`POST /api/auth/reset-password`).
9. Implementar endpoint de perfil do usuário logado (`GET /api/auth/me`).
10. Implementar middleware de RBAC central que valida perfil em cada rota protegida.

### Fase 3 — Backend de gestão de usuários
11. Implementar CRUD de usuários (`GET /api/users`, `GET /api/users/:id`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id`).
12. Implementar ações de bloqueio e reativação.
13. Implementar ação de envio de link de redefinição pelo `Administrador`.
14. Implementar lógica de alteração de e-mail de fornecedor com preservação do `original_email`.
15. Integrar serviço de auditoria para todos os eventos listados.

### Fase 4 — Frontend de autenticação
16. Implementar tela de login.
17. Implementar tela de primeiro acesso (definição de senha).
18. Implementar tela de solicitação de redefinição de senha.
19. Implementar tela de redefinição de senha (nova senha).
20. Implementar componente de perfil do usuário logado (header/navbar).
21. Implementar guarda de rota (proteção de rotas por autenticação e perfil).

### Fase 5 — Frontend de gestão de usuários
22. Implementar tela de listagem de usuários com filtros.
23. Implementar tela de criação de usuário.
24. Implementar tela de detalhe/edição de usuário.
25. Implementar ações de bloqueio, reativação, remoção e redefinição de senha na UI.

### Fase 6 — Testes e validação
26. Testes de autenticação (login, logout, expiração de link, política de senha).
27. Testes de RBAC (acesso autorizado e negado por perfil).
28. Testes de gestão de ciclo de vida (criar, bloquear, reativar, remover).
29. Testes de auditoria (verificar que todos os eventos geram registro).
30. Testes de isolamento de dados (fornecedor acessa apenas dados próprios).

## 14. Riscos específicos do módulo

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Supabase Auth não suportar customização necessária para o fluxo de primeiro acesso (invite link com validade configurável). | Pode exigir implementação customizada de invite flow. | Média | Verificar documentação do Supabase Auth para `inviteUserByEmail` e configuração de expiração. Prever alternativa com link manual se necessário. |
| Inconsistência entre `supplierId` e `creditorId` nas APIs do Sienge. | O e-mail do fornecedor pode não ser encontrado automaticamente, exigindo intervenção manual do `Administrador`. | Média | Prever caminho manual como fallback desde o início. Esse risco será endereçado pela homologação (§17, item 1). |
| Atualização de e-mail no Supabase Auth não refletir imediatamente na sessão ativa do fornecedor. | Fornecedor pode enfrentar problema de login logo após a alteração. | Baixa | Invalidar sessão do fornecedor após alteração de e-mail e exigir novo login. |
| Falta de bloqueio automático por tentativas inválidas (decisão explícita da V1.0). | Exposição a ataques de força bruta. | Baixa (V1.0 opera em escopo controlado) | Monitorar via logs de auditoria (`user.login_failed`). Implementar rate limiting básico na camada de API. |
| Monorepo não inicializado bloqueia implementação. | Nenhum código pode ser executado ou testado. | Alta | Pré-requisito: inicializar monorepo antes da Fase 1 deste módulo, conforme documentado no relatório de reconhecimento. |
