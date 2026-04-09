# PRD Filho — Backoffice, Auditoria e Operação

> Módulo: 9 de 9
> Seções do PRDGlobal: §12, §14
> Dependências: Todos os módulos anteriores (1–8)
> Data de geração: 2026-04-06

---

## 1. Objetivo do módulo

O módulo de Backoffice, Auditoria e Operação é a camada transversal que unifica a visão operacional de todos os fluxos do sistema em um único painel de controle interno. Ele concentra as telas de listagem, filtro, priorização visual e tratamento de exceções que permitem à equipe de `Compras` e ao `Administrador` monitorar cotações, pedidos, entregas, avarias e integrações com o Sienge de forma eficiente e rastreável.

Além da operação do dia a dia, este módulo implementa a trilha de auditoria persistida que registra todos os eventos críticos do sistema — desde o envio de uma cotação até a definição de uma ação corretiva de avaria — com data, hora, usuário, tipo e resumo da ação. Essa trilha é a base de governança e compliance operacional da V1.0.

Por fim, o módulo consolida os critérios de aceite macro (§14 do PRDGlobal) que definem os campos mínimos de listagem em cada tela do backoffice e do portal do fornecedor, garantindo que todas as interfaces operacionais estejam alinhadas com os requisitos aprovados de produto.

## 2. Escopo funcional

### 2.1 Incluso neste PRD

- Tela de listagem de cotações no backoffice com campos mínimos obrigatórios (§14.1).
- Tela de listagem de pedidos e follow-up no backoffice com campos mínimos obrigatórios (§14.1).
- Definição dos campos mínimos de listagem do portal do fornecedor — pedidos e cotações (§14.1).
- Status mínimos de integração e sua sinalização visual (§12.1).
- Tratamento de falha de integração com reprocessamento automático e manual (§12.2).
- Filtro rápido "Exigem ação" com os status operacionais obrigatórios (§12.3).
- Priorização visual da operação na lista de pedidos e follow-up (§12.4).
- Cores operacionais por status (§12.5).
- Trilha de auditoria operacional com eventos registráveis mínimos e campos obrigatórios por evento (§12.6).
- Critérios de aceite macro para cotação, follow-up, entrega, avaria, autenticação e integração (§14.2 a §14.7).

### 2.2 Excluído deste PRD

- Lógica de fluxo de cotação (resposta, aprovação, reprovação, reenvio) → PRD 02 (Fluxo de Cotação).
- Lógica de follow-up logístico (régua de cobrança, cálculo de dias úteis, notificações sequenciais) → PRD 04 (Follow-up Logístico).
- Lógica de entrega, divergência e cálculo de status de pedido → PRD 05 (Entrega, Divergência e Status de Pedido).
- Lógica de avaria e ação corretiva (registro, sugestão, definição) → PRD 06 (Avaria e Ação Corretiva).
- Clientes HTTP, adaptadores e reconciliação com Sienge → PRD 07 (Integração com o Sienge).
- Dashboards, KPIs e indicadores analíticos → PRD 08 (Dashboard e Indicadores).
- Gestão de usuários e credenciais (CRUD de usuários, bloqueio, reativação) → PRD 01 (Autenticação e Perfis).
- Templates e envio de notificações por e-mail → PRD 03 (Notificações de Cotação).

### 2.3 Fora de escopo da V1.0

- Políticas avançadas de segurança além do mínimo operacional (§2.3 do PRDGlobal).
- Régua separada por parcela de entrega do mesmo item (§2.3 do PRDGlobal).
- Notificação por WhatsApp (V2.0).

## 3. Perfis envolvidos

| Perfil | Permissões neste módulo | Restrições |
|--------|------------------------|------------|
| `Compras` | Acessa backoffice completo: listagens de cotações e pedidos, filtro "Exigem ação", tratamento de exceções, acionamento de reprocessamento manual, consulta à trilha de auditoria. | Não pode gerir acessos de usuários nem parametrizar workflow. |
| `Administrador` | Acesso total ao backoffice, incluindo todas as permissões de `Compras`, além de parametrização de regras, monitoramento de integrações e governança. | Não pode aprovar respostas de cotação nem definir ações corretivas de avaria. |
| `Visualizador de Pedidos` | Consulta pedidos e entregas no backoffice (somente leitura). | Não altera dados, não acessa filtro "Exigem ação", não acessa dashboards/indicadores, não aciona reprocessamento. *(PRDGlobal §3.2)* |
| `Fornecedor` | Acessa apenas as listagens do portal do fornecedor (cotações e pedidos próprios). | Não acessa o backoffice interno. *(PRDGlobal §3.2)* |

## 4. Entidades e modelagem

