import { Job } from 'pg-boss';

export async function processSiengeReconcile(job: Job) {
  console.log(`[Job: ${job.name}] Executing Sienge Reconcile. ID: ${job.id}`);
  
  // TO-DO: Implementar leitura detalhada disparada por webhooks
  // Exemplo:
  // 1. Receber ID via job.data
  // 2. Chamar Sienge
  // 3. Atualizar Supabase com dados persistidos
}
