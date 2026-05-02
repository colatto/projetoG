# PRD Filho — Dashboard e Indicadores

> Módulo: 8 de 9
> Seções do PRDGlobal: §13
> Dependências: 2 (Fluxo de Cotação), 4 (Follow-up Logístico), 5 (Entrega, Divergência e Status de Pedido), 6 (Avaria e Ação Corretiva)
> Data de geração: 2026-04-06

---

## 1. Objetivo do módulo

O módulo de Dashboard e Indicadores é responsável por fornecer visibilidade analítica e gerencial sobre toda a operação de suprimentos automatizada pelo sistema. Ele consolida dados originados nos módulos de Cotação, Follow-up Logístico, Entrega e Avaria para apresentar indicadores-chave de desempenho (KPIs), painéis visuais e classificações operacionais que suportam a tomada de decisão pela equipe de Compras.

Este módulo existe para atacar diretamente o problema de "baixa qualidade analítica para gestão de fornecedores, obras e compras" identificado no PRDGlobal §1.1. Ao consolidar informações de cotações, pedidos, prazos, entregas e avarias em uma interface analítica unificada, o dashboard permite que Compras identifique gargalos, fornecedores problemáticos, tendências de atraso e eficiência operacional sem precisar consultar dados fragmentados em planilhas ou relatórios manuais.

O valor entregue inclui: monitoramento contínuo da operação com atualização diária, sinalização de criticidade por item e obra, ranking de confiabilidade de fornecedores e resumos rápidos que destacam imediatamente os pontos que exigem ação — cotações abertas, pedidos atrasados, avarias e falhas de integração.

## 2. Escopo funcional

### 2.1 Incluso neste PRD

- Implementação dos 5 dashboards oficiais da V1.0: Lead Time, Atrasos, Criticidade, Ranking de Fornecedores e Avarias. _(PRDGlobal §13.1)_
- Implementação dos filtros globais de dashboard: Fornecedor, Obra, Pedido e Item. _(PRDGlobal §13.2)_
- Frequência de atualização diária dos indicadores. _(PRDGlobal §13.3)_
- Implementação dos 6 KPIs oficiais iniciais e suas fórmulas derivadas. _(PRDGlobal §13.4, §13.5)_
- Implementação do cálculo de criticidade por item/insumo. _(PRDGlobal §13.6)_
- Implementação da sinalização de confiabilidade do fornecedor (Confiável, Atenção, Crítico). _(PRDGlobal §13.7)_
- Implementação dos resumos rápidos do dashboard. _(PRDGlobal §13.8)_
- Camada de agregação e cálculo para alimentar os indicadores.
- Componentes de interface para visualização dos dashboards.
- Auditoria de acesso aos dashboards.

### 2.2 Excluído deste PRD

- Importação e sincronização de cotações do Sienge — coberto pelo PRD 02 (Fluxo de Cotação) e PRD 07 (Integração com o Sienge).
- Cálculo e gestão de status operacionais de pedido (Atrasado, Entregue, Parcialmente Entregue, etc.) — coberto pelo PRD 05 (Entrega, Divergência e Status de Pedido).
- Cálculo e gestão da régua de follow-up e dias úteis — coberto pelo PRD 04 (Follow-up Logístico).
- Registro e tratamento de avarias e ações corretivas — coberto pelo PRD 06 (Avaria e Ação Corretiva).
- Filtro rápido "Exigem ação" e priorização visual da operação — coberto pelo PRD 09 (Backoffice, Auditoria e Operação). _(PRDGlobal §12.3, §12.4)_
- Tela de listagem de cotações e pedidos do backoffice — coberto pelo PRD 09.
- Gestão de acessos e perfis — coberto pelo PRD 01 (Autenticação e Perfis).
- Monitoramento de integrações e reprocessamento de falhas — coberto pelo PRD 09.

### 2.3 Fora de escopo da V1.0

- Dashboards com atualização em tempo real (a V1.0 define atualização diária). _(PRDGlobal §13.3)_
- Exportação de relatórios em PDF ou Excel a partir do dashboard (não mencionado no PRDGlobal §13).
- Alertas proativos automatizados por e-mail baseados em indicadores do dashboard (não mencionado no PRDGlobal §13).
- Dashboards personalizáveis pelo usuário (não mencionado no PRDGlobal §13).
- Régua separada por parcela de entrega do mesmo item. _(PRDGlobal §2.3)_

## 3. Perfis envolvidos

| Perfil                      | Acesso ao Dashboard | Permissões                                                                                                         | Restrições                                                        |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Compras**                 | ✅ Sim              | Visualizar todos os dashboards, aplicar filtros, consultar KPIs, rankings e resumos rápidos.                       | Não altera dados; apenas consulta.                                |
| **Administrador**           | ✅ Sim              | Mesmo acesso de visualização que Compras. Parametrização de regras que afetam cálculos (via módulo de Backoffice). | Não altera dados diretamente no dashboard.                        |
| **Fornecedor**              | ❌ Não              | Sem acesso a dashboards ou indicadores.                                                                            | _(PRDGlobal §3.2 — Fornecedor consulta apenas histórico próprio)_ |
| **Visualizador de Pedidos** | ❌ Não              | Sem acesso a dashboards, indicadores, parametrizações ou ações operacionais.                                       | _(PRDGlobal §3.2 — explicitamente excluído)_                      |

## 4. Entidades e modelagem

### 4.1 `dashboard_snapshot`

Armazena snapshots diários dos indicadores agregados para suportar a frequência de atualização diária definida no PRDGlobal §13.3.

