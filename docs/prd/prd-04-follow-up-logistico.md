# PRD Filho — Follow-up Logístico

> Módulo: 4 de 9
> Seções do PRDGlobal: §6
> Dependências: 1 (Autenticação e Perfis), 5 (Entrega, Divergência e Status de Pedido), 7 (Integração com o Sienge)
> Data de geração: 2026-04-06

---

## 1. Objetivo do módulo

O módulo de Follow-up Logístico automatiza o acompanhamento de pedidos de compra após sua geração no Sienge, substituindo o processo manual e reativo de cobrança de prazos por uma régua de notificações parametrizável baseada em dias úteis.

O módulo resolve diretamente o problema de follow-up reativo descrito no PRDGlobal §1.1, em que a equipe de suprimentos perde tempo com cobranças manuais e possui baixa visibilidade sobre atrasos e entregas pendentes. O valor entregue é a redução de esforço manual de follow-up em 80%, a redução da taxa de atrasos para abaixo de 10% e a economia de mais de 40 horas/mês da equipe de suprimentos (PRDGlobal §1.3).

O follow-up opera como motor de workflow assíncrono que calcula prazos, dispara notificações sequenciais, processa respostas do fornecedor (confirmação de prazo ou sugestão de nova data) e sinaliza automaticamente pedidos atrasados — tudo sem depender do frontend ou de ação manual contínua de `Compras`.

## 2. Escopo funcional

### 2.1 Incluso neste PRD

- Início automático do follow-up quando pedido chega do Sienge.
- Cálculo de prazo em dias úteis com feriados nacionais.
- Régua de cobrança sequencial a partir de 50% do prazo.
- Notificações sequenciais (`Notificação 1`, `Notificação 2`, etc.).
- Cópia de `Compras` a partir da `Notificação 2`.
- Resposta do fornecedor: confirmação de prazo ou sugestão de nova data.
- Aprovação/reprovação de nova data por `Compras`.
- Reinício da régua com nova data prometida aprovada.
- Sinalização automática de `Atrasado` quando a data prometida vence sem entrega confirmada.
- Notificação automática de `Compras` em caso de atraso.
- Continuidade da régua em entrega parcial com saldo pendente.
- Simplificação V1.0 para múltiplas entregas (última data prometida consolidada).
- Telas do portal do fornecedor para resposta ao follow-up.
- Telas do backoffice para acompanhamento e aprovação de nova data.
- Auditoria de todos os eventos de follow-up.

### 2.2 Excluído deste PRD

- Importação e sincronização de pedidos do Sienge → Módulo 7 (Integração com o Sienge).
- Importação de notas fiscais e confirmação de entrega → Módulo 5 (Entrega, Divergência e Status de Pedido).
- Validação de `OK`/`Divergência` de entrega → Módulo 5.
- Cálculo e transição dos status `Parcialmente Entregue`, `Entregue`, `Divergência`, `Cancelado` → Módulo 5.
- Registro e tratamento de avaria e reposição → Módulo 6 (Avaria e Ação Corretiva).
- Autenticação, login, primeiro acesso e RBAC → Módulo 1 (Autenticação e Perfis).
- Dashboard e indicadores de follow-up → Módulo 8 (Dashboard e Indicadores).
- Filtro `Exigem ação` e backoffice completo → Módulo 9 (Backoffice, Auditoria e Operação).

### 2.3 Fora de escopo da V1.0

- Régua separada por parcela de entrega do mesmo item _(PRDGlobal §2.3, §6.5)_.
- Alteração automática da data planejada no Sienge a partir da data sugerida pelo fornecedor _(PRDGlobal §2.3, §6.4)_.

## 3. Perfis envolvidos

| Perfil                      | Permissões neste módulo                                                                                                                           | Restrições                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Fornecedor**              | Visualizar follow-up dos próprios pedidos; confirmar entrega no prazo; sugerir nova data prometida.                                               | Acessa apenas dados próprios. Não pode aprovar a própria sugestão de nova data. _(PRDGlobal §3.2, §3.3)_ |
| **Compras**                 | Visualizar todos os follow-ups; aprovar ou reprovar nova data sugerida; acompanhar régua e atrasos; receber notificações de atraso e confirmação. | Não pode gerir acessos nem parametrizar régua. _(PRDGlobal §3.2, §3.3)_                                  |
| **Administrador**           | Parametrizar régua de cobrança e regras de follow-up; editar templates de notificação de follow-up.                                               | Não pode aprovar nova data nem tomar decisões operacionais de follow-up. _(PRDGlobal §3.2, §3.3)_        |
| **Visualizador de Pedidos** | Consultar pedidos e status de follow-up (somente leitura).                                                                                        | Não pode alterar dados, responder follow-up nem acessar ações operacionais. _(PRDGlobal §3.2)_           |

