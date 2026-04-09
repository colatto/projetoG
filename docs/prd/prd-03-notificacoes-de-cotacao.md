# PRD Filho — Notificações de Cotação

> Módulo: 3 de 9
> Seções do PRDGlobal: §5
> Dependências: 1 (Autenticação e Perfis), 2 (Fluxo de Cotação)
> Data de geração: 2026-04-06

---

## 1. Objetivo do módulo

O módulo de Notificações de Cotação é responsável por informar o fornecedor sobre novas cotações disponíveis no portal, utilizando o canal de e-mail como meio oficial de comunicação na V1.0. Ele garante que o fornecedor receba um e-mail contendo os dados obrigatórios da cotação — nome, número, data de início e data de fim — assim que a cotação for enviada por `Compras`.

Este módulo também sustenta a editabilidade controlada dos templates de notificação pelo `Administrador`, assegurando que os campos obrigatórios definidos pelo PRDGlobal permaneçam intactos enquanto o conteúdo textual complementar pode ser personalizado. Além disso, inclui as notificações de follow-up de cotação (lembretes e re-notificações sobre cotações pendentes) conforme previsto nos fluxos de envio e resposta do módulo de Cotação.

O valor central deste módulo está em aumentar a taxa de resposta dos fornecedores dentro do prazo, reduzir o esforço manual da equipe de `Compras` na cobrança de respostas e manter rastreabilidade completa de todas as comunicações enviadas.

## 2. Escopo funcional

### 2.1 Incluso neste PRD

- Envio de e-mail de nova cotação ao fornecedor quando `Compras` dispara o envio.
- Conteúdo obrigatório do e-mail de nova cotação: nome, número da cotação, data de início e data de fim.
- Template de notificação de nova cotação com áreas editáveis e campos obrigatórios protegidos.
- Edição de template pelo `Administrador`, respeitando limites definidos.
- Notificação de nova cotação para envio tardio (fornecedor liberado após envio inicial, dentro do prazo).
- Notificação a `Compras` quando uma cotação vence com status `Sem resposta`.
- Bloqueio de envio de notificações para fornecedor bloqueado.
- Bloqueio de envio de notificações para fornecedor sem e-mail válido (nem no Sienge, nem cadastrado localmente pelo `Administrador`).
- Registro de cada notificação enviada para auditoria e rastreabilidade.
- Templates editáveis para notificações de follow-up de cotação, respeitando a mesma regra de campos obrigatórios e conteúdo editável.
- Serviço de envio de e-mail transacional.

### 2.2 Excluído deste PRD

- Notificação por WhatsApp — excluída da V1.0; pertence à V2.0 *(PRDGlobal §2.2)*.
- Toda lógica de importação, resposta, aprovação e integração de cotação — pertence ao módulo 2 (Fluxo de Cotação).
- Notificações de follow-up logístico (régua de cobrança de pedidos) — pertence ao módulo 4 (Follow-up Logístico).
- Notificações de entrega, divergência e avaria — pertencem aos módulos 5 e 6.
- Notificações de falha de integração para `Compras` — pertence ao módulo 9 (Backoffice, Auditoria e Operação).
- Gestão de perfis, autenticação e controle de acesso — pertence ao módulo 1 (Autenticação e Perfis).
- Dashboards e indicadores de cotações enviadas/respondidas — pertence ao módulo 8 (Dashboard e Indicadores).

### 2.3 Fora de escopo da V1.0

- Notificação de nova cotação por WhatsApp *(PRDGlobal §2.2)*.
- Políticas avançadas de segurança para o serviço de e-mail além do mínimo operacional *(PRDGlobal §2.3)*.

## 3. Perfis envolvidos

| Perfil | Interação com este módulo | Permissões | Restrições |
|--------|--------------------------|------------|------------|
| **Fornecedor** | Recebe notificações de nova cotação por e-mail. Não interage diretamente com a gestão de notificações. | Receber e-mails de cotação. | Não edita templates. Não controla o envio. |
| **Compras** | Dispara o envio de cotações (ação que gatilha a notificação). Recebe notificação quando cotação vence com `Sem resposta`. | Ser notificado sobre cotações sem resposta. | Não edita templates de notificação. |
| **Administrador** | Edita templates de notificação dentro dos limites aprovados. | Editar conteúdo editável dos templates de notificação de cotação e de follow-up de cotação. | Não pode remover nem alterar campos obrigatórios do template. |
| **Visualizador de Pedidos** | Sem interação com este módulo. | Nenhuma. | Não acessa notificações, templates ou configurações. |

