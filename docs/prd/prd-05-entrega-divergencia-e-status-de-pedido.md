# PRD Filho — Entrega, Divergência e Status de Pedido

> Módulo: 5 de 9
> Seções do PRDGlobal: §7
> Dependências: 1 (Autenticação e Perfis), 7 (Integração com o Sienge)
> Data de geração: 2026-04-06

---

## 1. Objetivo do módulo

Este módulo é responsável por consolidar a visão operacional de entregas, divergências e status de pedidos de compra no sistema. Ele consome dados de entregas vindos do Sienge — identificados via nota fiscal — e permite que `Compras` valide cada entrega, registrando conformidade (`OK`) ou `Divergência`.

O módulo resolve o problema de falta de visibilidade sobre o estado real das entregas no fluxo de suprimentos. Sem ele, a equipe de Compras não tem como saber, de forma estruturada e auditável, se um pedido foi parcialmente entregue, se houve divergência entre o previsto e o entregue, ou se o pedido está atrasado. Essa informação hoje fica dispersa entre planilhas, e-mails e verificações manuais no ERP.

O valor entregue é a capacidade de acompanhar automaticamente o ciclo de vida do pedido — desde a importação do Sienge até a confirmação final de entrega — com status calculados em tempo real, alertas de divergência e atraso, e uma trilha auditável de cada decisão operacional.

## 2. Escopo funcional

### 2.1 Incluso neste PRD

- Importação automática de dados de entrega do Sienge via `GET /purchase-invoices/deliveries-attended`.
- Cálculo e transição dos status operacionais de pedido: `Parcialmente Entregue`, `Entregue`, `Atrasado`, `Divergência`, `Em avaria`, `Reposição`, `Cancelado`.
- Validação de entrega por `Compras` (decisão `OK` ou `Divergência`).
- Regras de interação entre divergência e régua de follow-up (referência cruzada com módulo 4).
- Regras de entrega parcial e cálculo de saldo pendente.
- Regras de cancelamento e devolução total (status `Cancelado` e encerramento de régua).
- Notificação automática para `Compras` quando uma entrega é identificada pelo sistema.
- Tela de validação de entregas no backoffice.
- Tela de consulta de pedidos e entregas no portal do fornecedor.
- Tela de consulta de pedidos e entregas no portal do Visualizador de Pedidos.
- Eventos de auditoria para validação de entrega e registro de divergência.

### 2.2 Excluído deste PRD

- **Registro de avaria e ação corretiva:** coberto pelo módulo 6 (Avaria e Ação Corretiva). Este módulo apenas reflete os status `Em avaria` e `Reposição` quando definidos pelo módulo 6.
- **Régua de cobrança e follow-up logístico:** coberto pelo módulo 4 (Follow-up Logístico). Este módulo apenas informa ao follow-up se a divergência ocorreu com prazo aberto ou vencido.
- **Importação de pedidos de compra do Sienge:** coberta pelo módulo 7 (Integração com o Sienge). Este módulo consome os pedidos já sincronizados.
- **Importação de dados de entregas programadas (delivery-schedules):** coberta pelo módulo 7 (Integração com o Sienge).
- **Dashboard e indicadores sobre entregas:** coberto pelo módulo 8 (Dashboard e Indicadores).
- **Filtro rápido "Exigem ação" no backoffice:** coberto pelo módulo 9 (Backoffice, Auditoria e Operação). Este módulo apenas garante que os status estarão disponíveis para filtragem.
- **Cores operacionais do backoffice:** coberto pelo módulo 9 (Backoffice, Auditoria e Operação).

### 2.3 Fora de escopo da V1.0

- Régua separada por parcela de entrega do mesmo item _(PRDGlobal §2.3)_.
- Automações financeiras, fiscais ou contábeis além do uso logístico de nota fiscal _(PRDGlobal §2.3)_.
- Alteração automática de data planejada no Sienge a partir de sugestão do fornecedor _(PRDGlobal §2.3)_.

## 3. Perfis envolvidos

| Perfil                      | Permissões neste módulo                                                                                                                                                                                     | Restrições                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Fornecedor**              | Consulta lista de pedidos e entregas próprias no portal. Visualiza status, data prometida, data do pedido, indicação de atraso, avaria ou reposição.                                                        | Apenas dados próprios. Não pode validar entrega, registrar divergência ou alterar status.                       |
| **Compras**                 | Visualiza lista de pedidos e entregas no backoffice. Valida entrega (`OK` ou `Divergência`). Acompanha saldos pendentes e status operacionais. Recebe notificação automática quando entrega é identificada. | Não pode gerir acessos ou parametrizar o sistema.                                                               |
| **Administrador**           | Acesso administrativo completo ao sistema, inclusive consulta de entregas e pedidos.                                                                                                                        | Não valida entregas operacionalmente (função de `Compras`).                                                     |
| **Visualizador de Pedidos** | Consulta pedidos e entregas.                                                                                                                                                                                | Não altera dados. Não acessa dashboards, indicadores, parametrizações ou ações operacionais. _(PRDGlobal §3.2)_ |

_(Referência: PRDGlobal §3)_

## 4. Entidades e modelagem

### 4.1 `delivery_record` — Registro de entrega

Armazena cada entrega identificada a partir do Sienge.

