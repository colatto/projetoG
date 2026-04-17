# Homologação Sienge - Pendências de Validação

Este documento compõe as funcionalidades de integração com o Sienge (baseadas no PRD-07 §17) que não podem ser garantidas apenas em ambiente isolado (sandbox local) e requerem validação conjunta com o ambiente real do cliente/Sienge.

Esta é uma documentação viva para guiar as sessões de testes integrados e assegurar o _go-live_.

## 17.1 Correspondência de Identificadores de Fornecedor

- **Identificação**: Validação do vínculo entre APIs de compras e credores.
- **Ambiente Real**: Base de dados populada do cliente no Sienge.
- **Critérios**: Confirmar se o campo `supplierId` retornado na API de Cotação mapeia exatamente (1:1) com o `creditorId` da API de Credores.
- **Responsáveis**: Equipe de Engenharia Local + Cliente.
- **Prazo Estimado**: 2 dias.

## 17.2 Validação de E-mail de Contato

- **Identificação**: Consistência da regra de captação de e-mail do fornecedor (RN-05).
- **Ambiente Real**: Cadastros reais de credores no Sienge do cliente.
- **Critérios**: Confirmar se utilizar o primeiro e-mail válido no array `contacts[].email` reflete corretamente o contato operacional de compras do fornecedor no dia a dia.
- **Responsáveis**: Cliente (Setor de Compras).
- **Prazo Estimado**: 3 dias.

## 17.3 Webhook de Geração de Pedido

- **Identificação**: Validação do evento `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`.
- **Ambiente Real**: Ambiente de teste conectado ao Sienge do cliente.
- **Critérios**: O Sienge deve disparar o webhook corretamente ao gerar um pedido; a aplicação deve receber e vincular o pedido à cotação com sucesso. A ausência deste webhook bloqueia o go-live.
- **Responsáveis**: Equipe de Engenharia Local + Suporte Sienge.
- **Prazo Estimado**: 5 dias.

## 17.4 Webhook de Autorização de Negociação

- **Identificação**: Evento `PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED`.
- **Ambiente Real**: Ambiente de teste conectado ao Sienge do cliente.
- **Critérios**: O webhook deve ser recebido sempre que o status de autorização de uma negociação mudar, acionando a reconsulta dos dados pela aplicação.
- **Responsáveis**: Equipe de Engenharia Local.
- **Prazo Estimado**: 2 dias.

## 17.5 Consistência do Mapa de Cotação

- **Identificação**: Validação da regra RN-10 (Fornecedor removido do mapa).
- **Ambiente Real**: Sienge do cliente (interface de mapa de cotações).
- **Critérios**: Ao tentar responder uma cotação para um fornecedor excluído manualmente do mapa no Sienge, o sistema não deve criar a negociação e deve exibir o alerta vermelho esperado para a equipe de Compras.
- **Responsáveis**: Equipe de Engenharia Local + Cliente.
- **Prazo Estimado**: 2 dias.

## 17.6 Comportamento de Criação/Atualização de Negociação

- **Identificação**: Ordem das chamadas de escrita de cotação.
- **Ambiente Real**: Sienge (API de escrita).
- **Critérios**: Confirmar se o fluxo sequencial (`POST` negociação → `PUT` negociação → `PUT` itens → `PATCH` authorize) funciona sem erros de concorrência ou bloqueios lógicos por parte do ERP.
- **Responsáveis**: Equipe de Engenharia Local.
- **Prazo Estimado**: 3 dias.

## 17.7 Estrutura de Múltiplas Cotações

- **Identificação**: Retorno do array `purchaseQuotations[]` em webhooks.
- **Ambiente Real**: Cenários reais de compras do cliente.
- **Critérios**: Validar se o sistema consegue processar adequadamente o payload quando um único pedido consolida itens oriundos de cotações distintas.
- **Responsáveis**: Equipe de Engenharia Local + Cliente.
- **Prazo Estimado**: 3 dias.

## 17.8 Cobertura de Cenários de Entrega

- **Identificação**: Leitura via `GET /purchase-invoices/deliveries-attended`.
- **Ambiente Real**: Fluxo logístico real faturado.
- **Critérios**: Garantir que este endpoint retorna todos os cenários possíveis de notas fiscais vinculadas a pedidos, permitindo o mapeamento retroativo: Nota → Pedido → Cotação.
- **Responsáveis**: Equipe de Engenharia Local + Cliente (Recebimento).
- **Prazo Estimado**: 5 dias.

## 17.9 Variações de Tipo em Quantidades Abertas

- **Identificação**: Retorno do campo `openQuantity` na API de delivery-requirements.
- **Ambiente Real**: API Sienge.
- **Critérios**: Identificar se o campo retorna estritamente numérico ou se pode apresentar strings formatadas em cenários específicos, validando a resiliência do parser desenvolvido.
- **Responsáveis**: Equipe de Engenharia Local.
- **Prazo Estimado**: 2 dias.
