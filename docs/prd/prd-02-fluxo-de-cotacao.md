# PRD Filho — Fluxo de Cotação

> Módulo: 2 de 9
> Seções do PRDGlobal: §4, §9.3.1, §9.3.7, §9.3.8 (parcial), §10 (parcial), §12.6 (parcial), §14.1 (parcial), §14.2
> Dependências: PRD 01 — Autenticação e Perfis, PRD 07 — Integração com o Sienge
> Data de geração: 2026-04-06

---

## 1. Objetivo do módulo

O módulo de Fluxo de Cotação é o núcleo operacional do produto. Ele resolve o principal gargalo da GRF: o processo manual de envio, recebimento e aprovação de cotações de compra, hoje fragmentado entre e-mail, WhatsApp e digitação manual no Sienge.

Este módulo automatiza o ciclo completo da cotação — desde a importação do Sienge até o retorno da resposta aprovada — garantindo rastreabilidade, controle de prazos, aprovação obrigatória por `Compras` e integração confiável com o ERP. Ele sustenta o princípio de que o Sienge permanece como fonte principal de verdade e que nenhuma resposta de cotação volta ao Sienge sem aprovação manual.

O valor entregue é direto: redução do tempo operacional de cotação para menos de 1 dia, elevação da taxa de resposta de fornecedores para acima de 90% dentro do prazo, e automação de mais de 70% das etapas operacionais do fluxo de cotação. _(PRDGlobal §1.3)_

---

## 2. Escopo funcional

### 2.1 Incluso neste PRD

- Importação de cotações do Sienge via `GET /purchase-quotations/all/negotiations`.
- Revisão de cotações importadas por `Compras` antes do envio ao fornecedor.
- Envio de cotações ao fornecedor pelo portal (somente fornecedores com acesso liberado).
- Registro de leitura da cotação pelo fornecedor.
- Resposta de cotação pelo fornecedor no portal, incluindo data de entrega obrigatória.
- Edição e reenvio de resposta pelo fornecedor enquanto prazo aberto e sem aprovação final.
- Aprovação ou reprovação da resposta de cotação por `Compras`.
- Solicitação de correção ao fornecedor por `Compras`.
- Integração da resposta aprovada ao Sienge via APIs de escrita.
- Controle de status operacionais da cotação.
- Regras de encerramento de cotação e tratamento de `Sem resposta`.
- Identificação e sinalização de `Fornecedor fechado` e `Encerrado`.
- Sinalização de `Fornecedor inválido no mapa de cotação`.
- Ordenação operacional de cotações no portal do fornecedor.
- Tratamento de falhas de integração com reenvio controlado.
- Campos mínimos de listagem no backoffice e no portal do fornecedor.
- Persistência dos identificadores de rastreabilidade do fluxo de cotação.
- Eventos de auditoria do fluxo de cotação.

### 2.2 Excluído deste PRD

| Funcionalidade                                                                    | Módulo responsável                               |
| --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Criação, bloqueio, reativação e gestão de acessos de fornecedor e usuário interno | PRD 01 — Autenticação e Perfis                   |
| Autenticação (login, primeiro acesso, redefinição de senha)                       | PRD 01 — Autenticação e Perfis                   |
| RBAC e controle de perfis                                                         | PRD 01 — Autenticação e Perfis                   |
| Notificação de nova cotação por e-mail                                            | PRD 03 — Notificações de Cotação                 |
| Follow-up logístico e régua de cobrança                                           | PRD 04 — Follow-up Logístico                     |
| Status de pedido, entrega e divergência                                           | PRD 05 — Entrega, Divergência e Status de Pedido |
| Avaria e ação corretiva                                                           | PRD 06 — Avaria e Ação Corretiva                 |
| Clientes HTTP, adaptadores, parsers e reconciliação geral com Sienge              | PRD 07 — Integração com o Sienge                 |
| Dashboards e indicadores                                                          | PRD 08 — Dashboard e Indicadores                 |
| Backoffice geral, filtros consolidados e auditoria operacional cross-módulo       | PRD 09 — Backoffice, Auditoria e Operação        |

### 2.3 Fora de escopo da V1.0

- Exposição de propostas concorrentes entre fornecedores. _(PRDGlobal §2.3)_
- Envio de anexos, comprovantes ou documentos pelo fornecedor. _(PRDGlobal §2.3)_
- Notificação de nova cotação por WhatsApp (V2.0). _(PRDGlobal §2.2)_

---

## 3. Perfis envolvidos

| Perfil                      | Permissões neste módulo                                                                                                                                                                                                | Restrições neste módulo                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Fornecedor**              | Visualiza cotações destinadas a ele; abre cotação (marca leitura); responde cotação com data de entrega obrigatória; edita e reenvia enquanto prazo aberto e sem aprovação final; consulta histórico próprio.          | Não aprova a própria resposta; não acessa cotações de outros fornecedores; não altera data de término. _(PRDGlobal §3.3)_ |
| **Compras**                 | Revisa dados importados do Sienge; envia cotação ao fornecedor; define data de término; aprova ou reprova resposta; solicita correção; aciona reenvio ao Sienge; aciona reprocessamento manual em falha de integração. | Não gere acessos ou parametrizações. _(PRDGlobal §3.3)_                                                                   |
| **Administrador**           | Acesso completo de leitura às cotações para monitoramento.                                                                                                                                                             | Não aprova nem reprova respostas de cotação. _(PRDGlobal §3.3)_                                                           |
| **Visualizador de Pedidos** | Sem acesso ao fluxo de cotação.                                                                                                                                                                                        | Não visualiza cotações, não executa ações. _(PRDGlobal §3.2)_                                                             |

_(PRDGlobal §3.1, §3.2, §3.3)_

---

## 4. Entidades e modelagem

### 4.1 `quotation` (Cotação)

Cotação importada do Sienge.