| Campo                        | Tipo          | Obrigatório | Descrição                                                                |
| ---------------------------- | ------------- | ----------- | ------------------------------------------------------------------------ |
| `id`                         | UUID          | Sim         | Identificador único do snapshot.                                         |
| `snapshot_date`              | DATE          | Sim         | Data de referência do snapshot (dia da consolidação).                    |
| `cotacoes_enviadas`          | INTEGER       | Sim         | Total de cotações enviadas no período. _(§13.5)_                         |
| `cotacoes_respondidas`       | INTEGER       | Sim         | Total de cotações com resposta válida. _(§13.5)_                         |
| `cotacoes_sem_resposta`      | INTEGER       | Sim         | Total de cotações vencidas com status "Sem resposta". _(§13.5)_          |
| `pedidos_no_prazo`           | INTEGER       | Sim         | Total de pedidos com entrega confirmada até a data prometida. _(§13.5)_  |
| `pedidos_atrasados`          | INTEGER       | Sim         | Total de pedidos com status "Atrasado". _(§13.5)_                        |
| `pedidos_com_avaria`         | INTEGER       | Sim         | Total de pedidos com registro de avaria. _(§13.5)_                       |
| `total_pedidos_monitorados`  | INTEGER       | Sim         | Base de cálculo para taxas percentuais.                                  |
| `lead_time_medio_dias_uteis` | DECIMAL(10,2) | Não         | Média em dias úteis entre data do pedido e entrega confirmada. _(§13.5)_ |
| `created_at`                 | TIMESTAMPTZ   | Sim         | Data/hora de criação do snapshot.                                        |

**Relacionamentos:** Nenhum FK direto; dados derivados de `cotacoes`, `pedidos`, `entregas` e `avarias`.
**Índices sugeridos:** `(snapshot_date)` UNIQUE, `(created_at)`.
**Regras de integridade:** Um único snapshot por `snapshot_date`. O snapshot não pode ser alterado após criação — novos cálculos geram novo snapshot (idempotência).

### 4.2 `dashboard_snapshot_por_fornecedor`

Armazena métricas diárias por fornecedor para suportar o ranking de fornecedores e a sinalização de confiabilidade.

| Campo                        | Tipo          | Obrigatório | Descrição                                                         |
| ---------------------------- | ------------- | ----------- | ----------------------------------------------------------------- |
| `id`                         | UUID          | Sim         | Identificador único.                                              |
| `snapshot_date`              | DATE          | Sim         | Data de referência do snapshot.                                   |
| `supplier_id`                | INTEGER       | Sim         | `supplierId` do Sienge.                                           |
| `supplier_name`              | VARCHAR(255)  | Sim         | Nome do fornecedor (desnormalizado para performance de consulta). |
| `cotacoes_enviadas`          | INTEGER       | Sim         | Total de cotações enviadas ao fornecedor.                         |
| `cotacoes_respondidas`       | INTEGER       | Sim         | Total de cotações respondidas pelo fornecedor.                    |
| `pedidos_no_prazo`           | INTEGER       | Sim         | Total de pedidos entregues no prazo.                              |
| `pedidos_atrasados`          | INTEGER       | Sim         | Total de pedidos atrasados.                                       |
| `pedidos_com_avaria`         | INTEGER       | Sim         | Total de pedidos com avaria.                                      |
| `lead_time_medio_dias_uteis` | DECIMAL(10,2) | Não         | Lead time médio do fornecedor.                                    |
| `confiabilidade`             | VARCHAR(20)   | Sim         | Classificação: `confiavel`, `atencao` ou `critico`. _(§13.7)_     |
| `created_at`                 | TIMESTAMPTZ   | Sim         | Data/hora de criação.                                             |

**Relacionamentos:** Referência lógica a `fornecedores` via `supplier_id`.
**Índices sugeridos:** `(snapshot_date, supplier_id)` UNIQUE, `(supplier_id)`, `(confiabilidade)`.
**Regras de integridade:** Um único registro por `(snapshot_date, supplier_id)`.

### 4.3 `dashboard_snapshot_por_obra`

Armazena métricas diárias por obra para suportar os filtros por obra e o dashboard de criticidade.

| Campo                        | Tipo          | Obrigatório | Descrição                                     |
| ---------------------------- | ------------- | ----------- | --------------------------------------------- |
| `id`                         | UUID          | Sim         | Identificador único.                          |
| `snapshot_date`              | DATE          | Sim         | Data de referência do snapshot.               |
| `building_id`                | INTEGER       | Sim         | `buildingId` do Sienge.                       |
| `building_name`              | VARCHAR(255)  | Não         | Nome da obra (desnormalizado, se disponível). |
| `pedidos_no_prazo`           | INTEGER       | Sim         | Total de pedidos no prazo para a obra.        |
| `pedidos_atrasados`          | INTEGER       | Sim         | Total de pedidos atrasados.                   |
| `pedidos_com_avaria`         | INTEGER       | Sim         | Total de pedidos com avaria.                  |
| `lead_time_medio_dias_uteis` | DECIMAL(10,2) | Não         | Lead time médio para a obra.                  |
| `created_at`                 | TIMESTAMPTZ   | Sim         | Data/hora de criação.                         |

**Relacionamentos:** Referência lógica à obra via `building_id`.
**Índices sugeridos:** `(snapshot_date, building_id)` UNIQUE, `(building_id)`.
**Regras de integridade:** Um único registro por `(snapshot_date, building_id)`.

### 4.4 `dashboard_criticidade_item`

Armazena a classificação de criticidade por item/insumo conforme §13.6.

| Campo                        | Tipo          | Obrigatório | Descrição                                  |
| ---------------------------- | ------------- | ----------- | ------------------------------------------ |
| `id`                         | UUID          | Sim         | Identificador único.                       |
| `snapshot_date`              | DATE          | Sim         | Data de referência.                        |
| `item_identifier`            | VARCHAR(100)  | Sim         | Identificador do item/insumo.              |
| `item_description`           | VARCHAR(500)  | Não         | Descrição do item.                         |
| `building_id`                | INTEGER       | Não         | Obra associada.                            |
| `prazo_obra_dias_uteis`      | INTEGER       | Não         | Prazo restante da obra em dias úteis.      |
| `media_historica_dias_uteis` | DECIMAL(10,2) | Não         | Média histórica de entrega do item/insumo. |
| `criticidade`                | VARCHAR(20)   | Sim         | `urgente` ou `padrao`. _(§13.6)_           |
| `created_at`                 | TIMESTAMPTZ   | Sim         | Data/hora de criação.                      |

