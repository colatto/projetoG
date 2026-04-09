# Prompt — Geração de PRD Filho

## Instrução principal

Você é um especialista em produto e arquitetura de software.
Você receberá o nome de um módulo funcional e deve gerar o PRD filho correspondente.

Antes de começar, leia obrigatoriamente e na íntegra:

1. `PRDGlobal.md` — fonte de verdade de produto e regras de negócio.
2. `docs/decisions/relatorio-reconhecimento.md` — estado atual do repositório.
3. `docs/architecture.md` — arquitetura e topologia de deploy.
4. `docs/decisions/ADR-0001-repo-structure.md` — decisão de estrutura do monorepo.

Se qualquer um desses arquivos não puder ser lido, interrompa e informe antes de prosseguir.

---

## Módulos disponíveis para geração

Cada invocação deste prompt gera **um único PRD filho**. Informe o módulo desejado substituindo `{{MODULO}}` pelo nome do módulo:

| # | Módulo | Seções do PRDGlobal | Dependências diretas |
|---|--------|-------------------|---------------------|
| 1 | Autenticação e Perfis | §3, §11 | Nenhuma (módulo fundacional) |
| 2 | Fluxo de Cotação | §4 | 1 (Auth), 7 (Integração Sienge) |
| 3 | Notificações de Cotação | §5 | 1 (Auth), 2 (Cotação) |
| 4 | Follow-up Logístico | §6 | 1 (Auth), 5 (Entrega), 7 (Integração Sienge) |
| 5 | Entrega, Divergência e Status de Pedido | §7 | 1 (Auth), 7 (Integração Sienge) |
| 6 | Avaria e Ação Corretiva | §8 | 1 (Auth), 5 (Entrega) |
| 7 | Integração com o Sienge | §9, §10 | Nenhuma (módulo fundacional de integração) |
| 8 | Dashboard e Indicadores | §13 | 2 (Cotação), 4 (Follow-up), 5 (Entrega), 6 (Avaria) |
| 9 | Backoffice, Auditoria e Operação | §12, §14 | Todos os anteriores |

---

## Regras de geração

### Regras invioláveis

1. **Não inventar funcionalidades.** Tudo que estiver no PRD filho deve ter origem explícita no PRDGlobal. Se algo não estiver no PRDGlobal, não inclua.
2. **Não contradizer decisões existentes.** Respeitar ADR-0001, stack definida, fronteira de responsabilidades e princípios de integração com o Sienge.
3. **Não sobrepor módulos.** Cada PRD filho cobre apenas o seu perímetro. Se uma funcionalidade pertence a outro módulo, referencie-o como dependência, não reimplemente.
4. **Não reduzir escopo sem justificativa.** Se o PRDGlobal exige algo para o módulo, o PRD filho deve incluí-lo. Simplificações são permitidas apenas quando explicitamente indicadas no PRDGlobal (ex.: "simplificação da V1.0").
5. **Não assumir implementação prévia.** O relatório de reconhecimento confirma que todos os módulos estão ausentes. Cada PRD filho parte do zero.

### Regras de contexto técnico

6. O Supabase é `dbGRF` (`lkfevrdhofxlmwjfhnru`), PostgreSQL 17 em `sa-east-1`.
7. O monorepo ainda não foi inicializado — o PRD filho pode assumir que será inicializado antes da execução, mas não deve depender de estrutura que ainda não foi decidida (ex.: framework do backend).
8. Quando o módulo envolver banco de dados, o PRD filho deve listar as entidades e campos mínimos, mas **não** gerar SQL diretamente — isso é responsabilidade da execução.
9. Quando o módulo envolver frontend, o PRD filho deve listar as telas e componentes necessários, referenciando a paleta de cores de `docs/paleta_de_cores.md` e os assets de `docs/identidade_visual.md`.
10. Quando o módulo envolver integração com o Sienge, o PRD filho deve referenciar os endpoints, campos e regras exatamente como documentados no PRDGlobal §9, sem reinterpretar contratos.

### Regras de qualidade

11. Cada critério de aceite deve ser verificável por teste automatizado ou inspeção objetiva.
12. Cada entidade deve listar seus campos mínimos com tipo e obrigatoriedade.
13. Cada endpoint ou serviço deve listar método, entrada, saída e erros esperados.
14. Se o módulo tem dependência de homologação (§17), listar explicitamente quais itens se aplicam.

---

## Estrutura obrigatória do PRD filho

O arquivo gerado deve ser salvo em:

```
docs/prd/prd-{{numero}}-{{slug-do-modulo}}.md
```

Exemplo: `docs/prd/prd-01-autenticacao-e-perfis.md`

### Template