### 4.1 Entidade: `audit_events` (Trilha de Auditoria)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `id` | UUID | Sim | Identificador único do evento. |
| `event_type` | ENUM/VARCHAR | Sim | Tipo do evento (ver lista em §12.6). |
| `event_timestamp` | TIMESTAMPTZ | Sim | Data e hora do evento (UTC). |
| `actor_id` | UUID | Sim | ID do usuário ou serviço que originou o evento. |
| `actor_type` | ENUM/VARCHAR | Sim | Tipo do ator: `user`, `system`, `integration`. |
| `quotation_id` | UUID | Não | Cotação afetada, quando houver. |
| `order_id` | UUID | Não | Pedido afetado, quando houver. |
| `supplier_id` | UUID | Não | Fornecedor afetado, quando houver. |
| `summary` | TEXT | Sim | Resumo da ação realizada. |
| `metadata` | JSONB | Não | Dados complementares do evento (ex.: payload de integração, motivo de reprovação). |
| `created_at` | TIMESTAMPTZ | Sim | Data de criação do registro. |

**Relacionamentos:**
- `actor_id` → `users.id` (quando ator é usuário).
- `quotation_id` → `quotations.id` (quando aplicável).
- `order_id` → `orders.id` (quando aplicável).
- `supplier_id` → `suppliers.id` (quando aplicável).

**Índices sugeridos:**
- `idx_audit_event_type` em `event_type`.
- `idx_audit_event_timestamp` em `event_timestamp`.
- `idx_audit_quotation_id` em `quotation_id`.
- `idx_audit_order_id` em `order_id`.
- `idx_audit_supplier_id` em `supplier_id`.
- `idx_audit_actor_id` em `actor_id`.

**Regras de integridade:**
- `event_type` deve pertencer à lista de tipos auditáveis definidos em §12.6.
- `event_timestamp` e `created_at` são preenchidos automaticamente pelo sistema.
- A trilha de auditoria é append-only: registros nunca são editados ou removidos durante a operação.
- Após `1 ano`, os registros podem ser arquivados conforme §11.5 do PRDGlobal (LGPD).

### 4.2 Entidade: `integration_events` (Eventos de Integração)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `id` | UUID | Sim | Identificador único do evento de integração. |
| `integration_type` | VARCHAR | Sim | Tipo da integração (ex.: `quotation_response`, `delivery_sync`, `order_sync`). |
| `status` | ENUM/VARCHAR | Sim | Status: `pending`, `success`, `failure`. |
| `entity_type` | VARCHAR | Sim | Tipo da entidade envolvida (ex.: `quotation`, `order`, `invoice`). |
| `entity_id` | UUID | Sim | ID da entidade envolvida. |
| `attempt_count` | INTEGER | Sim | Número de tentativas realizadas (default: 1). |
| `max_attempts` | INTEGER | Sim | Número máximo de tentativas automáticas (default: 3 para cotação). |
| `next_retry_at` | TIMESTAMPTZ | Não | Data/hora da próxima tentativa automática. |
| `last_error` | TEXT | Não | Mensagem de erro da última tentativa. |
| `error_details` | JSONB | Não | Detalhes técnicos do erro (status HTTP, payload de resposta). |
| `resolved_at` | TIMESTAMPTZ | Não | Data/hora em que a integração foi concluída com sucesso ou encerrada. |
| `resolved_by` | UUID | Não | ID do usuário que acionou o reprocessamento manual bem-sucedido. |
| `created_at` | TIMESTAMPTZ | Sim | Data de criação do registro. |
| `updated_at` | TIMESTAMPTZ | Sim | Data da última atualização. |

**Relacionamentos:**
- `entity_id` → referência polimórfica à entidade envolvida.
- `resolved_by` → `users.id`.

**Índices sugeridos:**
- `idx_integration_status` em `status`.
- `idx_integration_entity` em `(entity_type, entity_id)`.
- `idx_integration_next_retry` em `next_retry_at` (para o scheduler de reprocessamento).

**Regras de integridade:**
- O `status` inicial é `pending`.
- Transições permitidas: `pending` → `success`, `pending` → `failure`, `failure` → `pending` (reprocessamento), `failure` → `success`.
- `next_retry_at` deve ser calculado como `last_attempt_at + 24 horas` (§12.2).
- `attempt_count` não pode ultrapassar `max_attempts` em reprocessamentos automáticos.

## 5. Regras de negócio