| Campo                 | Tipo                     | Obrigatório | Descrição                                |
| --------------------- | ------------------------ | ----------- | ---------------------------------------- |
| `id`                  | UUID                     | Sim         | Identificador interno                    |
| `sienge_quotation_id` | INTEGER                  | Sim         | `purchaseQuotationId` do Sienge          |
| `buyer_id`            | TEXT                     | Sim         | `buyerId` do Sienge                      |
| `status`              | ENUM                     | Sim         | Status operacional da cotação (ver §4.6) |
| `consistent`          | BOOLEAN                  | Sim         | Flag de consistência do Sienge           |
| `sienge_status`       | TEXT                     | Sim         | Status original do Sienge                |
| `quotation_date`      | DATE                     | Sim         | Data da cotação (`quotationDate`)        |
| `response_deadline`   | DATE                     | Sim         | Data limite de resposta (`responseDate`) |
| `end_date`            | TIMESTAMP WITH TIME ZONE | Sim         | Data de término definida por `Compras`   |
| `sent_at`             | TIMESTAMP WITH TIME ZONE | Não         | Data/hora do envio ao(s) fornecedor(es)  |
| `sent_by`             | UUID                     | Não         | FK para usuário que enviou               |
| `raw_payload`         | JSONB                    | Não         | Payload bruto do Sienge para auditoria   |
| `created_at`          | TIMESTAMP WITH TIME ZONE | Sim         | Data de criação                          |
| `updated_at`          | TIMESTAMP WITH TIME ZONE | Sim         | Última atualização                       |

**Relacionamentos:**

- 1:N com `quotation_supplier`
- N:1 com `users` (via `sent_by`)

**Índices sugeridos:**

- `idx_quotation_sienge_id` em `sienge_quotation_id` (UNIQUE)
- `idx_quotation_status` em `status`
- `idx_quotation_end_date` em `end_date`

**Regras de integridade:**

- `sienge_quotation_id` deve ser único.
- `end_date` não pode ser alterada após o envio (`sent_at IS NOT NULL`). _(PRDGlobal §4.1)_

---

### 4.2 `quotation_supplier` (Fornecedor na Cotação)

Vínculo entre cotação e cada fornecedor participante.

| Campo                   | Tipo                     | Obrigatório | Descrição                                      |
| ----------------------- | ------------------------ | ----------- | ---------------------------------------------- |
| `id`                    | UUID                     | Sim         | Identificador interno                          |
| `quotation_id`          | UUID                     | Sim         | FK para `quotation`                            |
| `supplier_id`           | INTEGER                  | Sim         | `supplierId` do Sienge                         |
| `supplier_name`         | TEXT                     | Sim         | Nome do fornecedor no Sienge                   |
| `status`                | ENUM                     | Sim         | Status individual do fornecedor nesta cotação  |
| `read_at`               | TIMESTAMP WITH TIME ZONE | Não         | Momento em que o fornecedor abriu a cotação    |
| `sent_at`               | TIMESTAMP WITH TIME ZONE | Não         | Momento do envio da cotação a este fornecedor  |
| `closed_order_id`       | INTEGER                  | Não         | `purchaseOrderId` quando `Fornecedor fechado`  |
| `latest_negotiation_id` | INTEGER                  | Não         | `negotiationId` da última negociação do Sienge |
| `created_at`            | TIMESTAMP WITH TIME ZONE | Sim         | Data de criação                                |
| `updated_at`            | TIMESTAMP WITH TIME ZONE | Sim         | Última atualização                             |

**Relacionamentos:**

- N:1 com `quotation`
- N:1 com `suppliers` (entidade do módulo de Auth/Integração)
- 1:N com `quotation_response`

**Índices sugeridos:**

- `idx_qs_quotation_supplier` em `(quotation_id, supplier_id)` (UNIQUE)
- `idx_qs_status` em `status`

**Regras de integridade:**

- Combinação `(quotation_id, supplier_id)` deve ser única.
- `read_at` só é preenchido quando o fornecedor abre a cotação específica no portal (não por mero login). _(PRDGlobal §4.5)_

---

### 4.3 `quotation_response` (Resposta de Cotação)

Resposta enviada pelo fornecedor para uma cotação.

| Campo                       | Tipo                     | Obrigatório | Descrição                                                 |
| --------------------------- | ------------------------ | ----------- | --------------------------------------------------------- |
| `id`                        | UUID                     | Sim         | Identificador interno                                     |
| `quotation_supplier_id`     | UUID                     | Sim         | FK para `quotation_supplier`                              |
| `version`                   | INTEGER                  | Sim         | Versão da resposta (incrementa a cada reenvio)            |
| `supplier_answer_date`      | DATE                     | Sim         | Data da resposta do fornecedor                            |
| `validity`                  | DATE                     | Não         | Validade da proposta                                      |
| `seller`                    | TEXT                     | Não         | Nome do vendedor                                          |
| `discount`                  | DECIMAL(10,2)            | Não         | Desconto geral                                            |
| `freight_type`              | TEXT                     | Não         | Tipo de frete                                             |
| `freight_type_for_order`    | TEXT                     | Não         | Tipo de frete para pedido gerado                          |
| `freight_price`             | DECIMAL(12,2)            | Não         | Valor do frete                                            |
| `other_expenses`            | DECIMAL(12,2)            | Não         | Outras despesas                                           |
| `apply_ipi_freight`         | BOOLEAN                  | Não         | Aplicar IPI sobre frete                                   |
| `internal_notes`            | TEXT                     | Não         | Observações internas                                      |
| `supplier_notes`            | TEXT                     | Não         | Observações do fornecedor                                 |
| `payment_terms`             | TEXT                     | Não         | Condições de pagamento                                    |
| `review_status`             | ENUM                     | Sim         | `pending`, `approved`, `rejected`, `correction_requested` |
| `reviewed_by`               | UUID                     | Não         | FK para usuário de `Compras` que revisou                  |
| `reviewed_at`               | TIMESTAMP WITH TIME ZONE | Não         | Data/hora da revisão                                      |
| `review_notes`              | TEXT                     | Não         | Observações de `Compras` na revisão                       |
| `integration_status`        | ENUM                     | Sim         | `not_sent`, `pending`, `success`, `failed`                |
| `integration_attempts`      | INTEGER                  | Sim         | Número de tentativas de envio ao Sienge                   |
| `last_integration_at`       | TIMESTAMP WITH TIME ZONE | Não         | Última tentativa de integração                            |
| `last_integration_error`    | TEXT                     | Não         | Último erro de integração                                 |
| `sienge_negotiation_number` | INTEGER                  | Não         | `negotiationNumber` retornado pelo Sienge                 |
| `submitted_at`              | TIMESTAMP WITH TIME ZONE | Sim         | Data/hora do envio pelo fornecedor                        |
| `created_at`                | TIMESTAMP WITH TIME ZONE | Sim         | Data de criação                                           |
| `updated_at`                | TIMESTAMP WITH TIME ZONE | Sim         | Última atualização                                        |