```markdown
# PRD Filho — {{NOME_DO_MODULO}}

> Módulo: {{numero}} de 9
> Seções do PRDGlobal: {{secoes}}
> Dependências: {{dependencias}}
> Data de geração: {{data}}

---

## 1. Objetivo do módulo

Descrever em 2–3 parágrafos o que este módulo resolve, por que existe e qual valor entrega ao produto.

## 2. Escopo funcional

### 2.1 Incluso neste PRD
Lista objetiva do que este PRD filho cobre.

### 2.2 Excluído deste PRD
Lista objetiva do que NÃO está neste PRD, referenciando o módulo que cobre (se aplicável).

### 2.3 Fora de escopo da V1.0
Itens que o PRDGlobal exclui explicitamente para este módulo na V1.0.

## 3. Perfis envolvidos

Tabela com os perfis que interagem com este módulo, listando permissões e restrições relevantes conforme §3 do PRDGlobal.

## 4. Entidades e modelagem

Para cada entidade principal do módulo:
- Nome da entidade
- Campos mínimos (nome, tipo, obrigatoriedade, descrição)
- Relacionamentos
- Índices sugeridos
- Regras de integridade

## 5. Regras de negócio

Lista numerada das regras operacionais que este módulo implementa, com referência direta à seção do PRDGlobal.

Formato:
- **RN-XX:** [descrição da regra] *(PRDGlobal §X.Y)*

## 6. Fluxos operacionais

Para cada fluxo principal:
- Descrição textual passo a passo
- Diagrama de estados ou sequência (quando aplicável)
- Exceções e tratamento de erro

## 7. Contratos de API / Serviços

Para cada endpoint ou serviço interno:
- Método e rota (ou nome do serviço)
- Entrada (campos, tipos, validações)
- Saída (campos, tipos)
- Erros esperados
- Perfis autorizados

## 8. Interface do usuário

Para cada tela ou componente:
- Nome e propósito
- Campos exibidos
- Ações disponíveis por perfil
- Referências visuais (paleta, assets conforme `docs/paleta_de_cores.md`)

## 9. Integrações e dependências externas

Se o módulo interage com o Sienge ou outros módulos:
- Endpoints utilizados (referência ao PRDGlobal §9)
- Webhooks consumidos
- Regras de reconciliação
- Tratamento de falhas

## 10. Auditoria e rastreabilidade

Eventos auditáveis gerados por este módulo, conforme §12.6 do PRDGlobal.

## 11. Validações pendentes de homologação

Itens da §17 do PRDGlobal que se aplicam a este módulo.

## 12. Critérios de aceite

Lista verificável de condições que devem ser verdadeiras para considerar o módulo implementado:
- [ ] Critério 1
- [ ] Critério 2
- [ ] ...

## 13. Fases de implementação sugeridas

Ordem recomendada de implementação dentro do módulo, considerando dependências internas e prioridade operacional.

## 14. Riscos específicos do módulo

Riscos que podem impactar a implementação deste módulo, com mitigação proposta.
```

---

## Instrução de execução

Substitua `{{MODULO}}` pelo módulo desejado e execute este prompt.

Exemplo de invocação:

> Gere o PRD filho para o módulo: **Autenticação e Perfis**

O assistente deve:

1. Ler todos os arquivos obrigatórios listados no início.
2. Extrair apenas as regras e requisitos do PRDGlobal que pertencem ao módulo solicitado.
3. Gerar o PRD filho seguindo rigorosamente a estrutura e as regras acima.
4. Salvar o arquivo em `docs/prd/prd-{{numero}}-{{slug}}.md`.
5. Não gerar mais de um PRD filho por invocação.

---

## Ordem recomendada de geração

A geração deve respeitar a árvore de dependências. A ordem recomendada é:

```
Fase 1 (fundacionais, sem dependências):
  → PRD 01 — Autenticação e Perfis
  → PRD 07 — Integração com o Sienge

Fase 2 (dependem da Fase 1):
  → PRD 02 — Fluxo de Cotação
  → PRD 05 — Entrega, Divergência e Status de Pedido

Fase 3 (dependem da Fase 2):
  → PRD 03 — Notificações de Cotação
  → PRD 06 — Avaria e Ação Corretiva
  → PRD 04 — Follow-up Logístico

Fase 4 (dependem de todos os anteriores):
  → PRD 08 — Dashboard e Indicadores
  → PRD 09 — Backoffice, Auditoria e Operação
```

---

## Critérios de qualidade do PRD filho gerado

Antes de entregar, o assistente deve verificar:

- [ ] Todas as regras citadas possuem referência à seção do PRDGlobal?
- [ ] Nenhuma funcionalidade foi inventada além do PRDGlobal?
- [ ] Nenhuma decisão técnica contradiz ADR-0001 ou o `docs/architecture.md`?
- [ ] O escopo do PRD não invade o perímetro de outro módulo?
- [ ] Entidades possuem campos mínimos com tipo e obrigatoriedade?
- [ ] Critérios de aceite são verificáveis?
- [ ] Itens de homologação da §17 aplicáveis foram listados?
- [ ] O arquivo foi salvo no caminho correto?