## 4. Entidades e modelagem

### 4.1 `followup_tracking`

Rastreamento principal do follow-up por pedido/item.

| Campo                         | Tipo        | Obrigatório | Descrição                                                             |
| ----------------------------- | ----------- | ----------- | --------------------------------------------------------------------- |
| `id`                          | UUID        | Sim         | Identificador único                                                   |
| `purchase_order_id`           | INTEGER     | Sim         | ID do pedido no Sienge (`purchaseOrderId`)                            |
| `supplier_id`                 | INTEGER     | Sim         | ID do fornecedor (`supplierId`)                                       |
| `order_date`                  | DATE        | Sim         | Data do pedido no Sienge (marco inicial)                              |
| `promised_date_original`      | DATE        | Sim         | Data prometida original do Sienge                                     |
| `promised_date_current`       | DATE        | Sim         | Data prometida vigente (pode ser alterada por aprovação de `Compras`) |
| `status`                      | ENUM        | Sim         | `active`, `paused`, `completed`, `overdue`, `cancelled`               |
| `current_notification_number` | INTEGER     | Sim         | Número da notificação atual (ex.: 1, 2, 3…)                           |
| `last_notification_sent_at`   | TIMESTAMPTZ | Não         | Data/hora do último envio de notificação                              |
| `next_notification_date`      | DATE        | Não         | Data do próximo envio programado                                      |
| `supplier_response_type`      | ENUM        | Não         | `confirmed_on_time`, `suggested_new_date`, `none`                     |
| `suggested_date`              | DATE        | Não         | Nova data sugerida pelo fornecedor                                    |
| `suggested_date_status`       | ENUM        | Não         | `pending_approval`, `approved`, `rejected`                            |
| `approved_by`                 | UUID        | Não         | ID do usuário que aprovou/reprovou nova data                          |
| `approved_at`                 | TIMESTAMPTZ | Não         | Data/hora da aprovação/reprovação                                     |
| `building_id`                 | INTEGER     | Não         | ID da obra no Sienge                                                  |
| `created_at`                  | TIMESTAMPTZ | Sim         | Data de criação                                                       |
| `updated_at`                  | TIMESTAMPTZ | Sim         | Data de última atualização                                            |

**Relacionamentos:** referencia `purchase_order_id` da entidade de pedidos (Módulo 5/7), `supplier_id` da entidade de fornecedores (Módulo 1/7).

**Índices sugeridos:** `(purchase_order_id)`, `(supplier_id)`, `(status, next_notification_date)`, `(status)` para consultas de scheduler.

**Regras de integridade:** um follow-up por par `(purchase_order_id, supplier_id)` ativo. `promised_date_current >= order_date`.

### 4.2 `followup_notifications`

Histórico de notificações enviadas.

| Campo                  | Tipo        | Obrigatório | Descrição                                            |
| ---------------------- | ----------- | ----------- | ---------------------------------------------------- |
| `id`                   | UUID        | Sim         | Identificador único                                  |
| `followup_tracking_id` | UUID        | Sim         | FK para `followup_tracking`                          |
| `notification_number`  | INTEGER     | Sim         | Sequencial: 1, 2, 3…                                 |
| `title`                | VARCHAR     | Sim         | `Notificação 1`, `Notificação 2`, etc.               |
| `sent_at`              | TIMESTAMPTZ | Sim         | Data/hora de envio                                   |
| `sent_to_supplier`     | BOOLEAN     | Sim         | Se foi enviada ao fornecedor                         |
| `copied_to_compras`    | BOOLEAN     | Sim         | Se `Compras` foi copiado (a partir da Notificação 2) |
| `channel`              | ENUM        | Sim         | `email` (V1.0)                                       |
| `delivery_status`      | ENUM        | Sim         | `sent`, `delivered`, `failed`                        |
| `created_at`           | TIMESTAMPTZ | Sim         | Data de criação                                      |

