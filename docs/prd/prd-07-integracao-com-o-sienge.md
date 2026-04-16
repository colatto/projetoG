# PRD Filho — Integração com o Sienge

> Módulo: 7 de 9
> Seções do PRDGlobal: §9, §10
> Dependências: Nenhuma (módulo fundacional de integração)
> Data de geração: 2026-04-06

---

## 1. Objetivo do módulo

Este módulo estabelece a camada de integração entre o sistema local e o ERP Sienge, que é a fonte principal de verdade para dados operacionais mestres como cotações, fornecedores, pedidos de compra, notas fiscais e entregas. A integração é bidirecional controlada: leitura automatizada de dados do Sienge e escrita controlada de respostas de cotação aprovadas por `Compras`.

O módulo é fundacional porque todos os demais módulos que dependem de dados do Sienge (Cotação, Follow-up, Entrega, Avaria, Dashboard) consomem os clientes, mapeadores e mecanismos de sincronização aqui definidos. Sem esta camada, o sistema local não tem acesso aos dados operacionais mestres necessários para operação.

O valor entregue é: automação confiável da troca de dados com o Sienge, com idempotência, retry, rastreabilidade e reconciliação, eliminando a dependência de processos manuais de digitação e conferência entre sistemas.

## 2. Escopo funcional

### 2.1 Incluso neste PRD

- Clientes HTTP para todos os endpoints oficiais de leitura e escrita da V1.0 (§9.3).
- Autenticação `Basic Authorization` contra a API do Sienge (§9.2).
- Paginação automática com `limit` e `offset` (§9.2).
- Respeito ao rate limit público de `200/minuto` (REST) e `20/minuto` (BULK) (§9.2).
- Mapeadores de payload para cada endpoint (request e response).
- Receptor e processador de webhooks do Sienge (§9.3.8).
- Mecanismo de reconciliação: webhook como gatilho principal + leitura API como fallback (§9.8).
- Regras de vínculo entre cotação, pedido e nota fiscal (§9.6, §9.7).
- Regra de identificação de fornecedor e e-mail via API de Credores (§9.5).
- Regra de fornecedor inválido no mapa de cotação (§9.9).
- Persistência dos identificadores obrigatórios de rastreabilidade (§10).
- Tratamento de falha de integração com retry automático e manual (§12.2, referenciado por §9).
- Idempotência em todas as operações de escrita (§15.2).
- Registro de eventos de integração para auditoria (§12.6).
- Entidade de log de integração para rastreabilidade fim a fim.
- Anti-patterns obrigatórios documentados (§9.11).

### 2.2 Excluído deste PRD

- Fluxo de aprovação de cotação por `Compras` → PRD 02 (Fluxo de Cotação).
- Régua de follow-up e cálculo de dias úteis → PRD 04 (Follow-up Logístico).
- Validação de entrega por `Compras` (`OK`/`Divergência`) → PRD 05 (Entrega).
- Registro e tratamento de avarias → PRD 06 (Avaria e Ação Corretiva).
- Telas de backoffice para monitoramento de integração → PRD 09 (Backoffice).
- Dashboard e indicadores → PRD 08 (Dashboard).
- Gestão de usuários e RBAC → PRD 01 (Autenticação e Perfis).
- Templates e envio de notificações por e-mail → PRD 03 (Notificações).

### 2.3 Fora de escopo da V1.0

- Alteração automática da data planejada no Sienge a partir da data sugerida pelo fornecedor _(PRDGlobal §2.3)_.
- Automações financeiras, fiscais ou contábeis além do uso logístico de nota fiscal _(PRDGlobal §2.3)_.
- Régua separada por parcela de entrega do mesmo item _(PRDGlobal §2.3)_.

## 3. Perfis envolvidos

| Perfil                    | Interação com este módulo                                                                                                                         | Restrições                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `Compras`                 | Aciona reprocessamento manual de falhas; aprova respostas antes da escrita no Sienge; recebe notificações de falha e divergência de reconciliação | Não altera configurações de integração             |
| `Administrador`           | Parametriza credenciais da API do Sienge; configura subdomínio do cliente; monitora status de integração                                          | Não aprova respostas de cotação                    |
| `Fornecedor`              | Consumidor indireto — seus dados são sincronizados do Sienge                                                                                      | Sem acesso direto às funcionalidades de integração |
| `Visualizador de Pedidos` | Consumidor indireto — consulta pedidos sincronizados                                                                                              | Sem acesso direto às funcionalidades de integração |

## 4. Entidades e modelagem

### 4.1 `sienge_credentials`

Armazena as credenciais de acesso à API do Sienge.

| Campo             | Tipo         | Obrigatório | Descrição                          |
| ----------------- | ------------ | ----------- | ---------------------------------- |
| `id`              | UUID         | Sim         | PK                                 |
| `subdomain`       | VARCHAR(100) | Sim         | Subdomínio do cliente no Sienge    |
| `api_user`        | VARCHAR(255) | Sim         | Usuário da API (criptografado)     |
| `api_password`    | TEXT         | Sim         | Senha da API (criptografada)       |
| `rest_rate_limit` | INTEGER      | Sim         | Rate limit REST (default: 200/min) |
| `bulk_rate_limit` | INTEGER      | Sim         | Rate limit BULK (default: 20/min)  |
| `is_active`       | BOOLEAN      | Sim         | Se a integração está ativa         |
| `created_at`      | TIMESTAMPTZ  | Sim         | Data de criação                    |
| `updated_at`      | TIMESTAMPTZ  | Sim         | Última atualização                 |