**Relacionamentos:**

- N:1 com `quotation_supplier`
- 1:N com `quotation_response_item`

**Índices sugeridos:**

- `idx_qr_qs_version` em `(quotation_supplier_id, version)` (UNIQUE)
- `idx_qr_review_status` em `review_status`
- `idx_qr_integration_status` em `integration_status`

**Regras de integridade:**

- Combinação `(quotation_supplier_id, version)` deve ser única.
- `review_status` inicia como `pending`.
- `integration_status` inicia como `not_sent`.
- `integration_attempts` inicia como `0`.

---

### 4.4 `quotation_response_item` (Item da Resposta)

Cada item respondido pelo fornecedor na cotação.

| Campo                   | Tipo                     | Obrigatório | Descrição                           |
| ----------------------- | ------------------------ | ----------- | ----------------------------------- |
| `id`                    | UUID                     | Sim         | Identificador interno               |
| `quotation_response_id` | UUID                     | Sim         | FK para `quotation_response`        |
| `quotation_item_number` | INTEGER                  | Sim         | Número do item na cotação do Sienge |
| `detail_id`             | INTEGER                  | Não         | `detailId`                          |
| `trademark_id`          | INTEGER                  | Não         | `trademarkId`                       |
| `quoted_quantity`       | DECIMAL(12,4)            | Sim         | Quantidade cotada                   |
| `negotiated_quantity`   | DECIMAL(12,4)            | Sim         | Quantidade negociada                |
| `unit_price`            | DECIMAL(12,4)            | Sim         | Preço unitário                      |
| `discount`              | DECIMAL(10,2)            | Não         | Desconto do item                    |
| `discount_percentage`   | DECIMAL(5,2)             | Não         | Percentual de desconto              |
| `increase_percentage`   | DECIMAL(5,2)             | Não         | Percentual de acréscimo             |
| `ipi_tax_percentage`    | DECIMAL(5,2)             | Não         | % IPI                               |
| `iss_tax_percentage`    | DECIMAL(5,2)             | Não         | % ISS                               |
| `icms_tax_percentage`   | DECIMAL(5,2)             | Não         | % ICMS                              |
| `freight_unit_price`    | DECIMAL(12,4)            | Não         | Frete unitário                      |
| `selected_option`       | BOOLEAN                  | Não         | Opção selecionada                   |
| `internal_notes`        | TEXT                     | Não         | Observações internas                |
| `supplier_notes`        | TEXT                     | Não         | Observações do fornecedor           |
| `created_at`            | TIMESTAMP WITH TIME ZONE | Sim         | Data de criação                     |
| `updated_at`            | TIMESTAMP WITH TIME ZONE | Sim         | Última atualização                  |

**Relacionamentos:**

- N:1 com `quotation_response`
- 1:N com `quotation_response_item_delivery`

**Índices sugeridos:**

- `idx_qri_response_item` em `(quotation_response_id, quotation_item_number)` (UNIQUE)

**Regras de integridade:**

- Combinação `(quotation_response_id, quotation_item_number)` deve ser única.

---

### 4.5 `quotation_response_item_delivery` (Entregas do Item)

Programação de entregas por item da resposta.

| Campo                        | Tipo                     | Obrigatório | Descrição                                       |
| ---------------------------- | ------------------------ | ----------- | ----------------------------------------------- |
| `id`                         | UUID                     | Sim         | Identificador interno                           |
| `quotation_response_item_id` | UUID                     | Sim         | FK para `quotation_response_item`               |
| `delivery_number`            | INTEGER                  | Sim         | Número sequencial da entrega                    |
| `delivery_date`              | DATE                     | Sim         | Data de entrega _(obrigatória, PRDGlobal §4.3)_ |
| `delivery_quantity`          | DECIMAL(12,4)            | Sim         | Quantidade da entrega                           |
| `created_at`                 | TIMESTAMP WITH TIME ZONE | Sim         | Data de criação                                 |

**Relacionamentos:**

- N:1 com `quotation_response_item`

**Índices sugeridos:**

- `idx_qrid_item_number` em `(quotation_response_item_id, delivery_number)` (UNIQUE)

**Regras de integridade:**

- Pelo menos uma entrega deve existir com `delivery_date` preenchida por resposta. _(PRDGlobal §4.3)_
- Combinação `(quotation_response_item_id, delivery_number)` deve ser única.

---

### 4.6 ENUM `quotation_status`

| Valor                  | Descrição                              |
| ---------------------- | -------------------------------------- |
| `in_negotiation`       | Em negociação                          |
| `awaiting_review`      | Aguardando revisão de Compras          |
| `approved`             | Aprovada por Compras                   |
| `rejected`             | Reprovada por Compras                  |
| `correction_requested` | Correção solicitada                    |
| `awaiting_sienge_send` | Aguardando reenvio ao Sienge           |
| `integrated`           | Integrada ao Sienge                    |
| `no_response`          | Sem resposta                           |
| `invalid_supplier`     | Fornecedor inválido no mapa de cotação |
| `supplier_closed`      | Fornecedor fechado                     |
| `closed`               | Encerrado                              |

_(PRDGlobal §4.6)_

---

## 5. Regras de negócio

