# PRD Global

O objetivo deste PRD é eliminar ambiguidades, manter apenas uma linha mestra de produto e deixar explícitas as validações técnicas que ainda dependem de homologação com o Sienge.

Este documento concentra o contrato mínimo de implementação necessário para frontend, backend, integrações, dashboard e homologação.

## 1. Visão Geral do Produto

### 1.1 Problema a ser resolvido

A GRF opera o processo de suprimentos com baixa automação fora do ERP Sienge, concentrando atividades críticas em canais manuais e fragmentados, como e-mail e WhatsApp. Isso gera:

- retrabalho na digitação e validação de cotações;
- follow-up reativo de pedidos;
- baixa rastreabilidade de respostas, alterações e exceções;
- pouca visibilidade sobre atrasos, entregas parciais e avarias;
- baixa qualidade analítica para gestão de fornecedores, obras e compras.

### 1.2 Solução proposta

Construir uma aplicação web integrada ao Sienge para automação do fluxo de cotação e follow-up logístico, composta por:

- portal do fornecedor para recebimento e resposta de cotações, acompanhamento de pedidos, confirmação de prazo, sugestão de nova data e registro de avarias;
- backoffice interno para revisão operacional, aprovação manual, tratamento de exceções, auditoria, monitoramento de integrações e consulta gerencial;
- camada de integração com o Sienge para leitura de cotações, fornecedores, pedidos, notas fiscais e escrita controlada das respostas aprovadas;
- motor de workflow para follow-up automatizado, réguas de cobrança, reprocessamentos e status operacionais.

### 1.3 Objetivos de negócio

- reduzir o tempo operacional de cotação para menos de 1 dia;
- reduzir o esforço manual de follow-up em 80%;
- reduzir o lead time médio do processo em 20%;
- elevar a taxa de resposta de fornecedores para acima de 90% dentro do prazo;
- reduzir a taxa de atrasos para abaixo de 10%;
- automatizar mais de 70% das etapas operacionais do fluxo;
- economizar mais de 40 horas por mês da equipe de suprimentos;
- manter disponibilidade mínima de 99,5% e alta confiabilidade de integração.

### 1.4 Princípios do produto

- O `Sienge` é a fonte principal de verdade para os dados operacionais mestres.
- O sistema local mantém apenas exceções operacionais e de controle que não devem voltar ao ERP.
- Nenhuma resposta de cotação volta ao Sienge sem aprovação manual de `Compras`.
- Nenhuma decisão operacional local deve sobrescrever dados mestres do Sienge.
- A V1.0 prioriza aderência operacional, rastreabilidade e integração confiável, mesmo que algumas simplificações de modelagem sejam necessárias.

## 2. Escopo por Release

### 2.1 Versão 1.0

A `Versão 1.0` inclui todo o escopo funcional atualmente aprovado:

- portal do fornecedor;
- backoffice interno;
- fluxo de cotação;
- follow-up logístico;
- gestão de avarias;
- dashboards e indicadores;
- autenticação e perfis;
- auditoria operacional;
- integração com Sienge;
- notificação de nova cotação por e-mail.

### 2.2 Versão 2.0

Fica explicitamente para a `Versão 2.0`:

- notificação de nova cotação por WhatsApp.

### 2.3 Fora de escopo da V1.0

- alteração automática da data planejada no Sienge a partir da data sugerida pelo fornecedor;
- auto cadastro de fornecedor;
- ativação autônoma de credenciais sem ação do `Administrador`;
- envio de anexos, comprovantes ou documentos pelo fornecedor;
- exposição de propostas concorrentes entre fornecedores;
- automações financeiras, fiscais ou contábeis além do uso logístico de nota fiscal;
- régua separada por parcela de entrega do mesmo item;
- políticas avançadas de segurança além do mínimo operacional definido para a V1.0.

## 3. Perfis Oficiais e Permissões

### 3.1 Perfis do sistema

Os perfis oficiais são:

- `Fornecedor`
- `Compras`
- `Administrador`
- `Visualizador de Pedidos`

### 3.2 Responsabilidades por perfil

`Fornecedor`

- acessa apenas os próprios dados;
- responde cotações;
- informa data de entrega;
- confirma entrega no prazo ou sugere nova data;
- registra avaria;
- sugere ação corretiva de avaria;
- consulta histórico próprio.

`Compras`

- revisa dados vindos do Sienge antes do envio ao fornecedor;
- revisa respostas dos fornecedores antes do retorno ao Sienge;
- aprova ou reprova respostas de cotação;
- aprova ou reprova nova data prometida;
- valida entrega identificada por integração;
- trata divergências, atrasos, avarias e falhas de integração;
- acompanha dashboards e operação.

`Administrador`

- cria, edita, bloqueia, reativa e remove usuários internos;
- cria acesso, bloqueia, reativa e redefine acesso de fornecedor;
- altera o e-mail local do fornecedor no sistema;
- parametriza workflow e regras do sistema;
- edita templates de notificação dentro dos limites aprovados;
- monitora operação, integrações e governança.

`Visualizador de Pedidos`

- consulta pedidos e entregas;
- não altera dados;
- não acessa dashboards, indicadores, parametrizações ou ações operacionais.

### 3.3 Regras de permissão obrigatórias

- Apenas `Administrador` pode gerir acessos internos e de fornecedores.
- Apenas `Administrador` pode parametrizar workflow e regras.
- Apenas `Compras` aprova respostas de cotação para retorno ao Sienge.
- Apenas `Compras` aprova nova data prometida.
- Apenas `Compras` define a ação corretiva final de uma avaria.
- O `Fornecedor` nunca aprova a própria resposta nem a própria sugestão de nova data.

## 4. Fluxo Funcional de Cotação

### 4.1 Entrada e preparação

- O sistema deve importar cotações do Sienge por `GET /purchase-quotations/all/negotiations`.
- `Compras` revisa os dados importados antes do envio ao fornecedor.
- Cada cotação deve ter data de início e data de fim visíveis ao fornecedor.
- A data de término da cotação é definida por `Compras`.
- Depois que a cotação é enviada, a data de término não pode mais ser alterada.

### 4.2 Envio ao fornecedor

- A cotação só deve ser enviada para fornecedores com acesso já liberado no portal.
- Em cotações com múltiplos fornecedores, o envio ocorre apenas para quem já tiver acesso ativo.
- Se o fornecedor existir no Sienge, mas ainda não tiver acesso liberado no portal, o sistema não deve enviar notificação de cotação nem follow-up para esse fornecedor.
- Se o acesso de um fornecedor for liberado depois do envio inicial, a cotação só poderá ser enviada a ele se o prazo ainda estiver aberto.
- Nesse envio tardio, a data final continua sendo a data original da cotação, sem prazo individual.
- Se o fornecedor estiver bloqueado, o sistema interrompe imediatamente notificações e operação no portal.

### 4.3 Resposta do fornecedor

- O fornecedor responde a cotação pelo portal.
- A resposta deve conter os campos obrigatórios definidos para a operação, incluindo data de entrega.
- O sistema não aceita envio de resposta sem data de entrega preenchida.
- O fornecedor pode editar e reenviar a cotação enquanto:
  - o prazo estiver aberto; e
  - ainda não houver aprovação final de `Compras`.
