# PRD Filho — Avaria e Ação Corretiva

> Módulo: 6 de 9
> Seções do PRDGlobal: §8
> Dependências: 1 (Autenticação e Perfis), 5 (Entrega, Divergência e Status de Pedido)
> Data de geração: 2026-04-06

---

## 1. Objetivo do módulo

O módulo de Avaria e Ação Corretiva resolve o problema de rastreabilidade e tratamento operacional de materiais danificados ou com defeito recebidos pela GRF. Sem este módulo, a identificação de avarias e a decisão sobre ações corretivas dependem de canais informais (e-mail, WhatsApp), gerando perda de rastreabilidade, atrasos na resolução e impossibilidade de medir o impacto operacional de fornecedores com alta incidência de problemas.

Este módulo permite que tanto o `Fornecedor` quanto `Compras` registrem avarias associadas a itens de pedido, definam ações corretivas controladas (cancelamento parcial/total ou reposição) e mantenham uma trilha auditável de todo o processo decisório. O sistema garante que apenas `Compras` define a ação corretiva final, preservando a governança do fluxo.

O valor principal entregue é a capacidade de tratar exceções operacionais de forma estruturada, integrada ao fluxo de entrega e follow-up, alimentando os dashboards de qualidade de fornecedores e permitindo decisões baseadas em dados concretos para o ranking de confiabilidade.

## 2. Escopo funcional

### 2.1 Incluso neste PRD

- Registro de avaria por `Fornecedor` e `Compras`, associado a item de pedido.
- Registro de avaria mesmo antes da entrega formalmente identificada no Sienge.
- Transição de status do pedido/item para `Em avaria` ao registrar avaria.
- Sugestão de ação corretiva pelo `Fornecedor`.
- Notificação ao `Compras` quando o fornecedor sugere ação corretiva.
- Decisão da ação corretiva final por `Compras` (aceitar sugestão ou definir outra).
- Ações corretivas exclusivas: cancelamento parcial/total do item avariado ou reposição.
- Fluxo de `Reposição`: fornecedor informa nova data prometida, régua de follow-up reinicia.
- Fluxo de cancelamento: recálculo interno de saldo, valor e status do pedido.
- Devolução total da compra: status `Cancelado` e encerramento da régua de follow-up.
- Reabertura do acompanhamento quando avaria pós-entrega gera `Reposição`.
- Tratamento de avaria sem reabertura quando não há `Reposição`.
- Auditoria de todos os eventos de avaria e ação corretiva.
- Telas do portal do fornecedor para registro de avaria e sugestão de ação corretiva.
- Telas do backoffice para registro de avaria por `Compras`, análise de sugestões e definição de ação corretiva.

### 2.2 Excluído deste PRD

- **Autenticação, RBAC e gestão de acessos** — coberto pelo PRD 01 (Autenticação e Perfis).
- **Importação e sincronização de pedidos do Sienge** — coberto pelo PRD 05 (Entrega, Divergência e Status de Pedido).
- **Status operacionais de pedido e cálculo de entrega** (ex.: `Parcialmente Entregue`, `Entregue`, `Atrasado`, `Divergência`) — cobertos pelo PRD 05.
- **Régua de cobrança e workflow de follow-up** — cobertos pelo PRD 04 (Follow-up Logístico). Este PRD define apenas o gatilho de reinício da régua em caso de `Reposição`.
- **Dashboards e indicadores de avaria** (ex.: `Taxa de avaria`, `Pedidos com avaria`, confiabilidade de fornecedor) — cobertos pelo PRD 08 (Dashboard e Indicadores).
- **Integração direta de leitura/escrita com APIs do Sienge** — coberta pelo PRD 07 (Integração com o Sienge).
- **Templates e envio de notificações por e-mail** — cobertos pelo PRD 03 (Notificações de Cotação).
- **Filtro rápido `Exigem ação` e priorização visual no backoffice** — cobertos pelo PRD 09 (Backoffice, Auditoria e Operação).

### 2.3 Fora de escopo da V1.0

- Envio de anexos, comprovantes ou documentos pelo fornecedor para evidenciar avaria _(PRDGlobal §2.3)_.
- Automações financeiras, fiscais ou contábeis além do uso logístico da nota fiscal _(PRDGlobal §2.3)_.
- Régua separada por parcela de entrega do mesmo item — a V1.0 considera apenas a última data prometida consolidada _(PRDGlobal §6.5)_.

## 3. Perfis envolvidos