*(Referência: PRDGlobal §3.1, §3.2, §3.3)*

## 4. Entidades e modelagem

### 4.1 `notification_templates`

Template editável de notificação.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único do template. |
| `type` | ENUM | Sim | Tipo do template: `new_quotation`, `quotation_reminder`, `no_response_alert`. |
| `subject_template` | TEXT | Sim | Template do assunto do e-mail, com placeholders para campos obrigatórios. |
| `body_template` | TEXT | Sim | Template do corpo do e-mail, com placeholders para campos obrigatórios e áreas editáveis. |
| `mandatory_placeholders` | JSONB | Sim | Lista dos placeholders obrigatórios que não podem ser removidos (ex.: `{{nome}}`, `{{numero_cotacao}}`, `{{data_inicio}}`, `{{data_fim}}`). |
| `version` | INTEGER | Sim | Versão do template para rastreabilidade de edições. |
| `updated_by` | UUID | Sim | FK para o usuário (`Administrador`) que fez a última edição. |
| `updated_at` | TIMESTAMPTZ | Sim | Data e hora da última edição. |
| `created_at` | TIMESTAMPTZ | Sim | Data e hora de criação. |
| `is_active` | BOOLEAN | Sim | Indica se o template está ativo. Default: `true`. |

**Relacionamentos:**
- `updated_by` → `users.id` (módulo 1).

**Índices sugeridos:**
- `idx_notification_templates_type` em `type`.
- `idx_notification_templates_active` em `(type, is_active)`.

**Regras de integridade:**
- Cada `type` deve ter exatamente um template ativo por vez.
- Os `mandatory_placeholders` devem estar presentes tanto no `subject_template` quanto no `body_template`, conforme aplicável ao tipo.
- Ao editar, o sistema deve validar que todos os `mandatory_placeholders` continuam presentes no template antes de salvar.

---

### 4.2 `notification_logs`

Registro de cada notificação enviada.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único do registro. |
| `template_id` | UUID | Sim | FK para o template utilizado no envio. |
| `template_version` | INTEGER | Sim | Versão do template no momento do envio (snapshot). |
| `type` | ENUM | Sim | Tipo da notificação enviada: `new_quotation`, `quotation_reminder`, `no_response_alert`. |
| `recipient_email` | VARCHAR(255) | Sim | E-mail do destinatário. |
| `recipient_supplier_id` | INTEGER | Não | `supplierId` do fornecedor destinatário, quando aplicável. |
| `recipient_user_id` | UUID | Não | ID do usuário destinatário, quando aplicável (ex.: `Compras`). |
| `quotation_id` | INTEGER | Sim | `purchaseQuotationId` da cotação relacionada. |
| `subject` | TEXT | Sim | Assunto renderizado do e-mail enviado. |
| `body_snapshot` | TEXT | Sim | Corpo do e-mail renderizado e enviado (snapshot para auditoria). |
| `status` | ENUM | Sim | Status do envio: `sent`, `failed`, `bounced`. |
| `error_message` | TEXT | Não | Mensagem de erro em caso de falha no envio. |
| `sent_at` | TIMESTAMPTZ | Não | Data e hora do envio efetivo. |
| `created_at` | TIMESTAMPTZ | Sim | Data e hora da criação do registro. |
| `triggered_by` | UUID | Não | ID do usuário que desencadeou o envio (ex.: `Compras` ao enviar cotação). |

**Relacionamentos:**
- `template_id` → `notification_templates.id`.
- `recipient_supplier_id` → referência lógica ao `supplierId` do Sienge (persistido localmente via módulo 2).
- `recipient_user_id` → `users.id` (módulo 1).
- `quotation_id` → referência lógica à cotação persistida (módulo 2).
- `triggered_by` → `users.id` (módulo 1).

**Índices sugeridos:**
- `idx_notification_logs_quotation` em `quotation_id`.
- `idx_notification_logs_supplier` em `recipient_supplier_id`.
- `idx_notification_logs_type_status` em `(type, status)`.
- `idx_notification_logs_sent_at` em `sent_at`.

**Regras de integridade:**
- Todo envio de notificação deve gerar um registro nesta tabela, independentemente do resultado.
- O `body_snapshot` deve conter o e-mail renderizado completo, não o template com placeholders.
- Retenção padrão: 1 ano *(PRDGlobal §11.5)*.