**Relacionamentos:** Referência lógica a itens de pedido e obras.
**Índices sugeridos:** `(snapshot_date, item_identifier)`, `(criticidade)`, `(building_id)`.
**Regras de integridade:** Sem histórico suficiente, classificar como `padrao`. _(§13.6)_

## 5. Regras de negócio

- **RN-01:** Os dashboards oficiais da V1.0 são exclusivamente: Lead Time, Atrasos, Criticidade, Ranking de Fornecedores e Avarias. _(PRDGlobal §13.1)_
- **RN-02:** Os filtros disponíveis em todos os dashboards são: Fornecedor, Obra, Pedido e Item. _(PRDGlobal §13.2)_
- **RN-03:** A atualização dos indicadores é diária. Os dados exibidos refletem a situação consolidada até o fechamento do dia anterior. _(PRDGlobal §13.3)_
- **RN-04:** `Cotações enviadas` = total de cotações enviadas no período selecionado. _(PRDGlobal §13.5)_
- **RN-05:** `Cotações respondidas` = total de cotações com resposta válida do fornecedor no período selecionado. _(PRDGlobal §13.5)_
- **RN-06:** `Cotações sem resposta` = total de cotações vencidas com status "Sem resposta" no período selecionado. _(PRDGlobal §13.5)_
- **RN-07:** `Pedidos no prazo` = total de pedidos com entrega confirmada até a data prometida. _(PRDGlobal §13.5)_
- **RN-08:** `Pedidos atrasados` = total de pedidos com status "Atrasado" no período selecionado. _(PRDGlobal §13.5)_
- **RN-09:** `Pedidos com avaria` = total de pedidos que tiveram ao menos um registro de avaria no período selecionado. _(PRDGlobal §13.5)_
- **RN-10:** `Taxa de resposta de cotação` = Cotações respondidas / Cotações enviadas × 100. _(PRDGlobal §13.5)_
- **RN-11:** `Taxa de cotações sem resposta` = Cotações sem resposta / Cotações enviadas × 100. _(PRDGlobal §13.5)_
- **RN-12:** `Taxa de pedidos no prazo` = Pedidos no prazo / Total de pedidos monitorados × 100. _(PRDGlobal §13.5)_
- **RN-13:** `Taxa de atraso` = Pedidos atrasados / Total de pedidos monitorados × 100. _(PRDGlobal §13.5)_
- **RN-14:** `Taxa de avaria` = Pedidos com avaria / Total de pedidos monitorados × 100. _(PRDGlobal §13.5)_
- **RN-15:** `Lead time médio` = média, em dias úteis, entre a Data do Pedido no Sienge e a Data de entrega confirmada. _(PRDGlobal §13.5)_
- **RN-16:** O cálculo de dias úteis considera apenas feriados nacionais (regra consistente com o módulo de Follow-up). _(PRDGlobal §6.1)_
- **RN-17:** Criticidade `Urgente` quando o prazo da obra for menor que a média histórica do item ou insumo. _(PRDGlobal §13.6)_
- **RN-18:** Criticidade `Padrão` quando o prazo da obra for maior ou igual à média histórica. _(PRDGlobal §13.6)_
- **RN-19:** Sem histórico suficiente para calcular criticidade, classificar como `Padrão`. _(PRDGlobal §13.6)_
- **RN-20:** Sinalização `Confiável`: sem atraso e sem avaria nos últimos 3 meses. _(PRDGlobal §13.7)_
- **RN-21:** Sinalização `Atenção`: com atraso ou com avaria nos últimos 3 meses. _(PRDGlobal §13.7)_
- **RN-22:** Sinalização `Crítico`: com atraso e com avaria nos últimos 3 meses. _(PRDGlobal §13.7)_
- **RN-23:** O dashboard deve exibir no mínimo os resumos rápidos: cotações abertas, cotações aguardando revisão, pedidos atrasados, pedidos em avaria e falhas de integração. _(PRDGlobal §13.8)_
- **RN-24:** Apenas os perfis `Compras` e `Administrador` podem acessar dashboards e indicadores. O `Visualizador de Pedidos` está explicitamente excluído. _(PRDGlobal §3.2)_
- **RN-25:** O `Fornecedor` não tem acesso a dashboards ou indicadores. _(PRDGlobal §3.2)_

## 6. Fluxos operacionais

### 6.1 Fluxo de consolidação diária dos indicadores

**Descrição passo a passo:**

1. Um job agendado é disparado diariamente (após o fim do dia útil ou em horário definido pela parametrização).
2. O job consulta as tabelas de cotações, pedidos, entregas e avarias para consolidar os KPIs do dia.
3. Para cada KPI, aplica a fórmula definida em §13.5.
4. Calcula o lead time médio em dias úteis (excluindo fins de semana e feriados nacionais).
5. Para cada fornecedor ativo, calcula métricas individuais e atribui a sinalização de confiabilidade conforme §13.7 (consultando os últimos 3 meses).
6. Para cada obra com pedidos ativos, calcula métricas agregadas.
7. Para cada item/insumo relevante, calcula a criticidade conforme §13.6.
8. Persiste os resultados nas tabelas de snapshot correspondentes.
9. Em caso de erro no job, registra log de erro e notifica via trilha de auditoria. O snapshot do dia não é criado parcialmente.

**Diagrama de estados:**

```
[Agendado] → [Executando consolidação] → [Snapshot criado] → [Disponível para consulta]
                        ↓
               [Erro na consolidação] → [Log registrado] → [Retry no próximo ciclo]
```