**Relacionamentos:** FK para `followup_tracking(id)`.

**Índices sugeridos:** `(followup_tracking_id, notification_number)`.

### 4.3 `followup_date_changes`

Histórico de alterações de data prometida.

| Campo                  | Tipo        | Obrigatório | Descrição                     |
| ---------------------- | ----------- | ----------- | ----------------------------- |
| `id`                   | UUID        | Sim         | Identificador único           |
| `followup_tracking_id` | UUID        | Sim         | FK para `followup_tracking`   |
| `previous_date`        | DATE        | Sim         | Data prometida anterior       |
| `suggested_date`       | DATE        | Sim         | Data sugerida pelo fornecedor |
| `suggested_by`         | UUID        | Sim         | ID do fornecedor (usuário)    |
| `suggested_at`         | TIMESTAMPTZ | Sim         | Data/hora da sugestão         |
| `decision`             | ENUM        | Não         | `approved`, `rejected`        |
| `decided_by`           | UUID        | Não         | ID do usuário `Compras`       |
| `decided_at`           | TIMESTAMPTZ | Não         | Data/hora da decisão          |
| `reason`               | TEXT        | Não         | Justificativa                 |
| `created_at`           | TIMESTAMPTZ | Sim         | Data de criação               |

**Relacionamentos:** FK para `followup_tracking(id)`.

### 4.4 `business_days_holidays`

Feriados nacionais para cálculo de dias úteis.

| Campo          | Tipo        | Obrigatório | Descrição           |
| -------------- | ----------- | ----------- | ------------------- |
| `id`           | UUID        | Sim         | Identificador único |
| `holiday_date` | DATE        | Sim         | Data do feriado     |
| `name`         | VARCHAR     | Sim         | Nome do feriado     |
| `year`         | INTEGER     | Sim         | Ano de referência   |
| `created_at`   | TIMESTAMPTZ | Sim         | Data de criação     |

**Índices sugeridos:** `(holiday_date)` UNIQUE, `(year)`.

**Regras de integridade:** apenas feriados nacionais _(PRDGlobal §6.1)_.

### 4.5 `followup_notification_templates`

Templates editáveis de notificação de follow-up.

| Campo               | Tipo        | Obrigatório | Descrição                                                                         |
| ------------------- | ----------- | ----------- | --------------------------------------------------------------------------------- |
| `id`                | UUID        | Sim         | Identificador único                                                               |
| `type`              | ENUM        | Sim         | `followup_reminder`, `overdue_alert`, `confirmation_received`, `new_date_pending` |
| `subject_template`  | TEXT        | Sim         | Template do assunto                                                               |
| `body_template`     | TEXT        | Sim         | Template do corpo                                                                 |
| `editable_by_admin` | BOOLEAN     | Sim         | Se o Administrador pode editar                                                    |
| `updated_by`        | UUID        | Não         | Último editor                                                                     |
| `updated_at`        | TIMESTAMPTZ | Sim         | Data da última edição                                                             |
| `created_at`        | TIMESTAMPTZ | Sim         | Data de criação                                                                   |

## 5. Regras de negócio