- **Índices:** `idx_sienge_credentials_active` em `is_active`.
- **Regras:** Apenas um registro ativo por vez. Credenciais devem ser armazenadas com criptografia em repouso.

### 4.2 `integration_events`

Registra cada operação de integração para rastreabilidade.

| Campo                 | Tipo         | Obrigatório | Descrição                                                                                                                                    |
| --------------------- | ------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | UUID         | Sim         | PK                                                                                                                                           |
| `event_type`          | VARCHAR(50)  | Sim         | Tipo: `sync_quotations`, `sync_creditor`, `sync_orders`, `sync_deliveries`, `write_negotiation`, `authorize_negotiation`, `webhook_received` |
| `direction`           | VARCHAR(10)  | Sim         | `inbound` ou `outbound`                                                                                                                      |
| `endpoint`            | VARCHAR(255) | Sim         | URL do endpoint chamado                                                                                                                      |
| `http_method`         | VARCHAR(10)  | Sim         | GET, POST, PUT, PATCH                                                                                                                        |
| `http_status`         | INTEGER      | Não         | Status HTTP da resposta                                                                                                                      |
| `request_payload`     | JSONB        | Não         | Payload enviado (mascarado conforme §15.3)                                                                                                   |
| `response_payload`    | JSONB        | Não         | Payload recebido (mascarado)                                                                                                                 |
| `status`              | VARCHAR(30)  | Sim         | `pending`, `success`, `failure`, `retry_scheduled`                                                                                           |
| `error_message`       | TEXT         | Não         | Mensagem de erro, se houver                                                                                                                  |
| `retry_count`         | INTEGER      | Sim         | Número de tentativas realizadas (default: 0)                                                                                                 |
| `max_retries`         | INTEGER      | Sim         | Máximo de retries configurado                                                                                                                |
| `next_retry_at`       | TIMESTAMPTZ  | Não         | Próximo retry agendado                                                                                                                       |
| `related_entity_type` | VARCHAR(50)  | Não         | `quotation`, `order`, `invoice`, `creditor`                                                                                                  |
| `related_entity_id`   | VARCHAR(100) | Não         | ID da entidade relacionada no Sienge                                                                                                         |
| `idempotency_key`     | VARCHAR(255) | Não         | Chave de idempotência                                                                                                                        |
| `created_at`          | TIMESTAMPTZ  | Sim         | Data de criação                                                                                                                              |
| `updated_at`          | TIMESTAMPTZ  | Sim         | Última atualização                                                                                                                           |

- **Índices:** `idx_integration_events_status` em `status`; `idx_integration_events_type` em `event_type`; `idx_integration_events_entity` em `(related_entity_type, related_entity_id)`; `idx_integration_events_idempotency` em `idempotency_key` (UNIQUE quando não nulo); `idx_integration_events_retry` em `next_retry_at` WHERE `status = 'retry_scheduled'`.
- **Retenção:** 1 ano conforme §11.5.

### 4.3 `webhook_events`

Registra webhooks recebidos do Sienge.

| Campo                | Tipo         | Obrigatório | Descrição                                           |
| -------------------- | ------------ | ----------- | --------------------------------------------------- |
| `id`                 | UUID         | Sim         | PK                                                  |
| `webhook_type`       | VARCHAR(100) | Sim         | Tipo do webhook recebido                            |
| `payload`            | JSONB        | Sim         | Payload completo recebido                           |
| `sienge_delivery_id` | VARCHAR(255) | Não         | Valor de `x-sienge-id` para idempotência da entrega |
| `sienge_hook_id`     | VARCHAR(255) | Não         | Valor de `x-sienge-hook-id`                         |
| `sienge_event`       | VARCHAR(255) | Não         | Valor de `x-sienge-event`                           |
| `sienge_tenant`      | VARCHAR(255) | Não         | Valor de `x-sienge-tenant`                          |
| `status`             | VARCHAR(20)  | Sim         | `received`, `processing`, `processed`, `failed`     |
| `processed_at`       | TIMESTAMPTZ  | Não         | Data de processamento                               |
| `error_message`      | TEXT         | Não         | Erro, se houver                                     |
| `created_at`         | TIMESTAMPTZ  | Sim         | Data de recebimento                                 |

- **Índices:** `idx_webhook_events_type` em `webhook_type`; `idx_webhook_events_status` em `status`; `idx_webhook_events_delivery_id` em `sienge_delivery_id` (UNIQUE quando não nulo).

### 4.4 `sienge_sync_cursor`

Controla a posição de sincronização por tipo de recurso.

| Campo            | Tipo        | Obrigatório | Descrição                                                     |
| ---------------- | ----------- | ----------- | ------------------------------------------------------------- |
| `id`             | UUID        | Sim         | PK                                                            |
| `resource_type`  | VARCHAR(50) | Sim         | `quotations`, `orders`, `invoices`, `deliveries`, `creditors` |
| `last_offset`    | INTEGER     | Sim         | Último offset processado                                      |
| `last_synced_at` | TIMESTAMPTZ | Sim         | Data da última sincronização                                  |
| `sync_status`    | VARCHAR(20) | Sim         | `idle`, `running`, `error`                                    |
| `error_message`  | TEXT        | Não         | Erro da última execução                                       |

