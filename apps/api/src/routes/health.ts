import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

export default async function healthRoute(app: FastifyInstance) {
  // Configurando o ZodTypeProvider especificamente para o ciclo de vida dessa rotulagem
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get('/health', {
    schema: {
      tags: ['System'],
      description: 'Verifica a saúde da API',
      response: {
        200: z.object({
          status: z.string(),
          timestamp: z.string(),
          version: z.string()
        })
      }
    }
  }, async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  });
}