- **RN-01:** O follow-up começa quando o pedido de compra chega do Sienge. _(PRDGlobal §6.1)_
- **RN-02:** O marco inicial do cálculo é a `Data do Pedido no Sienge`. _(PRDGlobal §6.1)_
- **RN-03:** O prazo é calculado entre a `Data do Pedido no Sienge` e a `Data Prometida` vigente. _(PRDGlobal §6.1)_
- **RN-04:** O cálculo usa apenas dias úteis, considerando apenas feriados nacionais. _(PRDGlobal §6.1)_
- **RN-05:** A régua inicia em 50% do prazo em dias úteis. _(PRDGlobal §6.2)_
- **RN-06:** A primeira cobrança é a `Notificação 1`. Se não houver resposta, seguem `Notificação 2`, `Notificação 3`, `Notificação 4` e assim por diante. _(PRDGlobal §6.2)_
- **RN-07:** O título das notificações deve seguir obrigatoriamente o padrão sequencial `Notificação 1`, `Notificação 2`, etc. _(PRDGlobal §6.2)_
- **RN-08:** A partir da `Notificação 2`, o e-mail de `Compras` vai copiado. _(PRDGlobal §6.2)_
- **RN-09:** As notificações seguintes (após a Notificação 1) são enviadas uma vez por dia útil. _(PRDGlobal §6.2)_
- **RN-10:** A régua continua até haver resposta do fornecedor ou o pedido virar `Atrasado`. _(PRDGlobal §6.2)_
- **RN-11:** O fornecedor pode confirmar que entregará no prazo ou sugerir nova data. _(PRDGlobal §6.3)_
- **RN-12:** Quando o fornecedor confirma entrega no prazo, a régua é encerrada naquele momento e `Compras` é notificado. _(PRDGlobal §6.4)_
- **RN-13:** A confirmação vale apenas até a data prometida vigente. _(PRDGlobal §6.4)_
- **RN-14:** Se a data prometida vencer sem entrega confirmada no Sienge, o pedido segue normalmente para atraso. _(PRDGlobal §6.4)_
- **RN-15:** Se o fornecedor sugerir nova data, `Compras` deve aprovar ou reprovar. _(PRDGlobal §6.4)_
- **RN-16:** Se `Compras` aprovar a nova data, ela passa a valer como `Data Prometida` local e a régua reinicia com base nela. _(PRDGlobal §6.4)_
- **RN-17:** Quando a nova data for aprovada, a nova cobrança de 50% do prazo segue a mesma regra e o mesmo fluxo de cobrança. _(PRDGlobal §6.4)_
- **RN-18:** Se `Compras` reprovar, a data prometida anterior é mantida e a régua continua. _(PRDGlobal §6.4)_
- **RN-19:** A nova data prometida não volta para o Sienge e não sobrescreve a data original do ERP. _(PRDGlobal §6.4, §9.1)_
- **RN-20:** Na V1.0, quando existirem múltiplas datas de entrega para o mesmo item, considera-se apenas a última data prometida consolidada do item. _(PRDGlobal §6.5)_
- **RN-21:** A V1.0 não controla uma régua separada por parcela de entrega do mesmo item. _(PRDGlobal §6.5)_
- **RN-22:** Em entrega parcial, a régua continua apenas enquanto existir saldo pendente no pedido. _(PRDGlobal §6.6)_
- **RN-23:** Se a data prometida for hoje e no dia útil seguinte ainda não houver nota fiscal no Sienge confirmando a entrega, o pedido deve ser sinalizado como `Atrasado`. _(PRDGlobal §6.6)_
- **RN-24:** `Compras` deve ser notificado automaticamente em caso de atraso. _(PRDGlobal §6.6)_
- **RN-25:** O conteúdo das notificações de follow-up pode ser editado pelo `Administrador`, respeitando a estrutura operacional aprovada. _(PRDGlobal §5.4)_

## 6. Fluxos operacionais

### 6.1 Fluxo principal — Régua de cobrança

1. Pedido de compra é importado do Sienge (Módulo 7).
2. O sistema cria um registro de `followup_tracking` com `order_date` e `promised_date_original` extraídos do pedido.
3. O sistema calcula 50% do prazo em dias úteis entre `order_date` e `promised_date_current`.
4. Ao atingir 50% do prazo, o scheduler dispara a `Notificação 1` por e-mail ao fornecedor.
5. Se não houver resposta em 1 dia útil, o scheduler dispara a `Notificação 2` (com `Compras` em cópia).
6. Notificações subsequentes são disparadas a cada dia útil até resposta do fornecedor ou vencimento da data prometida.
7. Se a data prometida vencer sem entrega confirmada no Sienge no próximo dia útil, o status muda para `overdue` e `Compras` é notificado.

**Exceções:**

- Se o pedido for `Cancelado` (Módulo 5), a régua é encerrada imediatamente.
- Se houver `Reposição` (Módulo 6), a régua reinicia com a nova data prometida da reposição.

### 6.2 Fluxo — Confirmação de entrega no prazo

1. Fornecedor acessa o portal e seleciona "Confirmarei entrega no prazo".
2. O sistema registra `supplier_response_type = confirmed_on_time`.
3. A régua é encerrada (status `completed`).
4. `Compras` recebe notificação da confirmação.
5. Se a data prometida vencer sem entrega confirmada no Sienge, o pedido volta para acompanhamento e é sinalizado como `Atrasado`.