**Exceções e tratamento de erro:**

- Se houver erro de acesso ao banco durante a consolidação, o job deve ser reenfileirado para o próximo ciclo.
- O snapshot deve ser atômico: ou todos os dados são persistidos ou nenhum (transaction).
- Dados faltantes (ex.: obra sem pedido) não geram erro; o registro simplesmente não é criado para aquela dimensão.

### 6.2 Fluxo de consulta do dashboard pelo usuário

**Descrição passo a passo:**

1. O usuário (`Compras` ou `Administrador`) acessa a seção de Dashboard no backoffice.
2. O sistema verifica o perfil do usuário. Se `Fornecedor` ou `Visualizador de Pedidos`, retorna erro 403.
3. O sistema carrega o snapshot mais recente disponível para a data atual.
4. Os resumos rápidos (§13.8) são exibidos na entrada do dashboard.
5. O usuário pode navegar entre os 5 dashboards: Lead Time, Atrasos, Criticidade, Ranking de Fornecedores e Avarias.
6. O usuário pode aplicar filtros: Fornecedor, Obra, Pedido, Item.
7. Ao aplicar filtros, o sistema recalcula a exibição a partir dos dados do snapshot filtrados pela dimensão selecionada.
8. O acesso é registrado na trilha de auditoria.

**Exceções e tratamento de erro:**

- Se não houver snapshot disponível (ex.: sistema recém-implantado), exibir mensagem informativa sem dados, sem erro.
- Se o filtro não retornar resultados, exibir mensagem de "Nenhum dado encontrado para os filtros selecionados".

## 7. Contratos de API / Serviços

### 7.1 `GET /api/dashboard/resumo`

Retorna os resumos rápidos do dashboard conforme §13.8.

**Entrada:**

| Campo             | Tipo | Obrigatório | Descrição                                              |
| ----------------- | ---- | ----------- | ------------------------------------------------------ |
| `data_referencia` | DATE | Não         | Data do snapshot. Default: último snapshot disponível. |

**Saída:**

| Campo                         | Tipo    | Descrição                                        |
| ----------------------------- | ------- | ------------------------------------------------ |
| `cotacoes_abertas`            | INTEGER | Total de cotações com status em negociação.      |
| `cotacoes_aguardando_revisao` | INTEGER | Total de cotações aguardando revisão de Compras. |
| `pedidos_atrasados`           | INTEGER | Total de pedidos com status "Atrasado".          |
| `pedidos_em_avaria`           | INTEGER | Total de pedidos com status "Em avaria".         |
| `falhas_integracao`           | INTEGER | Total de falhas de integração ativas.            |
| `data_snapshot`               | DATE    | Data de referência dos dados.                    |

**Erros esperados:**

| Código | Descrição                                                      |
| ------ | -------------------------------------------------------------- |
| 401    | Não autenticado.                                               |
| 403    | Perfil não autorizado (Fornecedor ou Visualizador de Pedidos). |
| 404    | Nenhum snapshot disponível.                                    |

**Perfis autorizados:** `Compras`, `Administrador`.

### 7.2 `GET /api/dashboard/kpis`

Retorna os KPIs oficiais e fórmulas derivadas conforme §13.4 e §13.5.

**Entrada:**

| Campo         | Tipo    | Obrigatório | Descrição                                  |
| ------------- | ------- | ----------- | ------------------------------------------ |
| `data_inicio` | DATE    | Não         | Início do período. Default: 30 dias atrás. |
| `data_fim`    | DATE    | Não         | Fim do período. Default: data atual.       |
| `supplier_id` | INTEGER | Não         | Filtro por fornecedor.                     |
| `building_id` | INTEGER | Não         | Filtro por obra.                           |

**Saída:**

| Campo                        | Tipo    | Descrição                   |
| ---------------------------- | ------- | --------------------------- |
| `cotacoes_enviadas`          | INTEGER | _(§13.5)_                   |
| `cotacoes_respondidas`       | INTEGER | _(§13.5)_                   |
| `cotacoes_sem_resposta`      | INTEGER | _(§13.5)_                   |
| `pedidos_no_prazo`           | INTEGER | _(§13.5)_                   |
| `pedidos_atrasados`          | INTEGER | _(§13.5)_                   |
| `pedidos_com_avaria`         | INTEGER | _(§13.5)_                   |
| `taxa_resposta_cotacao`      | DECIMAL | _(§13.5)_                   |
| `taxa_cotacoes_sem_resposta` | DECIMAL | _(§13.5)_                   |
| `taxa_pedidos_no_prazo`      | DECIMAL | _(§13.5)_                   |
| `taxa_atraso`                | DECIMAL | _(§13.5)_                   |
| `taxa_avaria`                | DECIMAL | _(§13.5)_                   |
| `lead_time_medio_dias_uteis` | DECIMAL | _(§13.5)_                   |
| `total_pedidos_monitorados`  | INTEGER | Base de cálculo.            |
| `periodo`                    | OBJECT  | `{ data_inicio, data_fim }` |

**Erros esperados:**

| Código | Descrição                                  |
| ------ | ------------------------------------------ |
| 401    | Não autenticado.                           |
| 403    | Perfil não autorizado.                     |
| 400    | Período inválido (data_inicio > data_fim). |

**Perfis autorizados:** `Compras`, `Administrador`.

### 7.3 `GET /api/dashboard/lead-time`

Retorna dados detalhados do dashboard de Lead Time.

**Entrada:**

| Campo               | Tipo    | Obrigatório | Descrição              |
| ------------------- | ------- | ----------- | ---------------------- |
| `data_inicio`       | DATE    | Não         | Início do período.     |
| `data_fim`          | DATE    | Não         | Fim do período.        |
| `supplier_id`       | INTEGER | Não         | Filtro por fornecedor. |
| `building_id`       | INTEGER | Não         | Filtro por obra.       |
| `purchase_order_id` | INTEGER | Não         | Filtro por pedido.     |
| `item_identifier`   | VARCHAR | Não         | Filtro por item.       |