- **Índices:** `idx_sienge_sync_cursor_resource` em `resource_type` (UNIQUE).

### 4.5 Identificadores persistidos (§10)

A seguinte tabela consolida os identificadores que **devem** ser persistidos nas entidades dos módulos consumidores para manter rastreabilidade fim a fim:

| Identificador                         | Origem                   | Uso                                             |
| ------------------------------------- | ------------------------ | ----------------------------------------------- |
| `purchaseQuotationId`                 | Cotação no Sienge        | PK da cotação importada                         |
| `supplierId`                          | Cotação/Pedido no Sienge | Identificador do fornecedor no fluxo de compras |
| `negotiationId` / `negotiationNumber` | Negociação no Sienge     | Rastrear resposta enviada                       |
| `purchaseOrderId`                     | Pedido no Sienge         | PK do pedido importado                          |
| `purchaseOrderItemNumber`             | Item do pedido           | Detalhar itens                                  |
| `purchaseQuotationItemId`             | Cotação/Item             | Vínculo cotação-item                            |
| `sequentialNumber`                    | Nota fiscal              | PK da NF importada                              |
| `invoiceItemNumber`                   | Item da NF               | Detalhar itens da NF                            |
| `creditorId`                          | API de Credores          | Vínculo cadastral (pendente homologação §17)    |

## 5. Regras de negócio

- **RN-01:** O Sienge prevalece como fonte principal de verdade para dados operacionais mestres. O sistema local mantém apenas exceções: e-mail alterado pelo Administrador, data prometida aprovada por Compras, status internos de workflow, registros de avaria e trilhas de auditoria. _(PRDGlobal §9.1)_
- **RN-02:** A autenticação na API do Sienge usa `Basic Authorization` com header `Authorization: Basic base64(usuario-api:senha)`. _(PRDGlobal §9.2)_
- **RN-03:** O rate limit deve ser respeitado: `200/minuto` para REST, `20/minuto` para BULK. _(PRDGlobal §9.2)_
- **RN-04:** Paginação usa `limit` (padrão 100, máximo 200) e `offset` (padrão 0). O retorno paginado é tratado com `resultSetMetadata` e `results`. _(PRDGlobal §9.2)_
- **RN-05:** O e-mail do fornecedor deve ser buscado em `GET /creditors/{creditorId}`, usando o primeiro `contacts[].email` preenchido. Se não houver e-mail preenchido, o fornecedor fica bloqueado até ajuste manual do Administrador. _(PRDGlobal §9.5)_
- **RN-06:** O vínculo principal entre pedido e cotação é feito pelo webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`. O detalhamento por item (`purchaseQuotations[]`) é conferência, não regra principal. _(PRDGlobal §9.6)_
- **RN-07:** O vínculo nota fiscal → pedido usa `GET /purchase-invoices/deliveries-attended`. O vínculo nota → cotação segue o caminho: `Nota → purchaseOrderId → item do pedido → purchaseQuotationId → Cotação`. _(PRDGlobal §9.7)_
- **RN-08:** Webhooks são gatilhos de sincronização incremental. Após cada webhook, a aplicação deve reconsultar a API REST para reconciliação detalhada. _(PRDGlobal §9.8)_
- **RN-09:** A ausência permanente do webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` é bloqueio de homologação. Se a reconciliação divergir do vínculo criado pelo webhook, o sistema mantém o vínculo e notifica `Compras`. _(PRDGlobal §9.8)_
- **RN-10:** Se o fornecedor foi removido do mapa de cotação no Sienge, o sistema não cria negociação automaticamente. O sistema alerta `Compras` antes de qualquer tentativa de escrita. O status exibido é `Fornecedor inválido no mapa de cotação` em vermelho. _(PRDGlobal §9.9)_
- **RN-11:** O parser deve respeitar a grafia do contrato real (`sheduledDate`, `sheduledQuantity` sem o `c`). _(PRDGlobal §9.10)_
- **RN-12:** O endpoint `PATCH .../negotiations/latest/authorize` só deve ser chamado após aprovação manual de `Compras`. _(PRDGlobal §9.3.7)_
- **RN-13:** Em falha de integração, o sistema tenta novo reprocessamento automático após 24 horas. Para escrita de cotação, são 2 reenvios automáticos com intervalo de 24 horas. Se persistir, `Compras` é notificado. _(PRDGlobal §12.2)_
- **RN-14:** Integrações devem ter idempotência, retry e rastreabilidade. _(PRDGlobal §15.2)_
- **RN-15:** O endpoint `GET /purchase-quotations/comparison-map/pdf` não deve ser usado como fonte de automação. _(PRDGlobal §9.3.1)_
- **RN-16:** O receptor de webhook deve validar os headers oficiais `x-sienge-id` e `x-sienge-event`. O header `x-webhook-secret` pode ser usado apenas como proteção opcional e compatível com ambientes legados; ele não substitui o contrato oficial documentado pelo Sienge. Este segredo (`SIENGE_WEBHOOK_SECRET`) deve ser mantido estritamente como variável de ambiente (segredo de infra da API/Web), não integrando o registro dinâmico na tabela `sienge_credentials`. Se um dia precisar sair do `.env`, deverá fazê-lo numa configuração primariamente isolada para webhooks inbound. _(Sienge general-hooks)_
- **RN-17:** A idempotência de recebimento do webhook deve usar `x-sienge-id`. Se o mesmo identificador de entrega chegar novamente, o sistema responde `200` e não reenfileira o processamento. _(Sienge general-hooks)_
- **RN-18:** O tempo de resposta do receptor deve permanecer abaixo de `2,5s`, com processamento assíncrono, para evitar retries desnecessários do Sienge. _(Sienge general-hooks)_

