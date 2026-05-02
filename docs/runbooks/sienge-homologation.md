# Homologação Sienge - Pendências de Validação

Este documento compõe as funcionalidades de integração com o Sienge (baseadas no PRD-07 §17) que não podem ser garantidas apenas em ambiente isolado (sandbox local) e requerem validação conjunta com o ambiente real do cliente/Sienge.

Esta é uma documentação viva para guiar as sessões de testes integrados e assegurar o _go-live_.

**Scripts somente leitura:** ficam em `packages/integration-sienge/src/__tests__/*.integration.ts`. Execução típica a partir da **raiz do monorepo**:

```bash
pnpm --filter @projetog/integration-sienge exec tsx src/__tests__/<nome>.integration.ts
```

Credenciais: carregar `apps/api/.env` e/ou `workers/.env` (Sienge + Supabase service role onde aplicável).

---

## 17.1 Correspondência de Identificadores de Fornecedor

- **Identificação**: Validação do vínculo entre APIs de compras e credores.
- **Ambiente Real**: Base de dados populada do cliente no Sienge.
- **Critérios**: Confirmar se o campo `supplierId` retornado na API de Cotação mapeia exatamente (1:1) com o `creditorId` da API de Credores.

- **Status (2026-04-17):** Validado.
- **Evidência:** `pnpm --filter @projetog/integration-sienge exec tsx src/__tests__/supplier-mapping.integration.ts` — `40/40` fornecedores resolvidos e correspondência nominal exata.
- **Próximo passo:** Repetir amostragem após mudanças cadastrais relevantes no Sienge — Engenharia + Cliente.

- **Responsáveis**: Equipe de Engenharia Local + Cliente.
- **Prazo Estimado**: 2 dias.

---

## 17.2 Validação de E-mail de Contato

- **Identificação**: Consistência da regra de captação de e-mail do fornecedor (RN-05).
- **Ambiente Real**: Cadastros reais de credores no Sienge do cliente.
- **Critérios**: Confirmar se utilizar o primeiro e-mail válido no array `contacts[].email` reflete corretamente o contato operacional de compras do fornecedor no dia a dia.

- **Status (2026-04-17):** Validado parcialmente.
- **Evidência:** Mesmo script de §17.1 — `35/40` com e-mail em `contacts[]`; `5/40` sem e-mail (bloqueáveis pela RN-05). Aguardar confirmação formal de Compras sobre “primeiro e-mail = contato operacional”.
- **Próximo passo:** Validação declarativa com Compras — Cliente.

- **Responsáveis**: Cliente (Setor de Compras).
- **Prazo Estimado**: 3 dias.

---

## 17.3 Webhook de Geração de Pedido

- **Identificação**: Validação do evento `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`.
- **Ambiente Real**: Ambiente de teste conectado ao Sienge do cliente.
- **Critérios**: O Sienge deve disparar o webhook corretamente ao gerar um pedido; a aplicação deve receber e vincular o pedido à cotação com sucesso. A ausência deste webhook bloqueia o go-live.

- **Status (2026-05-02):** Pendente cliente/Sienge para **disparo pontual**; instrumentação readonly disponível.
- **Evidência (readonly):** `webhook-history.integration.ts` — consulta `webhook_events` (últimos 30 dias), totais e última `created_at` por `webhook_type`. Saída depende do volume real recebido no projeto Supabase — executar no ambiente com dados e anexar stdout aqui.
- **Próximo passo:** Sessão conjunta Cliente + Sienge para gerar pedido de teste e confirmar entrega do webhook + processamento — Engenharia Local.

- **Responsáveis**: Equipe de Engenharia Local + Suporte Sienge.
- **Prazo Estimado**: 5 dias.

---

## 17.4 Webhook de Autorização de Negociação

- **Identificação**: Evento `PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED`.
- **Ambiente Real**: Ambiente de teste conectado ao Sienge do cliente.
- **Critérios**: O webhook deve ser recebido sempre que o status de autorização de uma negociação mudar, acionando a reconsulta dos dados pela aplicação.

- **Status (2026-05-02):** Pendente cliente/Sienge para disparo pontual; instrumentação readonly disponível.
- **Evidência (readonly):** Mesmo script `webhook-history.integration.ts` (segundo tipo na lista). Anexar stdout após execução no ambiente real.
- **Próximo passo:** Alterar autorização de negociação em ambiente de homologação Sienge e validar linha em `webhook_events` + `integration_events` — Engenharia Local.

- **Responsáveis**: Equipe de Engenharia Local.
- **Prazo Estimado**: 2 dias.

---

## 17.5 Consistência do Mapa de Cotação