## 5. Regras de negócio

- **RN-01:** O e-mail de nova cotação deve conter obrigatoriamente: nome, número da cotação, data de início e data de fim. *(PRDGlobal §5.2)*

- **RN-02:** O `Administrador` pode editar apenas o conteúdo editável do template de notificação. Os campos obrigatórios (`nome`, `número da cotação`, `data de início`, `data de fim`) não podem ser removidos nem alterados estruturalmente. *(PRDGlobal §5.3, §5.4)*

- **RN-03:** O conteúdo das notificações de follow-up de cotação também pode ser editado pelo `Administrador`, respeitando a estrutura operacional aprovada. *(PRDGlobal §5.4)*

- **RN-04:** A cotação só deve ser enviada (e portanto notificada) para fornecedores com acesso já liberado no portal. *(PRDGlobal §4.2)*

- **RN-05:** Se o fornecedor existir no Sienge mas ainda não tiver acesso liberado no portal, o sistema não deve enviar notificação de cotação. *(PRDGlobal §4.2)*

- **RN-06:** Se o acesso de um fornecedor for liberado depois do envio inicial, a cotação só pode ser notificada a ele se o prazo ainda estiver aberto. Nesse envio tardio, a data final continua sendo a data original da cotação. *(PRDGlobal §4.2)*

- **RN-07:** Se o fornecedor estiver bloqueado, o sistema interrompe imediatamente o envio de notificações. *(PRDGlobal §4.2)*

- **RN-08:** Se não houver e-mail válido no Sienge e também não houver e-mail cadastrado localmente pelo `Administrador`, o sistema deve bloquear o envio de notificações para esse fornecedor. *(PRDGlobal §9.5)*

- **RN-09:** Quando uma cotação vence com `Sem resposta` de um fornecedor, `Compras` deve ser notificado. *(PRDGlobal §4.7)*

- **RN-10:** A notificação é enviada somente por e-mail na V1.0. *(PRDGlobal §5.1)*

- **RN-11:** O e-mail do fornecedor para fins de notificação segue a seguinte hierarquia: e-mail local cadastrado pelo `Administrador` (se houver); caso contrário, o primeiro `contacts[].email` preenchido retornado por `GET /creditors/{creditorId}` do Sienge. *(PRDGlobal §9.5, §11.1)*

- **RN-12:** Toda notificação enviada deve gerar registro de auditoria. *(PRDGlobal §12.6)*

- **RN-13:** Os dados de notificações enviadas seguem a política de retenção de 1 ano. *(PRDGlobal §11.5)*

## 6. Fluxos operacionais

### 6.1 Fluxo: Envio de notificação de nova cotação

**Descrição passo a passo:**

1. `Compras` revisa a cotação importada do Sienge e dispara o envio para os fornecedores (ação pertencente ao módulo 2).
2. O sistema identifica os fornecedores vinculados à cotação que possuem acesso ativo no portal (consulta ao módulo 1).
3. Para cada fornecedor elegível:
   a. O sistema verifica se o fornecedor possui e-mail válido (local ou do Sienge, conforme RN-11).
   b. Se não houver e-mail válido, o envio é bloqueado para esse fornecedor e o evento é registrado (RN-08).
   c. Se o fornecedor estiver bloqueado, o envio é interrompido (RN-07).
   d. O sistema carrega o template ativo do tipo `new_quotation`.
   e. O sistema renderiza o template substituindo os placeholders pelos dados reais: nome do fornecedor, número da cotação, data de início e data de fim.
   f. O sistema envia o e-mail transacional.
   g. O sistema registra o envio em `notification_logs` com status `sent` ou `failed`.
   h. O sistema registra o evento de auditoria "envio de cotação".

**Exceções e tratamento de erro:**

- **E-mail inválido ou ausente:** o envio para o fornecedor é bloqueado; o log registra `failed` com mensagem descritiva; o sistema continua o envio para os demais fornecedores da cotação.
- **Falha no serviço de e-mail:** o log registra `failed` com a mensagem de erro do provedor; o evento é rastreável para reprocessamento.
- **Fornecedor sem acesso ativo:** nenhuma notificação é gerada; nenhum registro de log é criado para este fornecedor nesta cotação.

---

### 6.2 Fluxo: Envio tardio para fornecedor recém-liberado

**Descrição passo a passo:**