### 6.3 Fluxo — Sugestão de nova data

1. Fornecedor acessa o portal e seleciona "Sugerir nova data", informando a nova data.
2. O sistema registra a sugestão em `followup_date_changes` com `decision = pending`.
3. A régua fica pausada aguardando decisão de `Compras`.
4. `Compras` recebe notificação de nova data pendente.
5. `Compras` aprova ou reprova:
   - **Aprovação:** `promised_date_current` é atualizada, a régua reinicia com cálculo de 50% sobre o novo prazo.
   - **Reprovação:** a data anterior é mantida e a régua continua de onde parou.

### 6.4 Fluxo — Entrega parcial

1. Módulo 5 identifica entrega parcial via Sienge.
2. O sistema verifica se há saldo pendente no pedido.
3. Se houver saldo pendente, a régua continua com o prazo vigente.
4. Se não houver mais saldo pendente, a régua é encerrada.

## 7. Contratos de API / Serviços

### 7.1 `GET /api/followup/orders`

Listar pedidos em follow-up.

- **Entrada:** `status` (opcional), `supplier_id` (opcional), `building_id` (opcional), `page`, `limit`
- **Saída:** Lista paginada de `followup_tracking` com dados do pedido e fornecedor.
- **Erros:** `401 Unauthorized`, `403 Forbidden`
- **Perfis autorizados:** `Compras`, `Administrador`, `Visualizador de Pedidos`

### 7.2 `GET /api/followup/orders/:purchaseOrderId`

Detalhe do follow-up de um pedido.

- **Entrada:** `purchaseOrderId` (path)
- **Saída:** `followup_tracking` completo com histórico de notificações e alterações de data.
- **Erros:** `401`, `403`, `404 Not Found`
- **Perfis autorizados:** `Compras`, `Administrador`, `Visualizador de Pedidos`, `Fornecedor` (somente próprio)

### 7.3 `POST /api/followup/orders/:purchaseOrderId/confirm`

Fornecedor confirma entrega no prazo.

- **Entrada:** `purchaseOrderId` (path)
- **Saída:** `{ status: "confirmed", followup_tracking_id }`
- **Erros:** `401`, `403`, `404`, `409 Conflict` (já confirmado ou atrasado)
- **Perfis autorizados:** `Fornecedor` (somente próprio pedido)

### 7.4 `POST /api/followup/orders/:purchaseOrderId/suggest-date`

Fornecedor sugere nova data.

- **Entrada:** `purchaseOrderId` (path), `{ suggested_date: DATE, reason?: TEXT }`
- **Validações:** `suggested_date` deve ser futura e maior que `order_date`.
- **Saída:** `{ status: "pending_approval", date_change_id }`
- **Erros:** `401`, `403`, `404`, `422 Unprocessable Entity`
- **Perfis autorizados:** `Fornecedor` (somente próprio pedido)

### 7.5 `POST /api/followup/date-changes/:dateChangeId/approve`

`Compras` aprova nova data.

- **Entrada:** `dateChangeId` (path), `{ reason?: TEXT }`
- **Saída:** `{ status: "approved", new_promised_date }`
- **Erros:** `401`, `403`, `404`, `409` (já decidido)
- **Perfis autorizados:** `Compras`

### 7.6 `POST /api/followup/date-changes/:dateChangeId/reject`

`Compras` reprova nova data.

- **Entrada:** `dateChangeId` (path), `{ reason?: TEXT }`
- **Saída:** `{ status: "rejected" }`
- **Erros:** `401`, `403`, `404`, `409` (já decidido)
- **Perfis autorizados:** `Compras`

### 7.7 `GET /api/followup/orders/:purchaseOrderId/notifications`

Histórico de notificações de um pedido.

- **Entrada:** `purchaseOrderId` (path)
- **Saída:** Lista de `followup_notifications` ordenada por `notification_number`.
- **Erros:** `401`, `403`, `404`
- **Perfis autorizados:** `Compras`, `Administrador`, `Fornecedor` (somente próprio)

### 7.8 Serviço interno — `FollowupScheduler`

Worker assíncrono executado diariamente em dia útil.