### Anti-patterns obrigatórios (§9.11)

- Não ligar pedido à cotação só por nome do fornecedor.
- Não ligar pedido à cotação só por datas.
- Não usar item do pedido como **única** regra para descobrir a cotação principal.
- Não ligar nota fiscal à cotação só por data.
- Não tratar `contacts[]` como se sempre tivesse um único e-mail.
- Não sobrescrever dados mestres do Sienge com dados operacionais locais.
- Não criar negociação no Sienge para fornecedor removido do mapa de cotação.

## 6. Fluxos operacionais

### 6.1 Sincronização de cotações (Leitura)

1. O scheduler dispara a sincronização periódica.
2. O sistema consulta `GET /purchase-quotations/all/negotiations` com paginação.
3. Para cada cotação retornada, o sistema persiste ou atualiza os dados locais.
4. Para cada `supplierId` identificado, busca dados cadastrais em `GET /creditors/{creditorId}`.
5. Extrai o primeiro `contacts[].email` preenchido.
6. Se não houver e-mail, marca o fornecedor como bloqueado.
7. Registra evento de integração com status `success` ou `failure`.

**Exceções:** Rate limit atingido → aguardar e retry. Falha HTTP → registrar evento com `failure` e agendar retry.

### 6.2 Sincronização de pedidos (Leitura)