1. O `Administrador` libera o acesso de um fornecedor no portal (ação pertencente ao módulo 1).
2. O sistema verifica se existem cotações abertas (prazo ainda vigente) vinculadas a esse fornecedor.
3. Para cada cotação aberta:
   a. O sistema verifica que o fornecedor recém-liberado está no mapa de fornecedores da cotação (consulta ao módulo 2).
   b. O sistema carrega o template ativo do tipo `new_quotation`.
   c. O sistema renderiza o e-mail com os dados da cotação (a data final é a data original da cotação, sem prazo individual).
   d. O sistema envia o e-mail e registra em `notification_logs`.

**Exceções e tratamento de erro:**

- **Prazo da cotação já vencido:** nenhuma notificação é enviada.
- **Fornecedor não está no mapa de cotação:** nenhuma notificação é enviada.

---

### 6.3 Fluxo: Notificação de cotação `Sem resposta`

**Descrição passo a passo:**

1. A cotação atinge a data de término.
2. O sistema identifica fornecedores vinculados que não enviaram resposta válida (consulta ao módulo 2).
3. Para cada fornecedor com status `Sem resposta`:
   a. O sistema gera um alerta interno para `Compras`.
   b. O sistema carrega o template ativo do tipo `no_response_alert` (se configurado como e-mail para `Compras`).
   c. O sistema envia o e-mail a `Compras` com o resumo dos fornecedores sem resposta.
   d. O sistema registra o envio em `notification_logs`.

---

### 6.4 Fluxo: Edição de template pelo Administrador

**Descrição passo a passo:**

1. O `Administrador` acessa a tela de gestão de templates de notificação.
2. O sistema exibe o template ativo para o tipo selecionado.
3. O `Administrador` edita o conteúdo editável (textos livres ao redor dos placeholders obrigatórios).
4. O `Administrador` submete a edição.
5. O sistema valida que todos os `mandatory_placeholders` estão presentes no template editado.
6. Se a validação falhar: o sistema exibe mensagem de erro informando quais placeholders foram removidos e impede o salvamento.
7. Se a validação passar: o sistema incrementa a `version`, registra `updated_by` e `updated_at`, e salva o novo template.
8. O sistema registra o evento de auditoria "edição de template de notificação".

**Diagrama de estados do template:**

```
[Ativo] --edição válida--> [Nova Versão Ativa]
[Ativo] --edição inválida--> [Erro: placeholders ausentes] --corrige--> [Ativo]
```

## 7. Contratos de API / Serviços

### 7.1 Serviço: Envio de notificação de cotação

- **Nome:** `NotificationService.sendQuotationNotification`
- **Tipo:** Serviço interno (invocado pelo módulo 2 quando `Compras` envia a cotação)
- **Entrada:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `quotation_id` | INTEGER | Sim | `purchaseQuotationId` da cotação. |
| `supplier_ids` | INTEGER[] | Sim | Lista de `supplierId` dos fornecedores elegíveis. |
| `triggered_by` | UUID | Sim | ID do usuário que disparou o envio. |

- **Saída:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `results` | OBJECT[] | Array com resultado por fornecedor. |
| `results[].supplier_id` | INTEGER | `supplierId` do fornecedor. |
| `results[].status` | ENUM | `sent`, `failed`, `skipped`. |
| `results[].reason` | TEXT | Motivo, em caso de `failed` ou `skipped`. |

- **Erros esperados:**

| Código | Descrição |
|--------|-----------|
| `TEMPLATE_NOT_FOUND` | Nenhum template ativo do tipo `new_quotation`. |
| `QUOTATION_NOT_FOUND` | Cotação não encontrada no sistema. |
| `EMAIL_SERVICE_UNAVAILABLE` | Serviço de e-mail temporariamente indisponível. |

- **Perfis autorizados:** Chamada interna pelo sistema (gatilhada por ação de `Compras`).

---

### 7.2 Serviço: Envio tardio para fornecedor recém-liberado

- **Nome:** `NotificationService.sendLateQuotationNotification`
- **Tipo:** Serviço interno (invocado pelo módulo 1 ao liberar acesso de fornecedor)
- **Entrada:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `supplier_id` | INTEGER | Sim | `supplierId` do fornecedor recém-liberado. |
| `triggered_by` | UUID | Sim | ID do `Administrador` que liberou o acesso. |