- **RN-01:** O sistema deve importar cotações do Sienge por `GET /purchase-quotations/all/negotiations`. _(PRDGlobal §4.1)_
- **RN-02:** `Compras` revisa os dados importados antes do envio ao fornecedor. _(PRDGlobal §4.1)_
- **RN-03:** Cada cotação deve ter data de início e data de fim visíveis ao fornecedor. _(PRDGlobal §4.1)_
- **RN-04:** A data de término da cotação é definida por `Compras`. _(PRDGlobal §4.1)_
- **RN-05:** Depois que a cotação é enviada, a data de término não pode mais ser alterada. _(PRDGlobal §4.1)_
- **RN-06:** A cotação só deve ser enviada para fornecedores com acesso já liberado no portal. _(PRDGlobal §4.2)_
- **RN-07:** Em cotações com múltiplos fornecedores, o envio ocorre apenas para quem já tiver acesso ativo. _(PRDGlobal §4.2)_
- **RN-08:** Se o fornecedor existir no Sienge mas não tiver acesso liberado no portal, o sistema não deve enviar notificação nem follow-up. _(PRDGlobal §4.2)_
- **RN-09:** Se o acesso de um fornecedor for liberado depois do envio inicial, a cotação só pode ser enviada a ele se o prazo ainda estiver aberto. _(PRDGlobal §4.2)_
- **RN-10:** No envio tardio, a data final continua sendo a data original da cotação, sem prazo individual. _(PRDGlobal §4.2)_
- **RN-11:** Se o fornecedor estiver bloqueado, o sistema interrompe imediatamente notificações e operação no portal. _(PRDGlobal §4.2)_
- **RN-12:** A resposta do fornecedor deve conter data de entrega obrigatória. O sistema não aceita envio sem data de entrega preenchida. _(PRDGlobal §4.3)_
- **RN-13:** O fornecedor pode editar e reenviar a cotação enquanto o prazo estiver aberto e não houver aprovação final de `Compras`. _(PRDGlobal §4.3)_
- **RN-14:** Se `Compras` reprovar para ajuste, o fornecedor recebe o mesmo link e pode corrigir e reenviar enquanto o prazo estiver aberto. _(PRDGlobal §4.3)_
- **RN-15:** Após aprovação de `Compras` e envio ao Sienge, a resposta deixa de ser editável e permanece apenas para consulta. _(PRDGlobal §4.3)_
- **RN-16:** Toda resposta do fornecedor deve passar por aprovação manual de `Compras`. _(PRDGlobal §4.4)_
- **RN-17:** Em cotações com múltiplos fornecedores, `Compras` pode aprovar respostas individualmente. _(PRDGlobal §4.4)_
- **RN-18:** Se houver falha de integração após aprovação, o sistema deve manter a resposta com status pendente e permitir novo reenvio controlado. _(PRDGlobal §4.4)_
- **RN-19:** A cotação só é considerada lida quando o fornecedor abre a cotação específica no portal. Login sem abrir a cotação não marca leitura. _(PRDGlobal §4.5)_
- **RN-20:** Após a data de término, o sistema não aceita novas respostas nem reenvios. _(PRDGlobal §4.7)_
- **RN-21:** Se a cotação vencer sem resposta válida, o status do fornecedor é `Sem resposta` e `Compras` deve ser notificado. _(PRDGlobal §4.7)_
- **RN-22:** A ausência de resposta de um fornecedor não bloqueia o andamento da cotação com os demais. _(PRDGlobal §4.7)_
- **RN-23:** Cotações com `Sem resposta` permanecem consultáveis no portal, mas sem edição. _(PRDGlobal §4.7)_
- **RN-24:** Quando um pedido de compra é gerado no Sienge a partir da cotação, o fornecedor vencedor aparece como `Fornecedor fechado` com nome e número do pedido. _(PRDGlobal §4.7)_
- **RN-25:** Os demais fornecedores da mesma cotação devem aparecer como `Encerrado`. _(PRDGlobal §4.7)_
- **RN-26:** Na lista de cotações do portal do fornecedor, a ordenação prioriza: abertas pendentes > correção solicitada > em revisão > encerradas/integradas/sem resposta. _(PRDGlobal §4.8)_
- **RN-27:** O sistema só devolve resposta de cotação ao Sienge após aprovação de `Compras`. _(PRDGlobal §1.4, §4.4, §9.3.7)_
- **RN-28:** O endpoint `PATCH /purchase-quotations/{id}/suppliers/{id}/negotiations/latest/authorize` deve ser chamado somente depois da aprovação manual de `Compras`. _(PRDGlobal §9.3.7)_
- **RN-29:** No envio de resposta de cotação ao Sienge, o sistema tenta mais 2 reenvios automáticos com intervalo de 24 horas. Após falha persistente, `Compras` é notificado. _(PRDGlobal §12.2)_
- **RN-30:** Se o fornecedor foi removido do mapa de cotação no Sienge, o sistema não deve criar negociação automaticamente. O status exibido deve ser `Fornecedor inválido no mapa de cotação` com destaque vermelho. _(PRDGlobal §9.9)_
- **RN-31:** Mesmo após correção no Sienge, nova tentativa de envio para fornecedor anteriormente inválido exige aprovação prévia de `Compras`. _(PRDGlobal §9.9)_

---

## 6. Fluxos operacionais

### 6.1 Importação de cotação do Sienge

1. O sistema consulta `GET /purchase-quotations/all/negotiations` periodicamente (polling) ou sob demanda.
2. Para cada cotação retornada, verifica se `sienge_quotation_id` já existe localmente.
3. Se nova, cria registro em `quotation` com status `in_negotiation`.
4. Para cada fornecedor em `suppliers[]`, cria registro em `quotation_supplier` com `supplier_id` e `supplier_name`.
5. Persiste `latest_negotiation_id` quando disponível.
6. Persiste o payload bruto em `raw_payload` para auditoria.
7. Gera evento de auditoria: `quotation_imported`.

**Exceções:**

- Se a API do Sienge retornar erro, registra falha e programa retry conforme política de integração (PRD 07).
- Se `suppliers[]` contiver um fornecedor sem acesso no portal, o `quotation_supplier` é criado mas não marcado para envio.

---

### 6.2 Preparação e envio ao fornecedor

1. `Compras` visualiza a lista de cotações importadas com status `in_negotiation`.
2. `Compras` revisa dados da cotação (campos, fornecedores, datas).
3. `Compras` define a data de término (`end_date`), se ainda não definida.
4. `Compras` aciona o envio da cotação.
5. O sistema verifica cada fornecedor da cotação:
   - Se acesso ativo: marca `sent_at` e dispara notificação (módulo PRD 03).
   - Se acesso não liberado: pula o envio sem erro. O fornecedor fica como pendente de envio.
6. Registra `sent_at` e `sent_by` na cotação.
7. Após envio, `end_date` torna-se imutável.
8. Gera evento de auditoria: `quotation_sent`.

**Diagrama de estados do envio:**

```
[Importada] → Compras revisa → Compras define end_date → Compras envia
                                                            ├─→ Fornecedor com acesso → Enviada (notificação disparada)
                                                            └─→ Fornecedor sem acesso → Não enviada (aguarda liberação)
```

**Exceções:**

- Se nenhum fornecedor tiver acesso ativo, o envio é bloqueado com alerta para `Compras`.

---

### 6.3 Resposta do fornecedor