| Campo                        | Tipo          | Obrigatório | Descrição                                                                                          |
| ---------------------------- | ------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `id`                         | UUID          | Sim         | Identificador único interno.                                                                       |
| `purchase_order_id`          | INTEGER       | Sim         | ID do pedido de compra no Sienge (`purchaseOrderId`).                                              |
| `purchase_order_item_number` | INTEGER       | Sim         | Número do item do pedido (`purchaseOrderItemNumber`).                                              |
| `delivery_item_number`       | INTEGER       | Sim         | Número do item de entrega do pedido (`deliveryItemPurchaseOrderNumber`).                           |
| `attended_number`            | INTEGER       | Sim         | Número do atendimento (`purchaseOrderItemAttendedNumber`).                                         |
| `sequential_number`          | INTEGER       | Sim         | Número sequencial da nota fiscal (`sequentialNumber`).                                             |
| `invoice_item_number`        | INTEGER       | Sim         | Número do item na nota fiscal (`invoiceItemNumber`).                                               |
| `delivery_date`              | DATE          | Sim         | Data da entrega efetiva (`deliveryDate`).                                                          |
| `quantity_delivered`         | DECIMAL(15,4) | Sim         | Quantidade entregue (`quantityDelivery`).                                                          |
| `validation_status`          | ENUM          | Sim         | Status da validação: `AGUARDANDO_VALIDACAO`, `OK`, `DIVERGENCIA`. Default: `AGUARDANDO_VALIDACAO`. |
| `validated_by`               | UUID          | Não         | ID do usuário que validou.                                                                         |
| `validated_at`               | TIMESTAMPTZ   | Não         | Data/hora da validação.                                                                            |
| `validation_notes`           | TEXT          | Não         | Observações da validação por `Compras`.                                                            |
| `sienge_synced_at`           | TIMESTAMPTZ   | Sim         | Data/hora da sincronização com o Sienge.                                                           |
| `created_at`                 | TIMESTAMPTZ   | Sim         | Data de criação do registro.                                                                       |
| `updated_at`                 | TIMESTAMPTZ   | Sim         | Data da última atualização.                                                                        |

**Relacionamentos:**

- `purchase_order_id` → referência lógica ao pedido sincronizado (tabela de pedidos do módulo 7).
- `validated_by` → `auth.users.id` (Supabase Auth).

**Índices sugeridos:**

- `(purchase_order_id, purchase_order_item_number)` — busca por pedido e item.
- `(sequential_number)` — busca por nota fiscal.
- `(validation_status)` — filtragem por status de validação.
- `(delivery_date)` — ordenação temporal.

**Regras de integridade:**

- `validation_status` aceita apenas `AGUARDANDO_VALIDACAO`, `OK`, `DIVERGENCIA`.
- `validated_by` e `validated_at` devem ser preenchidos simultaneamente quando `validation_status` != `AGUARDANDO_VALIDACAO`.
- Não deve existir registro duplicado para a mesma combinação de `purchase_order_id` + `purchase_order_item_number` + `delivery_item_number` + `attended_number` + `sequential_number` + `invoice_item_number` (constraint UNIQUE).

### 4.2 `order_status_history` — Histórico de status do pedido

Registra cada transição de status de um pedido para auditoria.

| Campo               | Tipo        | Obrigatório | Descrição                                                                  |
| ------------------- | ----------- | ----------- | -------------------------------------------------------------------------- |
| `id`                | UUID        | Sim         | Identificador único.                                                       |
| `purchase_order_id` | INTEGER     | Sim         | ID do pedido de compra no Sienge.                                          |
| `previous_status`   | TEXT        | Não         | Status anterior (nulo na primeira atribuição).                             |
| `new_status`        | TEXT        | Sim         | Novo status atribuído.                                                     |
| `reason`            | TEXT        | Não         | Motivo da transição (ex.: "Divergência registrada por Compras").           |
| `changed_by`        | UUID        | Não         | ID do usuário que causou a mudança (nulo para mudanças automáticas).       |
| `changed_by_system` | BOOLEAN     | Sim         | `true` se a mudança foi automática (ex.: sincronização). Default: `false`. |
| `created_at`        | TIMESTAMPTZ | Sim         | Data/hora da transição.                                                    |

**Índices sugeridos:**

- `(purchase_order_id, created_at)` — histórico temporal por pedido.

**Regras de integridade:**

- `new_status` deve ser um dos status operacionais válidos definidos em §7.3.
- Registros são imutáveis (append-only, sem UPDATE ou DELETE).

### 4.3 Extensão da entidade de pedido (módulo 7)

Este módulo espera que a entidade de pedido sincronizado (responsabilidade do módulo 7 — Integração com o Sienge) contenha pelo menos os seguintes campos operacionais calculados ou derivados:

| Campo                      | Tipo          | Descrição                                                                                                                        |
| -------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `current_status`           | ENUM          | Status operacional atual: `Parcialmente Entregue`, `Entregue`, `Atrasado`, `Divergência`, `Em avaria`, `Reposição`, `Cancelado`. |
| `total_quantity_ordered`   | DECIMAL(15,4) | Quantidade total pedida (soma dos itens).                                                                                        |
| `total_quantity_delivered` | DECIMAL(15,4) | Quantidade total entregue (soma das entregas confirmadas com `OK`).                                                              |
| `pending_quantity`         | DECIMAL(15,4) | Saldo pendente (`total_quantity_ordered - total_quantity_delivered`).                                                            |
| `has_divergence`           | BOOLEAN       | Flag indicando se existe divergência ativa.                                                                                      |
| `last_delivery_date`       | DATE          | Data da última entrega confirmada.                                                                                               |

