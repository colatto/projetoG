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

- Alteração automática da data planejada no Sienge a partir da data sugerida pelo fornecedor *(PRDGlobal §2.3)*.
- Automações financeiras, fiscais ou contábeis além do uso logístico de nota fiscal *(PRDGlobal §2.3)*.
- Régua separada por parcela de entrega do mesmo item *(PRDGlobal §2.3)*.

## 3. Perfis envolvidos

| Perfil | Interação com este módulo | Restrições |
|--------|--------------------------|------------|
| `Compras` | Aciona reprocessamento manual de falhas; aprova respostas antes da escrita no Sienge; recebe notificações de falha e divergência de reconciliação | Não altera configurações de integração |
| `Administrador` | Parametriza credenciais da API do Sienge; configura subdomínio do cliente; monitora status de integração | Não aprova respostas de cotação |
| `Fornecedor` | Consumidor indireto — seus dados são sincronizados do Sienge | Sem acesso direto às funcionalidades de integração |
| `Visualizador de Pedidos` | Consumidor indireto — consulta pedidos sincronizados | Sem acesso direto às funcionalidades de integração |

## 4. Entidades e modelagem

### 4.1 `sienge_credentials`

Armazena as credenciais de acesso à API do Sienge.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | Sim | PK |
| `subdomain` | VARCHAR(100) | Sim | Subdomínio do cliente no Sienge |
| `api_user` | VARCHAR(255) | Sim | Usuário da API (criptografado) |
| `api_password` | TEXT | Sim | Senha da API (criptografada) |
| `rest_rate_limit` | INTEGER | Sim | Rate limit REST (default: 200/min) |
| `bulk_rate_limit` | INTEGER | Sim | Rate limit BULK (default: 20/min) |
| `is_active` | BOOLEAN | Sim | Se a integração está ativa |
| `created_at` | TIMESTAMPTZ | Sim | Data de criação |
| `updated_at` | TIMESTAMPTZ | Sim | Última atualização |

- **Índices:** `idx_sienge_credentials_active` em `is_active`.
- **Regras:** Apenas um registro ativo por vez. Credenciais devem ser armazenadas com criptografia em repouso.

### 4.2 `integration_events`

Registra cada operação de integração para rastreabilidade.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | Sim | PK |
| `event_type` | VARCHAR(50) | Sim | Tipo: `sync_quotations`, `sync_creditor`, `sync_orders`, `sync_deliveries`, `write_negotiation`, `authorize_negotiation`, `webhook_received` |
| `direction` | VARCHAR(10) | Sim | `inbound` ou `outbound` |
| `endpoint` | VARCHAR(255) | Sim | URL do endpoint chamado |
| `http_method` | VARCHAR(10) | Sim | GET, POST, PUT, PATCH |
| `http_status` | INTEGER | Não | Status HTTP da resposta |
| `request_payload` | JSONB | Não | Payload enviado (mascarado conforme §15.3) |
| `response_payload` | JSONB | Não | Payload recebido (mascarado) |
| `status` | VARCHAR(30) | Sim | `pending`, `success`, `failure`, `retry_scheduled` |
| `error_message` | TEXT | Não | Mensagem de erro, se houver |
| `retry_count` | INTEGER | Sim | Número de tentativas realizadas (default: 0) |
| `max_retries` | INTEGER | Sim | Máximo de retries configurado |
| `next_retry_at` | TIMESTAMPTZ | Não | Próximo retry agendado |
| `related_entity_type` | VARCHAR(50) | Não | `quotation`, `order`, `invoice`, `creditor` |
| `related_entity_id` | VARCHAR(100) | Não | ID da entidade relacionada no Sienge |
| `idempotency_key` | VARCHAR(255) | Não | Chave de idempotência |
| `created_at` | TIMESTAMPTZ | Sim | Data de criação |
| `updated_at` | TIMESTAMPTZ | Sim | Última atualização |

- **Índices:** `idx_integration_events_status` em `status`; `idx_integration_events_type` em `event_type`; `idx_integration_events_entity` em `(related_entity_type, related_entity_id)`; `idx_integration_events_idempotency` em `idempotency_key` (UNIQUE quando não nulo); `idx_integration_events_retry` em `next_retry_at` WHERE `status = 'retry_scheduled'`.
- **Retenção:** 1 ano conforme §11.5.

### 4.3 `webhook_events`