- **RN-01:** Os status mínimos de integração são `Pendente de integração`, `Integrado com sucesso` e `Falha de integração`. *(PRDGlobal §12.1)*
- **RN-02:** Os status de integração devem ser exibidos com as seguintes cores: `Pendente de integração` = amarelo, `Integrado com sucesso` = verde, `Falha de integração` = vermelho. *(PRDGlobal §12.1)*
- **RN-03:** Em caso de falha de integração com o Sienge, o sistema tenta novo reprocessamento automático após 24 horas. *(PRDGlobal §12.2)*
- **RN-04:** No envio de resposta de cotação ao Sienge, o sistema tenta mais 2 reenvios automáticos, com intervalo de 24 horas (total de 3 tentativas). *(PRDGlobal §12.2)*
- **RN-05:** Se a falha persistir após os reprocessamentos automáticos, `Compras` deve ser notificado. *(PRDGlobal §12.2)*
- **RN-06:** `Compras` pode acionar novo reprocessamento manual a partir do backoffice. *(PRDGlobal §12.2)*
- **RN-07:** Na V1.0, novas tentativas manuais podem continuar sendo feitas sem limite automático. *(PRDGlobal §12.2)*
- **RN-08:** O filtro rápido "Exigem ação" deve contemplar no mínimo os seguintes status: `Aguardando revisão de Compras`, `Correção solicitada`, `Falha de integração`, `Fornecedor inválido no mapa de cotação`, `Atrasado`, `Divergência`, `Em avaria`, `Reposição`. *(PRDGlobal §12.3)*
- **RN-09:** Na lista de pedidos e follow-up, a ordenação deve priorizar: pedidos `Atrasados` → pedidos em `Divergência` → pedidos em `Em avaria` ou `Reposição` → pedidos pendentes de resposta do fornecedor → pedidos no prazo ou entregues. *(PRDGlobal §12.4)*
- **RN-10:** As cores operacionais obrigatórias são: `Atrasado` = vermelho, `Divergência` = laranja, `Em avaria` = roxo, `Reposição` = azul, `Entregue` = verde, `Parcialmente Entregue` = amarelo, `Cancelado` = cinza, `Aguardando reenvio ao Sienge` = amarelo, `Fornecedor inválido no mapa de cotação` = vermelho. *(PRDGlobal §12.5)*
- **RN-11:** A auditoria operacional deve registrar no mínimo: envio de cotação, leitura da cotação, resposta do fornecedor, aprovação por `Compras`, reprovação por `Compras`, reenvio para correção, integração com sucesso, falha de integração, alteração de data prometida, confirmação de entrega no prazo, registro de avaria, definição de ação corretiva. *(PRDGlobal §12.6)*
- **RN-12:** Cada evento de auditoria deve exibir: data e hora, tipo do evento, usuário ou origem do evento, cotação ou pedido afetado, fornecedor afetado (quando houver), resumo da ação realizada. *(PRDGlobal §12.6)*
- **RN-13:** A trilha de auditoria tem retenção padrão de 1 ano, após o qual os dados podem ser arquivados. *(PRDGlobal §11.5)*
- **RN-14:** A trilha de auditoria é append-only; registros não podem ser editados ou removidos durante a operação.

## 6. Fluxos operacionais

### 6.1 Fluxo de monitoramento e tratamento de exceções (Compras)

1. `Compras` acessa o backoffice e visualiza a lista de cotações ou a lista de pedidos/follow-up.
2. `Compras` ativa o filtro rápido "Exigem ação".
3. O sistema filtra e exibe apenas registros com os status definidos em RN-08.
4. Os registros são ordenados por prioridade visual conforme RN-09.
5. `Compras` clica em um registro para ver detalhes.
6. Dependendo do status:
   - `Aguardando revisão de Compras` → `Compras` revisa e aprova/reprova (lógica no PRD 02).
   - `Correção solicitada` → aguarda reenvio do fornecedor (lógica no PRD 02).
   - `Falha de integração` → `Compras` pode acionar reprocessamento manual (ver fluxo 6.2).
   - `Fornecedor inválido no mapa de cotação` → `Compras` investiga e trata (lógica no PRD 07).
   - `Atrasado` / `Divergência` → `Compras` trata operacionalmente (lógica no PRD 05).
   - `Em avaria` / `Reposição` → `Compras` define ação corretiva (lógica no PRD 06).

**Exceções:**
- Se não houver registros no filtro "Exigem ação", o sistema exibe mensagem informativa.

### 6.2 Fluxo de reprocessamento de integração

1. Uma integração com o Sienge falha (status = `Falha de integração`).
2. O sistema registra o evento na trilha de auditoria (tipo: `falha de integração`).
3. O sistema agenda reprocessamento automático para 24 horas depois (RN-03).
4. Se a integração for envio de resposta de cotação:
   - O sistema tenta mais 2 reenvios automáticos (total 3 tentativas), com intervalo de 24 horas (RN-04).
5. Se a falha persistir após todos os reprocessamentos automáticos:
   - O sistema notifica `Compras` (RN-05).
   - O registro continua exibido no filtro "Exigem ação" com status `Falha de integração` (vermelho).
6. `Compras` acessa o backoffice e localiza o registro.
7. `Compras` aciona o botão de reprocessamento manual.
8. O sistema tenta a integração novamente.
9. Se bem-sucedido: status muda para `Integrado com sucesso` (verde); evento registrado na auditoria.
10. Se falhar novamente: status permanece `Falha de integração`; `Compras` pode tentar novamente sem limite (RN-07).

**Diagrama de estados — Integração:**

```
[Pendente de integração] --(sucesso)--> [Integrado com sucesso]
[Pendente de integração] --(falha)--> [Falha de integração]
[Falha de integração] --(retry automático, sucesso)--> [Integrado com sucesso]
[Falha de integração] --(retry automático, falha + tentativas esgotadas)--> [Falha de integração] + notifica Compras
[Falha de integração] --(reprocessamento manual, sucesso)--> [Integrado com sucesso]
[Falha de integração] --(reprocessamento manual, falha)--> [Falha de integração]
```

