import { FastifyRequest, FastifyReply } from 'fastify';
import { LoginDto, ForgotPasswordDto, ResetPasswordDto } from '@projetog/shared';
import { AuditService } from '../audit/audit.service.js';
import { UserRole } from '@projetog/domain';

export class AuthController {
  constructor(private auditService: AuditService) {}

  public async login(
    request: FastifyRequest<{ Body: LoginDto }>,
    reply: FastifyReply
  ) {
    const { email, password } = request.body;
    const { supabase } = request.server;

    const { data, error } = await supabase.auth.signInWithPassword({
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
      return reply.code(403).send({ error: 'Forbidden', message: 'Acesso bloqueado, pendente ou removido' });
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
      supplierId: profileErrorData.supplier_id
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
        status: profileErrorData.status
      },
      session: {
        access_token: token,
      }
    });
  }

  public async logout(request: FastifyRequest, reply: FastifyReply) {
    // Para simplificação de arquitetura da V1, faremos o logout revogando do Supabase
    // Opcional se estiver usando JWT do Fastify (frontend limpa do localStorage)
    const { supabase } = request.server;
    
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
    reply: FastifyReply
  ) {
    const { email } = request.body;
    const { supabase } = request.server;

    // Dispara via Supabase (usando service role gerencia admin auth)
    const { error } = await supabase.auth.resetPasswordForEmail(email);

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
    reply: FastifyReply
  ) {
    const { token, new_password } = request.body;
    const { supabase } = request.server;

    // Redefinição feita sem estar logado necessita da API admin do Supabase (UpdateUserById) ou
    // a própria supabase JS local chamando updateUser (isso funciona quando se usa PKCE, mas aqui receberemos apenas token).
    // OBS: Em SSR puro essa rota pode não rodar sem ter a sessão válida do callback code.
    // Usaremos a API Admin para trocar a senha assumindo que o token não precise de verificação mágica (ou usamos o flow padrão client-side)
    // Para mitigar de forma rápida se estamos recebendo só token e password, assumiremos uso nativo ou faremos proxy:
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'recovery', email: '' });

    if (error || !data.user) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Token inválido ou expirado' });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(data.user.id, {
      password: new_password
    });

    if (updateError) {
      return reply.code(400).send({ error: updateError.message });
    }

    await this.auditService.log({
      eventType: 'password.reset_completed',
      targetUserId: data.user.id
    });

    return reply.send({ success: true });
  }

  public async me(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({
      data: {
        id: request.user.sub,
        email: request.user.email,
        role: request.user.role,
        status: request.user.status,
      }
    });
  }
}
