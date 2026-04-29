import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { EmailProvider, ResendEmailProvider } from '../modules/notifications/email-provider.js';

declare module 'fastify' {
  interface FastifyInstance {
    email: EmailProvider;
  }
}

export interface EmailPluginOptions {
  apiKey: string;
  fromAddress: string;
}

const emailPlugin: FastifyPluginAsync<EmailPluginOptions> = async (fastify, options) => {
  if (!options.apiKey) {
    fastify.log.warn('EMAIL_PROVIDER_API_KEY is not defined. Email sending will fail.');
  }

  if (!options.fromAddress) {
    fastify.log.warn(
      'EMAIL_FROM_ADDRESS is not defined. Using default noreply@grfincorporadora.com',
    );
  }

  const fromAddress = options.fromAddress || 'GRF Cotações <cotacoes@grfincorporadora.com>';
  const provider = new ResendEmailProvider(options.apiKey || 'dummy', fromAddress);

  fastify.decorate('email', provider);
};

export default fp(emailPlugin, {
  name: 'email-provider',
});