| Perfil                    | Permissões neste módulo                                                                                                                                                                                             | Restrições                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Fornecedor`              | Registrar avaria em item de pedido; sugerir ação corretiva; informar nova data prometida em caso de `Reposição` aceita.                                                                                             | Não pode definir a ação corretiva final. Não pode aceitar ou rejeitar a própria sugestão. Acessa apenas os próprios dados. _(PRDGlobal §3.2, §8.2)_ |
| `Compras`                 | Registrar avaria em item de pedido; receber notificação de sugestão do fornecedor; aceitar ou recusar sugestão; definir ação corretiva final (cancelamento ou reposição); tratar divergências e exceções de avaria. | Não pode gerir acessos ou parametrizar o sistema. _(PRDGlobal §3.2, §3.3, §8.2)_                                                                    |
| `Administrador`           | Consultar registros de avaria e auditoria.                                                                                                                                                                          | Não pode definir ações corretivas. Não pode aprovar respostas de cotação. _(PRDGlobal §3.3)_                                                        |
| `Visualizador de Pedidos` | Consultar pedidos com indicação de avaria ou reposição na listagem.                                                                                                                                                 | Não pode registrar avaria, sugerir ação corretiva nem realizar qualquer alteração. _(PRDGlobal §3.2)_                                               |

_(Referência: PRDGlobal §3.1, §3.2, §3.3, §8.2)_

## 4. Entidades e modelagem

### 4.1 Entidade: `damage_report` (Registro de Avaria)

| Campo                        | Tipo                                                            | Obrigatório | Descrição                                                  |
| ---------------------------- | --------------------------------------------------------------- | ----------- | ---------------------------------------------------------- |
| `id`                         | UUID                                                            | Sim         | Identificador único do registro de avaria                  |
| `purchase_order_id`          | INTEGER                                                         | Sim         | Referência ao `purchaseOrderId` do Sienge                  |
| `purchase_order_item_number` | INTEGER                                                         | Sim         | Referência ao `itemNumber` do item do pedido               |
| `reported_by_user_id`        | UUID                                                            | Sim         | Referência ao usuário que registrou (FK para `auth.users`) |
| `reported_by_profile`        | ENUM(`fornecedor`, `compras`)                                   | Sim         | Perfil que realizou o registro                             |
| `description`                | TEXT                                                            | Sim         | Descrição textual da avaria identificada                   |
| `status`                     | ENUM (ver §4.3)                                                 | Sim         | Status atual do registro de avaria                         |
| `suggested_action`           | ENUM(`cancelamento_parcial`, `cancelamento_total`, `reposicao`) | Não         | Ação corretiva sugerida pelo fornecedor                    |
| `suggested_action_notes`     | TEXT                                                            | Não         | Observações da sugestão do fornecedor                      |
| `suggested_at`               | TIMESTAMPTZ                                                     | Não         | Data/hora da sugestão de ação corretiva                    |
| `final_action`               | ENUM(`cancelamento_parcial`, `cancelamento_total`, `reposicao`) | Não         | Ação corretiva final definida por `Compras`                |
| `final_action_notes`         | TEXT                                                            | Não         | Justificativa da decisão de `Compras`                      |
| `final_action_decided_by`    | UUID                                                            | Não         | Referência ao usuário de `Compras` que decidiu             |
| `final_action_decided_at`    | TIMESTAMPTZ                                                     | Não         | Data/hora da decisão final                                 |
| `affected_quantity`          | NUMERIC                                                         | Não         | Quantidade de itens afetados pela avaria                   |
| `supplier_id`                | INTEGER                                                         | Sim         | `supplierId` do fornecedor no Sienge                       |
| `building_id`                | INTEGER                                                         | Não         | `buildingId` da obra associada ao pedido                   |
| `created_at`                 | TIMESTAMPTZ                                                     | Sim         | Data/hora de criação do registro (default: `now()`)        |
| `updated_at`                 | TIMESTAMPTZ                                                     | Sim         | Data/hora da última atualização (default: `now()`)         |

**Relacionamentos:**

- `purchase_order_id` + `purchase_order_item_number` → referência lógica ao item do pedido sincronizado (módulo 5).
- `reported_by_user_id` → FK para `auth.users` (módulo 1).
- `final_action_decided_by` → FK para `auth.users` (módulo 1).
- `supplier_id` → referência lógica ao fornecedor sincronizado.

**Índices sugeridos:**

- `idx_damage_report_order_item` em (`purchase_order_id`, `purchase_order_item_number`)
- `idx_damage_report_supplier` em (`supplier_id`)
- `idx_damage_report_status` em (`status`)
- `idx_damage_report_created_at` em (`created_at`)

**Regras de integridade:**

- `suggested_action` só pode ser preenchido quando `reported_by_profile` = `fornecedor` ou quando `Compras` ainda não definiu a ação final.
- `final_action` só pode ser preenchido por usuário com perfil `Compras`.
- Quando `final_action` é definida, `final_action_decided_by` e `final_action_decided_at` são obrigatórios.
- `status` segue a máquina de estados definida em §4.3.

### 4.2 Entidade: `damage_replacement` (Reposição de Avaria)

| Campo                 | Tipo                                                             | Obrigatório | Descrição                                            |
| --------------------- | ---------------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| `id`                  | UUID                                                             | Sim         | Identificador único da reposição                     |
| `damage_report_id`    | UUID                                                             | Sim         | FK para `damage_report.id`                           |
| `new_promised_date`   | DATE                                                             | Sim         | Nova data prometida pelo fornecedor para a reposição |
| `informed_by_user_id` | UUID                                                             | Sim         | Referência ao usuário fornecedor que informou a data |
| `informed_at`         | TIMESTAMPTZ                                                      | Sim         | Data/hora em que a nova data foi informada           |
| `replacement_status`  | ENUM(`aguardando_data`, `em_andamento`, `entregue`, `cancelado`) | Sim         | Status da reposição                                  |
| `replacement_scope`   | ENUM(`item`, `pedido`)                                           | Sim         | Se a reposição vale no nível de item ou de pedido    |
| `notes`               | TEXT                                                             | Não         | Observações sobre a reposição                        |
| `created_at`          | TIMESTAMPTZ                                                      | Sim         | Data/hora de criação (default: `now()`)              |
| `updated_at`          | TIMESTAMPTZ                                                      | Sim         | Data/hora da última atualização (default: `now()`)   |

**Relacionamentos:**

- `damage_report_id` → FK para `damage_report.id`.
- `informed_by_user_id` → FK para `auth.users`.

**Índices sugeridos:**

- `idx_damage_replacement_report` em (`damage_report_id`)
- `idx_damage_replacement_status` em (`replacement_status`)

**Regras de integridade:**

- `damage_replacement` só pode existir quando `damage_report.final_action` = `reposicao`.
- `new_promised_date` é obrigatória e deve ser data futura no momento do registro.
- A criação de `damage_replacement` dispara reinício da régua de follow-up (módulo 4).

### 4.3 Máquina de estados do registro de avaria

| Status                  | Descrição                                                                |
| ----------------------- | ------------------------------------------------------------------------ |
| `registrada`            | Avaria registrada, aguardando análise                                    |
| `sugestao_pendente`     | Fornecedor sugeriu ação corretiva, aguardando decisão de `Compras`       |
| `acao_definida`         | `Compras` definiu a ação corretiva final                                 |
| `em_reposicao`          | Ação corretiva = reposição, aguardando entrega de reposição              |
| `cancelamento_aplicado` | Ação corretiva = cancelamento parcial ou total, aplicada                 |
| `resolvida`             | Avaria totalmente tratada (reposição entregue ou cancelamento concluído) |

### 4.4 Entidade: `damage_audit_log` (Trilha de auditoria de avaria)

| Campo               | Tipo           | Obrigatório | Descrição                                     |
| ------------------- | -------------- | ----------- | --------------------------------------------- |
| `id`                | UUID           | Sim         | Identificador único do evento                 |
| `damage_report_id`  | UUID           | Sim         | FK para `damage_report.id`                    |
| `event_type`        | ENUM (ver §10) | Sim         | Tipo do evento auditado                       |
| `actor_user_id`     | UUID           | Não         | Usuário que originou o evento                 |
| `actor_profile`     | TEXT           | Não         | Perfil do ator (fornecedor, compras, sistema) |
| `details`           | JSONB          | Não         | Detalhes adicionais do evento                 |
| `purchase_order_id` | INTEGER        | Não         | Pedido afetado                                |
| `supplier_id`       | INTEGER        | Não         | Fornecedor afetado                            |
| `created_at`        | TIMESTAMPTZ    | Sim         | Data/hora do evento (default: `now()`)        |

**Índices sugeridos:**

- `idx_damage_audit_report` em (`damage_report_id`)
- `idx_damage_audit_created` em (`created_at`)
- `idx_damage_audit_event_type` em (`event_type`)

## 5. Regras de negócio

- **RN-01:** `Fornecedor` e `Compras` podem registrar avaria em item de pedido. _(PRDGlobal §8.1)_
- **RN-02:** A avaria pode ser registrada mesmo antes de a entrega estar formalmente identificada no Sienge. _(PRDGlobal §8.1)_
- **RN-03:** Ao registrar a avaria, o status do item/pedido passa para `Em avaria`. _(PRDGlobal §8.1)_
- **RN-04:** O `Fornecedor` pode apenas sugerir a ação corretiva; a ação corretiva final é sempre definida por `Compras`. _(PRDGlobal §8.2)_
- **RN-05:** Quando o fornecedor sugerir uma ação corretiva de avaria, `Compras` deve receber notificação no sistema para decidir. _(PRDGlobal §8.2)_
- **RN-06:** `Compras` pode aceitar a sugestão do fornecedor ou recusá-la e definir outra ação corretiva permitida. _(PRDGlobal §8.2)_
- **RN-07:** Toda notificação e decisão de avaria deve existir no sistema com trilha auditável. _(PRDGlobal §8.2)_
- **RN-08:** As únicas ações corretivas permitidas são: cancelamento parcial ou total do item avariado; ou reposição. _(PRDGlobal §8.3)_
- **RN-09:** Se `Compras` aceitar substituição, o sistema trata como `Reposição`. _(PRDGlobal §8.4)_
- **RN-10:** Em `Reposição`, o fornecedor deve informar nova data prometida. _(PRDGlobal §8.4)_
- **RN-11:** A régua de follow-up reinicia com base na nova data prometida de reposição. _(PRDGlobal §8.4)_
- **RN-12:** `Reposição` pode valer no nível de item ou de pedido, dependendo do caso. _(PRDGlobal §8.4)_
- **RN-13:** Em devolução ou cancelamento de item, o pedido segue com os demais itens válidos. _(PRDGlobal §8.5)_
- **RN-14:** O sistema recalcula internamente saldo, valor e status após cancelamento. _(PRDGlobal §8.5)_
- **RN-15:** O pedido no Sienge nunca é alterado por essas ações de cancelamento ou devolução. _(PRDGlobal §8.5, §9.1)_
- **RN-16:** Em devolução total da compra, o pedido fica `Cancelado` no sistema e a régua de follow-up é encerrada. _(PRDGlobal §8.5)_
- **RN-17:** Se uma avaria surgir depois da entrega total, o acompanhamento só reabre quando a ação corretiva gerar `Reposição`. _(PRDGlobal §8.6)_
- **RN-18:** Se não houver `Reposição` após avaria pós-entrega, a ocorrência é tratada sem reabrir o fluxo original do pedido. _(PRDGlobal §8.6)_
- **RN-19:** O pedido deve permanecer `Parcialmente Entregue` até que todos os itens restantes tenham sido entregues, cancelados ou encaminhados para `Reposição`. _(PRDGlobal §7.3)_
- **RN-20:** `Reposição` pode valer no nível de item ou no nível de pedido, dependendo da abrangência da substituição aprovada por `Compras`. _(PRDGlobal §7.3)_
- **RN-21:** Apenas `Compras` define a ação corretiva final de uma avaria. _(PRDGlobal §3.3)_

## 6. Fluxos operacionais

### 6.1 Fluxo de registro de avaria

**Descrição passo a passo:**

1. O usuário (`Fornecedor` ou `Compras`) acessa a tela de detalhe do pedido.
2. O usuário seleciona o item do pedido que possui avaria.
3. O usuário preenche o formulário de registro de avaria (descrição obrigatória, quantidade afetada opcional).
4. O sistema valida os campos obrigatórios.
5. O sistema cria o registro de avaria com status `registrada`.
6. O sistema altera o status do item/pedido para `Em avaria`.
7. O sistema registra evento de auditoria `avaria_registrada`.
8. Se o registro foi feito pelo `Fornecedor`, `Compras` recebe notificação in-app.
9. Se o `Fornecedor` incluiu sugestão de ação corretiva, o status muda para `sugestao_pendente` e `Compras` recebe notificação específica para decisão.

**Exceções e tratamento de erro:**

- Se o pedido não existir localmente, retornar erro `404` com mensagem descritiva.
- Se o item do pedido não existir, retornar erro `404`.
- Se o usuário não tiver permissão para o pedido (fornecedor acessando pedido de outro), retornar erro `403`.
- Se os campos obrigatórios estiverem ausentes, retornar erro `422` com detalhes de validação.

### 6.2 Fluxo de sugestão de ação corretiva pelo fornecedor

**Descrição passo a passo:**

1. O `Fornecedor` acessa o registro de avaria já existente (status `registrada`).
2. O `Fornecedor` seleciona a ação corretiva sugerida: `cancelamento_parcial`, `cancelamento_total` ou `reposicao`.
3. O `Fornecedor` pode incluir observações textuais.
4. O sistema valida que a ação sugerida está entre as permitidas (RN-08).
5. O sistema atualiza a avaria com `suggested_action`, `suggested_action_notes` e `suggested_at`.
6. O status da avaria muda para `sugestao_pendente`.
7. O sistema registra evento de auditoria `sugestao_enviada`.
8. O sistema notifica `Compras` in-app para decisão.

**Exceções e tratamento de erro:**

- Se a avaria já tiver `final_action` definida, retornar erro `409` — ação corretiva já decidida.
- Se a ação sugerida não estiver entre as permitidas, retornar erro `422`.

### 6.3 Fluxo de decisão de ação corretiva por Compras

**Descrição passo a passo:**

1. `Compras` acessa o registro de avaria (status `registrada` ou `sugestao_pendente`).
2. `Compras` visualiza os detalhes da avaria e a sugestão do fornecedor (se houver).
3. `Compras` define a ação corretiva final: `cancelamento_parcial`, `cancelamento_total` ou `reposicao`.
4. `Compras` pode incluir justificativa/observações.
5. O sistema valida que a ação está entre as permitidas.
6. O sistema atualiza a avaria com `final_action`, `final_action_notes`, `final_action_decided_by` e `final_action_decided_at`.
7. O status da avaria muda para `acao_definida`.
8. O sistema registra evento de auditoria `acao_corretiva_definida`.

**Bifurcação após a decisão:**

- **Se `cancelamento_parcial`:** O status muda para `cancelamento_aplicado`. O sistema recalcula saldo e status do pedido (RN-13, RN-14). O pedido continua com os demais itens.
- **Se `cancelamento_total`:** O status muda para `cancelamento_aplicado`. Se for o último item ativo do pedido, o pedido inteiro muda para `Cancelado` e a régua de follow-up é encerrada (RN-16).
- **Se `reposicao`:** O status muda para `em_reposicao`. O sistema cria registro de `damage_replacement` com status `aguardando_data`. O fornecedor é notificado para informar nova data prometida.

### 6.4 Fluxo de reposição

**Descrição passo a passo:**

1. Após `Compras` definir `reposicao`, o sistema cria `damage_replacement` com status `aguardando_data`.
2. O fornecedor é notificado para informar nova data prometida.
3. O fornecedor acessa o registro de reposição e informa `new_promised_date`.
4. O sistema valida que a data é futura.
5. O status de `damage_replacement` muda para `em_andamento`.
6. O sistema registra evento de auditoria `data_reposicao_informada`.
7. O sistema dispara o reinício da régua de follow-up (módulo 4) com base na nova data _(RN-11)_.
8. Quando a entrega de reposição for confirmada (via módulo 5), o status de `damage_replacement` muda para `entregue` e o status de `damage_report` muda para `resolvida`.

**Exceções e tratamento de erro:**

- Se a data informada for passada ou hoje, retornar erro `422`.
- Se a reposição for cancelada por `Compras` antes da entrega, o status muda para `cancelado`.

### 6.5 Fluxo de reabertura após entrega total

**Descrição passo a passo:**

1. Um pedido com todos os itens no status `Entregue` recebe registro de avaria.
2. O sistema registra a avaria normalmente (fluxo 6.1).
3. O fluxo de ação corretiva ocorre normalmente (fluxos 6.2 e 6.3).
4. **Se** a ação corretiva for `reposicao`: o acompanhamento do pedido reabre e a régua de follow-up reinicia _(RN-17)_.
5. **Se** a ação corretiva for `cancelamento`: a avaria é tratada localmente, sem reabrir o fluxo original do pedido _(RN-18)_.

### 6.6 Diagrama de estados da avaria

```
┌─────────────┐
│ registrada  │
└──────┬──────┘
       │
       ├────── Fornecedor sugere ação ──────┐
       │                                     │
       │                              ┌──────▼──────────┐
       │                              │sugestao_pendente │
       │                              └──────┬──────────┘
       │                                     │
       ├─────── Compras define ação ◄────────┘
       │