1. O fornecedor acessa o portal e abre a cotação.
2. O sistema marca `read_at` no `quotation_supplier`. Gera evento de auditoria: `quotation_read`.
3. O fornecedor preenche a resposta com os campos obrigatórios, incluindo data(s) de entrega.
4. O sistema valida que ao menos uma data de entrega está preenchida.
5. O fornecedor submete a resposta.
6. O sistema cria um registro em `quotation_response` com `version = 1`.
7. Cria registros em `quotation_response_item` e `quotation_response_item_delivery`.
8. Atualiza o status do `quotation_supplier` para `awaiting_review`.
9. Gera evento de auditoria: `quotation_response_submitted`.
10. Se o fornecedor editar e reenviar, cria novo `quotation_response` com `version` incrementada.

**Exceções:**

- Se o prazo expirou (`end_date` ultrapassada), a submissão é bloqueada com mensagem de prazo encerrado.
- Se já existe aprovação final de `Compras`, a edição é bloqueada.

---

### 6.4 Aprovação por Compras

1. `Compras` visualiza respostas com `review_status = pending`.
2. `Compras` analisa a resposta mais recente do fornecedor.
3. `Compras` pode:
   - **Aprovar:** `review_status = approved`. Status do `quotation_supplier` muda para `approved`.
   - **Reprovar:** `review_status = rejected`. Status do `quotation_supplier` muda para `rejected`.
   - **Solicitar correção:** `review_status = correction_requested`. Status do `quotation_supplier` muda para `correction_requested`. O fornecedor pode corrigir e reenviar.
4. Registra `reviewed_by`, `reviewed_at` e `review_notes`.
5. Gera evento de auditoria: `quotation_response_approved`, `quotation_response_rejected` ou `quotation_correction_requested`.

---

### 6.5 Integração da resposta aprovada com o Sienge

1. Após aprovação, a resposta é marcada para envio ao Sienge (`integration_status = pending`).
2. O sistema executa a sequência de escrita:
   a. Se necessário, `POST /purchase-quotations/{id}/suppliers/{id}/negotiations` para criar a negociação.
   b. `PUT /purchase-quotations/{id}/suppliers/{id}/negotiations/{n}` para atualizar dados gerais.
   c. Para cada item, `PUT .../negotiations/{n}/items/{itemNumber}` para atualizar itens.
   d. `PATCH .../negotiations/latest/authorize` para autorizar (somente após aprovação de `Compras`).
3. Se sucesso:
   - `integration_status = success`.
   - Status do `quotation_supplier` muda para `integrated`.
   - Resposta fica somente leitura.
   - Gera evento de auditoria: `quotation_integration_success`.
4. Se falha:
   - `integration_status = failed`.
   - Incrementa `integration_attempts`.
   - Registra `last_integration_error`.
   - Tentativa automática após 24h (até 2 retries). _(PRDGlobal §12.2)_
   - Se falha persistir após 3 tentativas, `Compras` é notificado.
   - Status do `quotation_supplier` muda para `awaiting_sienge_send`.
   - Gera evento de auditoria: `quotation_integration_failed`.

**Diagrama de sequência simplificado:**

```
Compras aprova → Sistema monta payload → POST/PUT Sienge
                                            ├─→ Sucesso → PATCH authorize → status = integrated
                                            └─→ Falha → retry automático (até 2x, 24h)
                                                           ├─→ Sucesso → status = integrated
                                                           └─→ Falha persistente → notifica Compras → reprocessamento manual
```

---

### 6.6 Encerramento de cotação

1. Um job periódico verifica cotações com `end_date` ultrapassada.
2. Para cada `quotation_supplier` sem resposta válida:
   - Status muda para `no_response`.
   - `Compras` é notificado.
3. Gera evento de auditoria: `quotation_expired_no_response`.

---

### 6.7 Fechamento por pedido de compra (via webhook)

1. O sistema recebe webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`.
2. Identifica `purchaseQuotationId` e `supplierId`.
3. O fornecedor vencedor muda para `supplier_closed` com `closed_order_id` = `purchaseOrderId`.
4. Os demais fornecedores da mesma cotação mudam para `closed`.
5. Gera evento de auditoria: `quotation_supplier_closed`.

_(PRDGlobal §4.7, §9.3.8)_

---

## 7. Contratos de API / Serviços

### 7.1 Listar cotações (Backoffice)

| Item            | Detalhe                                                                                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Método/Rota** | `GET /api/quotations`                                                                                                                                                                                                        |
| **Entrada**     | `status?`, `supplier_id?`, `start_date?`, `end_date?`, `page`, `per_page`                                                                                                                                                    |
| **Saída**       | Lista de cotações com campos mínimos de listagem (§14.1): `quotation_number`, `supplier_name`, `status`, `start_date`, `end_date`, `read_indicator`, `response_status`, `closed_supplier_indicator`, `purchase_order_number` |
| **Erros**       | `401 Unauthorized`, `403 Forbidden`                                                                                                                                                                                          |
| **Perfis**      | `Compras`, `Administrador`                                                                                                                                                                                                   |

---

### 7.2 Listar cotações (Portal do Fornecedor)

| Item            | Detalhe                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Método/Rota** | `GET /api/supplier/quotations`                                                                                                                                     |
| **Entrada**     | `page`, `per_page`                                                                                                                                                 |
| **Saída**       | Lista de cotações do fornecedor autenticado: `quotation_number`, `status`, `start_date`, `end_date`, `read_indicator`, `response_status`. Ordenação conforme §4.8. |
| **Erros**       | `401 Unauthorized`                                                                                                                                                 |
| **Perfis**      | `Fornecedor`                                                                                                                                                       |

---

### 7.3 Detalhar cotação

| Item            | Detalhe                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| **Método/Rota** | `GET /api/quotations/:quotation_id`                                                  |
| **Entrada**     | `quotation_id` (path)                                                                |
| **Saída**       | Cotação completa com fornecedores, respostas, itens, entregas e histórico de revisão |
| **Erros**       | `401 Unauthorized`, `403 Forbidden`, `404 Not Found`                                 |
| **Perfis**      | `Compras`, `Administrador`, `Fornecedor` (apenas seus próprios dados)                |

---

### 7.4 Marcar cotação como lida

| Item            | Detalhe                                                       |
| --------------- | ------------------------------------------------------------- |
| **Método/Rota** | `POST /api/supplier/quotations/:quotation_id/read`            |
| **Entrada**     | `quotation_id` (path)                                         |
| **Saída**       | `{ read_at: timestamp }`                                      |
| **Erros**       | `401 Unauthorized`, `404 Not Found`, `409 Conflict` (já lida) |
| **Perfis**      | `Fornecedor`                                                  |

---

### 7.5 Enviar cotação ao fornecedor

| Item            | Detalhe                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Método/Rota** | `POST /api/quotations/:quotation_id/send`                                                                                   |
| **Entrada**     | `quotation_id` (path), `end_date` (body, obrigatório se não definida)                                                       |
| **Saída**       | `{ sent_at: timestamp, suppliers_sent: number, suppliers_skipped: number }`                                                 |
| **Erros**       | `401 Unauthorized`, `403 Forbidden`, `409 Conflict` (já enviada), `422 Unprocessable Entity` (nenhum fornecedor com acesso) |
| **Perfis**      | `Compras`                                                                                                                   |

---

### 7.6 Submeter resposta de cotação

| Item            | Detalhe                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Método/Rota** | `POST /api/supplier/quotations/:quotation_id/respond`                                                                            |
| **Entrada**     | Body com campos da resposta (§4.3) e itens com entregas. Cada item deve ter ao menos uma entrega com `delivery_date` preenchida. |
| **Saída**       | `{ response_id, version }`                                                                                                       |
| **Erros**       | `401 Unauthorized`, `403 Forbidden`, `422 Unprocessable Entity` (data de entrega ausente, prazo expirado, já aprovada)           |
| **Perfis**      | `Fornecedor`                                                                                                                     |

---

### 7.7 Aprovar/Reprovar/Solicitar correção

| Item            | Detalhe                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Método/Rota** | `POST /api/quotations/:quotation_id/suppliers/:supplier_id/review`                                       |
| **Entrada**     | `action` (`approve`, `reject`, `request_correction`), `notes?`                                           |
| **Saída**       | `{ review_status, reviewed_at }`                                                                         |
| **Erros**       | `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `422 Unprocessable Entity` (sem resposta pendente) |
| **Perfis**      | `Compras`                                                                                                |