- Se `Compras` reprovar a resposta para ajuste, o fornecedor recebe o mesmo link da cotação e pode corrigir e reenviar enquanto o prazo estiver aberto.
- Após aprovação de `Compras` e envio ao Sienge, a resposta deixa de ser editável e permanece apenas para consulta.

### 4.4 Aprovação, reprovação e integração

- Toda resposta do fornecedor deve passar por aprovação manual de `Compras`.
- Em cotações com múltiplos fornecedores, `Compras` pode aprovar respostas individualmente.
- Qualquer envio ou reenvio ao Sienge depende de aprovação prévia de `Compras`.
- Se houver falha de integração após aprovação, o sistema deve manter a resposta com status pendente e permitir novo reenvio controlado.

### 4.5 Regra de leitura

- A cotação só é considerada `lida` quando o fornecedor abre a cotação específica no portal.
- Fazer login no portal, sem abrir a cotação, não marca leitura.

### 4.6 Status operacionais de cotação

Os principais status e sinalizações de cotação são:

- `Em negociação`
- `Aguardando revisão de Compras`
- `Aprovada por Compras`
- `Reprovada por Compras`
- `Correção solicitada`
- `Aguardando reenvio ao Sienge`
- `Integrada ao Sienge`
- `Sem resposta`
- `Fornecedor inválido no mapa de cotação`
- `Fornecedor fechado`
- `Encerrado`

### 4.7 Regras de encerramento

- Após a data de término, o sistema não aceita novas respostas nem reenvios.
- Se a cotação vencer sem resposta válida de um fornecedor, o status desse fornecedor é `Sem resposta`.
- Quando houver `Sem resposta`, `Compras` deve ser notificado.
- A ausência de resposta de um fornecedor não bloqueia o andamento da cotação com os demais.
- Cotações com `Sem resposta` permanecem consultáveis no portal, mas sem edição.
- Quando um pedido de compra é gerado no Sienge a partir da cotação, o fornecedor vencedor deve aparecer como `Fornecedor fechado` com nome do fornecedor e número do pedido.
- Os demais fornecedores da mesma cotação devem aparecer como `Encerrado`.

### 4.8 Ordenação operacional no portal do fornecedor

Na lista de cotações do portal do fornecedor, a ordenação deve priorizar:

- cotações abertas e pendentes de ação;
- depois cotações com `Correção solicitada`;
- depois cotações em revisão;
- por último cotações encerradas, integradas ou sem resposta.

## 5. Notificações de Cotação

### 5.1 Canal por versão

- Na `Versão 1.0`, a notificação de nova cotação é somente por e-mail.
- Na `Versão 2.0`, será adicionada a notificação de nova cotação por WhatsApp.

### 5.2 Conteúdo obrigatório

O e-mail de nova cotação deve conter obrigatoriamente:

- nome;
- número da cotação;
- data de início;
- data de fim.

### 5.3 Template

- O `Administrador` pode editar apenas o conteúdo editável do template.
- Os campos obrigatórios não podem ser removidos nem alterados estruturalmente.

### 5.4 Regras complementares de template

- Os campos obrigatórios `nome`, `número da cotação`, `data de início` e `data de fim` não podem ser removidos nem alterados no template.
- O conteúdo das notificações de follow-up também pode ser editado pelo `Administrador`, respeitando a estrutura operacional aprovada.

## 6. Workflow de Follow-up Logístico

### 6.1 Início do follow-up

- O follow-up começa quando o pedido de compra chega do Sienge.
- O marco inicial do cálculo é a `Data do Pedido no Sienge`.
- O prazo é calculado entre a `Data do Pedido no Sienge` e a `Data Prometida` vigente.
- O cálculo usa apenas dias úteis.
- Para dias úteis, o sistema considera apenas feriados nacionais.

### 6.2 Régua de cobrança

- A régua inicia em `50% do prazo`.
- A primeira cobrança é a `Notificação 1`.
- Se não houver resposta, seguem `Notificação 2`, `Notificação 3`, `Notificação 4` e assim por diante.
- O título das notificações deve seguir obrigatoriamente o padrão sequencial `Notificação 1`, `Notificação 2`, `Notificação 3` e assim sucessivamente.
- A partir da `Notificação 2`, o e-mail de `Compras` vai copiado.
- As notificações seguintes são enviadas uma vez por dia útil.
- A régua continua até haver resposta do fornecedor ou o pedido virar `Atrasado`.

### 6.3 Respostas possíveis do fornecedor

No portal, o fornecedor responde ao follow-up:

- confirmando que entregará no prazo; ou
- sugerindo nova data.

### 6.4 Regras de confirmação e nova data

- Quando o fornecedor confirma entrega no prazo, a régua é encerrada naquele momento e `Compras` é notificado.
- Essa confirmação vale apenas até a data prometida vigente.
- Se a data prometida vencer sem entrega confirmada no Sienge, o pedido segue normalmente para atraso.
- Se o fornecedor sugerir nova data, `Compras` deve aprovar ou reprovar.
- Se `Compras` aprovar a nova data, ela passa a valer como `Data Prometida` local e a régua reinicia com base nela.
- Quando a nova data for aprovada, a nova cobrança de `50% do prazo` deve seguir a mesma regra e o mesmo fluxo de cobrança.
- Se `Compras` reprovar, a data prometida anterior é mantida e a régua continua.
- A nova data prometida não volta para o Sienge e não sobrescreve a data original do ERP.

### 6.5 Simplificação da V1.0 para múltiplas entregas

- Quando existirem múltiplas datas de entrega para o mesmo item, a V1.0 considera apenas a última data prometida consolidada do item.
- A V1.0 não controla uma régua separada por parcela de entrega do mesmo item.

### 6.6 Entrega parcial e atraso

- Em entrega parcial, a régua continua apenas enquanto existir saldo pendente no pedido.
- Se a data prometida for hoje e no dia útil seguinte ainda não houver nota fiscal no Sienge confirmando a entrega, o pedido deve ser sinalizado como `Atrasado`.
- `Compras` deve ser notificado automaticamente nesses casos.

## 7. Entrega, Divergência e Status de Pedido

### 7.1 Fonte oficial de confirmação de entrega

- Na V1.0, a fonte oficial de confirmação de entrega é `Nota Fiscal`.
- O endpoint oficial adotado é `GET /purchase-invoices/deliveries-attended`.

### 7.2 Regra operacional de entrega

- A entrada de nota fiscal deve ser puxada automaticamente do Sienge.
- Após identificar uma entrega, o sistema notifica `Compras`.
- `Compras` valida a informação de entrega e decide entre:
  - `OK`; ou
  - `Divergência`.
- Se houver `Divergência` e o prazo ainda não tiver vencido, a régua continua.
- Se houver `Divergência` e o prazo já tiver vencido, o status permanece `Atrasado`.

### 7.3 Status operacionais de pedido

Os principais status de pedido e entrega são:

- `Parcialmente Entregue`
- `Entregue`
- `Atrasado`
- `Divergência`
- `Em avaria`
- `Reposição`
- `Cancelado`