### 6.3 Fluxo de consulta à trilha de auditoria

1. `Compras` ou `Administrador` acessa a seção de auditoria no backoffice.
2. O sistema exibe a lista de eventos de auditoria ordenada por data/hora (mais recente primeiro).
3. O usuário pode filtrar por:
   - Tipo de evento.
   - Cotação ou pedido específico.
   - Fornecedor específico.
   - Período de datas.
   - Usuário ou origem.
4. O sistema exibe para cada evento: data/hora, tipo, usuário/origem, cotação/pedido afetado, fornecedor (quando houver) e resumo da ação (RN-12).
5. O usuário pode expandir um evento para ver detalhes adicionais (metadata).

**Exceções:**
- Eventos com mais de 1 ano podem estar arquivados e não aparecer na consulta padrão (RN-13).

## 7. Contratos de API / Serviços

### 7.1 Listar cotações do backoffice

- **Método e rota:** `GET /api/backoffice/quotations`
- **Entrada:** `page` (integer, opcional, default: 1), `limit` (integer, opcional, default: 50), `status` (string, opcional), `supplier_id` (UUID, opcional), `date_start` (date, opcional), `date_end` (date, opcional), `require_action` (boolean, opcional — ativa filtro "Exigem ação").
- **Saída:** Lista paginada de cotações com campos mínimos: `quotation_number`, `supplier_name`, `status`, `date_start`, `date_end`, `read_indicator`, `response_status`, `closed_supplier` (boolean + nome e nº pedido quando houver), `purchase_order_number` (quando houver). *(PRDGlobal §14.1)*
- **Erros esperados:** `401 Unauthorized`, `403 Forbidden` (perfil sem acesso).
- **Perfis autorizados:** `Compras`, `Administrador`.

### 7.2 Listar pedidos e follow-up do backoffice

- **Método e rota:** `GET /api/backoffice/orders`
- **Entrada:** `page` (integer, opcional), `limit` (integer, opcional), `status` (string, opcional), `supplier_id` (UUID, opcional), `building_id` (UUID, opcional), `require_action` (boolean, opcional), `sort_priority` (boolean, opcional, default: true — aplica ordenação por prioridade operacional conforme RN-09).
- **Saída:** Lista paginada de pedidos com campos mínimos: `order_number`, `supplier_name`, `building_name`, `status`, `order_date`, `current_promised_date`, `delay_indicator`, `damage_or_divergence_indicator`, `pending_balance`, `linked_quotation_number`. *(PRDGlobal §14.1)*
- **Erros esperados:** `401 Unauthorized`, `403 Forbidden`.
- **Perfis autorizados:** `Compras`, `Administrador`, `Visualizador de Pedidos` (somente leitura, sem filtro "Exigem ação").

### 7.3 Listar cotações do portal do fornecedor

- **Método e rota:** `GET /api/supplier-portal/quotations`
- **Entrada:** `page` (integer, opcional), `limit` (integer, opcional).
- **Saída:** Lista paginada (apenas cotações do fornecedor autenticado) com campos mínimos: `quotation_number`, `status`, `date_start`, `date_end`, `read_indicator`, `response_status`. *(PRDGlobal §14.1)*
- **Erros esperados:** `401 Unauthorized`, `403 Forbidden`.
- **Perfis autorizados:** `Fornecedor`.

### 7.4 Listar pedidos do portal do fornecedor

- **Método e rota:** `GET /api/supplier-portal/orders`
- **Entrada:** `page` (integer, opcional), `limit` (integer, opcional).
- **Saída:** Lista paginada (apenas pedidos do fornecedor autenticado) com campos mínimos: `order_number`, `status`, `current_promised_date`, `order_date`, `delay_indicator`, `damage_or_replacement_indicator`, `building_name` (quando disponível). *(PRDGlobal §14.1)*
- **Erros esperados:** `401 Unauthorized`, `403 Forbidden`.
- **Perfis autorizados:** `Fornecedor`.

### 7.5 Reprocessar integração manualmente

- **Método e rota:** `POST /api/backoffice/integrations/{integration_event_id}/retry`
- **Entrada:** `integration_event_id` (UUID, path param).
- **Saída:** `{ status: "pending" | "success" | "failure", attempt_count: number, message: string }`.
- **Erros esperados:** `401 Unauthorized`, `403 Forbidden`, `404 Not Found` (evento não existe), `409 Conflict` (já em processamento), `422 Unprocessable Entity` (integração já resolvida com sucesso).
- **Perfis autorizados:** `Compras`, `Administrador`.

### 7.6 Listar eventos de integração