**Saída:**

| Campo                      | Tipo    | Descrição                                                    |
| -------------------------- | ------- | ------------------------------------------------------------ |
| `lead_time_medio_global`   | DECIMAL | Lead time geral em dias úteis.                               |
| `lead_time_por_fornecedor` | ARRAY   | `[{ supplier_id, supplier_name, lead_time_medio }]`          |
| `lead_time_por_obra`       | ARRAY   | `[{ building_id, building_name, lead_time_medio }]`          |
| `evolucao_diaria`          | ARRAY   | `[{ data, lead_time_medio }]` — série temporal para gráfico. |

**Erros esperados:** 401, 403.

**Perfis autorizados:** `Compras`, `Administrador`.

### 7.4 `GET /api/dashboard/atrasos`

Retorna dados detalhados do dashboard de Atrasos.

**Entrada:**

| Campo         | Tipo    | Obrigatório | Descrição              |
| ------------- | ------- | ----------- | ---------------------- |
| `data_inicio` | DATE    | Não         | Início do período.     |
| `data_fim`    | DATE    | Não         | Fim do período.        |
| `supplier_id` | INTEGER | Não         | Filtro por fornecedor. |
| `building_id` | INTEGER | Não         | Filtro por obra.       |

**Saída:**

| Campo                    | Tipo    | Descrição                                                        |
| ------------------------ | ------- | ---------------------------------------------------------------- |
| `total_atrasados`        | INTEGER | Total de pedidos atrasados.                                      |
| `taxa_atraso`            | DECIMAL | Percentual de atraso.                                            |
| `atrasos_por_fornecedor` | ARRAY   | `[{ supplier_id, supplier_name, total_atrasados, taxa_atraso }]` |
| `atrasos_por_obra`       | ARRAY   | `[{ building_id, building_name, total_atrasados }]`              |
| `evolucao_diaria`        | ARRAY   | `[{ data, total_atrasados, taxa_atraso }]` — série temporal.     |

**Erros esperados:** 401, 403.

**Perfis autorizados:** `Compras`, `Administrador`.

### 7.5 `GET /api/dashboard/criticidade`

Retorna dados detalhados do dashboard de Criticidade.

**Entrada:**

| Campo             | Tipo    | Obrigatório | Descrição        |
| ----------------- | ------- | ----------- | ---------------- |
| `building_id`     | INTEGER | Não         | Filtro por obra. |
| `item_identifier` | VARCHAR | Não         | Filtro por item. |

**Saída:**

| Campo            | Tipo    | Descrição                                                                                                                             |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `total_urgentes` | INTEGER | Itens classificados como Urgente.                                                                                                     |
| `total_padrao`   | INTEGER | Itens classificados como Padrão.                                                                                                      |
| `itens`          | ARRAY   | `[{ item_identifier, item_description, building_id, building_name, prazo_obra_dias_uteis, media_historica_dias_uteis, criticidade }]` |

**Erros esperados:** 401, 403.

**Perfis autorizados:** `Compras`, `Administrador`.

### 7.6 `GET /api/dashboard/ranking-fornecedores`

Retorna dados detalhados do dashboard de Ranking de Fornecedores.

**Entrada:**

| Campo         | Tipo | Obrigatório | Descrição          |
| ------------- | ---- | ----------- | ------------------ |
| `data_inicio` | DATE | Não         | Início do período. |
| `data_fim`    | DATE | Não         | Fim do período.    |

**Saída:**

| Campo          | Tipo  | Descrição                                                                                                                                                                            |
| -------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fornecedores` | ARRAY | `[{ supplier_id, supplier_name, cotacoes_enviadas, cotacoes_respondidas, taxa_resposta, pedidos_no_prazo, pedidos_atrasados, pedidos_com_avaria, lead_time_medio, confiabilidade }]` |

**Erros esperados:** 401, 403.

**Perfis autorizados:** `Compras`, `Administrador`.

### 7.7 `GET /api/dashboard/avarias`

Retorna dados detalhados do dashboard de Avarias.

**Entrada:**

| Campo         | Tipo    | Obrigatório | Descrição              |
| ------------- | ------- | ----------- | ---------------------- |
| `data_inicio` | DATE    | Não         | Início do período.     |
| `data_fim`    | DATE    | Não         | Fim do período.        |
| `supplier_id` | INTEGER | Não         | Filtro por fornecedor. |
| `building_id` | INTEGER | Não         | Filtro por obra.       |

**Saída:**

| Campo                        | Tipo    | Descrição                                                      |
| ---------------------------- | ------- | -------------------------------------------------------------- |
| `total_avarias`              | INTEGER | Total de avarias registradas.                                  |
| `taxa_avaria`                | DECIMAL | Percentual de pedidos com avaria.                              |
| `avarias_por_fornecedor`     | ARRAY   | `[{ supplier_id, supplier_name, total_avarias, taxa_avaria }]` |
| `avarias_por_obra`           | ARRAY   | `[{ building_id, building_name, total_avarias }]`              |
| `avarias_por_acao_corretiva` | OBJECT  | `{ cancelamentos, reposicoes }`                                |
| `evolucao_diaria`            | ARRAY   | `[{ data, total_avarias }]` — série temporal.                  |

**Erros esperados:** 401, 403.

**Perfis autorizados:** `Compras`, `Administrador`.

### 7.8 Serviço interno: `DashboardConsolidationJob`

Serviço executado como job agendado (worker ou cron) para consolidação diária.

**Método e rota:** Não é endpoint HTTP externo — é um job interno executado por agendamento.

**Entrada:** Nenhuma (autodescoberta da data de referência).

**Saída:** Snapshots criados nas tabelas `dashboard_snapshot`, `dashboard_snapshot_por_fornecedor`, `dashboard_snapshot_por_obra` e `dashboard_criticidade_item`.

**Erros esperados:**

| Erro                         | Tratamento                                                   |
| ---------------------------- | ------------------------------------------------------------ |
| Erro de conexão ao banco     | Retry no próximo ciclo agendado. Log registrado.             |
| Snapshot do dia já existente | Job é idempotente — recalcula e substitui o snapshot do dia. |

**Perfis autorizados:** Apenas job interno do sistema (sem interação de usuário).

## 8. Interface do usuário

### 8.1 Tela: Resumos Rápidos (Entrada do Dashboard)

**Nome e propósito:** Visão geral rápida com os indicadores mais críticos da operação. Primeira tela exibida ao acessar a seção de Dashboard.

**Campos exibidos:**

- Cotações abertas (contagem com ícone).
- Cotações aguardando revisão (contagem com ícone).
- Pedidos atrasados (contagem com ícone, destaque vermelho). _(§12.5)_
- Pedidos em avaria (contagem com ícone, destaque roxo). _(§12.5)_
- Falhas de integração (contagem com ícone, destaque vermelho). _(§12.5)_
- Data do último snapshot (informativo).

**Ações disponíveis por perfil:**

- `Compras`: Visualizar. Clicar em qualquer card para navegar ao dashboard detalhado correspondente.
- `Administrador`: Mesmas ações que Compras.

**Referências visuais:**

- Cards com fundo branco (`#FFFFFF`), borda sutil e ícones na paleta institucional.
- Valores numéricos em destaque com Azul Escuro (`#324598`).
- Contagens de alerta com cores operacionais conforme §12.5.
- Ícones em Turquesa (`#19B4BE`) para estados normais.

