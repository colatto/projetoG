import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  dashboardAtrasosQuerySchema,
  dashboardAvariasQuerySchema,
  dashboardCriticidadeQuerySchema,
  dashboardKpisQuerySchema,
  dashboardLeadTimeQuerySchema,
  dashboardRankingFornecedoresQuerySchema,
  dashboardResumoQuerySchema,
} from '@projetog/shared';
import { UserRole } from '@projetog/domain';
import { DashboardController } from './dashboard.controller.js';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const controller = new DashboardController(app);

  typedApp.addHook('preValidation', app.authenticate);
  typedApp.addHook(
    'preValidation',
    typedApp.verifyRole([UserRole.ADMINISTRADOR, UserRole.COMPRAS]),
  );

  typedApp.get(
    '/resumo',
    { schema: { querystring: dashboardResumoQuerySchema } },
    controller.getResumo.bind(controller),
  );
  typedApp.get(
    '/kpis',
    { schema: { querystring: dashboardKpisQuerySchema } },
    controller.getKpis.bind(controller),
  );
  typedApp.get(
    '/lead-time',
    { schema: { querystring: dashboardLeadTimeQuerySchema } },
    controller.getLeadTime.bind(controller),
  );
  typedApp.get(
    '/atrasos',
    { schema: { querystring: dashboardAtrasosQuerySchema } },
    controller.getAtrasos.bind(controller),
  );
  typedApp.get(
    '/criticidade',
    { schema: { querystring: dashboardCriticidadeQuerySchema } },
    controller.getCriticidade.bind(controller),
  );
  typedApp.get(
    '/ranking-fornecedores',
    { schema: { querystring: dashboardRankingFornecedoresQuerySchema } },
    controller.getRankingFornecedores.bind(controller),
  );
  typedApp.get(
    '/avarias',
    { schema: { querystring: dashboardAvariasQuerySchema } },
    controller.getAvarias.bind(controller),
  );
};