---

### 7.8 Reprocessar integração manualmente

| Item            | Detalhe                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Método/Rota** | `POST /api/quotations/:quotation_id/suppliers/:supplier_id/retry-integration`            |
| **Entrada**     | `quotation_id`, `supplier_id` (path)                                                     |
| **Saída**       | `{ integration_status, attempt_number }`                                                 |
| **Erros**       | `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict` (não está em falha) |
| **Perfis**      | `Compras`                                                                                |

---

### 7.9 Importar cotações do Sienge (Serviço interno)

| Item        | Detalhe                                                  |
| ----------- | -------------------------------------------------------- |
| **Nome**    | `QuotationSyncService.importFromSienge()`                |
| **Tipo**    | Serviço interno / Job (worker)                           |
| **Entrada** | Filtros opcionais `startDate`, `endDate`                 |
| **Saída**   | `{ imported: number, updated: number, errors: Error[] }` |
| **Erros**   | Falha de API do Sienge (registra e agenda retry)         |
| **Perfis**  | Sistema / Worker                                         |

---

### 7.10 Enviar resposta ao Sienge (Serviço interno)

| Item        | Detalhe                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------- |
| **Nome**    | `QuotationIntegrationService.sendToSienge()`                                                    |
| **Tipo**    | Serviço interno                                                                                 |
| **Entrada** | `quotation_response_id`                                                                         |
| **Saída**   | `{ success: boolean, negotiation_number?: number, error?: string }`                             |
| **Erros**   | Falha de API do Sienge, fornecedor inválido no mapa. Em falha, agenda retry automático (§12.2). |
| **Perfis**  | Sistema                                                                                         |

---

## 8. Interface do usuário

### 8.1 Lista de Cotações — Backoffice

| Item                    | Detalhe                                                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                | `QuotationListPage`                                                                                                                                                                                                  |
| **Propósito**           | Exibir todas as cotações importadas com filtros e status operacionais                                                                                                                                                |
| **Campos exibidos**     | Número da cotação, fornecedor, status (com cor operacional), data de início, data de fim, indicação de leitura, situação da resposta, indicação `Fornecedor fechado`, número do pedido de compra _(PRDGlobal §14.1)_ |
| **Ações por perfil**    | `Compras`: enviar cotação, acessar detalhe, filtrar. `Administrador`: visualizar, filtrar.                                                                                                                           |
| **Referências visuais** | Azul Escuro `#324598` para títulos. Azul Médio `#465EBE` para botões. Cores de status conforme §12.5: `Fornecedor inválido` = vermelho, `Aguardando reenvio` = amarelo. Fundo branco `#FFFFFF`.                      |

---

### 8.2 Detalhe da Cotação — Backoffice

| Item                    | Detalhe                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                | `QuotationDetailPage`                                                                                                                                                           |
| **Propósito**           | Exibir detalhes da cotação, fornecedores participantes, respostas e histórico                                                                                                   |
| **Campos exibidos**     | Dados da cotação, lista de fornecedores com status individual, resposta mais recente de cada fornecedor (itens, entregas, valores), histórico de revisões, status de integração |
| **Ações por perfil**    | `Compras`: definir data de término, enviar ao fornecedor, aprovar/reprovar/solicitar correção, reprocessar integração. `Administrador`: visualizar.                             |
| **Referências visuais** | Cards de fornecedor com borda colorida pelo status. Turquesa `#19B4BE` para indicadores de progresso. Azul Claro `#6ED8E0` para fundos secundários.                             |

---

### 8.3 Lista de Cotações — Portal do Fornecedor

| Item                    | Detalhe                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Nome**                | `SupplierQuotationListPage`                                                                                            |
| **Propósito**           | Exibir as cotações destinadas ao fornecedor autenticado                                                                |
| **Campos exibidos**     | Número da cotação, status, data de início, data de fim, indicação de leitura, situação da resposta _(PRDGlobal §14.1)_ |
| **Ordenação**           | Conforme RN-26: abertas pendentes > correção solicitada > em revisão > encerradas _(PRDGlobal §4.8)_                   |
| **Ações por perfil**    | `Fornecedor`: abrir cotação, responder, consultar histórico.                                                           |
| **Referências visuais** | Branding GRF com logo `src/assets/GRFlogo.png`. Paleta institucional.                                                  |

---

### 8.4 Formulário de Resposta — Portal do Fornecedor