### 8.2 Tela: Dashboard de Lead Time

**Nome e propósito:** Análise do tempo médio entre pedido e entrega confirmada, permitindo identificar gargalos de eficiência por fornecedor e obra.

**Campos exibidos:**

- Lead time médio global (número grande em destaque).
- Gráfico de evolução diária do lead time (linha temporal).
- Lead time por fornecedor (tabela ordenável).
- Lead time por obra (tabela ordenável).
- Filtros: Fornecedor, Obra, Pedido, Item.

**Ações disponíveis por perfil:**

- `Compras` / `Administrador`: Visualizar, aplicar filtros, ordenar tabelas.

**Referências visuais:**

- Gráfico com linha em Turquesa (`#19B4BE`) sobre fundo branco.
- Área sob a linha com gradiente sutil de Azul Claro (`#6ED8E0`).
- Cabeçalhos de tabela em Azul Escuro (`#324598`).
- Hover em linhas de tabela com Azul Claro (`#6ED8E0`) com opacidade reduzida.

### 8.3 Tela: Dashboard de Atrasos

**Nome e propósito:** Monitoramento de pedidos atrasados e taxa de atraso por fornecedor e obra.

**Campos exibidos:**

- Total de pedidos atrasados e taxa de atraso (cards de resumo).
- Gráfico de evolução diária de atrasos (barras ou linha).
- Atrasos por fornecedor (tabela com ranking).
- Atrasos por obra (tabela).
- Filtros: Fornecedor, Obra.

**Ações disponíveis por perfil:**

- `Compras` / `Administrador`: Visualizar, aplicar filtros, ordenar.

**Referências visuais:**

- Card de total de atrasos com fundo vermelho suave.
- Barras do gráfico em vermelho com gradiente.
- Meta de atraso < 10% indicada com linha de referência verde. _(§1.3)_

### 8.4 Tela: Dashboard de Criticidade

**Nome e propósito:** Classificação de itens/insumos por criticidade operacional, identificando quais exigem atenção urgente.

**Campos exibidos:**

- Contagem de itens `Urgente` vs `Padrão` (donut chart ou cards).
- Lista de itens com classificação de criticidade, obra, prazo da obra e média histórica.
- Filtros: Obra, Item.

**Ações disponíveis por perfil:**

- `Compras` / `Administrador`: Visualizar, aplicar filtros.

**Referências visuais:**

- Badge `Urgente` com fundo vermelho.
- Badge `Padrão` com fundo Azul Médio (`#465EBE`).
- Itens urgentes destacados no topo da lista.

### 8.5 Tela: Dashboard de Ranking de Fornecedores

**Nome e propósito:** Classificação e comparação dos fornecedores por desempenho operacional, incluindo taxa de resposta, atrasos, avarias e confiabilidade.

**Campos exibidos:**

- Tabela ranqueada com colunas: Fornecedor, Cotações enviadas, Cotações respondidas, Taxa de resposta, Pedidos no prazo, Pedidos atrasados, Pedidos com avaria, Lead time médio, Confiabilidade.
- Badge de confiabilidade por fornecedor: `Confiável`, `Atenção`, `Crítico`.
- Filtros: Período (data_inicio, data_fim).

**Ações disponíveis por perfil:**

- `Compras` / `Administrador`: Visualizar, ordenar por qualquer coluna, filtrar por período.

**Referências visuais:**

- Badge `Confiável` em verde.
- Badge `Atenção` em amarelo/laranja.
- Badge `Crítico` em vermelho.
- Linhas da tabela com hover em Azul Claro (`#6ED8E0`) com opacidade reduzida.
- Cabeçalhos em Azul Escuro (`#324598`).

### 8.6 Tela: Dashboard de Avarias

**Nome e propósito:** Consolidação de avarias por fornecedor, obra e tipo de ação corretiva, permitindo identificar padrões e fornecedores problemáticos.

**Campos exibidos:**

- Total de avarias e taxa de avaria (cards de resumo).
- Gráfico de evolução diária de avarias (barras ou linha).
- Avarias por fornecedor (tabela com ranking).
- Avarias por obra (tabela).
- Avarias por tipo de ação corretiva (cancelamentos vs. reposições).
- Filtros: Fornecedor, Obra.

**Ações disponíveis por perfil:**

