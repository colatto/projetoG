import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import axiosRetry, { isNetworkOrIdempotentRequestError } from 'axios-retry';
import { SiengeClient, createSiengeClient } from '../client.js';
import { ZodError } from 'zod';

vi.mock('axios', () => {
  const mockInstance = {
    request: vi.fn(),
    interceptors: {
      response: {
        use: vi.fn(),
      },
    },
  };
  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
  };
});

vi.mock('axios-retry', () => {
  return {
    default: vi.fn(),
    isNetworkOrIdempotentRequestError: vi.fn(),
  };
});

describe('SiengeClient', () => {
  const validConfig = {
    SIENGE_BASE_URL: 'https://api.sienge.com.br',
    SIENGE_API_KEY: 'test_key',
    SIENGE_API_SECRET: 'test_secret',
  };

  let mockAxiosInstance: Mock;

  beforeEach(() => {
    mockAxiosInstance = (axios.create as Mock)().request;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should validate config and throw on missing required env vars', () => {
      expect(() => new SiengeClient({})).toThrow(ZodError);
    });

    it('should create axios instance with correct base URL and auth headers', () => {
      new SiengeClient(validConfig);
      
      const expectedAuth = `Basic ${Buffer.from('test_key:test_secret').toString('base64')}`;

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.sienge.com.br',
          headers: expect.objectContaining({
            Authorization: expectedAuth,
          }),
        })
      );
    });

    it('should handle interceptor error logging', async () => {
      const client = createSiengeClient(validConfig);
      expect(client).toBeInstanceOf(SiengeClient);

      // Access the mocked interceptor use function
      const useMock = (axios.create as Mock)().interceptors.response.use as Mock;
      const errorFn = useMock.mock.calls[0][1];

      const errorObj = {
        message: 'Network Error',
        response: { status: 500 },
        config: {
          method: 'GET',
          url: '/test',
          _correlationId: 'cor1',
          _source: 'test-src',
          headers: {
            Authorization: 'Basic auth',
          },
        },
      };

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await expect(errorFn(errorObj)).rejects.toEqual(errorObj);
      expect(errorObj.config.headers.Authorization).toBe('***REDACTED***');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle axios retry logging and conditions', () => {
      new SiengeClient(validConfig);

      const retryConfig = (axiosRetry as unknown as Mock).mock.calls[0][1];
      
      // Test retryCondition
      const isNetworkOrIdempotentRequestErrorMock = isNetworkOrIdempotentRequestError as unknown as Mock;
      isNetworkOrIdempotentRequestErrorMock.mockReturnValue(true);
      
      expect(retryConfig.retryCondition({} as any)).toBe(true);

      // Test onRetry
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      retryConfig.onRetry(1, { message: 'err' } as any, {
        method: 'GET',
        url: '/test',
        _correlationId: 'cor1',
        _source: 'src1',
      } as any);

      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('HTTP Methods', () => {
    let client: SiengeClient;

    beforeEach(() => {
      client = new SiengeClient(validConfig);
    });

    it('should execute GET requests and return data', async () => {
      mockAxiosInstance.mockResolvedValue({ data: { success: true } });

      const result = await client.get('/test', { correlationId: '123' });

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          _correlationId: '123',
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('should execute POST requests and return data', async () => {
      mockAxiosInstance.mockResolvedValue({ data: { id: 1 } });

      const result = await client.post('/test', { name: 'test' });

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/test',
          data: { name: 'test' },
        })
      );
      expect(result).toEqual({ id: 1 });
    });

    it('should execute PUT requests and return data', async () => {
      mockAxiosInstance.mockResolvedValue({ data: { id: 1 } });

      const result = await client.put('/test/1', { name: 'updated' });

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: '/test/1',
          data: { name: 'updated' },
        })
      );
      expect(result).toEqual({ id: 1 });
    });

    it('should execute PATCH requests and return data', async () => {
      mockAxiosInstance.mockResolvedValue({ data: { id: 1 } });

      const result = await client.patch('/test/1', { name: 'patched' });

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          url: '/test/1',
          data: { name: 'patched' },
        })
      );
      expect(result).toEqual({ id: 1 });
    });

    it('should execute DELETE requests and return data', async () => {
      mockAxiosInstance.mockResolvedValue({ data: { success: true } });

      const result = await client.delete('/test/1');

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: '/test/1',
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('should execute requestBulk and return data', async () => {
      mockAxiosInstance.mockResolvedValue({ data: { bulk: true } });

      const result = await client.requestBulk({ method: 'GET', url: '/bulk', headers: {} as any });

      expect(mockAxiosInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/bulk',
        })
      );
      expect(result).toEqual({ bulk: true });
    });

    it('should return base URL', () => {
      expect(client.getBaseUrl()).toBe('https://api.sienge.com.br');
    });
  });

  describe('Pagination (paginateAll)', () => {
    let client: SiengeClient;

    beforeEach(() => {
      client = new SiengeClient(validConfig);
    });

    it('should fetch all pages correctly', async () => {
      // Mocking get method using vitest spies on the instance
      vi.spyOn(client, 'get')
        .mockResolvedValueOnce({
          resultSetMetadata: { count: 3, offset: 0, limit: 2 },
          results: [{ id: 1 }, { id: 2 }],
        })
        .mockResolvedValueOnce({
          resultSetMetadata: { count: 3, offset: 2, limit: 2 },
          results: [{ id: 3 }],
        });

      const results = await client.paginateAll('/test-paginated', {}, undefined, 2);

      expect(client.get).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(3);
      expect(results).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('should handle empty results gracefully', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({
        resultSetMetadata: { count: 0, offset: 0, limit: 100 },
        results: [],
      });

      const results = await client.paginateAll('/test-empty');

      expect(results).toEqual([]);
    });
  });
});