Registra webhooks recebidos do Sienge.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | Sim | PK |
| `webhook_type` | VARCHAR(100) | Sim | Tipo do webhook recebido |
| `payload` | JSONB | Sim | Payload completo recebido |
| `status` | VARCHAR(20) | Sim | `received`, `processing`, `processed`, `failed` |
| `processed_at` | TIMESTAMPTZ | Não | Data de processamento |
| `error_message` | TEXT | Não | Erro, se houver |
| `created_at` | TIMESTAMPTZ | Sim | Data de recebimento |

- **Índices:** `idx_webhook_events_type` em `webhook_type`; `idx_webhook_events_status` em `status`.

### 4.4 `sienge_sync_cursor`

Controla a posição de sincronização por tipo de recurso.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | Sim | PK |
| `resource_type` | VARCHAR(50) | Sim | `quotations`, `orders`, `invoices`, `deliveries`, `creditors` |
| `last_offset` | INTEGER | Sim | Último offset processado |
| `last_synced_at` | TIMESTAMPTZ | Sim | Data da última sincronização |
| `sync_status` | VARCHAR(20) | Sim | `idle`, `running`, `error` |
| `error_message` | TEXT | Não | Erro da última execução |

- **Índices:** `idx_sienge_sync_cursor_resource` em `resource_type` (UNIQUE).

### 4.5 Identificadores persistidos (§10)

A seguinte tabela consolida os identificadores que **devem** ser persistidos nas entidades dos módulos consumidores para manter rastreabilidade fim a fim:

| Identificador | Origem | Uso |
|---------------|--------|-----|
| `purchaseQuotationId` | Cotação no Sienge | PK da cotação importada |
| `supplierId` | Cotação/Pedido no Sienge | Identificador do fornecedor no fluxo de compras |
| `negotiationId` / `negotiationNumber` | Negociação no Sienge | Rastrear resposta enviada |
| `purchaseOrderId` | Pedido no Sienge | PK do pedido importado |
| `purchaseOrderItemNumber` | Item do pedido | Detalhar itens |
| `purchaseQuotationItemId` | Cotação/Item | Vínculo cotação-item |
| `sequentialNumber` | Nota fiscal | PK da NF importada |
| `invoiceItemNumber` | Item da NF | Detalhar itens da NF |
| `creditorId` | API de Credores | Vínculo cadastral (pendente homologação §17) |

## 5. Regras de negócio

- **RN-01:** O Sienge prevalece como fonte principal de verdade para dados operacionais mestres. O sistema local mantém apenas exceções: e-mail alterado pelo Administrador, data prometida aprovada por Compras, status internos de workflow, registros de avaria e trilhas de auditoria. *(PRDGlobal §9.1)*
- **RN-02:** A autenticação na API do Sienge usa `Basic Authorization` com header `Authorization: Basic base64(usuario-api:senha)`. *(PRDGlobal §9.2)*
- **RN-03:** O rate limit deve ser respeitado: `200/minuto` para REST, `20/minuto` para BULK. *(PRDGlobal §9.2)*
- **RN-04:** Paginação usa `limit` (padrão 100, máximo 200) e `offset` (padrão 0). O retorno paginado é tratado com `resultSetMetadata` e `results`. *(PRDGlobal §9.2)*
- **RN-05:** O e-mail do fornecedor deve ser buscado em `GET /creditors/{creditorId}`, usando o primeiro `contacts[].email` preenchido. Se não houver e-mail preenchido, o fornecedor fica bloqueado até ajuste manual do Administrador. *(PRDGlobal §9.5)*
- **RN-06:** O vínculo principal entre pedido e cotação é feito pelo webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`. O detalhamento por item (`purchaseQuotations[]`) é conferência, não regra principal. *(PRDGlobal §9.6)*
- **RN-07:** O vínculo nota fiscal → pedido usa `GET /purchase-invoices/deliveries-attended`. O vínculo nota → cotação segue o caminho: `Nota → purchaseOrderId → item do pedido → purchaseQuotationId → Cotação`. *(PRDGlobal §9.7)*
- **RN-08:** Webhooks são gatilhos de sincronização incremental. Após cada webhook, a aplicação deve reconsultar a API REST para reconciliação detalhada. *(PRDGlobal §9.8)*
- **RN-09:** A ausência permanente do webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` é bloqueio de homologação. Se a reconciliação divergir do vínculo criado pelo webhook, o sistema mantém o vínculo e notifica `Compras`. *(PRDGlobal §9.8)*
- **RN-10:** Se o fornecedor foi removido do mapa de cotação no Sienge, o sistema não cria negociação automaticamente. O sistema alerta `Compras` antes de qualquer tentativa de escrita. O status exibido é `Fornecedor inválido no mapa de cotação` em vermelho. *(PRDGlobal §9.9)*
- **RN-11:** O parser deve respeitar a grafia do contrato real (`sheduledDate`, `sheduledQuantity` sem o `c`). *(PRDGlobal §9.10)*
- **RN-12:** O endpoint `PATCH .../negotiations/latest/authorize` só deve ser chamado após aprovação manual de `Compras`. *(PRDGlobal §9.3.7)*
- **RN-13:** Em falha de integração, o sistema tenta novo reprocessamento automático após 24 horas. Para escrita de cotação, são 2 reenvios automáticos com intervalo de 24 horas. Se persistir, `Compras` é notificado. *(PRDGlobal §12.2)*
- **RN-14:** Integrações devem ter idempotência, retry e rastreabilidade. *(PRDGlobal §15.2)*
- **RN-15:** O endpoint `GET /purchase-quotations/comparison-map/pdf` não deve ser usado como fonte de automação. *(PRDGlobal §9.3.1)*

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