| Item                    | Detalhe                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                | `SupplierQuotationResponseForm`                                                                                                                                |
| **Propósito**           | Permitir ao fornecedor preencher e submeter a resposta de cotação                                                                                              |
| **Campos exibidos**     | Dados da cotação (somente leitura), itens com quantidade cotada, campos editáveis: preço unitário, descontos, impostos, frete, data(s) de entrega, observações |
| **Ações por perfil**    | `Fornecedor`: preencher, salvar rascunho, submeter, editar e reenviar (se permitido).                                                                          |
| **Validações**          | Data de entrega obrigatória por item. Campos numéricos com máscara e validação de tipo.                                                                        |
| **Referências visuais** | Botão de submissão em Azul Médio `#465EBE`. Alertas de validação com fundo vermelho claro. Campos obrigatórios com indicador visual.                           |

---

### 8.5 Painel de Revisão — Backoffice

| Item                    | Detalhe                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Nome**                | `QuotationReviewPanel`                                                                   |
| **Propósito**           | Permitir a `Compras` revisar, aprovar, reprovar ou solicitar correção                    |
| **Campos exibidos**     | Comparativo entre dados do Sienge e resposta do fornecedor, itens, entregas, observações |
| **Ações por perfil**    | `Compras`: aprovar, reprovar, solicitar correção com observações.                        |
| **Referências visuais** | Botão aprovar em verde. Botão reprovar em vermelho. Botão correção em laranja.           |

---

## 9. Integrações e dependências externas

### 9.1 Leitura de cotações do Sienge

| Item                | Detalhe                                                                                                                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Endpoint**        | `GET /purchase-quotations/all/negotiations` _(PRDGlobal §9.3.1)_                                                                                                                                                                                                                               |
| **Uso**             | Importação periódica de cotações                                                                                                                                                                                                                                                               |
| **Campos tratados** | `purchaseQuotationId`, `buyerId`, `consistent`, `status`, `quotationDate`, `responseDate`, `suppliers[].supplierId`, `suppliers[].supplierName`, `suppliers[].latestNegotiation[].negotiationId`, `suppliers[].latestNegotiation[].responseDate`, `suppliers[].latestNegotiation[].authorized` |
| **Filtros**         | `startDate`, `endDate`, `status`, `limit`, `offset`                                                                                                                                                                                                                                            |
| **Observação**      | API não expõe e-mail do fornecedor neste endpoint — e-mail buscado via `GET /creditors/{creditorId}` (PRD 07).                                                                                                                                                                                 |

### 9.2 Escrita da resposta no Sienge

| Item               | Detalhe                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Endpoints**      | `POST /purchase-quotations/{id}/suppliers/{id}/negotiations`, `PUT .../negotiations/{n}`, `PUT .../negotiations/{n}/items/{item}`, `PATCH .../negotiations/latest/authorize` _(PRDGlobal §9.3.7)_ |
| **Uso**            | Envio da resposta aprovada por `Compras`                                                                                                                                                          |
| **Pré-condição**   | Aprovação manual de `Compras` obrigatória antes de qualquer escrita.                                                                                                                              |
| **Campos do body** | Conforme §9.3.7 do PRDGlobal (ver detalhes na seção).                                                                                                                                             |

### 9.3 Webhook de pedido gerado

| Item           | Detalhe                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Webhook**    | `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` _(PRDGlobal §9.3.8)_                                                                          |
| **Uso**        | Fechamento automático da cotação ao gerar pedido                                                                                          |
| **Campos**     | `purchaseOrderId`, `purchaseQuotationId`, `supplierId`, `negotiationNumber`, `authorized`                                                 |
| **Tratamento** | Marcar fornecedor vencedor como `supplier_closed`, demais como `closed`. Após webhook, reconsultar API REST para reconciliação detalhada. |

### 9.4 Webhook de autorização de negociação

| Item           | Detalhe                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| **Webhook**    | `PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED` _(PRDGlobal §9.3.8)_                   |
| **Uso**        | Sincronização incremental de status de autorização                                            |
| **Campos**     | `purchaseQuotationId`, `supplierId`, `negotiationId`, `authorized`, `consistent`, `changedAt` |
| **Tratamento** | Atualizar status local e reconsultar API REST.                                                |

### 9.5 Tratamento de falhas

- Falha de integração: registrar, programar retry automático (até 2 retries, intervalo 24h). _(PRDGlobal §12.2)_
- Falha persistente: notificar `Compras`, permitir reprocessamento manual sem limite. _(PRDGlobal §12.2)_
- Status visuais: `Pendente de integração` → amarelo, `Integrado com sucesso` → verde, `Falha de integração` → vermelho. _(PRDGlobal §12.1)_

### 9.6 Dependência de outros módulos

| Módulo                           | Dependência                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| PRD 01 — Autenticação e Perfis   | Verificação de acesso ativo do fornecedor, RBAC, identificação do usuário autenticado |
| PRD 07 — Integração com o Sienge | Clientes HTTP, autenticação `Basic`, paginação, rate limiting, parser de contratos    |

---

## 10. Auditoria e rastreabilidade

Eventos auditáveis gerados por este módulo, conforme §12.6 do PRDGlobal:

| Evento                           | Descrição                                  | Dados mínimos                                                                                 |
| -------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `quotation_imported`             | Cotação importada do Sienge                | data/hora, `sienge_quotation_id`, quantidade de fornecedores                                  |
| `quotation_sent`                 | Cotação enviada ao(s) fornecedor(es)       | data/hora, `quotation_id`, usuário (`Compras`), fornecedores enviados, fornecedores ignorados |
| `quotation_read`                 | Fornecedor abriu a cotação no portal       | data/hora, `quotation_id`, `supplier_id`, `user_id`                                           |
| `quotation_response_submitted`   | Fornecedor submeteu resposta               | data/hora, `quotation_id`, `supplier_id`, `version`                                           |
| `quotation_response_approved`    | `Compras` aprovou a resposta               | data/hora, `quotation_id`, `supplier_id`, `reviewed_by`, `notes`                              |
| `quotation_response_rejected`    | `Compras` reprovou a resposta              | data/hora, `quotation_id`, `supplier_id`, `reviewed_by`, `notes`                              |
| `quotation_correction_requested` | `Compras` solicitou correção ao fornecedor | data/hora, `quotation_id`, `supplier_id`, `reviewed_by`, `notes`                              |
| `quotation_integration_success`  | Resposta integrada ao Sienge com sucesso   | data/hora, `quotation_id`, `supplier_id`, `negotiation_number`                                |
| `quotation_integration_failed`   | Falha na integração com o Sienge           | data/hora, `quotation_id`, `supplier_id`, `attempt_number`, `error_message`                   |
| `quotation_expired_no_response`  | Cotação venceu sem resposta do fornecedor  | data/hora, `quotation_id`, `supplier_id`                                                      |
| `quotation_supplier_closed`      | Fornecedor fechado (pedido gerado)         | data/hora, `quotation_id`, `supplier_id`, `purchase_order_id`                                 |

