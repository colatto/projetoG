import axios, {
  AxiosInstance,
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import axiosRetryModule, { isNetworkOrIdempotentRequestError } from 'axios-retry';

// Resolve ESM/CJS interop: in CJS context, the default export is nested
// under `.default`; in ESM context, it's the module itself.
const axiosRetry = (
  typeof axiosRetryModule === 'function'
    ? axiosRetryModule
    : (axiosRetryModule as unknown as { default: typeof axiosRetryModule }).default
) as typeof axiosRetryModule;
import Bottleneck from 'bottleneck';
import { SiengeConfig, siengeConfigSchema } from './config/env.js';
import type { SiengePaginatedResponse } from './types/sienge-types.js';

export interface RequestContext {
  correlationId?: string;
  source?: 'fastify' | 'worker' | 'unknown';
}

/** Default rate limits from PRD-07 §RN-03 */
const DEFAULT_REST_RATE_LIMIT = 200; // requests per minute
const DEFAULT_BULK_RATE_LIMIT = 20; // requests per minute

/** Default pagination settings from PRD-07 §RN-04 */
const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = 200;

export interface RateLimitConfig {
  restPerMinute?: number;
  bulkPerMinute?: number;
}

export class SiengeClient {
  private api: AxiosInstance;
  private config: SiengeConfig;
  private restLimiter: Bottleneck;
  private bulkLimiter: Bottleneck;

  constructor(envConfig: unknown, rateLimitConfig?: RateLimitConfig) {
    // Validates credentials at boot time
    this.config = siengeConfigSchema.parse(envConfig);

    this.api = axios.create({
      baseURL: this.config.SIENGE_BASE_URL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${this.config.SIENGE_API_KEY}:${this.config.SIENGE_API_SECRET}`).toString('base64')}`,
      },
    });

    // Configure rate limiters via Bottleneck (PRD-07 §RN-03)
    const restPerMinute = rateLimitConfig?.restPerMinute ?? DEFAULT_REST_RATE_LIMIT;
    const bulkPerMinute = rateLimitConfig?.bulkPerMinute ?? DEFAULT_BULK_RATE_LIMIT;

    this.restLimiter = new Bottleneck({
      reservoir: restPerMinute,
      reservoirRefreshAmount: restPerMinute,
      reservoirRefreshInterval: 60_000, // 1 minute
      maxConcurrent: 10,
    });

    this.bulkLimiter = new Bottleneck({
      reservoir: bulkPerMinute,
      reservoirRefreshAmount: bulkPerMinute,
      reservoirRefreshInterval: 60_000,
      maxConcurrent: 2,
    });

    // Configure Retry restricted to natively safe/idempotent operations
    axiosRetry(this.api, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // Only retries idempotent requests (GET, HEAD, OPTIONS, PUT, DELETE) on 5xx or network errors.
        // POSTs and critical mutations do NOT get automatic HTTP-level retry;
        // the persistence orchestration layer handles transaction state.
        return isNetworkOrIdempotentRequestError(error);
      },
      onRetry: (retryCount: number, _error: AxiosError, requestConfig: AxiosRequestConfig) => {
        const correlationId =
          (requestConfig as InternalAxiosRequestConfig & { _correlationId?: string })
            ._correlationId || 'unknown';
        const source =
          (requestConfig as InternalAxiosRequestConfig & { _source?: string })._source || 'unknown';

        console.warn(
          `[SiengeClient] Retry attempt ${retryCount} for ${requestConfig.method?.toUpperCase()} ${requestConfig.url}. CorrelationId: ${correlationId}. Source: ${source}. Error: ${_error.message}`,
        );
      },
    });

    // Response interceptors for masking and correlation injection in errors
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const correlationId =
          (error.config as InternalAxiosRequestConfig & { _correlationId?: string })
            ?._correlationId || 'unknown';
        const source =
          (error.config as InternalAxiosRequestConfig & { _source?: string })?._source || 'unknown';

        // Redact sensitive headers in logs so credentials never leak
        if (error.config?.headers?.['Authorization']) {
          error.config.headers['Authorization'] = '***REDACTED***';
        }

        console.error(
          `[SiengeClient] Integration failure ${error.config?.method?.toUpperCase()} ${error.config?.url}. CorrelationId: ${correlationId}. Source: ${source}. Status: ${error.response?.status}. Error: ${error.message}`,
        );

        return Promise.reject(error);
      },
    );
  }

  /**
   * Core request dispatcher — injects context metadata into the Axios instance.
   * All requests are throttled through the REST rate limiter.
   */
  public async request<T = unknown>(
    config: InternalAxiosRequestConfig & { context?: RequestContext },
  ): Promise<T> {
    const extendedConfig = {
      ...config,
      _correlationId: config.context?.correlationId,
      _source: config.context?.source,
    } as InternalAxiosRequestConfig & { _correlationId?: string; _source?: string };

    return this.restLimiter.schedule(async () => {
      const response = await this.api.request<T>(extendedConfig);
      return response.data;
    });
  }

  /**
   * Core request dispatcher for BULK endpoints.
   * Uses the stricter 20/min rate limiter.
   */
  public async requestBulk<T = unknown>(
    config: InternalAxiosRequestConfig & { context?: RequestContext },
  ): Promise<T> {
    const extendedConfig = {
      ...config,
      _correlationId: config.context?.correlationId,
      _source: config.context?.source,
    } as InternalAxiosRequestConfig & { _correlationId?: string; _source?: string };

    return this.bulkLimiter.schedule(async () => {
      const response = await this.api.request<T>(extendedConfig);
      return response.data;
    });
  }

  // ── HTTP Method Wrappers ──────────────────────────────────────────

  /**
   * Safe GET wrapper.
   * Uses automatic retry since GET is idempotent and safe.
   */
  public async get<T = unknown>(
    url: string,
    context?: RequestContext,
    config?: Record<string, unknown>,
  ): Promise<T> {
    return this.request<T>({
      method: 'GET',
      url,
      context,
      ...config,
    } as InternalAxiosRequestConfig & { context?: RequestContext });
  }

  /**
   * Protected POST wrapper.
   * Does NOT apply retry on payload errors since naive retries on creation
   * can cause duplicate persistence. Idempotency for mutations is managed
   * by the external Supabase persistence layer.
   */
  public async post<T = unknown>(
    url: string,
    data?: unknown,
    context?: RequestContext,
    config?: Record<string, unknown>,
  ): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      context,
      ...config,
    } as InternalAxiosRequestConfig & { context?: RequestContext });
  }

  /**
   * PUT wrapper — idempotent update.
   * Axios-retry treats PUT as idempotent, so automatic retry is enabled.
   */
  public async put<T = unknown>(
    url: string,
    data?: unknown,
    context?: RequestContext,
    config?: Record<string, unknown>,
  ): Promise<T> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      context,
      ...config,
    } as InternalAxiosRequestConfig & { context?: RequestContext });
  }

  /**
   * PATCH wrapper — partial update.
   * Not treated as idempotent by axios-retry; retry is managed by
   * the business retry layer (Camada 3).
   */
  public async patch<T = unknown>(
    url: string,
    data?: unknown,
    context?: RequestContext,
    config?: Record<string, unknown>,
  ): Promise<T> {
    return this.request<T>({
      method: 'PATCH',
      url,
      data,
      context,
      ...config,
    } as InternalAxiosRequestConfig & { context?: RequestContext });
  }

  /**
   * DELETE wrapper — idempotent removal.
   * Axios-retry treats DELETE as idempotent, so automatic retry is enabled.
   */
  public async delete<T = unknown>(
    url: string,
    context?: RequestContext,
    config?: Record<string, unknown>,
  ): Promise<T> {
    return this.request<T>({
      method: 'DELETE',
      url,
      context,
      ...config,
    } as InternalAxiosRequestConfig & { context?: RequestContext });
  }

  // ── Pagination ────────────────────────────────────────────────────

  /**
   * Automatic pagination following PRD-07 §RN-04.
   * Iterates through all pages of a paginated Sienge endpoint and
   * returns the accumulated results.
   *
   * @param url     The endpoint path (e.g. `/purchase-quotations/all/negotiations`)
   * @param params  Additional query parameters (filters)
   * @param context Request context for correlation
   * @param limit   Page size (default: 100, max: 200 per Sienge API)
   * @returns       All results accumulated across all pages
   */
  public async paginateAll<T>(
    url: string,
    params: Record<string, unknown> = {},
    context?: RequestContext,
    limit: number = DEFAULT_PAGE_LIMIT,
  ): Promise<T[]> {
    const pageSize = Math.min(limit, MAX_PAGE_LIMIT);
    const allResults: T[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.get<SiengePaginatedResponse<T>>(url, context, {
        params: { ...params, limit: pageSize, offset },
      });

      if (response.results && response.results.length > 0) {
        allResults.push(...response.results);
      }

      // Determine if there are more pages
      const totalCount = response.resultSetMetadata?.count ?? 0;
      offset += pageSize;
      hasMore = offset < totalCount;
    }

    return allResults;
  }

  // ── Accessors ─────────────────────────────────────────────────────

  /** Returns the base URL configured for this client. */
  public getBaseUrl(): string {
    return this.config.SIENGE_BASE_URL;
  }
}

export function createSiengeClient(
  envConfig: unknown,
  rateLimitConfig?: RateLimitConfig,
): SiengeClient {
  return new SiengeClient(envConfig, rateLimitConfig);
}
