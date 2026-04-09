import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler, jsonSchemaTransform } from 'fastify-type-provider-zod';

import healthRoute from './routes/health.js';

export function buildApp() {
  const app = Fastify({
    logger: true // Substituir depois com integração Pino para logging da auditoria
  });

  // Zod type provider integration
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Security and Utils plugins globais
  app.register(helmet, { global: true });
  app.register(cors, {
    origin: '*', // Permitir todas em dev, ajustar no futuro (Supabase, Vercel app config)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });
  app.register(sensible);

  // Swagger Documentation
  app.register(swagger, {
    openapi: {
      info: {
        title: 'API projetoG GRF',
        description: 'Backend para portal de fornecimentos e backoffice',
        version: '1.0.0'
      }
    },
    transform: jsonSchemaTransform
  });

  app.register(swaggerUi, {
    routePrefix: '/docs'
  });

  // Routes
  app.register(healthRoute);

  return app;
}