Regras obrigatórias para cálculo desses status:

- `Parcialmente Entregue` deve ser aplicado quando houver entrega parcial identificada no Sienge.
- O pedido deve permanecer `Parcialmente Entregue` até que todos os itens restantes tenham sido entregues, cancelados ou encaminhados para `Reposição`, conforme a regra aplicável.
- Um pedido só pode ficar `Entregue` quando todos os itens tiverem entrega confirmada no Sienge.
- `Reposição` pode valer no nível de item ou no nível de pedido, dependendo da abrangência da substituição aprovada por `Compras`.
- Em devolução total da compra, o pedido inteiro deve ficar `Cancelado` no sistema e a régua de follow-up deve ser encerrada imediatamente.

## 8. Avaria e Ação Corretiva

### 8.1 Registro de avaria

- `Fornecedor` e `Compras` podem registrar avaria.
- A avaria pode ser registrada mesmo antes de a entrega estar formalmente identificada.
- Ao registrar a avaria, o status passa para `Em avaria`.

### 8.2 Papel de cada perfil

- O `Fornecedor` pode apenas sugerir a ação corretiva.
- A ação corretiva final é sempre definida por `Compras`.
- Quando o fornecedor sugerir uma ação corretiva de avaria, `Compras` deve receber notificação no sistema para decidir.
- `Compras` pode aceitar a sugestão do fornecedor ou recusá-la e definir outra ação corretiva permitida.
- Toda notificação e decisão de avaria deve existir no sistema com trilha auditável.

### 8.3 Ações corretivas permitidas

As únicas ações corretivas permitidas são:

- cancelamento parcial ou total do item avariado; ou
- reposição.

### 8.4 Regras de reposição

- Se `Compras` aceitar substituição, o sistema trata como `Reposição`.
- Em `Reposição`, o fornecedor deve informar nova data prometida.
- A régua de follow-up reinicia com base nessa nova data.
- `Reposição` pode valer no nível de item ou de pedido, dependendo do caso.

### 8.5 Regras de cancelamento e devolução

- Em devolução ou cancelamento de item, o pedido segue com os demais itens válidos.
- O sistema recalcula internamente saldo, valor e status.
- O pedido no Sienge nunca é alterado por essas ações.
- Em devolução total da compra, o pedido fica `Cancelado` no sistema e a régua é encerrada.

### 8.6 Reabertura após entrega

- Se uma avaria surgir depois da entrega total, o acompanhamento só reabre quando a ação corretiva gerar `Reposição`.
- Se não houver `Reposição`, a ocorrência de avaria é tratada sem reabrir o fluxo original do pedido.

## 9. Integração com o Sienge

### 9.1 Princípio de integração

- O `Sienge` prevalece como fonte principal de verdade para dados operacionais mestres.
- O sistema local mantém como exceções:
  - e-mail alterado manualmente pelo `Administrador`;
  - data prometida aprovada por `Compras`;
  - status internos de workflow;
  - registros de avaria;
  - trilhas de auditoria.

### 9.2 Base técnica da API

- O padrão de URL base das APIs do Sienge segue `https://api.sienge.com.br/{subdominio-do-cliente}/public/api/v1/{recurso}`.
- A autenticação padrão informada pela documentação pública é `Basic Authorization`.
- O header esperado segue o padrão `Authorization: Basic base64(usuario-api:senha)`.
- O rate limit público informado é `200/minuto` para APIs `REST` e `20/minuto` para APIs `BULK`.
- As APIs listadas usam paginação com `limit` e `offset`.
- O padrão operacional esperado é `limit` padrão `100`, máximo `200`, e `offset` padrão `0`.
- O retorno paginado deve ser tratado com `resultSetMetadata` e `results`.

### 9.3 APIs oficiais da V1.0

Leitura de cotação:

- `GET /purchase-quotations/all/negotiations`

Leitura cadastral do fornecedor:

- `GET /creditors/{creditorId}`
- `GET /creditors`

Leitura de pedidos:

- `GET /purchase-orders`
- `GET /purchase-orders/{purchaseOrderId}`
- `GET /purchase-orders/{purchaseOrderId}/items`
- `GET /purchase-orders/{purchaseOrderId}/items/{itemNumber}/delivery-schedules`

Leitura de notas e entrega:

- `GET /purchase-invoices`
- `GET /purchase-invoices/{sequentialNumber}`
- `GET /purchase-invoices/{sequentialNumber}/items`
- `GET /purchase-invoices/deliveries-attended`

Leitura auxiliar de rastreabilidade:

- `GET /purchase-requests/{purchaseRequestId}/items/{purchaseRequestItemNumber}/delivery-requirements`

Escrita da resposta de cotação:

- `POST /purchase-quotations/{purchaseQuotationId}/suppliers/{supplierId}/negotiations`
- `PUT /purchase-quotations/{purchaseQuotationId}/suppliers/{supplierId}/negotiations/{negotiationNumber}`
- `PUT /purchase-quotations/{purchaseQuotationId}/suppliers/{supplierId}/negotiations/{negotiationNumber}/items/{quotationItemNumber}`
- `PATCH /purchase-quotations/{purchaseQuotationId}/suppliers/{supplierId}/negotiations/latest/authorize`

Webhooks relevantes:

- `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`
- `PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED`
- `PURCHASE_ORDER_AUTHORIZATION_CHANGED`
- `PURCHASE_ORDER_ITEM_MODIFIED`
- `PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED`

### 9.3.1 Contrato mínimo para leitura de cotação

Endpoint principal:

- `GET /purchase-quotations/all/negotiations`

Uso obrigatório no produto:

- importar cotações com fornecedores;
- identificar fornecedores vinculados;
- ler data da cotação;
- ler data limite de resposta;
- ler status e consistência;
- identificar a última negociação do fornecedor.

Filtros públicos relevantes:

- `quotationNumber`
- `supplierId`
- `buyerId`
- `startDate`
- `endDate`
- `authorized`
- `status`
- `consistency`
- `limit`
- `offset`

Campos mínimos a persistir ou tratar no retorno:

- `purchaseQuotationId`
- `buyerId`
- `consistent`
- `status`
- `quotationDate`
- `responseDate`
- `suppliers[].supplierId`
- `suppliers[].supplierName`
- `suppliers[].latestNegotiation[].negotiationId`
- `suppliers[].latestNegotiation[].responseDate`
- `suppliers[].latestNegotiation[].authorized`

Observações de implementação:

- esta é a principal API pública de leitura estruturada de cotações com fornecedores;
- o contrato público não expõe e-mail do fornecedor neste endpoint;
- o desenvolvedor não deve tentar inferir e-mail a partir de nome do fornecedor ou outros endpoints de cotação.
- o endpoint `GET /purchase-quotations/comparison-map/pdf` não deve ser usado como fonte principal de automação, pois foi identificado apenas como geração de relatório em PDF do mapa de cotações.

Exemplo simplificado de resposta:

```json
{
  "resultSetMetadata": {
    "count": 1,
    "offset": 0,
    "limit": 100
  },
  "results": [
    {
      "purchaseQuotationId": 1,
      "buyerId": "ANON_BUYER",
      "consistent": true,
      "status": "Registrada",
      "quotationDate": "2018-03-11",
      "responseDate": "2018-03-11",
      "suppliers": [
        {
          "supplierId": 77,
          "supplierName": "Fornecedor",
          "latestNegotiation": [
            {
              "negotiationId": 1,
              "responseDate": "2022-08-11",
              "authorized": true
            }
          ]
        }
      ]
    }
  ]
}
```

Observação complementar:

- este exemplo foi montado a partir do schema público oficial, porque a documentação pública não expõe um payload completo pronto para esse endpoint.

### 9.3.2 Contrato mínimo para leitura cadastral do fornecedor

Endpoint principal de cadastro:

- `GET /creditors/{creditorId}`

Uso obrigatório no produto:

- obter dados cadastrais do fornecedor;
- obter contatos e e-mails;
- enriquecer o fornecedor sincronizado a partir da cotação.

Campos mínimos a tratar no retorno:

- `id`
- `name`
- `tradeName`
- `phones[]`
- `contacts[].name`
- `contacts[].email`

Endpoint auxiliar de busca:

- `GET /creditors`

Filtros públicos relevantes:

- `cpf`
- `cnpj`
- `creditor`
- `limit`
- `offset`

Observações de implementação:

- o contrato expõe uma lista de contatos, não um campo único de e-mail principal;
- a regra operacional da V1.0 continua sendo usar o primeiro `contacts[].email` preenchido;
- essa regra deve ser aplicada de forma consistente em login, primeiro acesso, redefinição de senha e notificações futuras.

Exemplo simplificado de resposta:

```json
{
  "id": 77,
  "name": "Fornecedor XPTO Ltda",
  "tradeName": "Fornecedor XPTO",
  "contacts": [
    {
      "name": "Joao da Silva",
      "email": "joaodasilva@gmail.com"
    }
  ]
}
```

### 9.3.3 Contrato mínimo para leitura de pedidos

Endpoint principal:

- `GET /purchase-orders`

Uso obrigatório no produto:

- importar pedidos de compra;
- identificar pedido autorizado;
- identificar atraso via flag do próprio Sienge;
- relacionar pedido com fornecedor e obra.

Filtros públicos relevantes:

- `startDate`
- `endDate`
- `status`
- `authorized`
- `supplierId`
- `buildingId`
- `buyerId`
- `consistency`
- `limit`
- `offset`

Campos mínimos a tratar no retorno:

- `id`
- `formattedPurchaseOrderId`
- `status`
- `authorized`
- `disapproved`
- `deliveryLate`
- `consistent`
- `supplierId`
- `buildingId`
- `buyerId`
- `date`

Endpoints complementares:

- `GET /purchase-orders/{purchaseOrderId}`
- `GET /purchase-orders/{purchaseOrderId}/items`

Campos mínimos a tratar nos itens do pedido:

- `itemNumber`
- `quantity`
- `unitPrice`
- `purchaseQuotations[].purchaseQuotationId`
- `purchaseQuotations[].purchaseQuotationItemId`

Observações de implementação:

- os itens do pedido devem ser usados para detalhamento do vínculo com a cotação, não como regra principal de descoberta da cotação de origem;
- o sistema deve suportar cenários em que `purchaseQuotations[]` venha preenchido em mais de um item do pedido;
- até a homologação confirmar o comportamento real, o desenvolvedor não deve assumir que `purchaseQuotations[]` sempre terá apenas uma cotação por item.

Exemplo simplificado de resposta de `GET /purchase-orders`:

```json
{
  "resultSetMetadata": {
    "count": 1,
    "offset": 0,
    "limit": 100
  },
  "results": [
    {
      "id": 128,
      "formattedPurchaseOrderId": "128",
      "status": "PENDING",
      "authorized": true,
      "disapproved": false,
      "deliveryLate": true,
      "consistent": "CONSISTENT",
      "supplierId": 77,
      "buildingId": 15,
      "buyerId": "comprador",
      "date": "2018-03-11"
    }
  ]
}
```

Exemplo simplificado de item em `GET /purchase-orders/{purchaseOrderId}/items`:

```json
{
  "itemNumber": 1,
  "quantity": 100,
  "unitPrice": 25.9,
  "purchaseQuotations": [
    {
      "purchaseQuotationId": 1,
      "purchaseQuotationItemId": 1
    }
  ]
}
```

### 9.3.4 Contrato mínimo para entregas programadas por item

Endpoint principal:

- `GET /purchase-orders/{purchaseOrderId}/items/{itemNumber}/delivery-schedules`

Uso obrigatório no produto:

- consultar previsões de entrega por item;
- comparar previsto versus entregue;
- acompanhar saldo em aberto.

Campos mínimos a tratar no retorno:

- `deliveryScheduleNumber`
- `sheduledDate`
- `sheduledQuantity`
- `deliveredQuantity`
- `openQuantity`

Observações de implementação:

- o contrato público usa `sheduledDate` e `sheduledQuantity` com grafia sem o `c`;
- se o backend devolver esses nomes exatamente assim, o parser deve respeitar o contrato real sem normalização implícita.

Exemplo simplificado de resposta:

```json
{
  "resultSetMetadata": {
    "count": 1,
    "offset": 0,
    "limit": 100
  },
  "results": [
    {
      "deliveryScheduleNumber": 1,
      "sheduledDate": "2018-03-11",
      "sheduledQuantity": 100,
      "deliveredQuantity": 50,
      "openQuantity": 50
    }
  ]
}
```

### 9.3.5 Contrato mínimo para leitura de notas fiscais e entregas atendidas

Endpoint de listagem de notas:

- `GET /purchase-invoices`

Uso obrigatório no produto:

- listar notas fiscais por fornecedor e período;
- apoiar auditoria e rastreio de entrega.

Filtros públicos relevantes:

- `companyId`
- `supplierId`
- `documentId`
- `series`
- `number`
- `startDate`
- `endDate`
- `limit`
- `offset`

Campos mínimos a tratar no retorno:

- `supplierId`
- `documentId`
- `sequentialNumber`
- `series`
- `issueDate`
- `movementDate`

Endpoint de detalhe da nota:

- `GET /purchase-invoices/{sequentialNumber}`

Campos mínimos a tratar no retorno:

- `supplierId`
- `number`
- `companyId`
- `issueDate`
- `movementDate`
- `sequentialNumber`
- `consistency`
- `invoiceDeliveryId`

Endpoint de itens da nota:

- `GET /purchase-invoices/{sequentialNumber}/items`

Uso obrigatório no produto:

- detalhar itens da nota fiscal;
- conferir quantidades e itens atendidos quando houver necessidade operacional ou auditoria.

Endpoint principal para confirmação de entrega:

- `GET /purchase-invoices/deliveries-attended`

Uso obrigatório no produto:

- confirmar entrega efetiva;
- ligar pedido a nota fiscal;
- ligar item do pedido a item da nota;
- capturar data e quantidade entregues.

Filtros públicos relevantes:

- `billId`
- `sequentialNumber`
- `purchaseOrderId`
- `invoiceItemNumber`
- `purchaseOrderItemNumber`
- `limit`
- `offset`

Regras públicas do contrato para combinação de filtros:

- se `billId` não for informado, é obrigatório informar `sequentialNumber` ou `purchaseOrderId`;
- se `sequentialNumber` não for informado, é obrigatório informar `billId` ou `purchaseOrderId`;
- se `purchaseOrderId` não for informado, é obrigatório informar `sequentialNumber` ou `billId`.

Campos mínimos a tratar no retorno:

- `purchaseOrderId`
- `purchaseOrderItemNumber`
- `deliveryItemPurchaseOrderNumber`
- `purchaseOrderItemAttendedNumber`
- `sequentialNumber`
- `invoiceItemNumber`
- `deliveryDate`
- `quantityDelivery`

Exemplo simplificado de resposta de `GET /purchase-invoices/deliveries-attended`:

```json
{
  "resultSetMetadata": {
    "count": 1,
    "offset": 0,
    "limit": 100
  },
  "results": [
    {
      "purchaseOrderId": 128,
      "purchaseOrderItemNumber": 1,
      "deliveryItemPurchaseOrderNumber": 1,
      "purchaseOrderItemAttendedNumber": 2,
      "sequentialNumber": 190,
      "invoiceItemNumber": 1,
      "deliveryDate": "2019-07-15",
      "quantityDelivery": 84.0
    }
  ]
}
```

### 9.3.6 Contrato mínimo para leitura auxiliar de rastreabilidade

Endpoint auxiliar:

- `GET /purchase-requests/{purchaseRequestId}/items/{purchaseRequestItemNumber}/delivery-requirements`

Uso previsto no produto:

- entender a necessidade de entrega que originou a cotação;
- enriquecer rastreabilidade;
- apoiar debugging e auditoria.

Campos mínimos a tratar no retorno:

- `deliveryRequirementNumber`
- `requirementDate`
- `requirementQuantity`
- `attendedQuantity`
- `openQuantity`

Observações de implementação:

- este endpoint não é o centro do fluxo da V1.0;
- ele deve ser tratado como apoio de rastreabilidade, não como fonte principal do fluxo operacional.

### 9.3.7 Contrato mínimo para escrita da resposta de cotação

Criação de negociação quando necessário:

- `POST /purchase-quotations/{purchaseQuotationId}/suppliers/{supplierId}/negotiations`

Observação obrigatória:

- o contrato público expõe a criação de negociação, mas não deixa totalmente claro em quais cenários ela é obrigatória antes da atualização dos itens;
- até a homologação confirmar o comportamento real, a implementação deve prever esse passo como possibilidade técnica do fluxo.

Atualização geral da negociação:

- `PUT /purchase-quotations/{purchaseQuotationId}/suppliers/{supplierId}/negotiations/{negotiationNumber}`

Campos mínimos do body:

- `supplierAnswerDate`
- `validity`
- `seller`
- `discount`
- `freightType`
- `freightTypeForGeneratedPurchaseOrder`
- `freightPrice`
- `valueOtherExpenses`
- `applyIpiFreight`
- `internalNotes`
- `supplierNotes`
- `paymentTerms`

Exemplo simplificado de body:

```json
{
  "supplierAnswerDate": "2026-03-27",
  "validity": "2026-04-10",
  "seller": "Joao da Silva",
  "discount": 10.1,
  "freightType": "INCLUDED",
  "freightTypeForGeneratedPurchaseOrder": "PROPORTIONAL",
  "freightPrice": 120.5,
  "valueOtherExpenses": 20.36,
  "applyIpiFreight": true,
  "supplierNotes": "Resposta enviada pelo portal"
}
```

Atualização dos itens da negociação:

- `PUT /purchase-quotations/{purchaseQuotationId}/suppliers/{supplierId}/negotiations/{negotiationNumber}/items/{quotationItemNumber}`

Campos mínimos do body:

- `detailId`
- `trademarkId`
- `quotedQuantity`
- `negotiatedQuantity`
- `unitPrice`
- `discount`
- `discountPercentage`
- `increasePercentage`
- `ipiTaxPercentage`
- `issTaxPercentage`
- `icmsTaxPercentage`
- `freightUnitPrice`
- `selectedOption`
- `internalNotes`
- `supplierNotes`
- `negotiationDeliveries[].negotiationDeliveryNumber`
- `negotiationDeliveries[].deliveryDate`
- `negotiationDeliveries[].deliveryQuantity`

Exemplo simplificado de body:

```json
{
  "quotedQuantity": 10.5,
  "negotiatedQuantity": 10.5,
  "unitPrice": 5.5,
  "discount": 10,
  "discountPercentage": 1,
  "increasePercentage": 2,
  "ipiTaxPercentage": 1,
  "issTaxPercentage": 2,
  "icmsTaxPercentage": 8,
  "freightUnitPrice": 5,
  "selectedOption": true,
  "supplierNotes": "Entrega parcial combinada",
  "negotiationDeliveries": [
    {
      "deliveryDate": "2026-04-05",
      "deliveryQuantity": 5.5
    },
    {
      "deliveryDate": "2026-04-10",
      "deliveryQuantity": 5
    }
  ]
}
```

Autorização final da negociação:

- `PATCH /purchase-quotations/{purchaseQuotationId}/suppliers/{supplierId}/negotiations/latest/authorize`

Regra obrigatória:

- este endpoint deve ser chamado somente depois da aprovação manual de `Compras`.

### 9.3.8 Payloads mínimos esperados dos webhooks

Webhook principal de vínculo entre pedido e cotação:

- `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`

Campos mínimos esperados:

- `purchaseOrderId`
- `purchaseQuotationId`
- `supplierId`
- `negotiationNumber`
- `authorized`

Exemplo simplificado de payload:

```json
{
  "purchaseOrderId": 128,
  "purchaseQuotationId": 1,
  "supplierId": 77,
  "negotiationNumber": 1,
  "authorized": true
}
```

Webhook auxiliar de autorização de negociação:

- `PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED`

Campos mínimos esperados:

- `purchaseQuotationId`
- `supplierId`
- `negotiationId`
- `authorized`
- `consistent`
- `changedAt`

Exemplo simplificado de payload:

```json
{
  "purchaseQuotationId": 1,
  "supplierId": 77,
  "negotiationId": 1,
  "authorized": true,
  "consistent": true,
  "changedAt": "2026-03-27T10:00:00.000-03:00"
}
```

Webhook auxiliar de modificação de item do pedido:

- `PURCHASE_ORDER_ITEM_MODIFIED`

Campos mínimos esperados:

- `purchaseOrderId`

Exemplo simplificado de payload:

```json
{
  "purchaseOrderId": 128
}
```

Observações de implementação:

- webhooks servem como gatilho de sincronização incremental;
- após cada webhook, a aplicação deve reconsultar a API REST correspondente para reconciliação detalhada;
- o sistema não deve assumir que o payload do webhook, sozinho, contém todos os dados operacionais necessários.
- quando `PURCHASE_ORDER_AUTHORIZATION_CHANGED` ou `PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED` forem utilizados, o tratamento esperado é o mesmo: usá-los apenas como gatilho de reconsulta, nunca como fonte final de decisão operacional.