Cada evento deve exibir no mínimo: data e hora, tipo do evento, usuário ou origem, cotação afetada, fornecedor afetado (quando houver), resumo da ação. _(PRDGlobal §12.6)_

---

## 11. Validações pendentes de homologação

Os seguintes itens da §17 do PRDGlobal se aplicam diretamente a este módulo:

| #   | Item de homologação                                                  | Impacto neste módulo                                                   |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Validar se `supplierId` corresponde a `creditorId`                   | Essencial para vincular fornecedor da cotação ao cadastro de credores  |
| 5   | Validar existência do fornecedor no mapa de cotação antes da escrita | Obrigatório antes de qualquer `POST`/`PUT` de negociação no Sienge     |
| 6   | Validar comportamento de criação/atualização de negociação           | Definir se `POST` de negociação é obrigatório antes do `PUT` dos itens |
| 7   | Validar cenários com múltiplas cotações em `purchaseQuotations[]`    | Impacta a reconciliação do fechamento por pedido                       |

---

## 12. Critérios de aceite

- [ ] O sistema importa cotações do Sienge e persiste localmente com todos os campos mínimos.
- [ ] `Compras` consegue revisar e enviar cotações apenas para fornecedores com acesso ativo.
- [ ] A data de término é definida por `Compras` e torna-se imutável após o envio.
- [ ] O fornecedor visualiza apenas suas próprias cotações, ordenadas conforme §4.8.
- [ ] A cotação é marcada como lida somente quando o fornecedor abre a cotação (não por login).
- [ ] O fornecedor consegue responder a cotação com data de entrega obrigatória.
- [ ] A resposta é bloqueada se o prazo expirou ou se já existe aprovação final.
- [ ] O fornecedor pode editar e reenviar enquanto prazo aberto e sem aprovação final.
- [ ] `Compras` pode aprovar, reprovar ou solicitar correção individualmente por fornecedor.
- [ ] Após aprovação e integração com o Sienge, a resposta fica somente para consulta.
- [ ] A integração com o Sienge segue a sequência correta: POST/PUT negociação → PUT itens → PATCH authorize.
- [ ] Falhas de integração geram até 2 retries automáticos com intervalo de 24h.
- [ ] Após falha persistente, `Compras` é notificado e pode acionar reprocessamento manual.
- [ ] Cotações vencidas sem resposta ficam com status `Sem resposta` e `Compras` é notificado.
- [ ] Quando pedido é gerado no Sienge (webhook), o fornecedor vencedor fica como `Fornecedor fechado` e os demais como `Encerrado`.
- [ ] Fornecedor removido do mapa do Sienge recebe status `Fornecedor inválido no mapa de cotação` com destaque vermelho.
- [ ] Todos os eventos listados na seção 10 geram registro auditável com campos mínimos.
- [ ] A listagem do backoffice exibe os campos mínimos definidos em §14.1.
- [ ] A listagem do portal do fornecedor exibe os campos mínimos definidos em §14.1.
- [ ] Os identificadores `purchaseQuotationId`, `supplierId`, `negotiationId`/`negotiationNumber` são persistidos. _(PRDGlobal §10)_
- [ ] Fornecedor bloqueado tem notificações e operação interrompidas imediatamente.

---

## 13. Fases de implementação sugeridas

### Fase 1 — Fundação e importação

1. Criação das tabelas/entidades do módulo de cotação.
2. Serviço de importação de cotações do Sienge (`QuotationSyncService`).
3. Listagem básica de cotações no backoffice.

### Fase 2 — Envio e portal do fornecedor

4. Envio de cotação ao fornecedor por `Compras`.
5. Listagem de cotações no portal do fornecedor com ordenação operacional.
6. Marcação de leitura da cotação.

### Fase 3 — Resposta e revisão

7. Formulário de resposta de cotação do fornecedor.
8. Validação de data de entrega obrigatória.
9. Edição e reenvio de resposta.
10. Painel de revisão para `Compras` (aprovar/reprovar/correção).

### Fase 4 — Integração e encerramento

11. Serviço de envio da resposta aprovada ao Sienge (`QuotationIntegrationService`).
12. Retries automáticos e reprocessamento manual.
13. Tratamento de webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` para fechamento.
14. Encerramento automático de cotações vencidas.

### Fase 5 — Polimento e auditoria

15. Registro de todos os eventos de auditoria.
16. Tratamento de `Fornecedor inválido no mapa de cotação`.
17. Testes automatizados dos fluxos críticos.

---

## 14. Riscos específicos do módulo

| Risco                                                                                                 | Probabilidade | Impacto | Mitigação                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| Comportamento do Sienge na criação de negociação pode divergir do contrato público                    | Média         | Alto    | Implementar fluxo defensivo que tenta `POST` se `PUT` falhar. Validar em homologação (§17 item 6).                     |
| Webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` pode não estar disponível no ambiente do cliente  | Média         | Alto    | Implementar reconciliação por polling como fallback. Tratar ausência como bloqueio de homologação (PRDGlobal §9.8).    |
| Fornecedor removido do mapa após envio da cotação                                                     | Baixa         | Médio   | Verificar existência no mapa antes de qualquer escrita. Sinalizar com status vermelho e exigir aprovação de `Compras`. |
| Taxa de resposta baixa por inabilidade do fornecedor com o portal                                     | Média         | Médio   | UX simplificada no formulário de resposta. Depende também do módulo de notificações (PRD 03) para engajamento.         |
| Volume alto de cotações simultâneas pode sobrecarregar rate limit do Sienge (200/min REST)            | Baixa         | Médio   | Implementar fila com controle de vazão no worker de integração. Respeitar limites publicados.                          |
| Múltiplas cotações em `purchaseQuotations[]` por item de pedido podem gerar ambiguidade no fechamento | Média         | Médio   | Não assumir unicidade. Implementar lógica defensiva e validar em homologação (§17 item 7).                             |