- `Compras` / `Administrador`: Visualizar, aplicar filtros, ordenar.

**Referências visuais:**

- Card de total de avarias com destaque roxo (`Em avaria` conforme §12.5).
- Gráfico com barras em roxo e azul (reposição conforme §12.5).

## 9. Integrações e dependências externas

### 9.1 Dependência do módulo de Fluxo de Cotação (PRD 02)

O dashboard consome dados de cotações para calcular os KPIs de cotações enviadas, respondidas e sem resposta. As entidades e status de cotação definidos no PRD 02 são pré-requisito para os cálculos.

- Dados consumidos: cotações com status `Em negociação`, `Aprovada por Compras`, `Integrada ao Sienge`, `Sem resposta`, etc.
- Não há integração direta com o Sienge a partir deste módulo — a sincronização já é feita pelo módulo de Cotação.

### 9.2 Dependência do módulo de Follow-up Logístico (PRD 04)

O cálculo de lead time médio depende do conceito de dias úteis implementado no módulo de Follow-up, que considera apenas feriados nacionais.

- Dados consumidos: história de datas de pedido e datas de entrega, feriados nacionais.
- Este módulo deve reutilizar a mesma função de cálculo de dias úteis definida no PRD 04 para garantir consistência.

### 9.3 Dependência do módulo de Entrega (PRD 05)

Os KPIs de pedidos no prazo, atrasados e parcialmente entregues dependem dos status calculados pelo módulo de Entrega.

- Dados consumidos: pedidos com status `Entregue`, `Parcialmente Entregue`, `Atrasado`, `Divergência`, `Cancelado`.
- Dados de `building_id` (obra) para agregações por obra.

### 9.4 Dependência do módulo de Avaria (PRD 06)

Os KPIs de avarias e o dashboard de avarias dependem dos registros do módulo de Avaria.

- Dados consumidos: registros de avaria, ações corretivas aplicadas (cancelamento ou reposição), status `Em avaria` e `Reposição`.

### 9.5 Dependência do módulo de Integração com Sienge (PRD 07)

Os resumos rápidos incluem "falhas de integração", que dependem dos status de integração definidos no PRD 07 e no PRD 09.

- Dados consumidos: contagem de eventos de integração com status `Falha de integração`. _(PRDGlobal §12.1)_

### 9.6 Integração direta com o Sienge

Este módulo **não realiza integração direta** com as APIs do Sienge. Todos os dados são derivados das entidades locais criadas pelos outros módulos. A única referência indireta é o uso de identificadores do Sienge (`supplier_id`, `building_id`, `purchase_order_id`) nas dimensões de filtragem.

## 10. Auditoria e rastreabilidade

Eventos auditáveis gerados por este módulo, conforme §12.6 do PRDGlobal:

| Evento                      | Tipo                            | Dados mínimos                                                    |
| --------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| Acesso ao dashboard         | `dashboard.access`              | Data/hora, usuário, dashboard acessado.                          |
| Snapshot diário gerado      | `dashboard.snapshot_created`    | Data/hora, data_referencia do snapshot, quantidade de registros. |
| Erro na consolidação diária | `dashboard.consolidation_error` | Data/hora, data_referencia, tipo de erro, resumo da falha.       |

Cada evento deve exibir no mínimo: _(PRDGlobal §12.6)_

- Data e hora.
- Tipo do evento.
- Usuário ou origem do evento.
- Resumo da ação realizada.

## 11. Validações pendentes de homologação

Da §17 do PRDGlobal, os seguintes itens impactam indiretamente este módulo:

| #   | Item de homologação (§17)                                         | Impacto no Dashboard                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | Validar `GET /purchase-invoices/deliveries-attended`              | O cálculo de `Pedidos no prazo` e `Lead time médio` depende de entregas confirmadas capturadas por este endpoint. Se o endpoint não cobrir todos os cenários de entrega, os KPIs podem ser subcontados. |
| 1   | Validar se `supplierId` corresponde a `creditorId`                | O ranking de fornecedores depende da identificação correta do fornecedor. Inconsistências entre `supplierId` e `creditorId` podem gerar duplicação no ranking.                                          |
| 7   | Validar cenários com múltiplas cotações em `purchaseQuotations[]` | Se um pedido referenciar múltiplas cotações, o contabilizador de "Cotações respondidas" e "Cotações enviadas" pode precisar de ajuste para evitar dupla contagem.                                       |

## 12. Critérios de aceite

- [x] Os 5 dashboards oficiais (Lead Time, Atrasos, Criticidade, Ranking de Fornecedores, Avarias) estão implementados e acessíveis. _(§13.1)_
- [x] Os filtros Fornecedor, Obra, Pedido e Item estão disponíveis e funcionais em todos os dashboards. _(§13.2)_
- [ ] Os indicadores são atualizados diariamente por job agendado. _(§13.3)_
- [ ] Os 6 KPIs oficiais (Cotações enviadas, Cotações respondidas, Cotações sem resposta, Pedidos no prazo, Pedidos atrasados, Pedidos com avaria) são exibidos corretamente. _(§13.4)_
- [ ] As 12 fórmulas derivadas (taxas e lead time médio) são calculadas corretamente conforme §13.5.
- [ ] O cálculo de lead time médio usa dias úteis, considerando apenas feriados nacionais. _(§13.5, §6.1)_
- [ ] A criticidade é classificada como `Urgente` quando o prazo da obra for menor que a média histórica do item. _(§13.6)_
- [ ] A criticidade é classificada como `Padrão` quando o prazo for maior ou igual à média histórica, ou quando não houver histórico suficiente. _(§13.6)_
- [ ] A sinalização de confiabilidade do fornecedor está implementada: `Confiável` (sem atraso e sem avaria nos últimos 3 meses), `Atenção` (atraso ou avaria), `Crítico` (atraso e avaria). _(§13.7)_
- [x] Os resumos rápidos exibem: cotações abertas, cotações aguardando revisão, pedidos atrasados, pedidos em avaria, falhas de integração. _(§13.8)_
- [ ] Apenas `Compras` e `Administrador` acessam os dashboards. `Fornecedor` e `Visualizador de Pedidos` recebem erro 403. _(§3.2)_
- [x] O acesso ao dashboard gera evento de auditoria. _(§12.6)_
- [ ] O snapshot diário é atômico e idempotente (reenfileiramento seguro).
- [ ] As cores operacionais seguem o padrão definido em §12.5.
- [ ] A paleta de cores da interface segue `docs/paleta_de_cores.md`.
- [ ] Todos os endpoints do dashboard retornam 401 para requisições não autenticadas.
- [ ] Os dados exibidos no dashboard são consistentes com os status operacionais dos módulos dependentes (Cotação, Follow-up, Entrega, Avaria).