┌──────▼──────┐
│acao_definida│
└──────┬──────┘
       │
       ├── cancelamento ──► ┌───────────────────────┐
       │                    │ cancelamento_aplicado  │ ──► (Fim)
       │                    └───────────────────────┘
       │
       └── reposicao ─────► ┌───────────────┐     ┌───────────┐
                            │ em_reposicao  │ ──► │ resolvida │ (Fim)
                            └───────────────┘     └───────────┘
```

## 7. Contratos de API / Serviços

### 7.1 Registrar avaria

- **Método e rota:** `POST /api/damages`
- **Perfis autorizados:** `Fornecedor`, `Compras`
- **Entrada:**

| Campo                        | Tipo    | Obrigatório | Validação                                                                                           |
| ---------------------------- | ------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `purchase_order_id`          | INTEGER | Sim         | Deve existir localmente                                                                             |
| `purchase_order_item_number` | INTEGER | Sim         | Deve pertencer ao pedido                                                                            |
| `description`                | TEXT    | Sim         | Mín. 10 caracteres, máx. 2000                                                                       |
| `affected_quantity`          | NUMERIC | Não         | Deve ser > 0 se informado                                                                           |
| `suggested_action`           | ENUM    | Não         | Apenas `Fornecedor` pode enviar. Valores: `cancelamento_parcial`, `cancelamento_total`, `reposicao` |
| `suggested_action_notes`     | TEXT    | Não         | Máx. 1000 caracteres                                                                                |

- **Saída (201):**

| Campo        | Tipo        | Descrição                                            |
| ------------ | ----------- | ---------------------------------------------------- |
| `id`         | UUID        | ID do registro criado                                |
| `status`     | STRING      | Status inicial (`registrada` ou `sugestao_pendente`) |
| `created_at` | TIMESTAMPTZ | Data/hora de criação                                 |

- **Erros esperados:**

| Código | Condição                                                        |
| ------ | --------------------------------------------------------------- |
| `400`  | Campos inválidos ou mal formatados                              |
| `403`  | Usuário sem permissão para o pedido                             |
| `404`  | Pedido ou item não encontrado                                   |
| `422`  | Validação de negócio falhou (ex.: ação corretiva não permitida) |

### 7.2 Sugerir ação corretiva

- **Método e rota:** `PATCH /api/damages/{damageId}/suggest`
- **Perfis autorizados:** `Fornecedor`
- **Entrada:**

| Campo                    | Tipo | Obrigatório | Validação                                                 |
| ------------------------ | ---- | ----------- | --------------------------------------------------------- |
| `suggested_action`       | ENUM | Sim         | `cancelamento_parcial`, `cancelamento_total`, `reposicao` |
| `suggested_action_notes` | TEXT | Não         | Máx. 1000 caracteres                                      |

- **Saída (200):**

| Campo          | Tipo        | Descrição                 |
| -------------- | ----------- | ------------------------- |
| `id`           | UUID        | ID do registro atualizado |
| `status`       | STRING      | `sugestao_pendente`       |
| `suggested_at` | TIMESTAMPTZ | Data/hora da sugestão     |

- **Erros esperados:**

| Código | Condição                                       |
| ------ | ---------------------------------------------- |
| `403`  | Não é o fornecedor do pedido                   |
| `404`  | Avaria não encontrada                          |
| `409`  | Ação corretiva final já definida por `Compras` |
| `422`  | Ação sugerida não está entre as permitidas     |

### 7.3 Definir ação corretiva final

- **Método e rota:** `PATCH /api/damages/{damageId}/resolve`
- **Perfis autorizados:** `Compras`
- **Entrada:**

| Campo                | Tipo | Obrigatório | Validação                                                 |
| -------------------- | ---- | ----------- | --------------------------------------------------------- |
| `final_action`       | ENUM | Sim         | `cancelamento_parcial`, `cancelamento_total`, `reposicao` |
| `final_action_notes` | TEXT | Não         | Máx. 2000 caracteres                                      |

- **Saída (200):**

| Campo                     | Tipo        | Descrição                                                  |
| ------------------------- | ----------- | ---------------------------------------------------------- |
| `id`                      | UUID        | ID do registro atualizado                                  |
| `status`                  | STRING      | `acao_definida`, `cancelamento_aplicado` ou `em_reposicao` |
| `final_action`            | STRING      | Ação definida                                              |
| `final_action_decided_at` | TIMESTAMPTZ | Data/hora da decisão                                       |
| `replacement_id`          | UUID / null | ID da reposição criada, se aplicável                       |

- **Erros esperados:**

| Código | Condição                                       |
| ------ | ---------------------------------------------- |
| `403`  | Perfil não é `Compras`                         |
| `404`  | Avaria não encontrada                          |
| `409`  | Ação corretiva final já definida anteriormente |
| `422`  | Ação definida não está entre as permitidas     |

### 7.4 Informar data de reposição

- **Método e rota:** `PATCH /api/damages/{damageId}/replacement/date`
- **Perfis autorizados:** `Fornecedor`
- **Entrada:**

| Campo               | Tipo | Obrigatório | Validação            |
| ------------------- | ---- | ----------- | -------------------- |
| `new_promised_date` | DATE | Sim         | Deve ser data futura |
| `notes`             | TEXT | Não         | Máx. 1000 caracteres |

- **Saída (200):**

| Campo                | Tipo   | Descrição                  |
| -------------------- | ------ | -------------------------- |
| `replacement_id`     | UUID   | ID da reposição atualizada |
| `replacement_status` | STRING | `em_andamento`             |
| `new_promised_date`  | DATE   | Data informada             |

- **Erros esperados:**

| Código | Condição                             |
| ------ | ------------------------------------ |
| `403`  | Não é o fornecedor do pedido         |
| `404`  | Avaria ou reposição não encontrada   |
| `409`  | Reposição já finalizada ou cancelada |
| `422`  | Data não é futura                    |

### 7.5 Listar avarias

- **Método e rota:** `GET /api/damages`
- **Perfis autorizados:** `Fornecedor` (filtra apenas os próprios), `Compras`, `Administrador`
- **Parâmetros de query:**

| Campo               | Tipo    | Obrigatório | Descrição                                 |
| ------------------- | ------- | ----------- | ----------------------------------------- |
| `purchase_order_id` | INTEGER | Não         | Filtrar por pedido                        |
| `supplier_id`       | INTEGER | Não         | Filtrar por fornecedor                    |
| `status`            | ENUM    | Não         | Filtrar por status da avaria              |
| `page`              | INTEGER | Não         | Paginação (default: 1)                    |
| `per_page`          | INTEGER | Não         | Tamanho da página (default: 20, máx: 100) |

- **Saída (200):**

| Campo                 | Tipo    | Descrição                    |
| --------------------- | ------- | ---------------------------- |
| `data`                | ARRAY   | Lista de registros de avaria |
| `pagination.total`    | INTEGER | Total de registros           |
| `pagination.page`     | INTEGER | Página atual                 |
| `pagination.per_page` | INTEGER | Tamanho da página            |

### 7.6 Detalhar avaria

- **Método e rota:** `GET /api/damages/{damageId}`
- **Perfis autorizados:** `Fornecedor` (apenas próprio), `Compras`, `Administrador`
- **Saída (200):** Registro completo da avaria incluindo `damage_replacement` (se existir) e histórico de eventos de auditoria.
- **Erros esperados:**

| Código | Condição                             |
| ------ | ------------------------------------ |
| `403`  | Fornecedor acessando avaria de outro |
| `404`  | Avaria não encontrada                |

### 7.7 Listar histórico de auditoria da avaria

- **Método e rota:** `GET /api/damages/{damageId}/audit`
- **Perfis autorizados:** `Compras`, `Administrador`
- **Saída (200):** Lista de eventos de auditoria ordenados por `created_at` descendente.

## 8. Interface do usuário

### 8.1 Tela: Registro de Avaria (Portal do Fornecedor)

- **Propósito:** Permitir ao fornecedor registrar avaria em item de pedido e opcionalmente sugerir ação corretiva.
- **Campos exibidos:**
  - Número do pedido (somente leitura)
  - Item do pedido (selecionável entre os itens do pedido)
  - Descrição da avaria (campo de texto multilinha, obrigatório)
  - Quantidade afetada (numérico, opcional)
  - Sugestão de ação corretiva (select: cancelamento parcial, cancelamento total, reposição — opcional)
  - Observações da sugestão (campo de texto, opcional)
- **Ações disponíveis:**
  - `Registrar Avaria` (submit do formulário)
  - `Cancelar` (volta à tela de detalhe do pedido)
- **Referências visuais:**
  - Status `Em avaria`: cor roxo conforme `docs/paleta_de_cores.md` e PRDGlobal §12.5
  - Botões primários em Azul Escuro `#324598`
  - Fundo branco `#FFFFFF`
  - Detalhes e indicadores em Turquesa `#19B4BE`