### 9.4 Ordem recomendada de leitura das APIs

Para reduzir ambiguidade de implementação, a sequência recomendada é:

Cotação:

1. Ler `GET /purchase-quotations/all/negotiations`.
2. Identificar `purchaseQuotationId`.
3. Identificar `supplierId`.
4. Buscar o e-mail do fornecedor em `GET /creditors/{creditorId}`.

Pedido:

1. Ler `GET /purchase-orders`.
2. Ler `GET /purchase-orders/{purchaseOrderId}`.
3. Ler `GET /purchase-orders/{purchaseOrderId}/items`.
4. Usar `purchaseQuotations[]` para detalhar o vínculo do pedido com a cotação.

Entrega e nota fiscal:

1. Ler `GET /purchase-invoices/deliveries-attended`.
2. Quando necessário, complementar com `GET /purchase-invoices/{sequentialNumber}`.
3. Quando necessário, complementar com `GET /purchase-invoices/{sequentialNumber}/items`.

### 9.5 Regra para identificar fornecedor e e-mail

- O identificador principal do fornecedor no fluxo de compras é `supplierId`.
- O endpoint de cotação não expõe e-mail do fornecedor.
- O e-mail deve ser buscado em `GET /creditors/{creditorId}`.
- A regra operacional da V1.0 é usar o primeiro `contacts[].email` preenchido.
- Se não houver e-mail preenchido, o fornecedor fica bloqueado até ajuste manual do `Administrador`.
- Se não houver e-mail válido no Sienge e também não houver e-mail cadastrado localmente pelo `Administrador`, o sistema deve bloquear o envio de notificações e a operação desse fornecedor no portal.

### 9.6 Regra principal de vínculo entre cotação e pedido

- Todo `Pedido de Compra` deve ser vinculado a uma `Cotação` de origem.
- A regra principal de vínculo é o webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`.
- Esse webhook relaciona diretamente:
  - `purchaseOrderId`
  - `purchaseQuotationId`
  - `supplierId`
  - `negotiationNumber`
- O detalhamento por item em `GET /purchase-orders/{purchaseOrderId}/items` é usado como conferência e detalhamento, não como regra principal de vínculo.
- O `supplierId` do pedido deve ser comparado com o `supplierId` da cotação para confirmar que o fornecedor do pedido é o mesmo fornecedor do fluxo de compras.
- O vínculo principal do pedido com a cotação deve ser criado primeiro pelo webhook e só depois detalhado no nível dos itens.

### 9.7 Regra de vínculo entre nota fiscal, pedido e cotação

- Para ligar nota fiscal ao pedido, usar `GET /purchase-invoices/deliveries-attended`.
- O vínculo operacional mínimo `nota -> pedido` deve considerar no retorno, no mínimo, `purchaseOrderId`, `purchaseOrderItemNumber`, `sequentialNumber`, `invoiceItemNumber`, `deliveryDate` e `quantityDelivery`.
- Para ligar nota fiscal à cotação, fazer o caminho:

```text
Nota Fiscal -> purchaseOrderId -> item do pedido -> purchaseQuotations[].purchaseQuotationId -> Cotação
```

- O sistema não deve tentar ligar nota fiscal à cotação diretamente por fornecedor, data ou número textual.

### 9.8 Regras de reconciliação e uso de webhook

- Os webhooks públicos do Sienge não substituem leitura detalhada por API.
- O uso correto do webhook é como gatilho para reconsulta e sincronização incremental.
- A API REST continua sendo a fonte final de verdade para reconciliação detalhada.

- A forma recomendada de implementação é:
  - webhook como regra principal;
  - reconciliação por API como fallback.
- A ausência permanente do webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION` no ambiente do cliente deve ser tratada como bloqueio de homologação da integração.
- Se a reconciliação divergir do vínculo criado pelo webhook, o sistema não desfaz o vínculo automaticamente.
- Nesse caso, o sistema mantém o vínculo e notifica `Compras`.

### 9.9 Regra para fornecedor inválido no mapa

- Se o fornecedor tiver sido enviado por engano ou removido do mapa de cotação no Sienge, o sistema não deve criar negociação automaticamente para ele.
- O sistema deve alertar `Compras` antes de qualquer tentativa de escrita.
- Nesse cenário, o status exibido deve ser `Fornecedor inválido no mapa de cotação`, com destaque vermelho.
- Mesmo se o problema for corrigido no Sienge, qualquer nova tentativa de envio continua exigindo aprovação prévia de `Compras`.

### 9.10 Atenções de contrato público para implementação

- No endpoint `GET /purchase-orders/{purchaseOrderId}/items/{itemNumber}/delivery-schedules`, o contrato público usa `sheduledDate` e `sheduledQuantity` com grafia sem o `c`.
- Se o backend devolver esses nomes exatamente assim, o parser deve respeitar o contrato real.
- No endpoint `GET /purchase-requests/{purchaseRequestId}/items/{purchaseRequestItemNumber}/delivery-requirements`, o campo `openQuantity` aparece no schema público com tipagem potencialmente inconsistente em relação à descrição funcional.
- Esse contrato deve ser tratado como possível inconsistência pública até validação em homologação.

### 9.11 Regras objetivas e anti-patterns obrigatórios