> **Nota:** Estes campos são calculados por este módulo e persistidos/atualizados na entidade de pedido. O módulo 7 provê a estrutura base; este módulo opera sobre ela.

## 5. Regras de negócio

- **RN-01:** A fonte oficial de confirmação de entrega na V1.0 é a Nota Fiscal, obtida via `GET /purchase-invoices/deliveries-attended`. _(PRDGlobal §7.1)_

- **RN-02:** A entrada de nota fiscal deve ser puxada automaticamente do Sienge. _(PRDGlobal §7.2)_

- **RN-03:** Após identificar uma entrega, o sistema notifica `Compras`. _(PRDGlobal §7.2)_

- **RN-04:** `Compras` valida a informação de entrega e decide entre `OK` ou `Divergência`. _(PRDGlobal §7.2)_

- **RN-05:** Se houver `Divergência` e o prazo ainda não tiver vencido, a régua de follow-up continua. _(PRDGlobal §7.2)_

- **RN-06:** Se houver `Divergência` e o prazo já tiver vencido, o status permanece `Atrasado`. _(PRDGlobal §7.2)_

- **RN-07:** `Parcialmente Entregue` deve ser aplicado quando houver entrega parcial identificada no Sienge. _(PRDGlobal §7.3)_

- **RN-08:** O pedido deve permanecer `Parcialmente Entregue` até que todos os itens restantes tenham sido entregues, cancelados ou encaminhados para `Reposição`. _(PRDGlobal §7.3)_

- **RN-09:** Um pedido só pode ficar `Entregue` quando todos os itens tiverem entrega confirmada no Sienge. _(PRDGlobal §7.3)_

- **RN-10:** `Reposição` pode valer no nível de item ou no nível de pedido, dependendo da abrangência da substituição aprovada por `Compras`. _(PRDGlobal §7.3)_

- **RN-11:** Em devolução total da compra, o pedido inteiro deve ficar `Cancelado` no sistema e a régua de follow-up deve ser encerrada imediatamente. _(PRDGlobal §7.3)_

- **RN-12:** O sistema recalcula internamente saldo, valor e status quando houver cancelamento ou devolução de item. O pedido no Sienge nunca é alterado por essas ações. _(PRDGlobal §8.5)_

- **RN-13:** O pedido deve permanecer com status `Em avaria` quando uma avaria for registrada (responsabilidade do módulo 6), até que a ação corretiva seja definida. _(PRDGlobal §8.1)_

- **RN-14:** Quando a data prometida vencer e no dia útil seguinte ainda não houver nota fiscal no Sienge confirmando a entrega, o pedido deve ser sinalizado como `Atrasado`. _(PRDGlobal §6.6)_

- **RN-15:** Em entrega parcial, a régua de follow-up continua apenas enquanto existir saldo pendente no pedido. _(PRDGlobal §6.6)_

- **RN-16:** O vínculo operacional mínimo `nota → pedido` deve considerar `purchaseOrderId`, `purchaseOrderItemNumber`, `sequentialNumber`, `invoiceItemNumber`, `deliveryDate` e `quantityDelivery`. _(PRDGlobal §9.7)_

- **RN-17:** O sistema não deve tentar ligar nota fiscal à cotação diretamente por fornecedor, data ou número textual. O caminho correto é `Nota Fiscal → purchaseOrderId → item do pedido → purchaseQuotations[].purchaseQuotationId → Cotação`. _(PRDGlobal §9.7)_

## 6. Fluxos operacionais

### 6.1 Fluxo de identificação e validação de entrega

**Descrição passo a passo:**

1. O sistema executa sincronização periódica (polling) chamando `GET /purchase-invoices/deliveries-attended` com filtro por `purchaseOrderId` dos pedidos ativos monitorados.
2. Para cada registro retornado, o sistema verifica se já existe um `delivery_record` com a mesma combinação de chaves únicas.
3. Se for um registro novo:
   a. Cria o `delivery_record` com `validation_status = pending`.
   b. Recalcula os campos de saldo e status do pedido.
   c. Notifica `Compras` que uma nova entrega foi identificada.
4. `Compras` acessa o backoffice e visualiza a entrega pendente de validação.
5. `Compras` analisa os dados (quantidade, nota fiscal, item) e decide:
   - **OK:** O registro recebe `validation_status = ok`. O saldo é atualizado.
   - **Divergência:** O registro recebe `validation_status = divergence`. O status do pedido muda para `Divergência`.
6. Cada decisão gera registro de auditoria e entrada no `order_status_history`.

**Diagrama de estados do pedido:**