1. O endpoint receptor valida a autenticidade do webhook.
2. Persiste o payload em `webhook_events` com status `received`.
3. Processa de forma assíncrona:
   - `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`: cria vínculo pedido-cotação e dispara leitura detalhada do pedido.
   - `PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED`: reconsulta status da negociação.
   - `PURCHASE_ORDER_ITEM_MODIFIED`: reconsulta itens do pedido.
   - `PURCHASE_ORDER_AUTHORIZATION_CHANGED` / `PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED`: usa como gatilho de reconsulta apenas.
4. Atualiza status para `processed` ou `failed`.

### 6.6 Reprocessamento de falhas

1. O scheduler identifica eventos com status `retry_scheduled` e `next_retry_at <= NOW()`.
2. Reexecuta a operação com a mesma `idempotency_key`.
3. Atualiza `retry_count`.
4. Se `retry_count >= max_retries`, marca como `failure` e notifica `Compras`.
5. `Compras` pode acionar reprocessamento manual sem limite na V1.0.

## 7. Contratos de API / Serviços

### 7.1 Clientes Sienge (Leitura)

| Serviço | Endpoint Sienge | Método | Entrada | Saída | Erros |
|---------|----------------|--------|---------|-------|-------|
| `QuotationClient.listNegotiations` | `/purchase-quotations/all/negotiations` | GET | Filtros: `quotationNumber`, `supplierId`, `buyerId`, `startDate`, `endDate`, `authorized`, `status`, `consistency`, `limit`, `offset` | Lista paginada de cotações com fornecedores e negociações | 401, 429, 500 |
| `CreditorClient.getById` | `/creditors/{creditorId}` | GET | `creditorId` | Dados cadastrais com `contacts[].email` | 401, 404, 429, 500 |
| `CreditorClient.list` | `/creditors` | GET | Filtros: `cpf`, `cnpj`, `creditor`, `limit`, `offset` | Lista paginada de credores | 401, 429, 500 |
| `OrderClient.list` | `/purchase-orders` | GET | Filtros: `startDate`, `endDate`, `status`, `authorized`, `supplierId`, `buildingId`, `buyerId`, `consistency`, `limit`, `offset` | Lista paginada de pedidos | 401, 429, 500 |
| `OrderClient.getById` | `/purchase-orders/{id}` | GET | `purchaseOrderId` | Detalhe do pedido | 401, 404, 429, 500 |
| `OrderClient.getItems` | `/purchase-orders/{id}/items` | GET | `purchaseOrderId` | Lista de itens do pedido | 401, 404, 429, 500 |
| `OrderClient.getDeliverySchedules` | `/purchase-orders/{id}/items/{itemNumber}/delivery-schedules` | GET | `purchaseOrderId`, `itemNumber` | Lista paginada de entregas programadas | 401, 404, 429, 500 |
| `InvoiceClient.list` | `/purchase-invoices` | GET | Filtros: `companyId`, `supplierId`, `documentId`, `series`, `number`, `startDate`, `endDate`, `limit`, `offset` | Lista paginada de notas fiscais | 401, 429, 500 |
| `InvoiceClient.getById` | `/purchase-invoices/{sequentialNumber}` | GET | `sequentialNumber` | Detalhe da nota fiscal | 401, 404, 429, 500 |
| `InvoiceClient.getItems` | `/purchase-invoices/{sequentialNumber}/items` | GET | `sequentialNumber` | Lista de itens da nota | 401, 404, 429, 500 |
| `InvoiceClient.getDeliveriesAttended` | `/purchase-invoices/deliveries-attended` | GET | Filtros: `billId`, `sequentialNumber`, `purchaseOrderId`, `invoiceItemNumber`, `purchaseOrderItemNumber`, `limit`, `offset` | Lista de entregas atendidas | 401, 429, 500 |
| `DeliveryRequirementClient.get` | `/purchase-requests/{id}/items/{itemNumber}/delivery-requirements` | GET | `purchaseRequestId`, `purchaseRequestItemNumber` | Requisitos de entrega | 401, 404, 429, 500 |