- **Responsabilidades:** calcular próximas notificações, disparar e-mails, detectar atrasos, atualizar status.
- **Não depende do frontend** _(PRDGlobal §15.2)_.
- **Localização:** `workers/` conforme ADR-0001.

## 8. Interface do usuário

### 8.1 Portal do Fornecedor — Lista de Pedidos em Follow-up

- **Propósito:** Exibir ao fornecedor seus pedidos com follow-up ativo.
- **Campos exibidos:** número do pedido, status, data prometida atual, data do pedido, indicação de atraso, indicação de avaria ou reposição, obra (quando disponível). _(PRDGlobal §14.1)_
- **Ações disponíveis (Fornecedor):** "Confirmar entrega no prazo", "Sugerir nova data".
- **Ordenação:** pedidos `Atrasados` primeiro, depois pendentes de resposta, depois no prazo ou entregues. _(PRDGlobal §12.4)_
- **Referências visuais:** Azul Escuro `#324598` para cabeçalhos, Turquesa `#19B4BE` para indicadores ativos, vermelho para `Atrasado`, amarelo para `Parcialmente Entregue`. _(Conforme `docs/paleta_de_cores.md` e PRDGlobal §12.5)_

### 8.2 Portal do Fornecedor — Detalhe do Pedido / Follow-up

- **Propósito:** Exibir detalhes do follow-up e permitir resposta.
- **Campos exibidos:** dados do pedido, data do pedido, data prometida vigente, histórico de notificações recebidas, status da régua, data sugerida (se houver) e status da aprovação.
- **Ações disponíveis (Fornecedor):** "Confirmar entrega no prazo" (botão), "Sugerir nova data" (formulário com campo de data e justificativa opcional).
- **Referências visuais:** Azul Médio `#465EBE` para botões de ação, cores operacionais conforme §12.5.

### 8.3 Backoffice — Lista de Pedidos em Follow-up

- **Propósito:** Visão consolidada de todos os pedidos em follow-up.
- **Campos exibidos:** número do pedido, fornecedor, obra, status, data do pedido, data prometida atual, indicação de atraso, indicação de avaria ou divergência, saldo pendente, número da cotação vinculada. _(PRDGlobal §14.1)_
- **Ações disponíveis (Compras):** filtrar por status, fornecedor, obra; acessar detalhe; aprovar/reprovar nova data pendente.
- **Ordenação:** `Atrasados` → `Divergência` → `Em avaria`/`Reposição` → pendentes de resposta → no prazo ou entregues. _(PRDGlobal §12.4)_
- **Cores operacionais:** `Atrasado` vermelho, `Divergência` laranja, `Em avaria` roxo, `Reposição` azul, `Entregue` verde, `Parcialmente Entregue` amarelo, `Cancelado` cinza. _(PRDGlobal §12.5)_

### 8.4 Backoffice — Detalhe do Follow-up com Aprovação de Data

- **Propósito:** Permitir que `Compras` visualize todo o histórico do follow-up e tome decisão sobre novas datas.
- **Campos exibidos:** dados completos do pedido, timeline de notificações enviadas, histórico de sugestões de data com status, resposta do fornecedor.
- **Ações disponíveis (Compras):** "Aprovar nova data" (botão), "Reprovar nova data" (botão com campo de justificativa).

### 8.5 Administração — Templates de Notificação de Follow-up

- **Propósito:** Permitir que o `Administrador` edite o conteúdo editável dos templates de follow-up.
- **Campos exibidos:** tipo de template, assunto, corpo (com variáveis destacadas).
- **Ações disponíveis (Administrador):** editar conteúdo do template respeitando campos obrigatórios e estrutura operacional. _(PRDGlobal §5.4)_

## 9. Integrações e dependências externas

### 9.1 Dependência do Módulo 7 — Integração com o Sienge

O follow-up depende da importação de pedidos pelo Módulo 7:

- **`GET /purchase-orders`** — importar pedidos com `date`, `supplierId`, `buildingId`, `deliveryLate`. _(PRDGlobal §9.3.3)_
- **`GET /purchase-orders/{purchaseOrderId}/items/{itemNumber}/delivery-schedules`** — consultar `sheduledDate` (grafia original do contrato), `sheduledQuantity`, `deliveredQuantity`, `openQuantity` para determinar saldo pendente e data prometida. _(PRDGlobal §9.3.4)_
- **Webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`** — gatilho para iniciar follow-up quando pedido é gerado a partir de cotação. _(PRDGlobal §9.3.8)_
- **Webhook `PURCHASE_ORDER_ITEM_MODIFIED`** — gatilho para reconsultar e atualizar dados do pedido. _(PRDGlobal §9.3.8)_

### 9.2 Dependência do Módulo 5 — Entrega

- **`GET /purchase-invoices/deliveries-attended`** — confirmar entrega efetiva para encerrar régua ou sinalizar atraso. _(PRDGlobal §9.3.5)_
- O follow-up consulta o status de entrega do pedido (Módulo 5) para determinar se há saldo pendente.

### 9.3 Regras de integração

- A nova data prometida aprovada por `Compras` é local — **não volta para o Sienge**. _(PRDGlobal §6.4, §9.1)_
- Na V1.0, para follow-up, usar apenas a última data prometida consolidada do item. _(PRDGlobal §9.11)_
- Webhooks são gatilhos de reconsulta, não fonte final de dados. _(PRDGlobal §9.8)_

## 10. Auditoria e rastreabilidade

Eventos auditáveis gerados por este módulo, conforme §12.6 do PRDGlobal:

| Evento                           | Dados mínimos registrados                                                        |
| -------------------------------- | -------------------------------------------------------------------------------- |
| Notificação de follow-up enviada | data/hora, tipo, número da notificação, pedido, fornecedor, canal                |
| Confirmação de entrega no prazo  | data/hora, pedido, fornecedor, usuário                                           |
| Sugestão de nova data            | data/hora, pedido, fornecedor, data sugerida, data anterior                      |
| Aprovação de nova data           | data/hora, pedido, fornecedor, data aprovada, aprovador                          |
| Reprovação de nova data          | data/hora, pedido, fornecedor, data reprovada, aprovador, justificativa          |
| Alteração de data prometida      | data/hora, pedido, data anterior, data nova, origem da alteração                 |
| Pedido sinalizado como Atrasado  | data/hora, pedido, fornecedor, data prometida vencida                            |
| Régua encerrada                  | data/hora, pedido, fornecedor, motivo (confirmação, entrega total, cancelamento) |

Cada evento deve registrar: data/hora, tipo do evento, usuário ou origem, pedido afetado, fornecedor afetado e resumo da ação. _(PRDGlobal §12.6)_

## 11. Validações pendentes de homologação

Itens da §17 do PRDGlobal que se aplicam a este módulo:

- **§17.1:** Validar se `supplierId` das APIs de compras corresponde ao `creditorId` da API de Credores — impacta a identificação correta do fornecedor nos follow-ups.
- **§17.3:** Validar no ambiente do cliente a disponibilidade e funcionamento do webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` — é o gatilho principal para iniciar o follow-up.
- **§17.7:** Validar cenários reais em que um item do pedido possa referenciar mais de uma cotação — impacta o vínculo pedido→cotação exibido no follow-up.
- **§17.8:** Validar se `GET /purchase-invoices/deliveries-attended` cobre todos os cenários reais de entrega — impacta a detecção de entrega que encerra a régua ou sinaliza atraso.

## 12. Critérios de aceite