```
                    ┌─────────────────────┐
                    │   Pedido Importado   │
                    │   (Follow-up ativo)  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Entrega Parcial    │
               ┌────│  Identificada?      │────┐
               │    └─────────────────────┘    │
              Sim                              Não
               │                               │
    ┌──────────▼──────────┐         ┌──────────▼──────────┐
    │  Parcialmente       │         │  Prazo vencido sem   │
    │  Entregue           │         │  entrega?            │
    └──────────┬──────────┘         └──────────┬──────────┘
               │                               │
        Compras valida               Sim ──────▼─────── Não
               │                     │                    │
    ┌────┬─────▼─────┐     ┌────────▼──────┐   (continua
    │    │           │     │   Atrasado    │    follow-up)
   OK  Divergência   │     └───────────────┘
    │    │           │
    │    │    ┌──────▼──────────────┐
    │    │    │ Avaria? (módulo 6)  │
    │    │    └──────┬──────────────┘
    │    │           │
    │    │    ┌──────▼──────┐  ┌────────────┐
    │    │    │ Em avaria   │──│ Reposição  │
    │    │    └─────────────┘  └────────────┘
    │    │
    │    ▼─────────── Prazo aberto? ──── Sim: régua continua
    │    │                                Não: mantém Atrasado
    │    │
    ▼    │
Todos   │          ┌────────────────┐
itens   │          │   Cancelado    │
OK?     │          │(devolução total)│
    │   │          └────────────────┘
   Sim  │
    │   │
    ▼   │
┌───────▼───────┐
│   Entregue    │
└───────────────┘
```

**Exceções e tratamento de erro:**

- **Falha na sincronização com Sienge:** O registro de sincronização é marcado como falha. O sistema tenta novamente na próxima janela de polling. Se a falha persistir após os ciclos de retry definidos no módulo 7, `Compras` é notificado.
- **Registro duplicado de entrega:** Se a combinação de chaves únicas já existir em `delivery_record`, o sistema ignora o registro duplicado (idempotência).
- **Quantidade entregue inconsistente:** Se `quantityDelivery` for maior que o saldo pendente do item, o sistema cria o `delivery_record` normalmente mas sinaliza o pedido para revisão por `Compras` com indicação de `Divergência` automática.

### 6.2 Fluxo de cálculo de status

**Descrição passo a passo:**

1. Após cada novo `delivery_record` criado ou validado, o sistema recalcula o status do pedido.
2. Soma as quantidades entregues com `validation_status = ok` para cada item do pedido.
3. Compara com a quantidade total pedida.
4. Aplica as regras:
   - Se existir entrega confirmada mas saldo pendente > 0 → `Parcialmente Entregue`.
   - Se toda a quantidade de todos os itens estiver entregue → `Entregue`.
   - Se existir pelo menos um `delivery_record` com `validation_status = divergence` → `Divergência` (tem precedência sobre `Parcialmente Entregue`).
   - Se existir avaria ativa (módulo 6) → `Em avaria` (tem precedência sobre outros status exceto `Cancelado`).
   - Se existir reposição ativa (módulo 6) → `Reposição`.
   - Se houve devolução total → `Cancelado`.
5. Se o status mudar, registra a transição em `order_status_history`.

### 6.3 Fluxo de cancelamento e devolução total

**Descrição passo a passo:**

1. `Compras` identifica devolução total do pedido.
2. O sistema marca o pedido como `Cancelado`.
3. O sistema encerra imediatamente a régua de follow-up (notifica o módulo 4).
4. Registra evento de auditoria com motivo.
5. O pedido permanece consultável, mas sem ações operacionais ativas.

## 7. Contratos de API / Serviços

### 7.1 Listar entregas pendentes de validação

- **Método e rota:** `GET /api/deliveries/pending`
- **Entrada:**
  - `purchase_order_id` (INTEGER, opcional) — filtrar por pedido.
  - `supplier_id` (INTEGER, opcional) — filtrar por fornecedor.
  - `page` (INTEGER, default: 1) — paginação.
  - `limit` (INTEGER, default: 20, max: 100) — limite por página.