### 8.2 Tela: Detalhe da Avaria (Portal do Fornecedor)

- **Propósito:** Visualizar o estado da avaria e da ação corretiva; informar data de reposição quando necessário.
- **Campos exibidos:**
  - Dados da avaria (descrição, quantidade, data de registro, status)
  - Sugestão enviada pelo fornecedor (se houver)
  - Decisão de `Compras` (ação corretiva final, justificativa, data da decisão)
  - Dados de reposição (se aplicável): nova data prometida, status
- **Ações disponíveis por estado:**
  - Status `registrada`: botão `Sugerir Ação Corretiva`
  - Status `em_reposicao` + replacement `aguardando_data`: formulário `Informar Data de Reposição`
  - Demais estados: somente consulta
- **Referências visuais:** mesma paleta da tela 8.1.

### 8.3 Tela: Gestão de Avarias (Backoffice — Compras)

- **Propósito:** Listar todas as avarias, filtrar por status e priorizar as que exigem ação.
- **Campos exibidos na listagem:**
  - Número do pedido
  - Item
  - Fornecedor
  - Obra
  - Status da avaria (com cor: `Em avaria` = roxo, `Reposição` = azul conforme §12.5)
  - Data de registro
  - Sugestão do fornecedor (indicador: sim/não)
  - Ação corretiva final (se decidida)