- **Método e rota:** `GET /api/backoffice/integrations`
- **Entrada:** `page` (integer, opcional), `limit` (integer, opcional), `status` (string, opcional: `pending`, `success`, `failure`), `entity_type` (string, opcional), `entity_id` (UUID, opcional).
- **Saída:** Lista paginada de eventos de integração com campos: `id`, `integration_type`, `status`, `entity_type`, `entity_id`, `attempt_count`, `last_error`, `next_retry_at`, `created_at`, `resolved_at`.
- **Erros esperados:** `401 Unauthorized`, `403 Forbidden`.
- **Perfis autorizados:** `Compras`, `Administrador`.

### 7.7 Listar eventos de auditoria

- **Método e rota:** `GET /api/backoffice/audit`
- **Entrada:** `page` (integer, opcional), `limit` (integer, opcional), `event_type` (string, opcional), `quotation_id` (UUID, opcional), `order_id` (UUID, opcional), `supplier_id` (UUID, opcional), `actor_id` (UUID, opcional), `date_start` (datetime, opcional), `date_end` (datetime, opcional).
- **Saída:** Lista paginada de eventos de auditoria com campos: `id`, `event_type`, `event_timestamp`, `actor_id`, `actor_type`, `quotation_id`, `order_id`, `supplier_id`, `summary`, `metadata`.
- **Erros esperados:** `401 Unauthorized`, `403 Forbidden`.
- **Perfis autorizados:** `Compras`, `Administrador`.

### 7.8 Obter detalhe de evento de auditoria

- **Método e rota:** `GET /api/backoffice/audit/{audit_event_id}`
- **Entrada:** `audit_event_id` (UUID, path param).
- **Saída:** Evento completo de auditoria com todos os campos, incluindo `metadata` expandido.
- **Erros esperados:** `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- **Perfis autorizados:** `Compras`, `Administrador`.

### 7.9 Serviço interno: Registrar evento de auditoria

- **Nome do serviço:** `AuditService.registerEvent()`
- **Entrada:** `event_type` (string), `actor_id` (UUID), `actor_type` (string), `quotation_id` (UUID, opcional), `order_id` (UUID, opcional), `supplier_id` (UUID, opcional), `summary` (string), `metadata` (object, opcional).
- **Saída:** `audit_event_id` (UUID).
- **Erros esperados:** `ValidationError` (campo obrigatório ausente), `DatabaseError`.
- **Perfis autorizados:** Interno apenas (chamado por outros módulos).

### 7.10 Serviço interno: Registrar evento de integração

- **Nome do serviço:** `IntegrationService.registerEvent()`
- **Entrada:** `integration_type` (string), `entity_type` (string), `entity_id` (UUID), `status` (string), `error_message` (string, opcional), `error_details` (object, opcional).
- **Saída:** `integration_event_id` (UUID).
- **Erros esperados:** `ValidationError`, `DatabaseError`.
- **Perfis autorizados:** Interno apenas.

## 8. Interface do usuário

### 8.1 Tela: Lista de Cotações — Backoffice

- **Propósito:** Exibir todas as cotações importadas do Sienge com visão operacional unificada.
- **Campos exibidos por registro:**
  - Número da cotação.
  - Fornecedor.
  - Status (com cor operacional conforme RN-10).
  - Data de início.
  - Data de fim.
  - Indicação de leitura (ícone lido/não lido).
  - Situação da resposta.
  - Indicação `Fornecedor fechado` com nome do fornecedor e número do pedido (quando houver).
  - Número do pedido de compra (quando houver).
- **Ações disponíveis:**
  - `Compras` / `Administrador`: filtrar por status, fornecedor, período; ativar filtro "Exigem ação"; clicar para ver detalhes.
- **Referências visuais:** Azul Escuro `#324598` para cabeçalhos; Branco `#FFFFFF` para fundo; cores operacionais conforme §12.5; badges com Turquesa `#19B4BE` para contadores.

### 8.2 Tela: Lista de Pedidos e Follow-up — Backoffice

- **Propósito:** Exibir todos os pedidos em acompanhamento com priorização visual.
- **Campos exibidos por registro:**
  - Número do pedido.
  - Fornecedor.
  - Obra.
  - Status (com cor operacional conforme RN-10).
  - Data do pedido.
  - Data prometida atual.
  - Indicação de atraso (ícone/badge vermelho).
  - Indicação de avaria ou divergência (ícone/badge).
  - Saldo pendente.
  - Número da cotação vinculada.
- **Ações disponíveis:**
  - `Compras` / `Administrador`: filtrar, ordenar, ativar "Exigem ação", acionar reprocessamento (em registros com falha de integração), clicar para detalhes.
  - `Visualizador de Pedidos`: somente visualização e filtro por obra/fornecedor/período.
- **Referências visuais:** Ordenação por prioridade conforme RN-09; cores operacionais conforme §12.5; indicadores de saldo em Azul Médio `#465EBE`.

### 8.3 Tela: Lista de Cotações — Portal do Fornecedor

