import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from '@projetog/shared';
import { AuditService } from '../audit/audit.service.js';
import { UserRole, UserStatus } from '@projetog/domain';

export class UsersController {
  constructor(private auditService: AuditService) {}

  async listUsers(request: FastifyRequest<{ Querystring: UserQueryDto }>, reply: FastifyReply) {
    const { role, status, search, page = 1, per_page = 20 } = request.query;
    const supabase = request.server.supabase;

    let query = supabase.from('profiles').select('*', { count: 'exact' });

    if (role) {
      query = query.eq('role', role);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Pagination (0-indexed on offset)
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;

    query = query.range(from, to).order('created_at', { ascending: false });

    const { data, count, error } = await query;

    if (error) {
      request.log.error(error);
      return reply.code(500).send({ message: 'Erro ao buscar usuários', error: error.message });
    }

    return reply.code(200).send({
      data,
      pagination: {
        total: count || 0,
        page,
        per_page,
      },
    });
  }

  async getUserById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const supabase = request.server.supabase;

    const { data: user, error } = await supabase.from('profiles').select('*').eq('id', id).single();

    if (error || !user) {
      return reply.code(404).send({ message: 'Usuário não encontrado' });
    }

    return reply.code(200).send({ data: user });
  }

  async createUser(request: FastifyRequest<{ Body: CreateUserDto }>, reply: FastifyReply) {
    const payload = request.body;
    const adminId = request.user.sub;
    const supabase = request.server.supabase;

    // Verify email uniqueness in local profiles (pending, blocked, active)
    const { data: emailConflict } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', payload.email)
      .neq('status', UserStatus.REMOVIDO)
      .maybeSingle();

    if (emailConflict) {
      return reply.code(400).send({ message: 'E-mail já está em uso' });
    }

    // Verify supplier_id uniqueness if is fornecedor
    if (payload.role === UserRole.FORNECEDOR && payload.supplier_id) {
      const { data: supplierConflict } = await supabase
        .from('profiles')
        .select('id')
        .eq('supplier_id', payload.supplier_id)
        .neq('status', UserStatus.REMOVIDO)
        .maybeSingle();

      if (supplierConflict) {
        return reply
          .code(400)
          .send({ message: 'O ID de Fornecedor informado já possui um acesso ativo' });
      }
    }

    // Supabase Auth Creation
    // Utilizing admin API to invite user, it generates user and emails the magic link
    const { data: authUser, error: authError } = await supabase.auth.admin.inviteUserByEmail(
      payload.email,
    );

    if (authError || !authUser.user) {
      request.log.error(authError);
      return reply.code(500).send({ message: 'Erro ao provisionar usuário na identidade' });
    }

    const userId = authUser.user.id;

    // Profile creation
    const { data: profile, error: dbError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        supplier_id: payload.supplier_id || null,
        status: UserStatus.PENDENTE,
        created_by: adminId,
      })
      .select()
      .single();

    if (dbError) {
      request.log.error(dbError);
      return reply.code(500).send({ message: 'Erro ao registrar perfil local' });
    }

    await this.auditService.log({
      eventType: 'user.created',
      actorId: adminId,
      targetUserId: userId,
      metadata: { role: payload.role, email: payload.email },
    });