- **Ações disponíveis:**
  - Filtro por status, fornecedor, pedido, obra
  - Ordenação por data de registro (mais recente primeiro)
  - Clique para abrir detalhe
- **Referências visuais:**
  - Badge `Em avaria`: roxo
  - Badge `Reposição`: azul `#465EBE`
  - Badge `Cancelamento aplicado`: cinza
  - Badge `Resolvida`: verde
  - Paleta conforme `docs/paleta_de_cores.md`

### 8.4 Tela: Detalhe da Avaria (Backoffice — Compras)

- **Propósito:** Visualizar a avaria completa, decidir ação corretiva e acompanhar reposição.
- **Campos exibidos:**
  - Todos os campos da avaria
  - Sugestão do fornecedor (destaque visual quando presente)
  - Formulário de decisão de ação corretiva (quando pendente)
  - Dados de reposição e acompanhamento (quando aplicável)
  - Linha do tempo / histórico de auditoria do registro
- **Ações disponíveis:**
  - `Registrar Avaria` (em outro item do mesmo pedido)
  - `Definir Ação Corretiva` (quando status permite)
  - `Aceitar Sugestão do Fornecedor` (atalho quando há sugestão pendente)
  - `Recusar e Definir Outra Ação` (quando há sugestão pendente)
- **Referências visuais:** mesma paleta das demais telas.