- **Propósito:** Exibir as cotações do fornecedor autenticado, priorizadas por ação pendente.
- **Campos exibidos por registro:**
  - Número da cotação.
  - Status.
  - Data de início.
  - Data de fim.
  - Indicação de leitura.
  - Situação da resposta.
- **Ações disponíveis:**
  - `Fornecedor`: visualizar detalhes, responder (quando permitido pelo fluxo de cotação).
- **Referências visuais:** Paleta GRF; ordenação conforme §4.8 do PRDGlobal (abertas e pendentes primeiro).

### 8.4 Tela: Lista de Pedidos — Portal do Fornecedor

- **Propósito:** Exibir os pedidos do fornecedor autenticado.
- **Campos exibidos por registro:**
  - Número do pedido.
  - Status.
  - Data prometida atual.
  - Data do pedido.
  - Indicação de atraso.
  - Indicação de avaria ou reposição.
  - Obra (quando disponível).
- **Ações disponíveis:**
  - `Fornecedor`: visualizar detalhes, confirmar prazo ou sugerir nova data (quando no fluxo de follow-up).
- **Referências visuais:** Paleta GRF; cores operacionais conforme §12.5.

### 8.5 Tela: Monitor de Integrações — Backoffice

- **Propósito:** Exibir o status de todas as integrações com o Sienge.
- **Campos exibidos:**
  - Tipo da integração.
  - Entidade e ID.
  - Status (com cor: amarelo = pendente, verde = sucesso, vermelho = falha).
  - Número de tentativas.
  - Erro da última tentativa.
  - Próxima tentativa automática (quando aplicável).
  - Data de criação.
  - Data de resolução (quando aplicável).
- **Ações disponíveis:**
  - `Compras` / `Administrador`: filtrar por status, acionar reprocessamento manual (botão "Reprocessar" em registros com falha).
- **Referências visuais:** Badges de status com cores de §12.1.

### 8.6 Tela: Trilha de Auditoria — Backoffice

- **Propósito:** Exibir todos os eventos auditáveis do sistema de forma cronológica.
- **Campos exibidos por evento:**
  - Data e hora.
  - Tipo do evento (com ícone representativo).
  - Usuário ou origem.
  - Cotação ou pedido afetado.
  - Fornecedor afetado (quando houver).
  - Resumo da ação realizada.
- **Ações disponíveis:**
  - `Compras` / `Administrador`: filtrar por tipo de evento, cotação, pedido, fornecedor, usuário, período; expandir evento para ver detalhes (metadata).
- **Referências visuais:** Fundo branco, tipografia limpa; Azul Escuro `#324598` para cabeçalhos de coluna; Azul Claro `#6ED8E0` para hover em linhas.

### 8.7 Componente: Filtro "Exigem Ação"

- **Propósito:** Toggle/botão rápido que filtra as listagens para exibir apenas registros que exigem intervenção operacional.
- **Status contemplados:** `Aguardando revisão de Compras`, `Correção solicitada`, `Falha de integração`, `Fornecedor inválido no mapa de cotação`, `Atrasado`, `Divergência`, `Em avaria`, `Reposição`.
- **Ações disponíveis:**
  - `Compras` / `Administrador`: ativar/desativar o filtro; contador visual de itens pendentes.
- **Referências visuais:** Badge com contagem em Turquesa `#19B4BE`; estado ativo em Azul Médio `#465EBE`.

### 8.8 Componente: Botão de Reprocessamento Manual

- **Propósito:** Permitir que `Compras` acione nova tentativa de integração com o Sienge.
- **Localização:** Disponível em registros com status `Falha de integração`, tanto na lista de cotações/pedidos quanto no monitor de integrações.
- **Ações disponíveis:**
  - `Compras` / `Administrador`: clicar para acionar reprocessamento; confirmação modal antes do envio.
- **Referências visuais:** Botão em Azul Médio `#465EBE`; feedback visual de loading durante processamento; ícone de sucesso (verde) ou falha (vermelho) após resultado.

## 9. Integrações e dependências externas

### 9.1 Dependência: Módulo de Integração com o Sienge (PRD 07)

- O módulo de Backoffice não implementa os clientes HTTP nem os adaptadores de integração.
- O monitor de integrações e o reprocessamento manual dependem dos serviços expostos pelo PRD 07.
- Os eventos de integração (`integration_events`) são populados pelo PRD 07 e exibidos pelo presente módulo.

### 9.2 Dependência: Módulo de Cotação (PRD 02)

- Os campos de listagem de cotações no backoffice e no portal dependem das entidades e status definidos no PRD 02.
- O filtro "Exigem ação" utiliza os status operacionais de cotação definidos no PRD 02.

### 9.3 Dependência: Módulo de Follow-up (PRD 04) e Entrega (PRD 05)

- Os campos de listagem de pedidos no backoffice e no portal dependem das entidades e status dos PRDs 04 e 05.
- A priorização visual (RN-09) utiliza os status de pedido definidos nos PRDs 04 e 05.

### 9.4 Dependência: Módulo de Avaria (PRD 06)