- **Identificação**: Validação da regra RN-10 (Fornecedor removido do mapa).
- **Ambiente Real**: Sienge do cliente (interface de mapa de cotações).
- **Critérios**: Ao tentar responder uma cotação para um fornecedor excluído manualmente do mapa no Sienge, o sistema não deve criar a negociação e deve exibir o alerta vermelho esperado para a equipe de Compras.

- **Status (2026-05-02):** Parcial — leitura API readonly; fluxo de UI/bloqueio outbound permanece validação conjunta.
- **Evidência (readonly):** `quotation-map-supplier.integration.ts` com `HOMOLOG_QUOTATION_ID` e `HOMOLOG_SUPPLIER_ID` — confirma `presente | ausente` em `GET /purchase-quotations/all/negotiations`.
- **Próximo passo:** Caso de exclusão manual no mapa + tentativa de resposta (§17.6 complementar para escrita) — Cliente + Engenharia.

- **Responsáveis**: Equipe de Engenharia Local + Cliente.
- **Prazo Estimado**: 2 dias.

---

## 17.6 Comportamento de Criação/Atualização de Negociação

- **Identificação**: Ordem das chamadas de escrita de cotação.
- **Ambiente Real**: Sienge (API de escrita).
- **Critérios**: Confirmar se o fluxo sequencial (`POST` negociação → `PUT` negociação → `PUT` itens → `PATCH` authorize) funciona sem erros de concorrência ou bloqueios lógicos por parte do ERP.

- **Status (2026-05-02):** Pendente cliente — **não há script readonly** (mutação real).
- **Evidência:** Executar fluxo aprovado por Compras em ambiente de homologação; registrar IDs de cotação/fornecedor e resultado HTTP por etapa.
- **Próximo passo:** Janela de testes com Compras após §17.5 — Engenharia.

- **Responsáveis**: Equipe de Engenharia Local.
- **Prazo Estimado**: 3 dias.

---

## 17.7 Estrutura de Múltiplas Cotações

- **Identificação**: Retorno do array `purchaseQuotations[]` em pedidos.
- **Ambiente Real**: Cenários reais de compras do cliente.
- **Critérios**: Validar se o sistema consegue processar adequadamente o payload quando um único pedido consolida itens oriundos de cotações distintas.

- **Status (2026-05-02):** Instrumentação readonly disponível; interpretação operacional depende da amostra.
- **Evidência (readonly):** `multi-quotation-orders.integration.ts` — amostra pedidos recentes via `OrderClient.list`, distribuição `1 cotação` vs `>1` em `purchaseQuotations.length`. Anexar stdout.
- **Próximo passo:** Se amostra não mostrar `>1`, solicitar ao cliente caso real ou dados de teste Sienge — Engenharia.

- **Responsáveis**: Equipe de Engenharia Local + Cliente.
- **Prazo Estimado**: 3 dias.

---

## 17.8 Cobertura de Cenários de Entrega

- **Identificação**: Leitura via `GET /purchase-invoices/deliveries-attended`.
- **Ambiente Real**: Fluxo logístico real faturado.
- **Critérios**: Garantir que este endpoint retorna todos os cenários possíveis de notas fiscais vinculadas a pedidos, permitindo o mapeamento retroativo: Nota → Pedido → Cotação.

- **Status (2026-05-02):** Instrumentação readonly disponível.
- **Evidência (readonly):** `deliveries-attended-coverage.integration.ts` — confronta entregas Sienge (janela configurável no script) com linhas em `deliveries` no Supabase; reporta cobertos/órfãos. Requer `SUPABASE_*` + Sienge.
- **Próximo passo:** Revisar órfãos com equipe de recebimento — Cliente.

- **Responsáveis**: Equipe de Engenharia Local + Cliente (Recebimento).
- **Prazo Estimado**: 5 dias.

---

## 17.9 Variações de Tipo em Quantidades Abertas

- **Identificação**: Retorno do campo `openQuantity` na API de delivery-requirements.
- **Ambiente Real**: API Sienge.
- **Critérios**: Identificar se o campo retorna estritamente numérico ou se pode apresentar strings formatadas em cenários específicos, validando a resiliência do parser desenvolvido.

- **Status (2026-05-02):** Instrumentação readonly disponível.
- **Evidência (readonly):** `delivery-requirements-types.integration.ts` com `HOMOLOG_DELIVERY_REQ_SAMPLES="purchaseRequestId:itemNumber,..."` — classifica `typeof openQuantity` por amostra. Anexar stdout.
- **Próximo passo:** Ampliar amostras com itens de obras críticas — Engenharia.

- **Responsáveis**: Equipe de Engenharia Local.
- **Prazo Estimado**: 2 dias.