### 8.5 Indicação de avaria na listagem de pedidos (Portal do Fornecedor)

- **Propósito:** Exibir indicação visual de avaria ou reposição na lista de pedidos do portal do fornecedor.
- **Campos exibidos:** Conforme PRDGlobal §14.1 — indicação de avaria ou reposição.
- **Referências visuais:**
  - Indicador `Em avaria`: ícone/badge roxo
  - Indicador `Reposição`: ícone/badge azul

### 8.6 Indicação de avaria na listagem de pedidos (Backoffice)

- **Propósito:** Exibir indicação visual de avaria ou divergência na lista de pedidos do backoffice.
- **Campos exibidos:** Conforme PRDGlobal §14.1 — indicação de avaria ou divergência.
- **Referências visuais:**
  - Badge `Em avaria`: roxo conforme §12.5
  - Badge `Reposição`: azul conforme §12.5

## 9. Integrações e dependências externas

### 9.1 Integração com o módulo de Entrega (PRD 05)

- O registro de avaria referencia `purchase_order_id` e `purchase_order_item_number` gerenciados pelo módulo de Entrega.
- A avaria pode ser registrada mesmo antes da entrega (RN-02); portanto, a existência do pedido localmente é pré-requisito, mas não a confirmação de entrega.
- Quando a ação corretiva for `cancelamento`, o módulo de Entrega deve ser notificado para recalcular saldo e status do pedido.
- Quando a ação corretiva for `reposicao`, a entrega da reposição será confirmada pelo mesmo fluxo do módulo 5.
- Em devolução total, o módulo de Entrega deve tratar o pedido como `Cancelado`.