- **Saída:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `notifications_sent` | INTEGER | Quantidade de notificações enviadas. |
| `details` | OBJECT[] | Detalhes por cotação notificada. |
| `details[].quotation_id` | INTEGER | `purchaseQuotationId`. |
| `details[].status` | ENUM | `sent`, `failed`, `skipped`. |

- **Erros esperados:**

| Código | Descrição |
|--------|-----------|
| `SUPPLIER_NOT_FOUND` | Fornecedor não encontrado no sistema. |
| `NO_OPEN_QUOTATIONS` | Nenhuma cotação aberta para este fornecedor (não é erro, retorno vazio). |

- **Perfis autorizados:** Chamada interna pelo sistema (gatilhada por ação de `Administrador`).

---

### 7.3 Endpoint: Listar templates de notificação

- **Método:** `GET`
- **Rota:** `/api/notification-templates`
- **Entrada (query params):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `type` | ENUM | Não | Filtrar por tipo de template. |

- **Saída:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `templates` | OBJECT[] | Lista de templates. |
| `templates[].id` | UUID | ID do template. |
| `templates[].type` | ENUM | Tipo do template. |
| `templates[].subject_template` | TEXT | Template do assunto. |
| `templates[].body_template` | TEXT | Template do corpo. |
| `templates[].mandatory_placeholders` | STRING[] | Placeholders obrigatórios. |
| `templates[].version` | INTEGER | Versão atual. |
| `templates[].updated_at` | TIMESTAMPTZ | Última atualização. |

- **Erros esperados:**

| Código HTTP | Descrição |
|-------------|-----------|
| `401` | Não autenticado. |
| `403` | Perfil sem permissão (apenas `Administrador`). |

- **Perfis autorizados:** `Administrador`.

---

### 7.4 Endpoint: Atualizar template de notificação

- **Método:** `PUT`
- **Rota:** `/api/notification-templates/{templateId}`
- **Entrada (body):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `subject_template` | TEXT | Sim | Novo template do assunto. |
| `body_template` | TEXT | Sim | Novo template do corpo. |

- **Saída:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID do template atualizado. |
| `version` | INTEGER | Nova versão. |
| `updated_at` | TIMESTAMPTZ | Timestamp da atualização. |

- **Erros esperados:**

| Código HTTP | Descrição |
|-------------|-----------|
| `400` | Placeholder obrigatório ausente no template submetido. Retorna lista dos placeholders faltantes. |
| `401` | Não autenticado. |
| `403` | Perfil sem permissão (apenas `Administrador`). |
| `404` | Template não encontrado. |

- **Perfis autorizados:** `Administrador`.

---

### 7.5 Endpoint: Consultar logs de notificação

- **Método:** `GET`
- **Rota:** `/api/notification-logs`
- **Entrada (query params):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `quotation_id` | INTEGER | Não | Filtrar por cotação. |
| `supplier_id` | INTEGER | Não | Filtrar por fornecedor. |
| `type` | ENUM | Não | Filtrar por tipo de notificação. |
| `status` | ENUM | Não | Filtrar por status (`sent`, `failed`, `bounced`). |
| `start_date` | DATE | Não | Data mínima de envio. |
| `end_date` | DATE | Não | Data máxima de envio. |
| `limit` | INTEGER | Não | Paginação (default: 50). |
| `offset` | INTEGER | Não | Paginação (default: 0). |

- **Saída:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `total` | INTEGER | Total de registros. |
| `logs` | OBJECT[] | Lista de logs de notificação com os campos da entidade `notification_logs`. |

- **Erros esperados:**

| Código HTTP | Descrição |
|-------------|-----------|
| `401` | Não autenticado. |
| `403` | Perfil sem permissão (apenas `Compras` e `Administrador`). |

- **Perfis autorizados:** `Compras`, `Administrador`.

---

### 7.6 Serviço: Alerta de `Sem resposta` para Compras

- **Nome:** `NotificationService.sendNoResponseAlert`
- **Tipo:** Serviço interno (invocado automaticamente quando a cotação vence)
- **Entrada:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `quotation_id` | INTEGER | Sim | `purchaseQuotationId` da cotação vencida. |
| `supplier_ids_no_response` | INTEGER[] | Sim | Lista de `supplierId` sem resposta. |

- **Saída:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `status` | ENUM | `sent`, `failed`. |
| `compras_users_notified` | INTEGER | Quantidade de usuários `Compras` notificados. |

- **Erros esperados:**

