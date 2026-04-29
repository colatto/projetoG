import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from 'fastify-type-provider-zod';

import healthRoute from './routes/health.js';
import { supabasePlugin } from './plugins/supabase.js';
import { authPlugin } from './plugins/auth.js';
import { pgBossPlugin } from './plugins/pg-boss.js';
import { metricsPlugin } from './plugins/metrics.js';
import { authRoutes } from './modules/auth/index.js';
import { usersRoutes } from './modules/users/index.js';
import { webhookRoutes } from './modules/webhooks/index.js';
import { integrationRoutes } from './modules/integration/index.js';
import {
  quotationsBackofficeRoutes,
  supplierQuotationsRoutes,
} from './modules/quotations/index.js';
import { deliveriesRoutes } from './modules/deliveries/index.js';
import { ordersRoutes } from './modules/orders/index.js';
import { notificationsRoutes } from './modules/notifications/index.js';
import { followupRoutes } from './modules/followup/index.js';
import { damagesRoutes } from './modules/damages/index.js';
import { dashboardRoutes } from './modules/dashboard/index.js';

import type { JobPublisher } from './plugins/pg-boss.js';

interface BuildAppOptions {
  boss?: JobPublisher | null;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: true, // Substituir depois com integração Pino para logging da auditoria
  });

  // Zod type provider integration
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Security and Utils plugins globais
  app.register(helmet, { global: true });
  app.register(cors, {
    origin: '*', // Permitir todas em dev, ajustar no futuro (Supabase, Vercel app config)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.register(sensible);
  app.register(metricsPlugin);

  // Swagger Documentation
  app.register(swagger, {
    openapi: {
      info: {
        title: 'API projetoG GRF',
        description: 'Backend para portal de fornecimentos e backoffice',
        version: '1.0.0',
      },
    },
    transform: jsonSchemaTransform,
  });

  app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Plugins
  // Importante: Ler SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e JWT_SECRET de variaveis de ambiente
  app.register(supabasePlugin, {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  });

  app.register(authPlugin, {
    jwtSecret: process.env.JWT_SECRET || 'secret-placeholder',
  });

  if (options.boss !== undefined) {
    app.decorate('boss', options.boss);
  } else if (process.env.DATABASE_URL) {
    app.register(pgBossPlugin, {
      connectionString: process.env.DATABASE_URL,
    });
  } else {
    app.decorate('boss', null);
    app.log.warn('DATABASE_URL not configured; pg-boss publisher disabled in API');
  }

  // Routes
  app.register(healthRoute);
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(usersRoutes, { prefix: '/api/users' });
  app.register(webhookRoutes, { prefix: '/webhooks' });
  app.register(integrationRoutes, { prefix: '/api/integration' });

  // Quotations (PRD-02) — canonical routes + compatibility aliases (PRD-09)
  app.register(quotationsBackofficeRoutes, { prefix: '/api/quotations' });
  app.register(quotationsBackofficeRoutes, { prefix: '/api/backoffice/quotations' });
  app.register(supplierQuotationsRoutes, { prefix: '/api/supplier/quotations' });
  app.register(supplierQuotationsRoutes, { prefix: '/api/supplier-portal/quotations' });

  // Deliveries and Orders (PRD-05)
  app.register(deliveriesRoutes, { prefix: '/api/deliveries' });
  app.register(ordersRoutes, { prefix: '/api/orders' });

  // Notifications (PRD-03)
  app.register(notificationsRoutes, { prefix: '/api/notifications' });
  // Follow-up (PRD-04)
  app.register(followupRoutes, { prefix: '/api/followup' });
  // Damages and corrective actions (PRD-06)
  app.register(damagesRoutes, { prefix: '/api/damages' });
  // Dashboard and indicators (PRD-08)
  app.register(dashboardRoutes, { prefix: '/api/dashboard' });

  return app;
}