### 7.2 Clientes Sienge (Escrita)

| Serviço | Endpoint Sienge | Método | Entrada | Saída | Erros | Perfis |
|---------|----------------|--------|---------|-------|-------|--------|
| `NegotiationClient.create` | `/purchase-quotations/{id}/suppliers/{supplierId}/negotiations` | POST | Body conforme §9.3.7 | Negociação criada | 400, 401, 404, 409, 429, 500 | Sistema (após aprovação `Compras`) |
| `NegotiationClient.update` | `.../negotiations/{negotiationNumber}` | PUT | Body: `supplierAnswerDate`, `validity`, `seller`, `discount`, `freightType`, `freightTypeForGeneratedPurchaseOrder`, `freightPrice`, `valueOtherExpenses`, `applyIpiFreight`, `internalNotes`, `supplierNotes`, `paymentTerms` | Negociação atualizada | 400, 401, 404, 429, 500 | Sistema |
| `NegotiationClient.updateItem` | `.../negotiations/{num}/items/{itemNum}` | PUT | Body conforme §9.3.7 (itens) | Item atualizado | 400, 401, 404, 429, 500 | Sistema |
| `NegotiationClient.authorize` | `.../negotiations/latest/authorize` | PATCH | Nenhum body | Autorização confirmada | 400, 401, 404, 429, 500 | Sistema (somente após aprovação `Compras`) |

### 7.3 Serviços internos

| Serviço | Rota | Método | Entrada | Saída | Perfis |
|---------|------|--------|---------|-------|--------|
| `IntegrationService.syncQuotations` | Interno (worker) | — | Filtros opcionais | Resultado da sincronização | Sistema |
| `IntegrationService.syncOrders` | Interno (worker) | — | Filtros opcionais | Resultado da sincronização | Sistema |
| `IntegrationService.syncDeliveries` | Interno (worker) | — | `purchaseOrderId` | Resultado da sincronização | Sistema |
| `IntegrationService.syncCreditor` | Interno (worker) | — | `creditorId` | Dados do fornecedor | Sistema |
| `IntegrationService.writeNegotiation` | Interno (API) | — | Dados da resposta aprovada | Resultado da escrita | `Compras` (via aprovação) |
| `IntegrationService.retryFailed` | Interno (worker) | — | Nenhuma | Eventos reprocessados | Sistema |
| `WebhookReceiver.handle` | `/webhooks/sienge` | POST | Payload do webhook | `200 OK` | Externo (Sienge) |
| `IntegrationStatus.list` | `/api/integration/events` | GET | Filtros: `status`, `event_type`, `date_range` | Lista paginada de eventos | `Compras`, `Administrador` |
| `IntegrationStatus.retry` | `/api/integration/events/{id}/retry` | POST | `event_id` | Evento reagendado | `Compras` |

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
- `GET /purchase-quotations/all/negotiations` *(§9.3.1)*

**Leitura cadastral do fornecedor:**
- `GET /creditors/{creditorId}` *(§9.3.2)*
- `GET /creditors` *(§9.3.2)*

**Leitura de pedidos:**
- `GET /purchase-orders` *(§9.3.3)*
- `GET /purchase-orders/{purchaseOrderId}` *(§9.3.3)*
- `GET /purchase-orders/{purchaseOrderId}/items` *(§9.3.3)*
- `GET /purchase-orders/{purchaseOrderId}/items/{itemNumber}/delivery-schedules` *(§9.3.4)*

