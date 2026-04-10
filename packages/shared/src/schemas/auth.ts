import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  new_password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
});

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  role: z.enum(['fornecedor', 'compras', 'administrador', 'visualizador_pedidos']),
  supplier_id: z.number().int().positive().optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  status: z.enum(['pendente', 'ativo', 'bloqueado', 'removido']).optional(),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
