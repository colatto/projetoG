# Política de Logs e Mascaramento de Dados Sensíveis

> **Status:** Definido  
> **Data:** 2026-04-10  
> **Validação:** V7 do plano de validação (setup.md §validações)  
> **Referências:** PRDGlobal §11.5 (LGPD), §15.3 (requisitos não funcionais), PRD-07 §12 (critérios de aceite)

---

## 1. Objetivo

Definir as regras de **mascaramento**, **formatação** e **retenção** de logs para todo o sistema, garantindo:

- Conformidade com LGPD (nível operacional V1.0)
- Proteção de credenciais e tokens
- Rastreabilidade fim a fim via `correlationId`
- Observabilidade estruturada para diagnóstico

---

## 2. Dados classificados como sensíveis

### 2.1 Credenciais e tokens (NUNCA logar em texto claro)

| Dado                      | Variável/Campo                  | Onde aparece            | Ação                                                    |
| ------------------------- | ------------------------------- | ----------------------- | ------------------------------------------------------- |
| Senha da API Sienge       | `SIENGE_API_SECRET`             | env, headers HTTP       | Mascarar: `***REDACTED***`                              |
| Usuário da API Sienge     | `SIENGE_API_KEY`                | env, headers HTTP       | Mascarar: `***REDACTED***`                              |
| Header Authorization      | `Authorization: Basic xxx`      | requests/responses HTTP | Mascarar: `***REDACTED***`                              |
| JWT Secret                | `JWT_SECRET`                    | env                     | Nunca logar                                             |
| Supabase Service Role Key | `SUPABASE_SERVICE_ROLE_KEY`     | env, headers HTTP       | Mascarar: `***REDACTED***`                              |
| Supabase Anon Key         | `SUPABASE_ANON_KEY`             | env, headers HTTP       | Mascarar: `***REDACTED***`                              |
| Database URL              | `DATABASE_URL`                  | env                     | Mascarar password: `postgresql://user:***@host:port/db` |
| Tokens de sessão          | `access_token`, `refresh_token` | headers, responses      | Mascarar: mostrar últimos 8 chars                       |

### 2.2 Dados pessoais (LGPD — mascarar em logs)

| Dado                    | Onde aparece                         | Ação                                                          |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Email do fornecedor     | `contacts[].email`, `profiles.email` | Mascarar: `j***@empresa.com`                                  |
| Nome do fornecedor (PF) | `creditorName`, `profiles.name`      | Permitido em logs internos; mascarar em logs de saída/export  |
| CPF/CNPJ                | `creditors.cpf`, `creditors.cnpj`    | Mascarar: `***.***.***-XX` / `XX.XXX.XXX/XXXX-XX` (últimos 2) |
| Telefone de contato     | `contacts[].phone`                   | Mascarar: `(**) *****-XXXX`                                   |

### 2.3 Dados de negócio (permitidos em logs com contexto)

| Dado                                   | Decisão                                        |
| -------------------------------------- | ---------------------------------------------- |
| `supplierId`, `creditorId`             | ✅ Permitido (identificador numérico, sem PII) |
| `purchaseQuotationId`                  | ✅ Permitido                                   |
| `negotiationId`, `purchaseOrderId`     | ✅ Permitido                                   |
| `idempotency_key`                      | ✅ Permitido (UUID, sem PII)                   |
| Valores de cotação (preço, quantidade) | ✅ Permitido em logs internos                  |
| Status de integração                   | ✅ Permitido                                   |

---

## 3. Implementação do mascaramento

### 3.1 Estado atual (já implementado)

O `SiengeClient` em `packages/integration-sienge/src/client.ts` já implementa:

- ✅ Mascaramento do header `Authorization` em erros (`***REDACTED***`)
- ✅ Injection de `correlationId` e `source` em logs
- ✅ Log estruturado com método HTTP, URL e status code

### 3.2 Função utilitária de mascaramento

Criar em `packages/shared/src/utils/log-sanitizer.ts`:

```typescript
/**
 * Sanitizes sensitive data from objects before logging.
 * Operates on a deep clone — never mutates the original.
 */

const SENSITIVE_KEYS = new Set([
  'authorization',
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api_secret',
  'apisecret',
  'service_role_key',
  'supabase_service_role_key',
  'jwt_secret',
  'database_url',
  'access_token',
  'refresh_token',
]);

const EMAIL_REGEX = /^([^@]{1})[^@]*(@.+)$/;
const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}-(\d{2})$/;
const CNPJ_REGEX = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-(\d{2})$/;

export function sanitizeForLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return obj;

  const clone = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const [key, value] of Object.entries(clone)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_KEYS.has(lowerKey)) {
      (clone as Record<string, unknown>)[key] = '***REDACTED***';
    } else if (lowerKey === 'email' && typeof value === 'string') {
      (clone as Record<string, unknown>)[key] = maskEmail(value);
    } else if (typeof value === 'object' && value !== null) {
      (clone as Record<string, unknown>)[key] = sanitizeForLog(value);
    }
  }

  return clone;
}

export function maskEmail(email: string): string {
  const match = email.match(EMAIL_REGEX);
  if (!match) return '***@***';
  return `${match[1]}***${match[2]}`;
}

export function maskCpf(cpf: string): string {
  const match = cpf.match(CPF_REGEX);
  if (!match) return '***.***.***-**';
  return `***.***.***-${match[1]}`;
}

export function maskCnpj(cnpj: string): string {
  const match = cnpj.match(CNPJ_REGEX);
  if (!match) return '**.***.****/****-**';
  return `**.***.****/****-${match[1]}`;
}

export function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.password = '***';
    return parsed.toString();
  } catch {
    return '***DATABASE_URL_REDACTED***';
  }
}
```

### 3.3 Integração por camada

| Camada                        | Como integrar                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/integration-sienge` | Interceptor Axios já mascara `Authorization`. Adicionar `sanitizeForLog()` no log de request body/response para operações de escrita. |
| `apps/api`                    | Logger Fastify com serializer customizado que aplica `sanitizeForLog()` nos fields `req.headers` e `res.body`.                        |
| `workers/`                    | Wrapper de log nos handlers de job — aplicar `sanitizeForLog()` em `job.data` antes de logar.                                         |
| `supabase/`                   | Triggers de auditoria não logam dados sensíveis — apenas `user_id`, `action`, `table`, `timestamp`.                                   |

---

## 4. Formato de log estruturado

### 4.1 Formato padrão

Todos os logs devem seguir formato JSON estruturado para facilitar busca e correlação:

```json
{
  "timestamp": "2026-04-10T20:30:00.000Z",
  "level": "info|warn|error",
  "service": "api|worker|integration-sienge",
  "correlationId": "uuid-v4",
  "source": "fastify|worker|unknown",
  "message": "Human-readable description",
  "context": {
    "method": "GET",
    "url": "/creditors/1203",
    "statusCode": 200,
    "duration": 245,
    "jobId": "pgboss-job-uuid",
    "jobName": "sienge:sync-quotations"
  }
}
```

### 4.2 Níveis de log

| Nível   | Uso                                 | Exemplos                                                  |
| ------- | ----------------------------------- | --------------------------------------------------------- |
| `error` | Falhas que requerem ação            | Falha de integração, exceção não tratada, pg-boss error   |
| `warn`  | Situações anormais mas recuperáveis | Retry de HTTP, fornecedor sem email, rate limit próximo   |
| `info`  | Operações normais relevantes        | Job iniciado/concluído, sync completado, webhook recebido |
| `debug` | Detalhes de diagnóstico (dev only)  | Payloads, SQL, detalhes de response                       |

### 4.3 Migração de `console.*` para logger estruturado

O código atual usa `console.log/warn/error` diretamente. Na implementação dos serviços de integração, migrar para:

- **`apps/api`:** Usar `fastify.log` (Pino integrado)
- **`workers/`:** Criar wrapper de logger usando Pino standalone
- **`packages/integration-sienge`:** Aceitar um logger injetável via construtor do `SiengeClient`

> [!NOTE]  
> A migração para logger estruturado não é bloqueante para a V1.0 funcional. Os `console.*` existentes nos stubs atuais serão substituídos quando os handlers forem implementados com lógica real.

---

## 5. Retenção e ciclo de vida

Conforme PRDGlobal §11.5:

| Tipo de dado           | Retenção    | Após vencimento                                |
| ---------------------- | ----------- | ---------------------------------------------- |
| Logs técnicos          | **1 ano**   | Arquivar ou deletar                            |
| Trilhas de auditoria   | **1 ano**   | Arquivar                                       |
| Notificações enviadas  | **1 ano**   | Arquivar                                       |
| Eventos de integração  | **1 ano**   | Arquivar                                       |
| Histórico de avarias   | **1 ano**   | Arquivar                                       |
| Jobs pg-boss (archive) | **90 dias** | Limpar via `boss.deleteAllFailedJobs()` ou SQL |

### 5.1 Implementação na V1.0

- **Logs de aplicação:** Gerenciados pela plataforma de deploy (Vercel para API, runtime do worker). Sem infra adicional de log aggregation na V1.0.
- **`integration_events`:** Tabela no Supabase. Implementar rotina de arquivamento quando operacional (pós-V1.0).
- **`webhook_events`:** Idem.
- **`pgboss.archive`:** pg-boss já possui cleanup automático via `archiveCompletedAfterSeconds` (default: 12h) e `deleteAfterDays`.

### 5.2 Configuração recomendada do pg-boss para retenção

```typescript
const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL,
  archiveCompletedAfterSeconds: 43200, // 12h — mover jobs completos para archive
  deleteAfterDays: 90, // 90 dias — limpar archive
});
```

---

## 6. Proibições

| #   | Proibição                                                                                       |
| --- | ----------------------------------------------------------------------------------------------- |
| 1   | **NUNCA** logar `SIENGE_API_SECRET`, `JWT_SECRET` ou `SUPABASE_SERVICE_ROLE_KEY` em texto claro |
| 2   | **NUNCA** logar senhas de banco (`DATABASE_URL` completa com password)                          |
| 3   | **NUNCA** logar tokens JWT completos (access_token, refresh_token)                              |
| 4   | **NUNCA** logar email completo de fornecedor em logs de produção                                |
| 5   | **NUNCA** logar CPF/CNPJ completo                                                               |
| 6   | **NUNCA** logar payloads completos de response em nível `info` (usar `debug` com sanitização)   |
| 7   | **NUNCA** desabilitar a sanitização em ambiente de produção                                     |

---

## 7. Checklist de implementação

- [x] `SiengeClient` mascara `Authorization` header em erros
- [x] `SiengeClient` injeta `correlationId` e `source` em logs
- [ ] Criar `packages/shared/src/utils/log-sanitizer.ts`
- [ ] Integrar sanitizer no interceptor de request body do `SiengeClient`
- [ ] Configurar Pino no `apps/api` (Fastify usa Pino nativamente)
- [ ] Criar wrapper de logger Pino no `workers/`
- [ ] Injetar logger no construtor do `SiengeClient`
- [ ] Configurar `archiveCompletedAfterSeconds` e `deleteAfterDays` no pg-boss
- [ ] Migrar `console.*` para logger estruturado nos handlers de jobs