- [ ] O follow-up é iniciado automaticamente quando um pedido é importado do Sienge.
- [ ] O cálculo de prazo utiliza dias úteis, considerando apenas feriados nacionais.
- [ ] A `Notificação 1` é disparada ao atingir 50% do prazo em dias úteis.
- [ ] As notificações seguem o padrão sequencial `Notificação 1`, `Notificação 2`, etc.
- [ ] A partir da `Notificação 2`, o e-mail de `Compras` é incluído como cópia.
- [ ] Notificações subsequentes são enviadas uma vez por dia útil.
- [ ] A régua continua até resposta do fornecedor ou status `Atrasado`.
- [ ] O fornecedor consegue confirmar entrega no prazo pelo portal.
- [ ] Ao confirmar prazo, a régua é encerrada e `Compras` é notificado.
- [ ] A confirmação vale apenas até a data prometida vigente.
- [ ] O fornecedor consegue sugerir nova data pelo portal.
- [ ] `Compras` consegue aprovar ou reprovar nova data sugerida.
- [ ] Nova data aprovada atualiza `promised_date_current` e reinicia a régua com cálculo de 50%.
- [ ] Nova data reprovada mantém a data anterior e a régua continua.
- [ ] A nova data prometida não é enviada ao Sienge.
- [ ] Se a data prometida vencer sem entrega confirmada no Sienge no dia útil seguinte, o pedido é sinalizado como `Atrasado`.
- [ ] `Compras` é notificado automaticamente em caso de atraso.
- [ ] Em entrega parcial, a régua continua enquanto houver saldo pendente.
- [ ] Na V1.0, apenas a última data prometida consolidada é usada (sem régua por parcela).
- [ ] O `Administrador` consegue editar templates de notificação de follow-up.
- [ ] Os campos obrigatórios dos templates não podem ser removidos.
- [ ] O scheduler roda como worker assíncrono, independente do frontend.
- [ ] Todos os eventos de follow-up são registrados na auditoria.
- [ ] A lista de pedidos no backoffice exibe todos os campos mínimos exigidos pelo PRDGlobal §14.1.
- [ ] A lista de pedidos no portal do fornecedor exibe todos os campos mínimos exigidos pelo PRDGlobal §14.1.
- [ ] A ordenação no backoffice prioriza `Atrasados` > `Divergência` > `Em avaria`/`Reposição` > pendentes > no prazo.

## 13. Fases de implementação sugeridas

### Fase 1 — Infraestrutura de cálculo e scheduler

- Implementar tabela de feriados nacionais (`business_days_holidays`).
- Implementar função de cálculo de dias úteis.
- Implementar `followup_tracking` e `followup_notifications`.
- Implementar scheduler base no worker assíncrono.

### Fase 2 — Régua de cobrança e notificações

- Implementar lógica de régua (50% do prazo, notificações sequenciais).
- Implementar envio de e-mail de follow-up com templates.
- Implementar cópia para `Compras` a partir da Notificação 2.
- Implementar detecção automática de `Atrasado`.

### Fase 3 — Respostas do fornecedor

- Implementar tela do portal para confirmação de prazo e sugestão de nova data.
- Implementar endpoints de resposta do fornecedor.
- Implementar fluxo de aprovação/reprovação de nova data por `Compras`.
- Implementar reinício da régua com nova data aprovada.

### Fase 4 — Backoffice e templates

- Implementar tela de lista e detalhe de follow-up no backoffice.
- Implementar gestão de templates de notificação pelo `Administrador`.
- Implementar trilha de auditoria completa.

### Fase 5 — Entrega parcial e integração com Módulo 5

- Implementar continuidade da régua em entrega parcial.
- Implementar encerramento automático da régua quando saldo pendente zerar.
- Testes integrados com fluxo de entrega.

## 14. Riscos específicos do módulo

| Risco                                                                                   | Impacto                                                                   | Mitigação                                                                                                   |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` indisponível no ambiente do cliente | Follow-up não é iniciado automaticamente                                  | Implementar fallback por polling periódico de `GET /purchase-orders` como reconciliação. _(PRDGlobal §9.8)_ |
| Inconsistência no campo `sheduledDate` do contrato público do Sienge                    | Cálculo de data prometida incorreto                                       | Respeitar exatamente a grafia do contrato sem normalização. _(PRDGlobal §9.10)_                             |
| Tabela de feriados nacionais desatualizada                                              | Cálculo de dias úteis incorreto, notificações disparadas em datas erradas | Pré-carregar feriados nacionais com antecedência de 2 anos; criar rotina de atualização anual.              |
| Fornecedor não responde ao follow-up e régua gera muitas notificações                   | Saturação de e-mails, fornecedor ignora notificações                      | Manter régua conforme PRDGlobal (1 notificação/dia útil até atraso); monitorar via dashboard (Módulo 8).    |
| Alta concorrência entre scheduler e respostas do fornecedor                             | Race condition entre envio de notificação e registro de resposta          | Implementar controle de concorrência otimista com locks na atualização do `followup_tracking`.              |
| Falha no serviço de e-mail                                                              | Notificações não são entregues                                            | Registrar `delivery_status = failed`, implementar retry e alertar `Compras` via backoffice.                 |