**Leitura de notas e entrega:**
- `GET /purchase-invoices` *(§9.3.5)*
- `GET /purchase-invoices/{sequentialNumber}` *(§9.3.5)*
- `GET /purchase-invoices/{sequentialNumber}/items` *(§9.3.5)*
- `GET /purchase-invoices/deliveries-attended` *(§9.3.5)*

**Leitura auxiliar:**
- `GET /purchase-requests/{id}/items/{itemNumber}/delivery-requirements` *(§9.3.6)*

**Escrita de cotação:**
- `POST /purchase-quotations/{id}/suppliers/{supplierId}/negotiations` *(§9.3.7)*
- `PUT /purchase-quotations/{id}/suppliers/{supplierId}/negotiations/{negotiationNumber}` *(§9.3.7)*
- `PUT .../negotiations/{negotiationNumber}/items/{quotationItemNumber}` *(§9.3.7)*
- `PATCH .../negotiations/latest/authorize` *(§9.3.7)*

### 9.2 Webhooks consumidos

| Webhook | Uso | Ação |
|---------|-----|------|
| `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` | Vínculo principal pedido-cotação | Criar vínculo + reconsultar pedido |
| `PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED` | Status de autorização da negociação | Reconsultar negociação |
| `PURCHASE_ORDER_AUTHORIZATION_CHANGED` | Mudança de autorização do pedido | Gatilho de reconsulta |
| `PURCHASE_ORDER_ITEM_MODIFIED` | Modificação de item do pedido | Reconsultar itens |
| `PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED` | Previsão financeira atualizada | Gatilho de reconsulta |

### 9.3 Regras de reconciliação

- Webhook como regra principal; reconciliação por API como fallback *(§9.8)*.
- A ausência permanente do webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` é bloqueio de homologação *(§9.8)*.
- Se reconciliação divergir do vínculo do webhook, manter vínculo e notificar `Compras` *(§9.8)*.

### 9.4 Tratamento de falhas

- Falha genérica: retry automático após 24h *(§12.2)*.
- Escrita de cotação: até 2 reenvios automáticos com intervalo de 24h *(§12.2)*.
- Após esgotar retries: notificar `Compras` *(§12.2)*.
- Reprocessamento manual por `Compras` sem limite na V1.0 *(§12.2)*.

## 10. Auditoria e rastreabilidade

Eventos auditáveis gerados por este módulo conforme §12.6:

| Evento | Descrição |
|--------|-----------|
| `integration_success` | Integração com Sienge concluída com sucesso |
| `integration_failure` | Falha de integração com o Sienge |
| `integration_retry` | Reprocessamento automático ou manual de integração |
| `webhook_received` | Webhook recebido do Sienge |
| `webhook_processed` | Webhook processado com sucesso |
| `webhook_failed` | Falha no processamento de webhook |
| `negotiation_written` | Resposta de cotação enviada ao Sienge |
| `negotiation_authorized` | Negociação autorizada no Sienge |
| `supplier_invalid_map` | Fornecedor detectado como inválido no mapa de cotação |
| `reconciliation_divergence` | Divergência detectada entre webhook e leitura API |

Cada evento registra: data/hora, tipo, usuário/origem, entidade afetada, fornecedor (quando aplicável), resumo da ação.

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
- [ ] Após webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`, o sistema cria o vínculo pedido-cotação e reconsulta a API.
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

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Divergência entre contrato público e comportamento real da API | Alta | Alto | Homologar com dados reais; implementar parsers tolerantes; registrar payloads completos para diagnóstico |
| Webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` indisponível no ambiente do cliente | Média | Alto | Implementar reconciliação por API como fallback; tratar ausência como bloqueio de homologação |
| Rate limit insuficiente para o volume operacional do cliente | Média | Médio | Implementar fila com controle de taxa; priorizar operações críticas; monitorar uso |
| Inconsistência de tipagem em campos como `openQuantity` | Média | Baixo | Parser tolerante; validação em homologação; fallback para tipo string |
| Falhas intermitentes da API do Sienge | Alta | Médio | Retry automático com backoff; fila de reprocessamento; monitoramento de health check |
| Mudança no contrato da API do Sienge sem aviso | Baixa | Alto | Versionamento dos clientes; alertas de contrato quebrado; logs detalhados de payload |