1. O scheduler ou webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` dispara a leitura.
2. O sistema consulta `GET /purchase-orders` com filtros relevantes.
3. Para cada pedido, busca detalhes em `GET /purchase-orders/{id}` e itens em `GET /purchase-orders/{id}/items`.
4. Busca entregas programadas em `GET /purchase-orders/{id}/items/{itemNumber}/delivery-schedules`.
5. Vincula pedido à cotação conforme §9.6.
6. Registra evento de integração.

### 6.3 Sincronização de entregas (Leitura)

1. O scheduler dispara a leitura periódica.
2. O sistema consulta `GET /purchase-invoices/deliveries-attended` com `purchaseOrderId`.
3. Complementa com `GET /purchase-invoices/{sequentialNumber}` e `.../items` quando necessário.
4. Vincula nota → pedido → cotação conforme §9.7.
5. Registra evento de integração.

### 6.4 Escrita de resposta de cotação (Outbound)

1. `Compras` aprova a resposta do fornecedor (módulo externo — PRD 02).
2. O sistema verifica se o fornecedor existe no mapa de cotação no Sienge (RN-10).
3. Se necessário, cria negociação via `POST .../negotiations`.
4. Atualiza negociação via `PUT .../negotiations/{negotiationNumber}`.
5. Atualiza itens via `PUT .../negotiations/{negotiationNumber}/items/{quotationItemNumber}`.
6. Autoriza via `PATCH .../negotiations/latest/authorize`.
7. Registra evento de integração com `idempotency_key`.
8. Em caso de falha: registra, agenda retry conforme RN-13.

### 6.5 Recebimento de webhooks

1. O endpoint receptor valida os headers oficiais `x-sienge-id` e `x-sienge-event`.
2. Se existir `x-webhook-secret`, valida contra `SIENGE_WEBHOOK_SECRET`; se o secret não vier, o fluxo segue normalmente.
3. Se o `x-sienge-event` divergir do `body.type`, rejeita a entrega com `400`.
4. Se `x-sienge-id` já existir em `webhook_events`, responde `200` com ACK de duplicidade e não persiste novamente.
5. Persiste o payload em `webhook_events` com status `received`, incluindo `sienge_delivery_id`, `sienge_hook_id`, `sienge_event` e `sienge_tenant`.
6. Processa de forma assíncrona:
   - `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`: cria vínculo pedido-cotação e dispara leitura detalhada do pedido.
   - `PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED`: reconsulta status da negociação.
   - `PURCHASE_ORDER_ITEM_MODIFIED`: reconsulta itens do pedido.
   - `PURCHASE_ORDER_AUTHORIZATION_CHANGED` / `PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED`: usa como gatilho de reconsulta apenas.
   - `CONTRACT_AUTHORIZED`, `CONTRACT_UNAUTHORIZED`, `MEASUREMENT_AUTHORIZED`, `MEASUREMENT_UNAUTHORIZED`, `CLEARING_FINISHED`, `CLEARING_DELETED`: aceita, registra e finaliza com ACK seguro; pipeline de reconciliação específico permanece pendente de implementação.
7. Atualiza status para `processed` ou `failed`.
8. O processamento deve responder rapidamente ao Sienge e deixar toda reconsulta REST para o worker assíncrono.

### 6.6 Reprocessamento de falhas

1. O scheduler identifica eventos com status `retry_scheduled` e `next_retry_at <= NOW()`.
2. Reexecuta a operação com a mesma `idempotency_key`.
3. Atualiza `retry_count`.
4. Se `retry_count >= max_retries`, marca como `failure` e notifica `Compras`.
5. `Compras` pode acionar reprocessamento manual sem limite na V1.0.

## 7. Contratos de API / Serviços

### 7.1 Clientes Sienge (Leitura)

| Serviço                               | Endpoint Sienge                                                    | Método | Entrada                                                                                                                               | Saída                                                     | Erros              |
| ------------------------------------- | ------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------ |
| `QuotationClient.listNegotiations`    | `/purchase-quotations/all/negotiations`                            | GET    | Filtros: `quotationNumber`, `supplierId`, `buyerId`, `startDate`, `endDate`, `authorized`, `status`, `consistency`, `limit`, `offset` | Lista paginada de cotações com fornecedores e negociações | 401, 429, 500      |
| `CreditorClient.getById`              | `/creditors/{creditorId}`                                          | GET    | `creditorId`                                                                                                                          | Dados cadastrais com `contacts[].email`                   | 401, 404, 429, 500 |
| `CreditorClient.list`                 | `/creditors`                                                       | GET    | Filtros: `cpf`, `cnpj`, `creditor`, `limit`, `offset`                                                                                 | Lista paginada de credores                                | 401, 429, 500      |
| `OrderClient.list`                    | `/purchase-orders`                                                 | GET    | Filtros: `startDate`, `endDate`, `status`, `authorized`, `supplierId`, `buildingId`, `buyerId`, `consistency`, `limit`, `offset`      | Lista paginada de pedidos                                 | 401, 429, 500      |
| `OrderClient.getById`                 | `/purchase-orders/{id}`                                            | GET    | `purchaseOrderId`                                                                                                                     | Detalhe do pedido                                         | 401, 404, 429, 500 |
| `OrderClient.getItems`                | `/purchase-orders/{id}/items`                                      | GET    | `purchaseOrderId`                                                                                                                     | Lista de itens do pedido                                  | 401, 404, 429, 500 |
| `OrderClient.getDeliverySchedules`    | `/purchase-orders/{id}/items/{itemNumber}/delivery-schedules`      | GET    | `purchaseOrderId`, `itemNumber`                                                                                                       | Lista paginada de entregas programadas                    | 401, 404, 429, 500 |
| `InvoiceClient.list`                  | `/purchase-invoices`                                               | GET    | Filtros: `companyId`, `supplierId`, `documentId`, `series`, `number`, `startDate`, `endDate`, `limit`, `offset`                       | Lista paginada de notas fiscais                           | 401, 429, 500      |
| `InvoiceClient.getById`               | `/purchase-invoices/{sequentialNumber}`                            | GET    | `sequentialNumber`                                                                                                                    | Detalhe da nota fiscal                                    | 401, 404, 429, 500 |
| `InvoiceClient.getItems`              | `/purchase-invoices/{sequentialNumber}/items`                      | GET    | `sequentialNumber`                                                                                                                    | Lista de itens da nota                                    | 401, 404, 429, 500 |
| `InvoiceClient.getDeliveriesAttended` | `/purchase-invoices/deliveries-attended`                           | GET    | Filtros: `billId`, `sequentialNumber`, `purchaseOrderId`, `invoiceItemNumber`, `purchaseOrderItemNumber`, `limit`, `offset`           | Lista de entregas atendidas                               | 401, 429, 500      |
| `DeliveryRequirementClient.get`       | `/purchase-requests/{id}/items/{itemNumber}/delivery-requirements` | GET    | `purchaseRequestId`, `purchaseRequestItemNumber`                                                                                      | Requisitos de entrega                                     | 401, 404, 429, 500 |

### 7.2 Clientes Sienge (Escrita)

| Serviço                        | Endpoint Sienge                                                 | Método | Entrada                                                                                                                                                                                                                        | Saída                  | Erros                        | Perfis                                     |
| ------------------------------ | --------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ---------------------------- | ------------------------------------------ |
| `NegotiationClient.create`     | `/purchase-quotations/{id}/suppliers/{supplierId}/negotiations` | POST   | Body conforme §9.3.7                                                                                                                                                                                                           | Negociação criada      | 400, 401, 404, 409, 429, 500 | Sistema (após aprovação `Compras`)         |
| `NegotiationClient.update`     | `.../negotiations/{negotiationNumber}`                          | PUT    | Body: `supplierAnswerDate`, `validity`, `seller`, `discount`, `freightType`, `freightTypeForGeneratedPurchaseOrder`, `freightPrice`, `valueOtherExpenses`, `applyIpiFreight`, `internalNotes`, `supplierNotes`, `paymentTerms` | Negociação atualizada  | 400, 401, 404, 429, 500      | Sistema                                    |
| `NegotiationClient.updateItem` | `.../negotiations/{num}/items/{itemNum}`                        | PUT    | Body conforme §9.3.7 (itens)                                                                                                                                                                                                   | Item atualizado        | 400, 401, 404, 429, 500      | Sistema                                    |
| `NegotiationClient.authorize`  | `.../negotiations/latest/authorize`                             | PATCH  | Nenhum body                                                                                                                                                                                                                    | Autorização confirmada | 400, 401, 404, 429, 500      | Sistema (somente após aprovação `Compras`) |

### 7.3 Serviços internos

| Serviço                               | Rota                                 | Método | Entrada                                                                                                                              | Saída                                                 | Perfis                     |
| ------------------------------------- | ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | -------------------------- |
| `IntegrationService.syncQuotations`   | Interno (worker)                     | —      | Filtros opcionais                                                                                                                    | Resultado da sincronização                            | Sistema                    |
| `IntegrationService.syncOrders`       | Interno (worker)                     | —      | Filtros opcionais                                                                                                                    | Resultado da sincronização                            | Sistema                    |
| `IntegrationService.syncDeliveries`   | Interno (worker)                     | —      | `purchaseOrderId`                                                                                                                    | Resultado da sincronização                            | Sistema                    |
| `IntegrationService.syncCreditor`     | Interno (worker)                     | —      | `creditorId`                                                                                                                         | Dados do fornecedor                                   | Sistema                    |
| `IntegrationService.writeNegotiation` | Interno (API)                        | —      | Dados da resposta aprovada                                                                                                           | Resultado da escrita                                  | `Compras` (via aprovação)  |
| `IntegrationService.retryFailed`      | Interno (worker)                     | —      | Nenhuma                                                                                                                              | Eventos reprocessados                                 | Sistema                    |
| `WebhookReceiver.handle`              | `/webhooks/sienge`                   | POST   | Body `{ type, data }` + headers `x-sienge-id`, `x-sienge-event`; opcionais `x-sienge-hook-id`, `x-sienge-tenant`, `x-webhook-secret` | `200 {status: received}` ou `200 {status: duplicate}` | Externo (Sienge)           |
| `IntegrationStatus.list`              | `/api/integration/events`            | GET    | Filtros: `status`, `event_type`, `date_range`                                                                                        | Lista paginada de eventos                             | `Compras`, `Administrador` |
| `IntegrationStatus.retry`             | `/api/integration/events/{id}/retry` | POST   | `event_id`                                                                                                                           | Evento reagendado                                     | `Compras`                  |

**Respostas esperadas do receptor de webhook**

- `200`: entrega recebida ou duplicada com ACK seguro
- `400`: ausência de `x-sienge-id` / `x-sienge-event` ou divergência entre header e body
- `401`: `x-webhook-secret` informado, porém inválido
- `500`: falha ao validar duplicidade ou persistir o evento antes do ACK

## 8. Interface do usuário

Este módulo é primariamente backend/infraestrutura. As interfaces de monitoramento são cobertas pelo PRD 09 (Backoffice). Os seguintes elementos visuais são definidos aqui por serem intrínsecos à integração:

### 8.1 Indicadores de status de integração (componentes reutilizáveis)

- **Badge de integração:** Exibe `Pendente de integração` (amarelo), `Integrado com sucesso` (verde), `Falha de integração` (vermelho) conforme §12.1.
- **Badge de fornecedor inválido:** Exibe `Fornecedor inválido no mapa de cotação` em vermelho conforme §9.9.

### 8.2 Referências visuais

- Paleta conforme `docs/paleta_de_cores.md`: Azul Escuro `#324598`, Azul Médio `#465EBE`, Turquesa `#19B4BE`, Azul Claro `#6ED8E0`, Branco `#FFFFFF`.
- Cores operacionais de integração conforme §12.5.