### 9.2 Integração com o módulo de Follow-up (PRD 04)

- Quando `Reposição` é definida e o fornecedor informa nova data prometida, a régua de follow-up reinicia com base nessa nova data _(PRDGlobal §8.4)_.
- Em devolução total da compra, a régua de follow-up é encerrada imediatamente _(PRDGlobal §8.5)_.
- O módulo de Avaria publica eventos que o módulo de Follow-up consome:
  - `replacement_date_informed` → reinício da régua
  - `full_cancellation_applied` → encerramento da régua

### 9.3 Integração com o Sienge

- **O pedido no Sienge nunca é alterado** por ações de cancelamento, devolução ou reposição deste módulo _(PRDGlobal §8.5, §9.1)_.
- As avarias são registros exclusivamente locais, mantidos fora do ERP _(PRDGlobal §9.1)_.
- Não há endpoints de escrita no Sienge para avarias na V1.0.
- A confirmação de entrega da reposição utiliza a mesma fonte de verdade do módulo 5: `GET /purchase-invoices/deliveries-attended` _(PRDGlobal §7.1)_.

### 9.4 Tratamento de falhas

- Se a notificação in-app para `Compras` falhar, o sistema deve retentar em background e registrar o erro no log de auditoria.
- Se o recálculo de saldo/status falhar após cancelamento, o sistema deve manter o status anterior e notificar `Compras` para intervenção manual.

## 10. Auditoria e rastreabilidade

Eventos auditáveis gerados por este módulo, conforme PRDGlobal §12.6:

| Evento                     | Descrição                                         | Campos mínimos do registro                                                 |
| -------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| `avaria_registrada`        | Avaria registrada por fornecedor ou `Compras`     | data/hora, tipo, usuário, pedido, fornecedor, descrição resumida           |
| `sugestao_enviada`         | Fornecedor sugeriu ação corretiva                 | data/hora, tipo, usuário, pedido, fornecedor, ação sugerida                |
| `acao_corretiva_definida`  | `Compras` definiu ação corretiva final            | data/hora, tipo, usuário, pedido, fornecedor, ação definida, justificativa |
| `sugestao_aceita`          | `Compras` aceitou a sugestão do fornecedor        | data/hora, tipo, usuário, pedido, fornecedor                               |
| `sugestao_recusada`        | `Compras` recusou a sugestão e definiu outra ação | data/hora, tipo, usuário, pedido, fornecedor, ação alternativa             |
| `cancelamento_aplicado`    | Cancelamento parcial ou total aplicado            | data/hora, tipo, usuário, pedido, fornecedor, escopo (parcial/total)       |
| `reposicao_criada`         | Registro de reposição criado                      | data/hora, tipo, pedido, fornecedor, escopo (item/pedido)                  |
| `data_reposicao_informada` | Fornecedor informou nova data prometida           | data/hora, tipo, usuário, pedido, fornecedor, nova data                    |
| `reposicao_entregue`       | Reposição entregue e confirmada                   | data/hora, tipo, pedido, fornecedor                                        |
| `reposicao_cancelada`      | Reposição cancelada por `Compras`                 | data/hora, tipo, usuário, pedido, fornecedor                               |
| `pedido_cancelado_total`   | Pedido inteiro cancelado por devolução total      | data/hora, tipo, usuário, pedido, fornecedor                               |

Cada evento deve exibir no mínimo _(PRDGlobal §12.6)_:

- data e hora;
- tipo do evento;
- usuário ou origem do evento;
- cotação ou pedido afetado;
- fornecedor afetado, quando houver;
- resumo da ação realizada.

## 11. Validações pendentes de homologação

Itens da PRDGlobal §17 que se aplicam a este módulo:

| #   | Item de homologação                                                                              | Relevância para Avaria                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | Validar se `GET /purchase-invoices/deliveries-attended` cobre todos os cenários reais de entrega | Necessário para confirmar entrega de reposição. A confirmação da reposição depende deste endpoint retornar corretamente itens repostos. |
| 7   | Validar cenários com múltiplas cotações em `purchaseQuotations[]`                                | Relevante quando o item avariado tiver vínculo com múltiplas cotações, para manter a rastreabilidade correta.                           |

**Nota:** A maioria dos itens de homologação da §17 impacta primariamente os módulos de Integração (PRD 07) e Entrega (PRD 05). O módulo de Avaria depende indiretamente dos resultados dessas validações, especialmente para o fluxo de reposição que reutiliza a confirmação de entrega via Sienge.

## 12. Critérios de aceite

