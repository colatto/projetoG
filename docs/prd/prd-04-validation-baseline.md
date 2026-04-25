# Baseline de Validacao — PRD-04

Atualizado em `2026-04-24` para consolidar o fechamento tecnico do modulo de Follow-up Logistico.

## 1. Escopo de validacao aplicado

- Regras criticas de negocio RN-13 e RN-14.
- Recalculo de reinicio da regua com dias uteis (RN-16 e RN-17).
- Cobertura de testes para endpoints de sugestao/aprovacao/reprovacao.
- Cobertura de testes para transicoes do worker (overdue, confirmacao expirada, entrega parcial).
- Campos minimos de lista no backoffice e portal fornecedor.

## 2. Matriz criterio -> evidencia

| Criterio PRD-04                                                                        | Evidencia tecnica                                                                                                  | Status   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| RN-13/RN-14: confirmacao vale ate a data vigente e vira atraso em D+1 util sem entrega | `workers/src/jobs/follow-up.ts` inclui `CONCLUIDO` no loop e aplica overdue independentemente de confirmacao       | Atendido |
| Reinicio de regua em aprovacao usa dias uteis                                          | `apps/api/src/modules/followup/followup.controller.ts` usa calendario de feriados e funcoes de dias uteis          | Atendido |
| Fornecedor sugere nova data com pausa do tracker                                       | `apps/api/src/modules/followup/followup.routes.test.ts` (`allows supplier to suggest new date and pauses tracker`) | Atendido |
| Compras aprova/reprova nova data                                                       | `apps/api/src/modules/followup/followup.routes.test.ts` (`approves...`, `rejects...`)                              | Atendido |
| Ordenacao operacional da lista                                                         | `apps/api/src/modules/followup/followup.routes.test.ts` (`returns list ordered by operational priority`)           | Atendido |
| Copia de Compras em notificacao 2+                                                     | `workers/src/jobs/follow-up.test.ts` valida metadata `copied_to_compras`                                           | Atendido |
| Reativacao por expiracao apos confirmacao                                              | `workers/src/jobs/follow-up.test.ts` (`marks confirmed tracker as overdue...`)                                     | Atendido |
| Lista backoffice com campos minimos                                                    | `apps/web/src/pages/admin/FollowUpList.tsx` inclui obra, saldo pendente e cotacao vinculada                        | Atendido |
| Lista fornecedor com campos minimos                                                    | `apps/web/src/pages/supplier/SupplierFollowUpList.tsx` inclui data do pedido, obra e indicador de avaria/reposicao | Atendido |

## 3. Pendencias de homologacao externa (negocio)

Dependem de ambiente cliente/Sienge real e permanecem abertas para etapa de homologacao:

- Validar mapeamento `supplierId` x `creditorId`.
- Confirmar disponibilidade e comportamento do webhook `PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION`.
- Validar cenarios de item vinculado a multiplas cotacoes.
- Confirmar cobertura real de `GET /purchase-invoices/deliveries-attended`.

## 4. Regressao minima executada

- API: `pnpm --filter @projetog/api exec vitest run src/modules/followup/followup.routes.test.ts --pool=threads`
- Workers: `pnpm --filter @projetog/workers test -- follow-up.test.ts`
- Web: `pnpm --filter @projetog/web test -- FollowUpList.test.tsx SupplierFollowUpList.test.tsx SupplierFollowUpDetail.test.tsx`

Observacao: os testes web passam, com aviso de terminacao de worker (`kill EACCES`) no ambiente sandbox.
