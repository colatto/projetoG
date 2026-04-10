import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { UsersController } from './users.controller.js';
import { AuditService } from '../audit/audit.service.js';
import { UserRole } from '@projetog/domain';
import { 
  createUserSchema,
  updateUserSchema,
  userQuerySchema,
  userIdParamSchema
} from '@projetog/shared';

export default async function usersRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  
  const auditService = new AuditService(fastify);
  const controller = new UsersController(auditService);

  // All endpoints here require authentication and Admin role
  app.addHook('preValidation', fastify.authenticate);
  app.addHook('preValidation', fastify.verifyRole([UserRole.ADMINISTRADOR]));

  app.get('/', {
    schema: { querystring: userQuerySchema }
  }, controller.listUsers.bind(controller));

  app.get('/:id', {
    schema: { params: userIdParamSchema }
  }, controller.getUserById.bind(controller));

  app.post('/', {
    schema: { body: createUserSchema }
  }, controller.createUser.bind(controller));

  app.patch('/:id', {
    schema: {
      params: userIdParamSchema,
      body: updateUserSchema
    }
  }, controller.updateUser.bind(controller));

  app.post('/:id/block', {
    schema: { params: userIdParamSchema }
  }, controller.blockUser.bind(controller));

  app.post('/:id/reactivate', {
    schema: { params: userIdParamSchema }
  }, controller.reactivateUser.bind(controller));

  app.delete('/:id', {
    schema: { params: userIdParamSchema }
  }, controller.deleteUser.bind(controller));

  app.post('/:id/reset-password', {
    schema: { params: userIdParamSchema }
  }, controller.resetPasswordByAdmin.bind(controller));
}