- Os status `Em avaria` e `Reposição` são definidos no PRD 06 e consumidos pelo backoffice.

### 9.5 Dependência: Módulo de Autenticação (PRD 01)

- O RBAC e o controle de acesso às telas do backoffice dependem dos perfis e permissões do PRD 01.

### 9.6 Tratamento de falhas

- Se o serviço de auditoria estiver indisponível, o evento deve ser enfileirado localmente e persistido assim que o serviço retornar.
- Falhas na gravação de auditoria nunca devem bloquear a operação principal do usuário.

## 10. Auditoria e rastreabilidade

Este módulo é o próprio responsável pela infraestrutura de auditoria do sistema. Os eventos auditáveis que devem ser registrados são definidos em §12.6 do PRDGlobal:

| Tipo de evento | Descrição | Origem típica |
|----------------|-----------|---------------|
| `quotation_sent` | Envio de cotação ao fornecedor | PRD 02 |
| `quotation_read` | Fornecedor abre a cotação no portal | PRD 02 |
| `quotation_response` | Fornecedor responde a cotação | PRD 02 |
| `quotation_approved` | Aprovação de resposta por `Compras` | PRD 02 |
| `quotation_rejected` | Reprovação de resposta por `Compras` | PRD 02 |
| `quotation_correction_requested` | Reenvio para correção | PRD 02 |
| `integration_success` | Integração com Sienge bem-sucedida | PRD 07 |
| `integration_failure` | Falha de integração com Sienge | PRD 07 |
| `promised_date_changed` | Alteração de data prometida | PRD 04 |
| `delivery_confirmed` | Confirmação de entrega no prazo | PRD 05 |
| `damage_registered` | Registro de avaria | PRD 06 |
| `corrective_action_defined` | Definição de ação corretiva | PRD 06 |

Cada evento deve conter os campos mínimos definidos em RN-12.

## 11. Validações pendentes de homologação

Os seguintes itens da §17 do PRDGlobal se aplicam a este módulo:

- **§17, item 8:** Validar se `GET /purchase-invoices/deliveries-attended` cobre todos os cenários reais de entrega da operação — impacta a exibição de status de pedido nas listagens do backoffice.
- **§17, item 3:** Validar disponibilidade do webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` — impacta a exibição do campo "número do pedido de compra" na lista de cotações e o vínculo cotação-pedido.
- **§17, item 7:** Validar cenários com múltiplas cotações em `purchaseQuotations[]` — impacta a exibição correta do campo "cotação vinculada" na lista de pedidos.

## 12. Critérios de aceite

### Backoffice — Cotações
- [ ] A lista de cotações do backoffice exibe todos os campos mínimos obrigatórios: número da cotação, fornecedor, status, data de início, data de fim, indicação de leitura, situação da resposta, indicação `Fornecedor fechado` (com nome e nº pedido), número do pedido de compra. *(§14.1)*
- [ ] O filtro "Exigem ação" filtra corretamente os 8 status obrigatórios. *(§12.3)*

### Backoffice — Pedidos e Follow-up
- [ ] A lista de pedidos do backoffice exibe todos os campos mínimos obrigatórios: número do pedido, fornecedor, obra, status, data do pedido, data prometida atual, indicação de atraso, indicação de avaria/divergência, saldo pendente, número da cotação vinculada. *(§14.1)*
- [ ] A ordenação padrão segue a priorização visual: Atrasados > Divergência > Em avaria/Reposição > pendentes de resposta > no prazo/entregues. *(§12.4)*

### Portal do Fornecedor — Cotações
- [ ] A lista de cotações do portal exibe: número da cotação, status, data de início, data de fim, indicação de leitura, situação da resposta. *(§14.1)*
- [ ] A ordenação segue a prioridade: abertas e pendentes > correção solicitada > em revisão > encerradas. *(§4.8)*

### Portal do Fornecedor — Pedidos
- [ ] A lista de pedidos do portal exibe: número do pedido, status, data prometida atual, data do pedido, indicação de atraso, indicação de avaria/reposição, obra (quando disponível). *(§14.1)*

### Status de Integração
- [ ] Os 3 status de integração (`Pendente de integração`, `Integrado com sucesso`, `Falha de integração`) são exibidos com as cores corretas (amarelo, verde, vermelho). *(§12.1)*

### Reprocessamento
- [ ] Em falha de integração, o sistema agenda reprocessamento automático após 24 horas. *(§12.2)*
- [ ] No envio de cotação ao Sienge, o sistema tenta até 3 tentativas (1 original + 2 retries), com intervalo de 24 horas. *(§12.2)*
- [ ] Após todos os retries automáticos, `Compras` é notificado. *(§12.2)*
- [ ] `Compras` pode acionar reprocessamento manual sem limite na V1.0. *(§12.2)*

### Cores Operacionais
- [ ] Todos os status operacionais são exibidos com as cores corretas conforme §12.5.

### Auditoria
- [ ] Todos os 12 tipos de evento obrigatórios são registrados na trilha de auditoria. *(§12.6)*
- [ ] Cada evento exibe: data/hora, tipo, usuário/origem, cotação/pedido afetado, fornecedor (quando houver), resumo da ação. *(§12.6)*
- [ ] A trilha de auditoria é consultável com filtros por tipo, cotação, pedido, fornecedor, usuário e período.
- [ ] A trilha é append-only: nenhum registro pode ser editado ou removido.
- [ ] A retenção padrão de 1 ano é respeitada conforme §11.5.

### Permissões
- [ ] `Visualizador de Pedidos` acessa apenas consulta de pedidos e entregas, sem ações operacionais. *(§3.2)*
- [ ] `Fornecedor` acessa apenas o portal do fornecedor, sem acesso ao backoffice interno. *(§3.2)*

### Critérios Macro (§14)
- [ ] Cotação: o sistema importa do Sienge, exige data de entrega na resposta, permite edição dentro do prazo, exige aprovação de `Compras`, bloqueia após integração. *(§14.2)*
- [ ] Follow-up: inicia com pedido do Sienge, usa dias úteis e feriados nacionais, `Notificação 1` em 50% do prazo, títulos sequenciais, `Compras` copiado a partir da `Notificação 2`. *(§14.3)*
- [ ] Entrega: importação automática, fonte oficial é `deliveries-attended`, `Compras` valida OK ou Divergência, status corretos. *(§14.4)*
- [ ] Avaria: registrada por `Fornecedor` e `Compras`, status `Em avaria`, fornecedor sugere e `Compras` define, substituição vira `Reposição`. *(§14.5)*
- [ ] Autenticação: login por e-mail/senha, primeiro acesso por link seguro (24h), `Administrador` gere acessos. *(§14.6)*
- [ ] Integração: leitura pelos endpoints oficiais, e-mail via Credores, autenticação Basic, paginação, webhooks como gatilho, aprovação de `Compras` antes do retorno, falhas registradas/reprocessadas/notificadas. *(§14.7)*

## 13. Fases de implementação sugeridas

### Fase 1 — Infraestrutura de auditoria
1. Criar a entidade `audit_events` no banco.
2. Implementar o serviço interno `AuditService.registerEvent()`.
3. Expor a API de consulta de auditoria (`GET /api/backoffice/audit`).

### Fase 2 — Infraestrutura de integração
1. Criar a entidade `integration_events` no banco.
2. Implementar o serviço interno `IntegrationService.registerEvent()`.
3. Implementar o scheduler de reprocessamento automático (retry após 24h).
4. Expor a API de listagem e reprocessamento manual de integrações.

### Fase 3 — Listagens do backoffice
1. Implementar a listagem de cotações do backoffice com campos mínimos e filtros.
2. Implementar a listagem de pedidos/follow-up do backoffice com priorização visual.
3. Implementar o filtro "Exigem ação".
4. Aplicar as cores operacionais a todos os status.

### Fase 4 — Listagens do portal do fornecedor
1. Implementar a listagem de cotações do portal com campos mínimos.
2. Implementar a listagem de pedidos do portal com campos mínimos.
3. Aplicar a ordenação por prioridade definida em §4.8.

### Fase 5 — Monitor de integrações e reprocessamento
1. Implementar a tela de monitor de integrações.
2. Implementar o botão de reprocessamento manual com confirmação modal.
3. Integrar com feedback visual de resultado.

### Fase 6 — Trilha de auditoria (UI)
1. Implementar a tela de trilha de auditoria com filtros.
2. Implementar a expansão de detalhes de evento.
3. Validar que todos os 12 tipos de evento estão sendo registrados corretamente.

## 14. Riscos específicos do módulo

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Dependência de todos os módulos anteriores para exibição correta de status e campos | Atraso na implementação se módulos anteriores não estiverem prontos | Alta | Definir contratos de interface (tipos e enums) antecipadamente; implementar stubs/mocks; começar pela infraestrutura de auditoria e integração que é independente. |
| Volume de eventos de auditoria pode crescer rapidamente | Degradação de performance em consultas | Média | Índices otimizados; particionamento por data futuramente; política de arquivamento após 1 ano. |
| Inconsistência de status entre módulos (ex.: status exibido no backoffice não reflete o estado real da entidade) | Decisões operacionais incorretas por `Compras` | Média | Todos os módulos devem usar a mesma fonte de verdade (tabela de status normalizada); testes de integração cross-module. |
| Reprocessamento manual sem limite pode gerar sobrecarga de chamadas ao Sienge | Throttling ou bloqueio pela API do Sienge | Baixa | Implementar debounce no frontend (mínimo 30s entre cliques); respeitar rate limit de 200/min da API Sienge; feedback visual claro de processamento em andamento. |
| Falha na gravação de auditoria pode passar despercebida | Perda de rastreabilidade e compliance | Baixa | Enfileiramento local em caso de falha; monitoramento de erros no serviço de auditoria; a falha nunca bloqueia a operação principal. |