## 9. Integrações e dependências externas

### 9.1 Endpoints Sienge utilizados

**Leitura de cotação:**

- `GET /purchase-quotations/all/negotiations` _(§9.3.1)_

**Leitura cadastral do fornecedor:**

- `GET /creditors/{creditorId}` _(§9.3.2)_
- `GET /creditors` _(§9.3.2)_

**Leitura de pedidos:**

- `GET /purchase-orders` _(§9.3.3)_
- `GET /purchase-orders/{purchaseOrderId}` _(§9.3.3)_
- `GET /purchase-orders/{purchaseOrderId}/items` _(§9.3.3)_
- `GET /purchase-orders/{purchaseOrderId}/items/{itemNumber}/delivery-schedules` _(§9.3.4)_

**Leitura de notas e entrega:**

- `GET /purchase-invoices` _(§9.3.5)_
- `GET /purchase-invoices/{sequentialNumber}` _(§9.3.5)_
- `GET /purchase-invoices/{sequentialNumber}/items` _(§9.3.5)_
- `GET /purchase-invoices/deliveries-attended` _(§9.3.5)_

**Leitura auxiliar:**

- `GET /purchase-requests/{id}/items/{itemNumber}/delivery-requirements` _(§9.3.6)_

**Escrita de cotação:**

- `POST /purchase-quotations/{id}/suppliers/{supplierId}/negotiations` _(§9.3.7)_
- `PUT /purchase-quotations/{id}/suppliers/{supplierId}/negotiations/{negotiationNumber}` _(§9.3.7)_
- `PUT .../negotiations/{negotiationNumber}/items/{quotationItemNumber}` _(§9.3.7)_
- `PATCH .../negotiations/latest/authorize` _(§9.3.7)_

### 9.2 Webhooks consumidos

**Contrato de entrega**

- Método: `POST`
- Timeout esperado pelo Sienge: `2,5s`
- Headers obrigatórios: `x-sienge-id`, `x-sienge-event`
- Headers opcionais relevantes: `x-sienge-hook-id`, `x-sienge-tenant`
- Header opcional interno: `x-webhook-secret`
- User-Agent esperado: `sienge-hooks`
- Retry do Sienge em falha/timeout: `10`, `30`, `60`, `180` e `300` minutos após a tentativa anterior