- [ ] `Fornecedor` e `Compras` conseguem registrar avaria em item de pedido.
- [ ] A avaria pode ser registrada mesmo antes de a entrega estar formalmente identificada no Sienge.
- [ ] Ao registrar avaria, o status do pedido/item muda para `Em avaria`.
- [ ] `Fornecedor` consegue sugerir ação corretiva (cancelamento parcial, cancelamento total ou reposição).
- [ ] `Compras` recebe notificação in-app quando fornecedor sugere ação corretiva.
- [ ] `Compras` pode aceitar a sugestão do fornecedor.
- [ ] `Compras` pode recusar a sugestão e definir outra ação corretiva permitida.
- [ ] Apenas `Compras` pode definir a ação corretiva final.
- [ ] `Fornecedor` não consegue definir nem aceitar/rejeitar a própria sugestão.
- [ ] As únicas ações corretivas possíveis são: cancelamento parcial/total ou reposição.
- [ ] Quando `Compras` aceita reposição, o sistema cria registro de `Reposição`.
- [ ] Em `Reposição`, o fornecedor deve informar nova data prometida.
- [ ] A régua de follow-up reinicia com base na nova data prometida de reposição.
- [ ] `Reposição` pode ser no nível de item ou de pedido.
- [ ] Em cancelamento de item, o pedido segue com os demais itens válidos.
- [ ] O sistema recalcula saldo, valor e status após cancelamento.
- [ ] O pedido no Sienge **nunca** é alterado por ações deste módulo.
- [ ] Em devolução total, o pedido fica `Cancelado` no sistema e a régua de follow-up é encerrada.
- [ ] Avaria pós-entrega total reabre o acompanhamento apenas quando gera `Reposição`.
- [ ] Avaria pós-entrega total sem reposição é tratada sem reabrir o fluxo do pedido.
- [ ] Toda notificação e decisão de avaria tem trilha auditável no sistema.
- [ ] Todos os eventos de auditoria listados no §10 são registrados com os campos mínimos exigidos.
- [ ] A listagem de pedidos no portal do fornecedor exibe indicação de avaria/reposição.
- [ ] A listagem de pedidos no backoffice exibe indicação de avaria/divergência.
- [ ] `Em avaria` usa cor roxa e `Reposição` usa cor azul, conforme PRDGlobal §12.5.
- [ ] Fornecedor acessa apenas avarias dos próprios pedidos (isolamento de dados).

## 13. Fases de implementação sugeridas

### Fase 1 — Modelagem e infraestrutura

1. Criar tabelas `damage_report`, `damage_replacement` e `damage_audit_log` com migrações.
2. Configurar RLS (Row Level Security) para isolamento por fornecedor.
3. Implementar enums e tipos no `packages/domain`.

### Fase 2 — Endpoints de registro e listagem

4. Implementar `POST /api/damages` (registro de avaria).
5. Implementar `GET /api/damages` (listagem com filtros e paginação).
6. Implementar `GET /api/damages/{damageId}` (detalhe).
7. Registrar eventos de auditoria em cada operação.

### Fase 3 — Fluxo de ação corretiva

8. Implementar `PATCH /api/damages/{damageId}/suggest` (sugestão do fornecedor).
9. Implementar `PATCH /api/damages/{damageId}/resolve` (decisão de `Compras`).
10. Implementar lógica de cancelamento (recálculo de saldo/status).
11. Implementar lógica de criação de reposição.

### Fase 4 — Fluxo de reposição

12. Implementar `PATCH /api/damages/{damageId}/replacement/date` (data de reposição).
13. Implementar integração com o módulo de Follow-up (reinício da régua).
14. Implementar detecção de entrega de reposição via módulo de Entrega.

### Fase 5 — Interface do usuário

15. Tela de registro de avaria no portal do fornecedor.
16. Tela de detalhe de avaria no portal do fornecedor.
17. Tela de gestão de avarias no backoffice.
18. Tela de detalhe de avaria no backoffice (com decisão de ação corretiva).
19. Adicionar indicadores de avaria/reposição nas listagens de pedidos.

### Fase 6 — Cenários avançados e validação

20. Implementar fluxo de reabertura após entrega total.
21. Implementar devolução total (cancelamento completo + encerramento de régua).
22. Testes de integração entre Avaria ↔ Entrega ↔ Follow-up.
23. Testes de isolamento de dados do fornecedor.

## 14. Riscos específicos do módulo

| Risco                                                                                                    | Probabilidade | Impacto | Mitigação                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------- | ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmação de entrega de reposição não coberta pelo endpoint `deliveries-attended`                      | Média         | Alto    | Validar em homologação (§17 item 8). Prever fallback manual para `Compras` confirmar reposição sem nota fiscal no Sienge.                     |
| Cálculo incorreto de status em cenários de cancelamento parcial + entrega parcial + reposição simultânea | Média         | Alto    | Implementar máquina de estados com testes exaustivos para combinações de status. Cobrir cenários de edge case com testes automatizados.       |
| Inconsistência entre status local e status do Sienge após cancelamento ou reposição                      | Baixa         | Médio   | Registrar ações locais sem tocar no Sienge (conforme RN-15). Documentar que `Compras` deve tratar divergências manualmente no ERP.            |
| Fornecedor não informar data de reposição em tempo hábil                                                 | Média         | Médio   | Notificações automáticas lembrando o fornecedor. Em último caso, `Compras` pode cancelar a reposição e definir cancelamento.                  |
| Múltiplas avarias no mesmo item gerando conflito de estado                                               | Baixa         | Médio   | Permitir múltiplos registros de avaria por item, cada um com seu próprio ciclo de vida. O status do item considera a avaria mais grave ativa. |
| Dependência do módulo de Entrega (PRD 05) e Follow-up (PRD 04) para cenários completos                   | Alta          | Alto    | Priorizar implementação dos PRDs 04 e 05 antes ou em paralelo. Definir interfaces de integração claras e estáveis entre os módulos.           |