**Nota (2026-05-02) — lacunas 8.1–8.3 (cobertura):** Filtros globais espelhados na API (`packages/shared/src/schemas/dashboard.ts`) e nas telas (`DashboardFilters` em Lead Time, Atrasos, Avarias, Ranking e Criticidade); escopo por `purchase_order_id` / `item_identifier` reutiliza narrowing no `DashboardController` com totais de destaque alinhados às agregações quando há filtro dimensional; evolução diária omitida para PO/item (evita série global fora do escopo). Auditoria `dashboard.access` com insert best-effort (`try/catch` + log). Testes: [`apps/api/src/modules/dashboard/dashboard.routes.test.ts`](../../apps/api/src/modules/dashboard/dashboard.routes.test.ts) (resumo, audit em dois endpoints, atrasos com PO, ranking por `supplier_id`, criticidade 400, resiliência de audit) e [`apps/web/src/pages/admin/DashboardHome.test.tsx`](../../apps/web/src/pages/admin/DashboardHome.test.tsx).

## 13. Fases de implementação sugeridas

### Fase 1: Modelagem e job de consolidação

1. Criar as tabelas de snapshot (`dashboard_snapshot`, `dashboard_snapshot_por_fornecedor`, `dashboard_snapshot_por_obra`, `dashboard_criticidade_item`).
2. Implementar o serviço `DashboardConsolidationJob` com os cálculos dos 6 KPIs oficiais e fórmulas derivadas.
3. Implementar o cálculo de confiabilidade do fornecedor (§13.7).
4. Implementar o cálculo de criticidade (§13.6).
5. Configurar o agendamento diário do job (cron/scheduler).
6. Implementar auditoria do job (snapshot criado, erro de consolidação).

### Fase 2: API de dashboard

1. Implementar `GET /api/dashboard/resumo` (resumos rápidos).
2. Implementar `GET /api/dashboard/kpis` (KPIs globais com filtros).
3. Implementar os 5 endpoints detalhados (lead-time, atrasos, criticidade, ranking-fornecedores, avarias).
4. Implementar controle de acesso (RBAC: apenas Compras e Administrador).
5. Implementar validação de filtros e tratamento de erro.

### Fase 3: Interface do dashboard

1. Implementar o componente de resumos rápidos (tela de entrada).
2. Implementar o dashboard de Lead Time com gráfico de evolução e tabelas.
3. Implementar o dashboard de Atrasos com gráfico e tabelas.
4. Implementar o dashboard de Criticidade com classificação por item.
5. Implementar o dashboard de Ranking de Fornecedores com badges de confiabilidade.
6. Implementar o dashboard de Avarias com gráfico e tabelas.
7. Implementar componente de filtros globais (Fornecedor, Obra, Pedido, Item).
8. Aplicar paleta de cores e identidade visual conforme `docs/paleta_de_cores.md`.

### Fase 4: Testes e validação

1. Testar cálculos dos KPIs com dados simulados.
2. Testar idempotência do job de consolidação.
3. Testar controle de acesso (perfis autorizados e não autorizados).
4. Testar filtros combinados.
5. Validar consistência dos dados com os módulos dependentes.

## 14. Riscos específicos do módulo

| Risco                                                                                                                                        | Probabilidade             | Impacto                                                       | Mitigação                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dados dos módulos dependentes ausentes ou inconsistentes.** O dashboard depende de 4 módulos que precisam estar implementados e populados. | Alta (na V1.0 inicial)    | Alto — dashboards vazios ou com dados incorretos.             | Implementar mensagens informativas quando não houver dados. Criar o job de consolidação de forma defensiva (aceitar ausência parcial de dados sem falha). |
| **Cálculo de lead time incorreto por diferença na implementação de dias úteis.**                                                             | Média                     | Médio — KPI principal inconsistente com follow-up.            | Reutilizar exatamente a mesma função de dias úteis do PRD 04, centralizada em `packages/shared` ou `packages/domain`.                                     |
| **Performance da consolidação diária com grande volume de dados.**                                                                           | Baixa (V1.0)              | Médio — job lento pode conflitar com horário de operação.     | Usar queries otimizadas, índices nas tabelas de origem e horário de consolidação fora do pico.                                                            |
| **Criticidade imprecisa por falta de histórico.**                                                                                            | Alta (início da operação) | Baixo — classificação default é `Padrão`, que é conservadora. | Conforme §13.6, sem histórico suficiente classificar como `Padrão`. Comunicar ao usuário quando dado de média histórica é insuficiente.                   |
| **Ranking de fornecedores com duplicação por inconsistência de `supplierId`.**                                                               | Baixa                     | Médio — ranking impreciso.                                    | Depende da validação §17.1 (homologação). Implementar deduplicação por `supplier_id`.                                                                     |
| **Resumos rápidos exibindo dados desatualizados.**                                                                                           | Média                     | Baixo — dados refletem D-1 por design.                        | Exibir claramente a data do snapshot na interface. A atualização diária é uma decisão de produto. _(§13.3)_                                               |