| Webhook                                                | Contrato mínimo documentado                                        | Uso                                 | Ação atual no sistema              |
| ------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------- | ---------------------------------- |
| `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`            | `purchaseOrderId`, `purchaseQuotationId?`, `purchaseQuotations[]?` | Vínculo principal pedido-cotação    | Criar vínculo + reconsultar pedido |
| `PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED` | `purchaseQuotationId`                                              | Status de autorização da negociação | Reconsultar negociação             |
| `PURCHASE_ORDER_AUTHORIZATION_CHANGED`                 | `purchaseOrderId`                                                  | Mudança de autorização do pedido    | Gatilho de reconsulta              |
| `PURCHASE_ORDER_ITEM_MODIFIED`                         | `purchaseOrderId`                                                  | Modificação de item do pedido       | Reconsultar itens                  |
| `PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED`            | `purchaseOrderId`                                                  | Previsão financeira atualizada      | Gatilho de reconsulta              |
| `CONTRACT_AUTHORIZED`                                  | `documentId`, `contractNumber`, `consistent`                       | Contratos do suprimentos            | Registrar e ACK seguro             |
| `CONTRACT_UNAUTHORIZED`                                | `documentId`, `contractNumber`, `consistent`, `disapproved`        | Contratos do suprimentos            | Registrar e ACK seguro             |
| `MEASUREMENT_AUTHORIZED`                               | `documentId`, `contractNumber`, `measurementNumber`, `buildingId`  | Medição de contratos                | Registrar e ACK seguro             |
| `MEASUREMENT_UNAUTHORIZED`                             | `documentId`, `contractNumber`, `measurementNumber`, `buildingId`  | Medição de contratos                | Registrar e ACK seguro             |
| `CLEARING_FINISHED`                                    | `documentId`, `contractNumber`, `buildingId`, `measurementNumber`  | Quitação/clearing                   | Registrar e ACK seguro             |
| `CLEARING_DELETED`                                     | `documentId`, `contractNumber`, `buildingId`, `measurementNumber`  | Quitação/clearing                   | Registrar e ACK seguro             |

### 9.3 Regras de reconciliação

- Webhook como regra principal; reconciliação por API como fallback _(§9.8)_.
- A ausência permanente do webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` é bloqueio de homologação _(§9.8)_.
- Se reconciliação divergir do vínculo do webhook, manter vínculo e notificar `Compras` _(§9.8)_.

### 9.4 Tratamento de falhas

- Falha genérica: retry automático após 24h _(§12.2)_.
- Escrita de cotação: até 2 reenvios automáticos com intervalo de 24h _(§12.2)_.
- Após esgotar retries: notificar `Compras` _(§12.2)_.
- Reprocessamento manual por `Compras` sem limite na V1.0 _(§12.2)_.

## 10. Auditoria e rastreabilidade

Eventos auditáveis gerados por este módulo conforme §12.6:

| Evento                      | Descrição                                             |
| --------------------------- | ----------------------------------------------------- |
| `integration_success`       | Integração com Sienge concluída com sucesso           |
| `integration_failure`       | Falha de integração com o Sienge                      |
| `integration_retry`         | Reprocessamento automático ou manual de integração    |
| `webhook_received`          | Webhook recebido do Sienge                            |
| `webhook_processed`         | Webhook processado com sucesso                        |
| `webhook_failed`            | Falha no processamento de webhook                     |
| `negotiation_written`       | Resposta de cotação enviada ao Sienge                 |
| `negotiation_authorized`    | Negociação autorizada no Sienge                       |
| `supplier_invalid_map`      | Fornecedor detectado como inválido no mapa de cotação |
| `reconciliation_divergence` | Divergência detectada entre webhook e leitura API     |

Cada evento registra: data/hora, tipo, usuário/origem, entidade afetada, fornecedor (quando aplicável), resumo da ação. Para webhooks, registrar também `x-sienge-id`, `x-sienge-event`, `x-sienge-hook-id` e `x-sienge-tenant` quando presentes.

## 11. Validações pendentes de homologação

Da §17 do PRDGlobal, todos os 9 itens se aplicam diretamente a este módulo:

- [ ] **§17.1:** Validar se `supplierId` das APIs de compras corresponde ao `creditorId` da API de Credores.
- [ ] **§17.2:** Validar se a regra do primeiro `contacts[].email` preenchido é suficiente como e-mail oficial.
- [ ] **§17.3:** Validar disponibilidade e funcionamento do webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`.
- [ ] **§17.4:** Validar disponibilidade do webhook `PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED`.
- [ ] **§17.5:** Validar se o fornecedor continua existindo no mapa de cotação antes da escrita.
- [ ] **§17.6:** Validar comportamento real de criação e atualização de negociação antes do envio dos itens.
- [ ] **§17.7:** Validar cenários com múltiplas cotações em `purchaseQuotations[]`.
- [ ] **§17.8:** Validar se `GET /purchase-invoices/deliveries-attended` cobre todos os cenários de entrega.
- [ ] **§17.9:** Validar variações reais do campo `openQuantity` em `delivery-requirements`.