- **Saída:**
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "purchase_order_id": 128,
        "purchase_order_item_number": 1,
        "sequential_number": 190,
        "invoice_item_number": 1,
        "delivery_date": "2019-07-15",
        "quantity_delivered": 84.0,
        "validation_status": "pending",
        "sienge_synced_at": "2026-04-06T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5
    }
  }
  ```
- **Erros esperados:**
  - `401 Unauthorized` — token inválido ou ausente.
  - `403 Forbidden` — perfil sem permissão.
  - `400 Bad Request` — parâmetros inválidos.
- **Perfis autorizados:** `Compras`, `Administrador`.

### 7.2 Validar entrega

- **Método e rota:** `POST /api/deliveries/{deliveryRecordId}/validate`
- **Entrada:**

  ```json
  {
    "decision": "ok" | "divergence",
    "notes": "Observação opcional"
  }
  ```

  - `decision` (STRING, obrigatório) — `ok` ou `divergence`.
  - `notes` (STRING, opcional) — observações da validação.

- **Saída:**
  ```json
  {
    "id": "uuid",
    "validation_status": "ok",
    "validated_by": "uuid",
    "validated_at": "2026-04-06T14:30:00Z",
    "order_status_updated": true,
    "new_order_status": "Parcialmente Entregue"
  }
  ```
- **Erros esperados:**
  - `401 Unauthorized` — token inválido ou ausente.
  - `403 Forbidden` — perfil sem permissão.
  - `404 Not Found` — `deliveryRecordId` não encontrado.
  - `409 Conflict` — entrega já validada.
  - `400 Bad Request` — `decision` inválido.
- **Perfis autorizados:** `Compras`.

### 7.3 Consultar detalhes de entregas de um pedido

- **Método e rota:** `GET /api/orders/{purchaseOrderId}/deliveries`
- **Entrada:**
  - `purchaseOrderId` (INTEGER, obrigatório, path param).
- **Saída:**
  ```json
  {
    "purchase_order_id": 128,
    "current_status": "Parcialmente Entregue",
    "total_quantity_ordered": 100,
    "total_quantity_delivered": 84,
    "pending_quantity": 16,
    "deliveries": [
      {
        "id": "uuid",
        "purchase_order_item_number": 1,
        "sequential_number": 190,
        "invoice_item_number": 1,
        "delivery_date": "2019-07-15",
        "quantity_delivered": 84.0,
        "validation_status": "ok",
        "validated_by": "uuid",
        "validated_at": "2026-04-06T14:30:00Z"
      }
    ]
  }
  ```
- **Erros esperados:**
  - `401 Unauthorized` — token inválido ou ausente.
  - `403 Forbidden` — perfil sem permissão.
  - `404 Not Found` — pedido não encontrado.
- **Perfis autorizados:** `Compras`, `Administrador`, `Visualizador de Pedidos`, `Fornecedor` (apenas pedidos próprios).

### 7.4 Listar pedidos com status operacional

- **Método e rota:** `GET /api/orders`
- **Entrada:**
  - `status` (STRING, opcional) — filtrar por status operacional.
  - `supplier_id` (INTEGER, opcional) — filtrar por fornecedor.
  - `building_id` (INTEGER, opcional) — filtrar por obra.
  - `has_divergence` (BOOLEAN, opcional) — filtrar pedidos com divergência.
  - `page` (INTEGER, default: 1).
  - `limit` (INTEGER, default: 20, max: 100).
- **Saída:**
  ```json
  {
    "data": [
      {
        "purchase_order_id": 128,
        "formatted_id": "128",
        "supplier_id": 77,
        "supplier_name": "Fornecedor XPTO",
        "building_id": 15,
        "current_status": "Parcialmente Entregue",
        "order_date": "2018-03-11",
        "promised_date": "2018-04-11",
        "is_late": false,
        "has_divergence": false,
        "has_damage": false,
        "pending_quantity": 16,
        "quotation_id": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50
    }
  }
  ```
- **Erros esperados:**
  - `401 Unauthorized` — token inválido ou ausente.
  - `403 Forbidden` — perfil sem permissão.
  - `400 Bad Request` — parâmetros inválidos.
- **Perfis autorizados:**
  - `Compras`, `Administrador` — todos os pedidos.
  - `Fornecedor` — apenas pedidos próprios.
  - `Visualizador de Pedidos` — todos os pedidos (somente leitura).

### 7.5 Registrar cancelamento/devolução total

- **Método e rota:** `POST /api/orders/{purchaseOrderId}/cancel`
- **Entrada:**

  ```json
  {
    "reason": "Devolução total da compra"
  }
  ```

  - `reason` (STRING, obrigatório) — motivo do cancelamento.

- **Saída:**
  ```json
  {
    "purchase_order_id": 128,
    "new_status": "Cancelado",
    "followup_terminated": true,
    "cancelled_at": "2026-04-06T15:00:00Z"
  }
  ```
- **Erros esperados:**
  - `401 Unauthorized` — token inválido ou ausente.
  - `403 Forbidden` — perfil sem permissão.
  - `404 Not Found` — pedido não encontrado.
  - `409 Conflict` — pedido já cancelado.
- **Perfis autorizados:** `Compras`.

### 7.6 Consultar histórico de status de um pedido

- **Método e rota:** `GET /api/orders/{purchaseOrderId}/status-history`
- **Entrada:**
  - `purchaseOrderId` (INTEGER, obrigatório, path param).
- **Saída:**
  ```json
  {
    "purchase_order_id": 128,
    "history": [
      {
        "id": "uuid",
        "previous_status": null,
        "new_status": "Parcialmente Entregue",
        "reason": "Entrega parcial identificada via NF 190",
        "changed_by": null,
        "changed_by_system": true,
        "created_at": "2026-04-06T10:00:00Z"
      },
      {
        "id": "uuid",
        "previous_status": "Parcialmente Entregue",
        "new_status": "Divergência",
        "reason": "Divergência registrada por Compras",
        "changed_by": "uuid",
        "changed_by_system": false,
        "created_at": "2026-04-06T14:30:00Z"
      }
    ]
  }
  ```
- **Erros esperados:**
  - `401 Unauthorized`.
  - `403 Forbidden`.
  - `404 Not Found`.
- **Perfis autorizados:** `Compras`, `Administrador`.

## 8. Interface do usuário

### 8.1 Lista de pedidos e entregas — Backoffice

- **Nome:** Tela de Pedidos e Entregas (Backoffice)
- **Propósito:** Visão consolidada de todos os pedidos com status operacional, filtros e ações.
- **Campos exibidos (conforme PRDGlobal §14.1):**
  - Número do pedido.
  - Fornecedor.
  - Obra.
  - Status (com cor operacional conforme §12.5).
  - Data do pedido.
  - Data prometida atual.
  - Indicação de atraso.
  - Indicação de avaria ou divergência.
  - Saldo pendente.
  - Número da cotação vinculada.
- **Ações disponíveis por perfil:**
  - `Compras`: clicar para ver detalhes, validar entregas, registrar cancelamento.
  - `Administrador`: clicar para ver detalhes (sem ações operacionais).
- **Ordenação (conforme PRDGlobal §12.4):**
  - Pedidos `Atrasados` primeiro.
  - Pedidos em `Divergência`.
  - Pedidos em `Em avaria` ou `Reposição`.
  - Pedidos pendentes de resposta do fornecedor.
  - Pedidos no prazo ou entregues.
- **Referências visuais:**
  - Azul Escuro `#324598` para cabeçalhos e estrutura.
  - Azul Médio `#465EBE` para botões e ações.
  - Cores de status conforme §12.5: Vermelho (Atrasado), Laranja (Divergência), Roxo (Em avaria), Azul (Reposição), Verde (Entregue), Amarelo (Parcialmente Entregue), Cinza (Cancelado).

### 8.2 Detalhes do pedido e validação de entrega — Backoffice

- **Nome:** Tela de Detalhes do Pedido e Entregas
- **Propósito:** Permite a `Compras` visualizar todas as entregas de um pedido e validar cada uma.
- **Campos exibidos:**
  - Dados do pedido (número, fornecedor, obra, status, datas).
  - Saldo geral: quantidade pedida, entregue, pendente.
  - Lista de entregas com: número da NF, item, data de entrega, quantidade, status de validação.
  - Histórico de status do pedido.
- **Ações disponíveis por perfil:**
  - `Compras`: botão "Validar" para cada entrega pendente → abre modal com opções `OK` / `Divergência` e campo de observações. Botão "Cancelar Pedido" para devolução total.

### 8.3 Lista de pedidos — Portal do Fornecedor

- **Nome:** Meus Pedidos (Portal do Fornecedor)
- **Propósito:** Permite ao fornecedor consultar seus pedidos e entregas.
- **Campos exibidos (conforme PRDGlobal §14.1):**
  - Número do pedido.
  - Status.
  - Data prometida atual.
  - Data do pedido.
  - Indicação de atraso.
  - Indicação de avaria ou reposição.
  - Obra (quando disponível).
- **Ações disponíveis:**
  - Clicar para ver detalhes do pedido e entregas associadas (somente consulta).
- **Referências visuais:**
  - Paleta institucional conforme `docs/paleta_de_cores.md`.
  - Cores de status para rápida identificação visual.

### 8.4 Lista de pedidos — Visualizador de Pedidos

- **Nome:** Consulta de Pedidos (Visualizador)
- **Propósito:** Consulta de pedidos e entregas sem capacidade de alteração.
- **Campos exibidos:** mesmos da tela do backoffice (§8.1).
- **Ações disponíveis:** nenhuma ação operacional. Somente leitura.
- **Restrições:** não acessa dashboards, indicadores, parametrizações ou ações operacionais _(PRDGlobal §3.2)_.

## 9. Integrações e dependências externas

### 9.1 Integração com o Sienge — Leitura de entregas

**Endpoint principal:**

- `GET /purchase-invoices/deliveries-attended` _(PRDGlobal §9.3.5)_

**Uso neste módulo:**

- Confirmar entrega efetiva.
- Ligar pedido a nota fiscal.
- Ligar item do pedido a item da nota.
- Capturar data e quantidade entregues.

**Filtros obrigatórios:**

- `purchaseOrderId` — filtro principal por pedido monitorado.

**Regras de combinação de filtros:**

- Se `billId` não for informado, é obrigatório informar `sequentialNumber` ou `purchaseOrderId`.
- Se `sequentialNumber` não for informado, é obrigatório informar `billId` ou `purchaseOrderId`.
- Se `purchaseOrderId` não for informado, é obrigatório informar `sequentialNumber` ou `billId`.

**Campos consumidos no retorno:**

- `purchaseOrderId`
- `purchaseOrderItemNumber`
- `deliveryItemPurchaseOrderNumber`
- `purchaseOrderItemAttendedNumber`
- `sequentialNumber`
- `invoiceItemNumber`
- `deliveryDate`
- `quantityDelivery`

_(Referência: PRDGlobal §9.3.5)_

### 9.2 Integração com o Sienge — Leitura complementar de notas fiscais

**Endpoints complementares (quando necessário para auditoria ou detalhamento):**

- `GET /purchase-invoices/{sequentialNumber}` _(PRDGlobal §9.3.5)_
- `GET /purchase-invoices/{sequentialNumber}/items` _(PRDGlobal §9.3.5)_

**Campos relevantes:**

- `supplierId`, `number`, `companyId`, `issueDate`, `movementDate`, `sequentialNumber`, `consistency`, `invoiceDeliveryId`.

### 9.3 Integração com o Sienge — Entregas programadas

**Endpoint:**

- `GET /purchase-orders/{purchaseOrderId}/items/{itemNumber}/delivery-schedules` _(PRDGlobal §9.3.4)_

**Uso neste módulo:**

- Comparar previsto versus entregue.
- Acompanhar saldo em aberto.

**Campos consumidos:**

- `deliveryScheduleNumber`
- `sheduledDate` (grafia sem `c` — respeitar contrato real)
- `sheduledQuantity` (grafia sem `c` — respeitar contrato real)
- `deliveredQuantity`
- `openQuantity`

_(Referência: PRDGlobal §9.3.4, §9.10)_

### 9.4 Dependência do módulo 7 — Integração com o Sienge

- Este módulo depende de pedidos já sincronizados pelo módulo 7.
- O módulo 7 deve fornecer a estrutura de dados de pedidos e itens de pedido persistidos localmente.
- O polling de `deliveries-attended` pode ser executado como extensão do ciclo de sincronização de pedidos do módulo 7, ou como job independente.

### 9.5 Dependência do módulo 4 — Follow-up Logístico

- Quando uma `Divergência` é registrada com prazo aberto, este módulo deve sinalizar ao módulo 4 que a régua deve continuar.
- Quando um pedido é marcado como `Cancelado`, este módulo deve sinalizar ao módulo 4 para encerrar a régua imediatamente.
- Quando uma entrega parcial é confirmada com `OK` e ainda existe saldo pendente, o módulo 4 deve manter a régua ativa.

### 9.6 Dependência do módulo 6 — Avaria e Ação Corretiva

- Este módulo reflete os status `Em avaria` e `Reposição` quando eles são definidos pelo módulo 6.
- O módulo 6 notifica este módulo para atualizar o `current_status` do pedido.

### 9.7 Tratamento de falhas de integração

- Em caso de falha de integração com o Sienge, o sistema tenta novo reprocessamento automático após `24 horas` _(PRDGlobal §12.2)_.
- Se a falha persistir, `Compras` deve ser notificado _(PRDGlobal §12.2)_.
- `Compras` pode acionar reprocessamento manual no backoffice _(PRDGlobal §12.2)_.

### 9.8 Regra de vínculo nota → pedido → cotação

- Para ligar nota fiscal ao pedido, usar `GET /purchase-invoices/deliveries-attended` _(PRDGlobal §9.7)_.
- Para ligar nota fiscal à cotação, seguir o caminho: `Nota Fiscal → purchaseOrderId → item do pedido → purchaseQuotations[].purchaseQuotationId → Cotação` _(PRDGlobal §9.7)_.
- O sistema **não deve** tentar ligar nota fiscal à cotação diretamente por fornecedor, data ou número textual _(PRDGlobal §9.7)_.

## 10. Auditoria e rastreabilidade

Eventos auditáveis gerados por este módulo, conforme §12.6 do PRDGlobal:

| Evento                           | Descrição                                                              | Dados mínimos registrados                                                    |
| -------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `delivery_identified`            | Nova entrega identificada via sincronização com Sienge.                | Data/hora, pedido, item, NF, quantidade, origem (sistema).                   |
| `delivery_validated_ok`          | Entrega validada como `OK` por `Compras`.                              | Data/hora, pedido, item, NF, usuário (`Compras`), observações.               |
| `delivery_validated_divergence`  | Entrega validada como `Divergência` por `Compras`.                     | Data/hora, pedido, item, NF, usuário (`Compras`), observações.               |
| `order_status_changed`           | Status do pedido foi alterado.                                         | Data/hora, pedido, status anterior, novo status, motivo, usuário ou sistema. |
| `order_cancelled`                | Pedido marcado como `Cancelado` (devolução total).                     | Data/hora, pedido, motivo, usuário (`Compras`).                              |
| `followup_termination_requested` | Solicitação de encerramento da régua de follow-up enviada ao módulo 4. | Data/hora, pedido, motivo.                                                   |

Cada evento deve seguir o formato mínimo de auditoria definido no PRDGlobal §12.6:

- data e hora;
- tipo do evento;
- usuário ou origem do evento;
- cotação ou pedido afetado;
- fornecedor afetado, quando houver;
- resumo da ação realizada.

## 11. Validações pendentes de homologação

Os seguintes itens da §17 do PRDGlobal se aplicam diretamente a este módulo:

| #   | Item de homologação                                                                                                    | Impacto neste módulo                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | Validar se `GET /purchase-invoices/deliveries-attended` cobre todos os cenários reais de entrega da operação.          | **Crítico.** Este é o endpoint principal deste módulo. Se ele não cobrir cenários como entrega parcial, entrega em múltiplas remessas ou devolução, o cálculo de status será incorreto. |
| 7   | Validar cenários reais em que um item do pedido possa referenciar mais de uma cotação no array `purchaseQuotations[]`. | **Relevante.** Impacta o vínculo de rastreabilidade nota → pedido → cotação.                                                                                                            |
| 1   | Validar se `supplierId` corresponde a `creditorId`.                                                                    | **Relevante.** Necessário para confirmar que o fornecedor da entrega é o mesmo fornecedor do pedido e da cotação.                                                                       |
| 9   | Validar variações reais do contrato do campo `openQuantity` em `delivery-requirements`.                                | **Impacto indireto.** Usado para comparação previsto vs. entregue.                                                                                                                      |

## 12. Critérios de aceite

- [ ] O sistema importa automaticamente dados de entrega do Sienge via `GET /purchase-invoices/deliveries-attended`.
- [ ] Registros de entrega duplicados não são criados (idempotência garantida pela constraint UNIQUE).
- [ ] `Compras` é notificado automaticamente quando uma nova entrega é identificada.
- [ ] `Compras` pode validar uma entrega como `OK` ou `Divergência` no backoffice.
- [ ] Após validação `OK`, o saldo pendente do pedido é recalculado corretamente.
- [ ] Após validação `Divergência`, o status do pedido muda para `Divergência`.
- [ ] Se houver `Divergência` com prazo aberto, a régua de follow-up continua ativa.
- [ ] Se houver `Divergência` com prazo vencido, o status permanece `Atrasado`.
- [ ] O status `Parcialmente Entregue` é aplicado quando existe entrega parcial confirmada.
- [ ] O pedido permanece `Parcialmente Entregue` até todos os itens serem entregues, cancelados ou encaminhados para `Reposição`.
- [ ] O status `Entregue` só é aplicado quando todos os itens têm entrega confirmada.
- [ ] Em devolução total, o pedido fica `Cancelado` e a régua de follow-up é encerrada.
- [ ] O sistema recalcula saldo e status internamente sem alterar dados no Sienge.
- [ ] Os status `Em avaria` e `Reposição` são corretamente refletidos quando definidos pelo módulo 6.
- [ ] A lista de pedidos no backoffice exibe todos os campos mínimos definidos no PRDGlobal §14.1.
- [ ] A lista de pedidos no portal do fornecedor exibe todos os campos mínimos definidos no PRDGlobal §14.1.
- [ ] O `Visualizador de Pedidos` consegue consultar pedidos e entregas sem capacidade de alteração.
- [ ] O `Fornecedor` visualiza apenas seus próprios pedidos e entregas.
- [ ] A ordenação no backoffice prioriza pedidos atrasados, em divergência e em avaria.
- [ ] Cada validação de entrega e mudança de status gera registro de auditoria.
- [ ] O histórico de status do pedido está disponível para consulta.
- [ ] O vínculo nota → pedido → cotação segue o caminho correto definido no PRDGlobal §9.7.
- [ ] A grafia `sheduledDate` e `sheduledQuantity` (sem `c`) do contrato do Sienge é respeitada no parser.

## 13. Fases de implementação sugeridas

### Fase 1 — Modelagem e infraestrutura

1. Criar tabelas `delivery_record` e `order_status_history` no Supabase.
2. Criar constraints, índices e políticas de acesso (RLS).
3. Definir enums de status operacionais.

### Fase 2 — Sincronização de entregas

4. Implementar serviço de polling de `GET /purchase-invoices/deliveries-attended`.
5. Implementar lógica de idempotência (verificação de duplicatas).
6. Implementar criação de `delivery_record` e notificação para `Compras`.

### Fase 3 — Validação e cálculo de status

7. Implementar endpoint de validação de entrega (`POST /api/deliveries/{id}/validate`).
8. Implementar engine de cálculo de status do pedido.
9. Implementar registro de transições em `order_status_history`.

### Fase 4 — API de consulta

10. Implementar endpoints de listagem de pedidos e entregas.
11. Implementar endpoint de histórico de status.
12. Implementar filtros e paginação.

### Fase 5 — Interface do usuário

13. Implementar tela de pedidos e entregas no backoffice.
14. Implementar tela de detalhes do pedido com validação de entrega.
15. Implementar tela de pedidos no portal do fornecedor.
16. Implementar tela de pedidos para o Visualizador de Pedidos.

### Fase 6 — Integração cruzada e auditoria

17. Implementar sinalização ao módulo 4 (follow-up) para continuidade ou encerramento de régua.
18. Implementar recepção de status do módulo 6 (avaria).
19. Garantir auditoria completa de todos os eventos definidos na seção 10.

## 14. Riscos específicos do módulo

| Risco                                                                                                                          | Probabilidade | Impacto | Mitigação                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /purchase-invoices/deliveries-attended` não cobrir todos os cenários de entrega (parcial, múltiplas remessas, devolução). | Média         | Alto    | Listar cenários reais durante homologação. Prever tratamento manual por `Compras` no backoffice como fallback.           |
| Inconsistência de dados entre quantidade entregue no Sienge e saldo calculado localmente.                                      | Média         | Médio   | Implementar validação de consistência com alerta para `Compras`. Nunca alterar dados no Sienge.                          |
| Volumes de entregas mal sincronizados gerando atraso na detecção.                                                              | Baixa         | Médio   | Calibrar frequência de polling. Complementar com webhooks quando disponíveis.                                            |
| Complexidade na interação entre status de múltiplos módulos (Divergência × Avaria × Reposição × Atraso).                       | Alta          | Alto    | Definir hierarquia clara de precedência de status. Implementar testes unitários para cada combinação de transição.       |
| Grafia incorreta dos campos do Sienge (`sheduledDate`, `sheduledQuantity`) causando falha no parser.                           | Baixa         | Alto    | Respeitar a grafia do contrato público real. Não normalizar implicitamente. Cobrir com testes de integração.             |
| Dependência circular entre módulos 4, 5 e 6 para cálculo de status.                                                            | Média         | Médio   | Definir contratos claros de interface entre módulos. Usar eventos/notificações assíncronas em vez de chamadas síncronas. |