    return reply.code(201).send({ data: profile });
  }

  async updateUser(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserDto }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const changes = request.body;
    const adminId = request.user.sub;
    const supabase = request.server.supabase;

    // Identify user
    const { data: user } = await supabase.from('profiles').select('*').eq('id', id).single();

    if (!user) {
      return reply.code(404).send({ message: 'Usuário não encontrado' });
    }

    const updates: import('@projetog/shared').Database['public']['Tables']['profiles']['Update'] =
      {};

    if (changes.name && changes.name !== user.name) {
      updates.name = changes.name;
    }

    if (changes.status && changes.status !== user.status) {
      updates.status = changes.status;
    }

    if (changes.email && changes.email !== user.email) {
      // Check email conflict
      const { data: emailConflict } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', changes.email)
        .neq('status', UserStatus.REMOVIDO)
        .neq('id', id)
        .maybeSingle();

      if (emailConflict) {
        return reply.code(400).send({ message: 'Novo e-mail já está em uso' });
      }

      // Update in Auth Supabase
      const { error: authError } = await supabase.auth.admin.updateUserById(id, {
        email: changes.email,
      });

      if (authError) {
        return reply.code(500).send({ message: 'Erro ao atualizar e-mail de identidade' });
      }

      updates.email = changes.email;

      // Store original email
      if (!user.original_email) {
        updates.original_email = user.email;
      }
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(200).send({ data: user }); // No changes
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return reply.code(500).send({ message: 'Erro ao salvar alterações no perfil' });
    }

    if (updates.email) {
      await this.auditService.log({
        eventType: 'user.email_changed',
        actorId: adminId,
        targetUserId: id,
        metadata: { old_email: user.email, new_email: updates.email },
      });
    }

    await this.auditService.log({
      eventType: 'user.edited',
      actorId: adminId,
      targetUserId: id,
      metadata: { fields_changed: Object.keys(updates).join(', ') },
    });

    return reply.code(200).send({ data: updatedProfile });
  }

  async blockUser(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const adminId = request.user.sub;
    const supabase = request.server.supabase;

    const { data: user } = await supabase.from('profiles').select('status').eq('id', id).single();

    if (!user) return reply.code(404).send({ message: 'Usuário não encontrado' });
    if (user.status === UserStatus.BLOQUEADO)
      return reply.code(409).send({ message: 'Usuário já está bloqueado' });
    if (user.status === UserStatus.REMOVIDO)
      return reply.code(409).send({ message: 'Não é possível operar sobre usuário removido' });

    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({
        status: UserStatus.BLOQUEADO,
        blocked_at: new Date().toISOString(),
        blocked_by: adminId,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.code(500).send({ message: 'Erro ao bloquear perfil' });

    await this.auditService.log({
      eventType: 'user.blocked',
      actorId: adminId,
      targetUserId: id,
    });

    return reply.code(200).send({ data: updatedProfile });
  }

  async reactivateUser(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const adminId = request.user.sub;
    const supabase = request.server.supabase;

    const { data: user } = await supabase.from('profiles').select('status').eq('id', id).single();

    if (!user) return reply.code(404).send({ message: 'Usuário não encontrado' });
    if (user.status !== UserStatus.BLOQUEADO)
      return reply.code(409).send({ message: 'Usuário não está bloqueado' });

    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({
        status: UserStatus.ATIVO,
        blocked_at: null,
        blocked_by: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.code(500).send({ message: 'Erro ao reativar perfil' });

    await this.auditService.log({
      eventType: 'user.reactivated',
      actorId: adminId,
      targetUserId: id,
    });

    return reply.code(200).send({ data: updatedProfile });
  }

  async deleteUser(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { id } = request.params;
    const adminId = request.user.sub;
    const supabase = request.server.supabase;

    const { data: user } = await supabase.from('profiles').select('status').eq('id', id).single();

    if (!user) return reply.code(404).send({ message: 'Usuário não encontrado' });
    if (user.status === UserStatus.REMOVIDO)
      return reply.code(409).send({ message: 'Usuário já está removido' });

    // Set auth to suspended or just delete from auth. In this context, we just mark as removido as soft delete.
    await supabase.auth.admin.deleteUser(id); // Or keep it if we want to retain references, but deleting from auth revokes everything.

    // We will do soft delete locally
    const { error } = await supabase
      .from('profiles')
      .update({ status: UserStatus.REMOVIDO })
      .eq('id', id);

    if (error) return reply.code(500).send({ message: 'Erro ao remover perfil' });

    await this.auditService.log({
      eventType: 'user.removed',
      actorId: adminId,
      targetUserId: id,
    });

    return reply.code(200).send({ success: true });
  }

  async resetPasswordByAdmin(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const adminId = request.user.sub;
    const supabase = request.server.supabase;

    const { data: user } = await supabase
      .from('profiles')
      .select('email, status')
      .eq('id', id)
      .single();

    if (!user) return reply.code(404).send({ message: 'Usuário não encontrado' });
    if (user.status === UserStatus.REMOVIDO)
      return reply.code(403).send({ message: 'Usuário removido' });

    const { error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
    });

    if (error) return reply.code(500).send({ message: 'Erro ao gerar link de redefinição' });

    await this.auditService.log({
      eventType: 'password.reset_by_admin',
      actorId: adminId,
      targetUserId: id,
    });

    return reply.code(200).send({ success: true });
  }
}