| Código | Descrição |
|--------|-----------|
| `TEMPLATE_NOT_FOUND` | Nenhum template ativo do tipo `no_response_alert`. |
| `NO_COMPRAS_USERS` | Nenhum usuário com perfil `Compras` ativo para receber o alerta. |

- **Perfis autorizados:** Chamada interna pelo sistema.

## 8. Interface do usuário

### 8.1 Tela: Gestão de Templates de Notificação

- **Nome:** Templates de Notificação
- **Propósito:** Permitir ao `Administrador` visualizar, editar e pré-visualizar os templates de notificação.

**Campos exibidos:**
- Tipo do template (seletor).
- Assunto do template (campo editável).
- Corpo do template (editor de texto com visualização dos placeholders obrigatórios em destaque).
- Lista de placeholders obrigatórios (exibida como referência, não editável).
- Versão atual do template.
- Data da última edição e nome do `Administrador` que editou.

**Ações disponíveis por perfil:**

| Ação | Administrador | Compras | Fornecedor | Visualizador |
|------|:------------:|:-------:|:----------:|:------------:|
| Visualizar templates | ✔ | ✗ | ✗ | ✗ |
| Editar template | ✔ | ✗ | ✗ | ✗ |
| Pré-visualizar e-mail renderizado | ✔ | ✗ | ✗ | ✗ |

**Referências visuais:**
- Fundo principal: Branco `#FFFFFF`.
- Botão salvar/editar: Azul Médio `#465EBE`.
- Placeholders obrigatórios destacados: Turquesa `#19B4BE` com fundo leve.
- Mensagem de erro (placeholder ausente): Vermelho de alerta.
- Cabeçalho da tela: Azul Escuro `#324598`.
- Referência de paleta: `docs/paleta_de_cores.md`.

---

### 8.2 Tela: Logs de Notificações

- **Nome:** Histórico de Notificações
- **Propósito:** Visualizar o histórico de notificações enviadas com filtros para auditoria e acompanhamento operacional.

**Campos exibidos:**
- Data e hora do envio.
- Tipo da notificação.
- Número da cotação.
- Fornecedor (nome e e-mail).
- Status do envio (`sent`, `failed`, `bounced`).
- Mensagem de erro (quando aplicável).
- Usuário que disparou o envio.

**Ações disponíveis por perfil:**

| Ação | Administrador | Compras | Fornecedor | Visualizador |
|------|:------------:|:-------:|:----------:|:------------:|
| Consultar logs | ✔ | ✔ | ✗ | ✗ |
| Filtrar por cotação/fornecedor/status | ✔ | ✔ | ✗ | ✗ |
| Exportar logs | ✔ | ✗ | ✗ | ✗ |

**Referências visuais:**
- Status `sent`: ícone/badge verde.
- Status `failed`: ícone/badge vermelho.
- Status `bounced`: ícone/badge laranja.
- Cores de cabeçalho: Azul Escuro `#324598`.
- Linhas alternadas: Fundo branco e Azul Claro `#6ED8E0` suave (10% de opacidade).
- Referência de paleta: `docs/paleta_de_cores.md`.

---

### 8.3 Componente: Indicador de notificação na tela de cotação

- **Nome:** Badge de status de notificação
- **Propósito:** Exibir na tela de detalhe da cotação (módulo 2) se a notificação foi enviada com sucesso ou falhou para cada fornecedor.

**Campos exibidos:**
- Ícone de status do envio (✔ enviado / ✗ falha / ⏳ pendente).
- Data e hora do envio.
- Tooltip com detalhes em caso de falha.

**Ações disponíveis por perfil:**

| Ação | Administrador | Compras | Fornecedor | Visualizador |
|------|:------------:|:-------:|:----------:|:------------:|
| Visualizar badge | ✔ | ✔ | ✗ | ✗ |

## 9. Integrações e dependências externas

### 9.1 Dependência do módulo 1 — Autenticação e Perfis

- Verificar se o fornecedor possui acesso ativo no portal antes de enviar notificação.
- Verificar o perfil do usuário para controle de acesso às telas de templates e logs.
- Obter a lista de usuários com perfil `Compras` para o alerta de `Sem resposta`.
- Obter o e-mail local do fornecedor (se alterado pelo `Administrador`).

### 9.2 Dependência do módulo 2 — Fluxo de Cotação

- Receber o gatilho de envio de cotação quando `Compras` dispara o envio.
- Consultar dados da cotação (número, data de início, data de fim) para renderizar o template.
- Consultar lista de fornecedores vinculados à cotação.
- Consultar status das cotações para identificar `Sem resposta` no encerramento.
- Receber o nome do fornecedor para renderizar o template.

