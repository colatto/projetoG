import { FastifyRequest, FastifyReply } from 'fastify';
import { LoginDto, ForgotPasswordDto, ResetPasswordDto } from '@projetog/shared';
import { AuditService } from '../audit/audit.service.js';
import { UserRole } from '@projetog/domain';
import { getPasswordRedirectUrl } from '../../config/frontend-url.js';

export class AuthController {
  constructor(private auditService: AuditService) {}

  public async login(request: FastifyRequest<{ Body: LoginDto }>, reply: FastifyReply) {
    const { email, password } = request.body;
    const { supabase, supabaseAuth } = request.server;

    // Usar supabaseAuth para login para não contaminar o client principal (service_role)
    // com a sessão do usuário autenticado — isso quebraria RLS em queries posteriores.
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session) {
      await this.auditService.log({
        eventType: 'user.login_failed',
        metadata: { email, ip: request.ip },
      });
      return reply.code(401).send({ error: 'Unauthorized', message: 'Credenciais inválidas' });
    }

    // Buscando dados locais (role, status) de perfis (profiles tabela atual do banco)
    const { data: profileErrorData, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, role, status, supplier_id')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profileErrorData) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Perfil não encontrado na base' });
    }

    if (profileErrorData.status !== 'ativo') {
      return reply
        .code(403)
        .send({ error: 'Forbidden', message: 'Acesso bloqueado, pendente ou removido' });
    }

    // Retorna um JWT nosso assinado pelo fastify, OU podemos retornar o do Supabase.
    // O PRD diz que o Backend é orquestrador mas usa JWT verification.
    // Como o cliente fará chamadas à API, podemos usar o JWT do fastify contendo os claims necessários
    const token = request.server.jwt.sign({
      sub: data.user.id,
      email: data.user.email,
      role: profileErrorData.role as UserRole,
      status: profileErrorData.status,
      name: profileErrorData.name,
      supplierId: profileErrorData.supplier_id,
    });

    await this.auditService.log({
      eventType: 'user.login',
      actorId: data.user.id,
      metadata: { ip: request.ip },
    });

    return reply.send({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: profileErrorData.name,
        role: profileErrorData.role,
        supplier_id: profileErrorData.supplier_id,
        status: profileErrorData.status,
      },
      session: {
        access_token: token,
      },
    });
  }

  public async logout(request: FastifyRequest, reply: FastifyReply) {
    // Para simplificação de arquitetura da V1, faremos o logout revogando do Supabase
    // Opcional se estiver usando JWT do Fastify (frontend limpa do localStorage)

    // Tentamos fazer signOut no Supabase com o token de authorization do Request (caso enviado)
    // Na API estamos mandando auth global
    await this.auditService.log({
      eventType: 'user.logout',
      actorId: request.user.sub,
    });

    return reply.send({ success: true });
  }

  public async forgotPassword(
    request: FastifyRequest<{ Body: ForgotPasswordDto }>,
    reply: FastifyReply,
  ) {
    const { email } = request.body;
    const { supabaseAuth } = request.server;

    // Dispara via Supabase (usando service role gerencia admin auth)
    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordRedirectUrl(),
    });

    if (error) {
      request.server.log.error(error);
    }

    await this.auditService.log({
      eventType: 'password.reset_requested',
      metadata: { email, ip: request.ip },
    });

    // Retornamos sucesso sempre, mesmo se der erro, para não revelar e-mails
    return reply.send({ success: true });
  }

  public async resetPassword(
    request: FastifyRequest<{ Body: ResetPasswordDto }>,
    reply: FastifyReply,
  ) {
    const { token, new_password } = request.body;
    const { supabaseAuth } = request.server;

    const isJwtSessionToken = token.split('.').length === 3;
    const { data, error } = isJwtSessionToken
      ? await supabaseAuth.auth.getUser(token)
      : await supabaseAuth.auth.verifyOtp({
          token_hash: token,
          type: 'recovery',
        });

    if (error || !data.user) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Token inválido ou expirado' });
    }

    const { error: updateError } = await supabaseAuth.auth.admin.updateUserById(data.user.id, {
      password: new_password,
    });

    if (updateError) {
      return reply.code(400).send({ error: updateError.message });
    }

    // Auto-activate pending profiles on first password setup (invite flow).
    // This transitions status from 'pendente' → 'ativo' so the user can log in immediately.
    const { supabase } = request.server;
    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', data.user.id)
      .single();

    if (profile && profile.status === 'pendente') {
      const { error: activateError } = await supabase
        .from('profiles')
        .update({ status: 'ativo' })
        .eq('id', data.user.id);

      if (activateError) {
        request.log.error(
          { err: activateError, userId: data.user.id },
          'Failed to auto-activate profile after password set',
        );
      } else {
        await this.auditService.log({
          eventType: 'user.auto_activated',
          actorId: data.user.id,
          targetUserId: data.user.id,
          metadata: { trigger: 'password_set_on_invite' },
        });
      }
    }

    await this.auditService.log({
      eventType: 'password.reset_completed',
      targetUserId: data.user.id,
    });

    return reply.send({ success: true });
  }

  public async me(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({
      data: {
        id: request.user.sub,
        email: request.user.email,
        name: request.user.name,
        role: request.user.role,
        status: request.user.status,
      },
    });
  }
}
