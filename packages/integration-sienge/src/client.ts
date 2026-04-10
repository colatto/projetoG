import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import axiosRetry, { isNetworkOrIdempotentRequestError } from 'axios-retry';
import { SiengeConfig, siengeConfigSchema } from './config/env.js';

export interface RequestContext {
  correlationId?: string;
  source?: 'fastify' | 'worker' | 'unknown';
}

export class SiengeClient {
  private api: AxiosInstance;
  private config: SiengeConfig;

  constructor(envConfig: unknown) {
    // Valida as credenciais no momento do boot
    this.config = siengeConfigSchema.parse(envConfig);

    this.api = axios.create({
      baseURL: this.config.SIENGE_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${this.config.SIENGE_API_KEY}:${this.config.SIENGE_API_SECRET}`).toString('base64')}`,
      },
    });

    // Configurando Retry restrito a operações nativamente seguras
    axiosRetry(this.api, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // Recarrega apenas em requests idempotentes (GET, HEAD, OPTIONS, PUT, DELETE) com 5xx ou erros de Network.
        // POSTs e mutações críticas NÃO terão retarget automatizado via HTTP client, ficando a cargo 
        // da orquestração de persistência garantir o estado da transação.
        return isNetworkOrIdempotentRequestError(error);
      },
      onRetry: (retryCount, _error, requestConfig) => {
        const correlationId = (requestConfig as InternalAxiosRequestConfig & { _correlationId?: string })._correlationId || 'unknown';
        const source = (requestConfig as InternalAxiosRequestConfig & { _source?: string })._source || 'unknown';

        console.warn(
          `[SiengeClient] Retry attempt ${retryCount} for ${requestConfig.method?.toUpperCase()} ${requestConfig.url}. CorrelationId: ${correlationId}. Source: ${source}. Error: ${_error.message}`
        );
      },
    });

    // Interceptors para Mascaramento e injeção do correlacionamento nos erros
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const correlationId = (error.config as InternalAxiosRequestConfig & { _correlationId?: string })?._correlationId || 'unknown';
        const source = (error.config as InternalAxiosRequestConfig & { _source?: string })?._source || 'unknown';

        // Remove headers sensíveis nos logs para que credentials não vazem
        if (error.config?.headers?.['Authorization']) {
          error.config.headers['Authorization'] = '***REDACTED***';
        }

        console.error(`[SiengeClient] Falha na integração Sienge ${error.config?.method?.toUpperCase()} ${error.config?.url}. CorrelationId: ${correlationId}. Source: ${source}. Status: ${error.response?.status}. Erro: ${error.message}`);

        return Promise.reject(error);
      }
    );
  }

  /**
   * Encapsula requisições repassando os parâmetros de contexto a instância axios internamente
   */
  public async request<T = unknown>(config: InternalAxiosRequestConfig & { context?: RequestContext }): Promise<T> {
    const extendedConfig = {
      ...config,
      _correlationId: config.context?.correlationId,
      _source: config.context?.source
    } as InternalAxiosRequestConfig & { _correlationId?: string; _source?: string };

    const response = await this.api.request<T>(extendedConfig);
    return response.data;
  }

  /**
   * Wrapper seguro para métodos GET.
   * Utiliza retry automático por se tratar de operação idempotente segura e imutável.
   */
  public async get<T = unknown>(url: string, context?: RequestContext, config?: Record<string, unknown>): Promise<T> {
    return this.request<T>({ method: 'GET', url, context, ...config } as InternalAxiosRequestConfig & { context?: RequestContext });
  }

  /**
   * Wrapper protegido para métodos POST.
   * Não aplica retry em erros de payload pois retries ingênuos na criação podem gerar persistência duplicada.
   * A idempotência das mutações deve ser gerenciada pelo banco Supabase externo a este modelo HTTP.
   */
  public async post<T = unknown>(url: string, data?: unknown, context?: RequestContext, config?: Record<string, unknown>): Promise<T> {
    return this.request<T>({ method: 'POST', url, data, context, ...config } as InternalAxiosRequestConfig & { context?: RequestContext });
  }

  // TODO: Adicionais métodos `put`, `delete` conforme o design exigido pelo pacote domain
}

export function createSiengeClient(envConfig: unknown): SiengeClient {
  return new SiengeClient(envConfig);
}