- Para mostrar a cotação, usar `purchaseQuotationId`.
- Para identificar o fornecedor do fluxo de compras, usar `supplierId`.
- Para buscar e-mail, usar `GET /creditors/{creditorId}` e ler `contacts[].email`.
- Para ligar pedido à cotação no nível principal, usar o webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`.
- Para detalhar itens do pedido contra a cotação, usar `purchaseQuotations[]` nos itens do pedido.
- Para ligar nota fiscal ao pedido, usar `GET /purchase-invoices/deliveries-attended`.
- Para ligar nota fiscal à cotação, usar o caminho `nota -> pedido -> item -> purchaseQuotationId`.
- Para follow-up na V1.0, usar apenas a última data prometida consolidada do item.
- Não ligar pedido à cotação só por nome do fornecedor.
- Não ligar pedido à cotação só por datas.
- Não usar item do pedido como única regra para descobrir a cotação principal que gerou o pedido.
- Não ligar nota à cotação só por data.
- Não tratar `contacts[]` como se sempre tivesse um único e-mail.
- Não sobrescrever dados mestres do Sienge com dados operacionais locais.
- Não criar negociação no Sienge para fornecedor removido do mapa de cotação ou enviado por engano.

## 10. Identificadores que o Sistema Deve Persistir

Para manter rastreabilidade fim a fim, o sistema deve guardar no mínimo:

- `purchaseQuotationId`
- `supplierId`
- `negotiationId` ou `negotiationNumber`, quando existir
- `purchaseOrderId`
- `purchaseOrderItemNumber`
- `purchaseQuotationItemId`, quando houver
- `sequentialNumber` da nota fiscal
- `invoiceItemNumber`
- `creditorId`, se a homologação confirmar a correspondência com `supplierId`

## 11. Autenticação, Segurança e LGPD

### 11.1 Regras de autenticação

- O login do `Fornecedor` é por e-mail.
- O e-mail inicial vem do Sienge, mas o `Administrador` pode alterá-lo localmente no sistema.
- Essa alteração não volta para o Sienge.
- O novo e-mail local passa a valer imediatamente para login, primeiro acesso, redefinição de senha e notificações.
- Usuários internos também fazem login com e-mail e senha.
- O primeiro acesso de fornecedor e usuário interno acontece por link seguro para definição de senha.
- O link de primeiro acesso expira em `24 horas`.
- O link de redefinição de senha expira em `24 horas`.
- Após expiração, é necessário gerar novo link.

### 11.2 Redefinição de senha

- O `Fornecedor` pode redefinir a própria senha.
- Usuários internos podem redefinir a própria senha.
- O `Administrador` também pode iniciar redefinição para fornecedor e usuário interno.

### 11.3 Política mínima de senha da V1.0

- mínimo de `8 caracteres`;
- sem exigência de maiúscula, minúscula, número ou caractere especial;
- sem histórico de senha;
- sem bloqueio automático por tentativas inválidas.

### 11.4 Sessão

- Na V1.0, a sessão não expira automaticamente por inatividade.
- O encerramento ocorre por logout manual.

### 11.5 LGPD e retenção

- A retenção padrão é de `1 ano`.
- A retenção de `1 ano` vale para:
  - logs técnicos;
  - trilhas de auditoria;
  - notificações enviadas;
  - histórico de avarias;
  - eventos de integração.
- Após `1 ano`, os dados podem ser arquivados.
- Na V1.0, a LGPD fica no nível básico operacional:
  - manter apenas dados necessários;
  - restringir acesso conforme perfil;
  - não implementar regras avançadas adicionais nesta fase.

## 12. Backoffice, Auditoria e Operação

### 12.1 Status mínimos de integração

- `Pendente de integração`
- `Integrado com sucesso`
- `Falha de integração`

No backoffice, esses status devem ser exibidos de forma visual simples:

- `Pendente de integração`: amarelo
- `Integrado com sucesso`: verde
- `Falha de integração`: vermelho

### 12.2 Tratamento de falha de integração

- Em caso de falha de integração com o Sienge, o sistema tenta novo reprocessamento automático após `24 horas`.
- No envio de resposta de cotação ao Sienge, o sistema tenta mais `2` reenvios automáticos, com intervalo de `24 horas`.
- Se a falha persistir após esses reprocessamentos, `Compras` deve ser notificado.
- `Compras` pode acionar novo reprocessamento manual no backoffice.
- Na V1.0, novas tentativas manuais podem continuar sendo feitas sem limite automático.

### 12.3 Filtro rápido

O backoffice deve oferecer o filtro `Exigem ação`, contemplando no mínimo:

- `Aguardando revisão de Compras`
- `Correção solicitada`
- `Falha de integração`
- `Fornecedor inválido no mapa de cotação`
- `Atrasado`
- `Divergência`
- `Em avaria`
- `Reposição`

### 12.4 Priorização visual da operação

Na lista de pedidos e follow-up, a ordenação deve priorizar:

- pedidos `Atrasados`;
- pedidos em `Divergência`;
- pedidos em `Em avaria` ou `Reposição`;
- pedidos pendentes de resposta do fornecedor;
- pedidos no prazo ou entregues.

### 12.5 Cores operacionais

- `Atrasado`: vermelho
- `Divergência`: laranja
- `Em avaria`: roxo
- `Reposição`: azul
- `Entregue`: verde
- `Parcialmente Entregue`: amarelo
- `Cancelado`: cinza
- `Aguardando reenvio ao Sienge`: amarelo
- `Fornecedor inválido no mapa de cotação`: vermelho

### 12.6 Auditoria visível

A auditoria operacional deve registrar no mínimo:

- envio de cotação;
- leitura da cotação;
- resposta do fornecedor;
- aprovação por `Compras`;
- reprovação por `Compras`;
- reenvio para correção;
- integração com sucesso;
- falha de integração;
- alteração de data prometida;
- confirmação de entrega no prazo;
- registro de avaria;
- definição de ação corretiva.

Cada evento deve exibir no mínimo:

- data e hora;
- tipo do evento;
- usuário ou origem do evento;
- cotação ou pedido afetado;
- fornecedor afetado, quando houver;
- resumo da ação realizada.

## 13. Dashboard e Indicadores

### 13.1 Dashboards oficiais da V1.0

- `Lead time`
- `Atrasos`
- `Criticidade`
- `Ranking de fornecedores`
- `Avarias`

### 13.2 Filtros

- `Fornecedor`
- `Obra`
- `Pedido`
- `Item`

### 13.3 Frequência de atualização

- atualização diária.

### 13.4 KPIs oficiais iniciais

- `Cotações enviadas`
- `Cotações respondidas`
- `Cotações sem resposta`
- `Pedidos no prazo`
- `Pedidos atrasados`
- `Pedidos com avaria`

### 13.5 Fórmulas iniciais

- `Cotações enviadas` = total de cotações enviadas no período selecionado
- `Cotações respondidas` = total de cotações com resposta válida do fornecedor no período selecionado
- `Cotações sem resposta` = total de cotações vencidas com status `Sem resposta` no período selecionado
- `Pedidos no prazo` = total de pedidos com entrega confirmada até a data prometida
- `Pedidos atrasados` = total de pedidos com status `Atrasado` no período selecionado
- `Pedidos com avaria` = total de pedidos que tiveram ao menos um registro de avaria no período selecionado
- `Taxa de resposta de cotação` = `Cotações respondidas / Cotações enviadas * 100`
- `Taxa de cotações sem resposta` = `Cotações sem resposta / Cotações enviadas * 100`
- `Taxa de pedidos no prazo` = `Pedidos no prazo / Total de pedidos monitorados * 100`
- `Taxa de atraso` = `Pedidos atrasados / Total de pedidos monitorados * 100`
- `Taxa de avaria` = `Pedidos com avaria / Total de pedidos monitorados * 100`
- `Lead time médio` = média, em dias úteis, entre a `Data do Pedido no Sienge` e a `Data de entrega confirmada`

### 13.6 Criticidade

- `Urgente` quando o prazo da obra for menor que a média histórica do item ou insumo.
- `Padrão` quando o prazo da obra for maior ou igual à média histórica.
- Sem histórico suficiente, classificar como `Padrão`.

### 13.7 Sinalização de confiabilidade do fornecedor

- `Confiável`: sem atraso e sem avaria nos últimos 3 meses
- `Atenção`: com atraso ou com avaria nos últimos 3 meses
- `Crítico`: com atraso e com avaria nos últimos 3 meses

### 13.8 Resumos rápidos do dashboard

O dashboard ou backoffice deve exibir no mínimo:

- cotações abertas;
- cotações aguardando revisão;
- pedidos atrasados;
- pedidos em avaria;
- falhas de integração.

## 14. Critérios de Aceite Macro

### 14.1 Campos mínimos de listagem

Na lista de cotações do backoffice, cada registro deve exibir no mínimo:

- número da cotação;
- fornecedor;
- status;
- data de início;
- data de fim;
- indicação de leitura;
- situação da resposta;
- indicação `Fornecedor fechado`, quando houver;
- número do pedido de compra, quando houver.

Na lista de pedidos e follow-up do backoffice, cada registro deve exibir no mínimo:

- número do pedido;
- fornecedor;
- obra;
- status;
- data do pedido;
- data prometida atual;
- indicação de atraso;
- indicação de avaria ou divergência;
- saldo pendente;
- número da cotação vinculada.

No portal do fornecedor, a lista de pedidos deve exibir no mínimo:

- número do pedido;
- status;
- data prometida atual;
- data do pedido;
- indicação de atraso;
- indicação de avaria ou reposição;
- obra, quando esse dado existir no retorno disponível.

Na lista de cotações do portal do fornecedor, cada registro deve exibir no mínimo:

- número da cotação;
- status;
- data de início;
- data de fim;
- indicação de leitura;
- situação da resposta.

### 14.2 Cotação

- O sistema importa cotações do Sienge e as disponibiliza ao fornecedor.
- Toda resposta exige data de entrega.
- O fornecedor pode editar enquanto o prazo estiver aberto e não houver aprovação final.
- `Compras` aprova ou reprova antes do retorno ao Sienge.
- Após integração ao Sienge, a resposta fica somente para consulta.

### 14.3 Follow-up

- O sistema inicia follow-up quando o pedido chega do Sienge.
- O cálculo usa data do pedido, data prometida, dias úteis e feriados nacionais.
- A `Notificação 1` dispara em `50% do prazo`.
- O título das notificações segue o padrão sequencial `Notificação 1`, `Notificação 2`, `Notificação 3` e assim sucessivamente.
- A partir da `Notificação 2`, `Compras` fica copiado.
- O fornecedor pode confirmar prazo ou sugerir nova data.
- Se a data vencer sem confirmação de entrega no Sienge, o pedido vira `Atrasado`.

### 14.4 Entrega

- O sistema importa automaticamente dados de pedido e entrega.
- A fonte oficial da V1.0 para confirmação de entrega é `GET /purchase-invoices/deliveries-attended`.
- `Compras` valida `OK` ou `Divergência`.
- O sistema reflete corretamente `Parcialmente Entregue`, `Entregue`, `Atrasado`, `Divergência` e `Cancelado`.

### 14.5 Avaria

- `Fornecedor` e `Compras` registram avaria.
- O status muda para `Em avaria`.
- O fornecedor apenas sugere ação corretiva.
- `Compras` define a ação final.
- Substituição aceita vira `Reposição` e exige nova data prometida.

### 14.6 Autenticação

- O sistema permite login por e-mail e senha para usuários internos e fornecedores.
- Primeiro acesso e redefinição usam link seguro com validade de `24 horas`.
- `Administrador` consegue criar, bloquear, reativar e gerir acessos.

### 14.7 Integração com o Sienge

- O sistema lê cotações, pedidos, entregas e fornecedores pelos endpoints oficiais mapeados.
- O sistema busca o e-mail do fornecedor na API de `Credores`.
- O sistema respeita autenticação `Basic`, paginação por `limit` e `offset` e limites públicos de consumo da API do Sienge.
- Webhooks são usados como gatilho de sincronização, não como substituto da leitura detalhada por API.
- O sistema só devolve resposta de cotação ao Sienge após aprovação de `Compras`.
- Falhas de integração são registradas, reprocessadas e notificadas.

## 15. Diretrizes Técnicas e de Arquitetura

### 15.1 Stack recomendada

- frontend SPA em React + TypeScript;
- backend em TypeScript;
- banco relacional PostgreSQL gerenciado;
- autenticação centralizada por serviço de identidade compatível com login por e-mail e senha;
- processamento assíncrono controlado para integrações, agendamentos e reprocessamentos.

### 15.2 Regras técnicas obrigatórias

- regras críticas de negócio devem ficar no backend;
- integrações devem ter idempotência, retry e rastreabilidade;
- jobs de follow-up, polling e reprocessamento não podem depender do cliente web;
- o sistema deve manter auditoria persistida;
- o frontend não deve concentrar lógica crítica de integração ou autorização.

### 15.3 Requisitos não funcionais mínimos

- HTTPS/TLS obrigatório;
- RBAC por perfil;
- isolamento de dados por fornecedor;
- mascaramento de dados sensíveis em logs;
- suporte a desktop e mobile;
- compatibilidade mínima com Chrome, Firefox, Safari e Edge;
- operação primária em português do Brasil;
- observabilidade com logs estruturados, trilha de auditoria e monitoramento de integrações.

## 16. Riscos e Dependências

### 16.1 Riscos principais

- dependência crítica das APIs e webhooks do Sienge;
- divergência entre contrato público e comportamento real em homologação;
- baixa adesão do fornecedor ao portal;
- falhas de integração que impactem cotação ou follow-up;
- cálculo incorreto de status em cenários de entrega parcial, reposição e avaria.

### 16.2 Mitigações esperadas

- usar webhook como gatilho e API REST como fonte final de verdade;
- implementar retries, reprocessamentos e observabilidade;
- homologar cenários reais com dados do cliente;
- manter tratamento explícito de exceções no backoffice;
- cobrir os cenários críticos com testes funcionais e integrados.

## 17. Validações Técnicas Ainda Obrigatórias em Homologação

- validar se `supplierId` das APIs de compras corresponde ao `creditorId` da API de `Credores`;
- validar na operação real se a regra do primeiro `contacts[].email` preenchido é suficiente como e-mail oficial do fornecedor;
- validar no ambiente do cliente a disponibilidade e funcionamento do webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`;
- validar no ambiente do cliente a disponibilidade prática do webhook `PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED`, caso ele seja usado no fluxo;
- validar se o fornecedor continua existindo no mapa de cotação antes da escrita da resposta no Sienge;
- validar o comportamento real de criação e atualização de negociação antes do envio dos itens da resposta;
- validar cenários reais em que um item do pedido possa referenciar mais de uma cotação no array `purchaseQuotations[]`;
- validar se `GET /purchase-invoices/deliveries-attended` cobre todos os cenários reais de entrega da operação.
- validar variações reais do contrato do campo `openQuantity` em `delivery-requirements`.

## 18. Referências de Origem

### 18.1 Fontes oficiais consultadas

- Documentação geral: https://api.sienge.com.br/docs/general-information.html
- Índice das APIs: https://api.sienge.com.br/docs/
- Cotações de preços: https://api.sienge.com.br/docs/html-files/purchase-quotations-v1.html
- Credores: https://api.sienge.com.br/docs/html-files/creditor-v1.html
- Pedidos de compra: https://api.sienge.com.br/docs/html-files/purchase-orders-v1.html
- Nota fiscal de compra: https://api.sienge.com.br/docs/html-files/purchase-invoices-v1.html
- Solicitações de compra: https://api.sienge.com.br/docs/html-files/purchase-requests-v1.html
- Tipos de webhooks: https://api.sienge.com.br/docs/general-hooks-types.html
