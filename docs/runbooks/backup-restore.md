# Runbook de Backup e Recuperação — Supabase (dbGRF)

Procedimentos operacionais para backup, restore e disaster recovery do banco de dados de produção.

## 1. Backups Automáticos (Supabase Pro)

O plano Pro inclui:

- **Backup diário** automático (retenção: 7 dias)
- **PITR** (Point-in-Time Recovery) com granularidade de até 1 segundo

### 1.1 Verificar status dos backups

1. Acesse: **Dashboard → Database → Backups**
2. Confirme que o último backup foi concluído com sucesso
3. Verifique a data/hora do backup mais recente

### 1.2 Restore via Dashboard

1. Acesse: **Dashboard → Database → Backups**
2. Selecione o snapshot desejado ou escolha um timestamp específico (PITR)
3. Clique em **Restore**
4. Aguarde a conclusão (pode levar minutos dependendo do tamanho)

> **Atenção:** O restore substitui **todo** o banco, incluindo `auth.users`. Sessões ativas serão invalidadas.

## 2. Backup Manual com `pg_dump`

Para backups complementares fora do ciclo automático.

### 2.1 Pré-requisitos

- PostgreSQL client (`pg_dump`) instalado localmente
- Connection string de produção (use a connection string do Supabase Pooler em modo `session`)

### 2.2 Executar backup

```bash
# Full backup (schema + dados)
pg_dump \
  --format=custom \
  --verbose \
  --no-owner \
  --no-privileges \
  --schema=public \
  --schema=auth \
  -f backup_$(date +%Y%m%d_%H%M%S).dump \
  "$DATABASE_URL"
```

### 2.3 Backup apenas schema (sem dados)

```bash
pg_dump \
  --format=custom \
  --schema-only \
  --schema=public \
  -f schema_$(date +%Y%m%d_%H%M%S).dump \
  "$DATABASE_URL"
```

### 2.4 Backup de tabelas críticas

```bash
# Tabelas de configuração e auditoria
pg_dump \
  --format=custom \
  --table=public.profiles \
  --table=public.sienge_credentials \
  --table=public.notification_templates \
  --table=public.audit_logs \
  --table=public.business_days_holidays \
  -f config_tables_$(date +%Y%m%d_%H%M%S).dump \
  "$DATABASE_URL"
```

## 3. Restore Manual com `pg_restore`

### 3.1 Restore completo

```bash
# Em um banco limpo (após reset ou novo projeto)
pg_restore \
  --verbose \
  --no-owner \
  --no-privileges \
  --single-transaction \
  -d "$DATABASE_URL" \
  backup_YYYYMMDD_HHMMSS.dump
```

### 3.2 Restore de tabelas específicas

```bash
pg_restore \
  --verbose \
  --no-owner \
  --data-only \
  --table=notification_templates \
  -d "$DATABASE_URL" \
  config_tables_YYYYMMDD_HHMMSS.dump
```

## 4. Procedimento de Disaster Recovery

### 4.1 Cenário: Dados corrompidos por operação indevida

1. **Avaliar impacto:** Identificar quais tabelas/registros foram afetados
2. **Se possível, use PITR:** Restaure para o timestamp anterior à corrupção
3. **Se PITR não disponível:** Use o último backup diário
4. **Reprocessar dados perdidos:** Para tabelas sincronizadas com Sienge (`purchase_orders`, `purchase_quotations`, `suppliers`, etc.), dispare o polling manual nos workers para re-sincronizar

### 4.2 Cenário: Projeto Supabase indisponível

1. Verificar status em **https://status.supabase.com**
2. Se o projeto estiver pausado: **Dashboard → Settings → General → Restore project**
3. Se houver falha regional: Supabase migrará automaticamente (SLA Pro)
4. Comunicar usuários via canal oficial

### 4.3 Cenário: Credenciais comprometidas

1. **Imediato:** Rotacionar todas as API keys no Dashboard
2. **JWT Secret:** Dashboard → Settings → API → Regenerate JWT Secret
3. **Service Role Key:** será regenerada junto com o JWT Secret
4. **Atualizar:** variáveis de ambiente na Hostinger (API + Workers) e Vercel (frontend)
5. **Invalidar sessões:** todas as sessions existentes serão invalidadas automaticamente

## 5. Cron de Backup Externo (Recomendado)

Para redundância, configure um cron na Hostinger ou CI:

```bash
# Exemplo: backup diário às 03:00 UTC
0 3 * * * /usr/bin/pg_dump --format=custom --schema=public -f /backups/grf_$(date +\%Y\%m\%d).dump "$DATABASE_URL" && find /backups -name "grf_*.dump" -mtime +30 -delete
```

## 6. Checklist Pós-Restore

- [ ] Verificar contagem de registros em tabelas críticas (`profiles`, `purchase_orders`, `suppliers`)
- [ ] Testar login de pelo menos 1 usuário de cada perfil
- [ ] Verificar que os workers conseguem conectar e executar jobs
- [ ] Confirmar que as RLS policies estão intactas (`SELECT count(*) FROM pg_policies WHERE schemaname = 'public'`)
- [ ] Disparar polling manual para reconciliar dados do Sienge
- [ ] Verificar endpoint `/health` da API
- [ ] Monitorar logs por 30 minutos pós-restore