### 9.3 Dependência de dados do Sienge (via módulo 7)

- O e-mail do fornecedor é originalmente obtido por `GET /creditors/{creditorId}`, usando a regra do primeiro `contacts[].email` preenchido *(PRDGlobal §9.5)*.
- Este módulo não consome a API do Sienge diretamente — depende do dado já persistido localmente pelos módulos 1 e 7.

### 9.4 Serviço de e-mail transacional

- O sistema requer um serviço de envio de e-mail transacional (ex.: Resend, SendGrid, Amazon SES, ou similar).
- O serviço deve suportar:
  - envio de e-mails HTML e texto plano;
  - report de falha de entrega (bounce handling);
  - rate limiting compatível com o volume esperado de cotações.
- A escolha específica do provedor fica para a implementação, respeitando as diretrizes técnicas do projeto.

### 9.5 Tratamento de falhas

- Em caso de falha no envio de e-mail, o sistema registra `failed` no `notification_logs` com a mensagem de erro.
- Falhas individuais de envio para um fornecedor não bloqueiam o envio para os demais fornecedores da mesma cotação.
- Logs de falha são consultáveis na tela de Histórico de Notificações.

## 10. Auditoria e rastreabilidade

Eventos auditáveis gerados por este módulo *(conforme PRDGlobal §12.6)*:

| Evento | Descrição | Dados mínimos |
|--------|-----------|---------------|
| `notification.quotation.sent` | Envio de notificação de nova cotação a um fornecedor. | Data/hora, `quotation_id`, `supplier_id`, e-mail do destinatário, ID do usuário que disparou, template utilizado. |
| `notification.quotation.failed` | Falha no envio de notificação de cotação. | Data/hora, `quotation_id`, `supplier_id`, e-mail do destinatário, mensagem de erro. |
| `notification.quotation.skipped` | Notificação não enviada (fornecedor bloqueado, sem e-mail, sem acesso). | Data/hora, `quotation_id`, `supplier_id`, motivo do skip. |
| `notification.no_response.sent` | Alerta de `Sem resposta` enviado a `Compras`. | Data/hora, `quotation_id`, lista de fornecedores sem resposta, usuários `Compras` notificados. |
| `notification.template.updated` | Template de notificação editado pelo `Administrador`. | Data/hora, `template_id`, versão anterior, nova versão, ID do `Administrador`. |

Cada evento deve conter no mínimo *(PRDGlobal §12.6)*:
- Data e hora.
- Tipo do evento.
- Usuário ou origem do evento.
- Cotação afetada.
- Fornecedor afetado, quando houver.
- Resumo da ação realizada.

## 11. Validações pendentes de homologação

Os seguintes itens da §17 do PRDGlobal se aplicam a este módulo:

| # §17 | Item | Relevância para este módulo |
|-------|------|---------------------------|
| 1 | Validar se `supplierId` corresponde a `creditorId` | Afeta a resolução de e-mail do fornecedor: se `supplierId` ≠ `creditorId`, o e-mail pode ser buscado com ID incorreto. |
| 2 | Validar regra do primeiro `contacts[].email` preenchido | Afeta diretamente qual e-mail será usado para envio de notificações. Se a regra não for suficiente, fornecedores podem não receber notificações ou recebê-las no e-mail errado. |

## 12. Critérios de aceite

- [ ] O sistema envia e-mail de nova cotação ao fornecedor quando `Compras` dispara o envio.
- [ ] O e-mail de nova cotação contém obrigatoriamente: nome, número da cotação, data de início e data de fim.
- [ ] O sistema não envia notificação para fornecedor sem acesso ativo no portal.
- [ ] O sistema não envia notificação para fornecedor bloqueado.
- [ ] O sistema não envia notificação para fornecedor sem e-mail válido (nem no Sienge, nem local).
- [ ] O sistema envia notificação tardia para fornecedor recém-liberado apenas se o prazo da cotação ainda estiver aberto.
- [ ] A data final da notificação tardia é a data original da cotação, sem prazo individual.
- [ ] O sistema notifica `Compras` quando uma cotação vence com fornecedores em `Sem resposta`.
- [ ] O `Administrador` pode editar o conteúdo dos templates de notificação.
- [ ] O sistema impede a remoção ou alteração dos campos obrigatórios (`nome`, `número da cotação`, `data de início`, `data de fim`) no template.
- [ ] Toda notificação enviada gera registro em `notification_logs` com status, e-mail, cotação e timestamp.
- [ ] O `body_snapshot` no log contém o e-mail renderizado, não o template com placeholders.
- [ ] A tela de Histórico de Notificações exibe logs filtráveis por cotação, fornecedor, tipo e status.
- [ ] A tela de Histórico de Notificações é acessível por `Compras` e `Administrador`.
- [ ] A tela de Gestão de Templates é acessível apenas por `Administrador`.
- [ ] Falha no envio para um fornecedor não bloqueia o envio para os demais fornecedores da mesma cotação.
- [ ] Os dados de notificações seguem a política de retenção de 1 ano.
- [ ] Cada evento de envio de notificação e edição de template gera trilha de auditoria com os campos mínimos exigidos.

