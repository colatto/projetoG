import { z } from 'zod';
import { UserRole, UserStatus } from '@projetog/domain';

// POST /api/users
export const createUserSchema = z.object({
  name: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Perfil inválido' }) }),
  supplier_id: z.number().int().positive().optional(),
}).refine(data => {
  // `supplier_id` is mandatory if role is fornecedor
  if (data.role === UserRole.FORNECEDOR && !data.supplier_id) {
    return false;
  }
  return true;
}, {
  message: 'O campo supplier_id é obrigatório para o perfil de fornecedor',
  path: ['supplier_id'],
}).refine(data => {
  // `supplier_id` is forbidden if role is not fornecedor
  if (data.role !== UserRole.FORNECEDOR && data.supplier_id) {
    return false;
  }
  return true;
}, {
  message: 'O campo supplier_id só pode ser preenchido para o perfil de fornecedor',
  path: ['supplier_id'],
});

export type CreateUserDto = z.infer<typeof createUserSchema>;

// PATCH /api/users/:id
export const updateUserSchema = z.object({
  name: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres').optional(),
  email: z.string().email('E-mail inválido').optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

// GET /api/users
export const userQuerySchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().optional(),
  page: z.preprocess(
    (a) => parseInt(z.string().parse(a), 10),
    z.number().int().min(1).optional().default(1)
  ),
  per_page: z.preprocess(
    (a) => parseInt(z.string().parse(a), 10),
    z.number().int().min(1).max(100).optional().default(20)
  ),
});

export type UserQueryDto = z.infer<typeof userQuerySchema>;

// Parameters expecting ID
export const userIdParamSchema = z.object({
  id: z.string().uuid('ID de usuário inválido'),
});