## 12. Critérios de aceite

- [ ] O sistema autentica na API do Sienge com `Basic Authorization` e obtém respostas válidas.
- [ ] O sistema respeita rate limit de 200/min (REST) e 20/min (BULK).
- [ ] O sistema pagina automaticamente resultados com `limit` e `offset`.
- [ ] O sistema importa cotações via `GET /purchase-quotations/all/negotiations` e persiste os campos mínimos definidos em §9.3.1.
- [ ] O sistema busca dados cadastrais do fornecedor via `GET /creditors/{creditorId}` e extrai o primeiro `contacts[].email` preenchido.
- [ ] Se não houver e-mail, o fornecedor é bloqueado no sistema.
- [ ] O sistema importa pedidos via `GET /purchase-orders` e persiste os campos mínimos definidos em §9.3.3.
- [ ] O sistema importa entregas programadas via `GET .../delivery-schedules` e respeita a grafia `sheduledDate`/`sheduledQuantity`.
- [ ] O sistema importa entregas atendidas via `GET /purchase-invoices/deliveries-attended` e persiste os campos mínimos definidos em §9.3.5.
- [ ] O sistema recebe e processa webhooks do Sienge, usando-os como gatilho de reconsulta.
- [ ] O receptor exige `x-sienge-id` e `x-sienge-event`, e rejeita divergência entre header e body.
- [ ] O sistema usa `x-sienge-id` como chave de idempotência de entrega.
- [ ] Entregas duplicadas recebem ACK `200` sem reenfileirar processamento.
- [ ] Após webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`, o sistema cria o vínculo pedido-cotação e reconsulta a API.
- [ ] Os metadados `x-sienge-id`, `x-sienge-event`, `x-sienge-hook-id` e `x-sienge-tenant` são persistidos em `webhook_events` quando enviados pelo Sienge.
- [ ] O sistema escreve resposta de cotação no Sienge somente após aprovação de `Compras`.
- [ ] O sistema verifica se o fornecedor existe no mapa de cotação antes de escrever.
- [ ] O sistema exibe `Fornecedor inválido no mapa de cotação` em vermelho quando aplicável.
- [ ] Em falha de integração, o sistema agenda retry automático após 24h.
- [ ] Para escrita de cotação, o sistema tenta até 2 reenvios automáticos com intervalo de 24h.
- [ ] Após esgotar retries, `Compras` é notificado.
- [ ] `Compras` pode acionar reprocessamento manual.
- [ ] Todas as operações de integração são registradas em `integration_events`.
- [ ] Todos os webhooks são registrados em `webhook_events`.
- [ ] Os identificadores de §10 são persistidos nas entidades relevantes.
- [ ] Operações de escrita possuem `idempotency_key` para evitar duplicação.
- [ ] O sistema persiste todos os identificadores necessários para rastreabilidade fim a fim conforme §10.
- [ ] Dados sensíveis são mascarados em logs conforme §15.3.

## 13. Fases de implementação sugeridas

1. **Fase 1 — Infraestrutura base:** Entidades de banco (`sienge_credentials`, `integration_events`, `webhook_events`, `sienge_sync_cursor`). Configuração de credenciais. Client HTTP base com autenticação, paginação e rate limiting.
2. **Fase 2 — Clientes de leitura:** `QuotationClient`, `CreditorClient`, `OrderClient`, `InvoiceClient`, `DeliveryRequirementClient`. Mapeadores de payload. Testes unitários com mocks.
3. **Fase 3 — Sincronização:** Workers de polling para cotações, pedidos e entregas. Cursor de sincronização. Registro de eventos de integração.
4. **Fase 4 — Webhooks:** Endpoint receptor. Processamento assíncrono por tipo. Reconciliação webhook + API.
5. **Fase 5 — Escrita:** `NegotiationClient` (create, update, updateItem, authorize). Verificação de fornecedor no mapa. Idempotência.
6. **Fase 6 — Retry e resiliência:** Mecanismo de retry automático. Reprocessamento manual. Notificação de `Compras` em falhas persistentes.
7. **Fase 7 — Homologação:** Validação dos 9 itens de §17 com dados reais do cliente.

## 14. Riscos específicos do módulo

| Risco                                                                                   | Probabilidade | Impacto | Mitigação                                                                                                |
| --------------------------------------------------------------------------------------- | ------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| Divergência entre contrato público e comportamento real da API                          | Alta          | Alto    | Homologar com dados reais; implementar parsers tolerantes; registrar payloads completos para diagnóstico |
| Webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` indisponível no ambiente do cliente | Média         | Alto    | Implementar reconciliação por API como fallback; tratar ausência como bloqueio de homologação            |
| Rate limit insuficiente para o volume operacional do cliente                            | Média         | Médio   | Implementar fila com controle de taxa; priorizar operações críticas; monitorar uso                       |
| Inconsistência de tipagem em campos como `openQuantity`                                 | Média         | Baixo   | Parser tolerante; validação em homologação; fallback para tipo string                                    |
| Falhas intermitentes da API do Sienge                                                   | Alta          | Médio   | Retry automático com backoff; fila de reprocessamento; monitoramento de health check                     |
| Mudança no contrato da API do Sienge sem aviso                                          | Baixa         | Alto    | Versionamento dos clientes; alertas de contrato quebrado; logs detalhados de payload                     |