## 13. Fases de implementação sugeridas

### Fase 1 — Templates e infraestrutura de envio
1. Criar entidade `notification_templates` no banco.
2. Inserir templates padrão (seed) para os tipos `new_quotation`, `quotation_reminder` e `no_response_alert`.
3. Implementar o serviço de renderização de templates (substituição de placeholders).
4. Integrar com o provedor de e-mail transacional escolhido.
5. Criar entidade `notification_logs` no banco.

### Fase 2 — Envio de notificação de nova cotação
1. Implementar `NotificationService.sendQuotationNotification`.
2. Integrar com o módulo 2 (receber gatilho de envio de cotação).
3. Implementar verificações: acesso ativo, e-mail válido, fornecedor não bloqueado.
4. Implementar registro de auditoria para cada envio.
5. Testar envio com múltiplos fornecedores (envio parcial em caso de falha individual).

### Fase 3 — Envio tardio e alertas
1. Implementar `NotificationService.sendLateQuotationNotification`.
2. Integrar com o módulo 1 (gatilho ao liberar acesso de fornecedor).
3. Implementar `NotificationService.sendNoResponseAlert`.
4. Integrar com o módulo 2 (gatilho ao encerrar cotação com `Sem resposta`).

### Fase 4 — Interface do usuário
1. Implementar tela de Gestão de Templates de Notificação.
2. Implementar validação de presença de placeholders obrigatórios na edição.
3. Implementar tela de Histórico de Notificações com filtros.
4. Implementar badge de status de notificação na tela de detalhe de cotação (integração visual com módulo 2).

### Fase 5 — Qualidade e validação
1. Testar todos os cenários de envio (normal, tardio, bloqueado, sem e-mail).
2. Testar edição de template com remoção de placeholder obrigatório (deve falhar).
3. Testar retenção e consulta de logs.
4. Validar integração fim a fim com o fluxo de cotação do módulo 2.

## 14. Riscos específicos do módulo

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:------------:|:-------:|-----------|
| **E-mail do fornecedor incorreto ou desatualizado no Sienge** | Média | Alto — fornecedor não recebe cotação | RN-11 define hierarquia de e-mail (local > Sienge). O `Administrador` pode corrigir localmente. Item §17.2 de homologação valida a regra. |
| **Serviço de e-mail indisponível** | Baixa | Alto — nenhuma notificação é enviada | Registrar falhas em `notification_logs`; implementar mecanismo de retry básico; alertar operação sobre acúmulo de falhas. |
| **Fornecedor não lê e-mail** | Média | Médio — cotação sem resposta | Fora do controle do sistema na V1.0; mitigado pelo alerta de `Sem resposta` para `Compras`. V2.0 adiciona WhatsApp como canal complementar. |
| **`supplierId` ≠ `creditorId`** | Baixa | Alto — e-mail buscado com ID errado, fornecedor errado notificado ou sem notificação | Dependente da homologação (§17.1). Mitigação: validar correspondência antes de usar o e-mail; registrar discrepância e bloquear envio até resolução. |
| **Template editado de forma inadequada pelo Administrador** | Baixa | Médio — e-mail deformado ou confuso | Validação obrigatória de presença de placeholders. Pré-visualização antes de salvar. Versionamento para rollback. |
| **Volume alto de cotações com muitos fornecedores sobrecarrega envio** | Baixa | Médio — atrasos no envio ou throttling do provedor | Implementar enfileiramento (queue) se necessário; respeitar rate limits do provedor de e-mail; envio assíncrono por cotação. |
