import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { CreditorClient } from '../../clients/creditor-client.js';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SiengeClient } from '../../client.js';
import type { SiengeCreditor } from '../../types/sienge-types.js';

describe('CreditorClient', () => {
  let mockSiengeClient: Mocked<SiengeClient>;
  let creditorClient: CreditorClient;

  beforeEach(() => {
    mockSiengeClient = {
      get: vi.fn(),
      paginateAll: vi.fn(),
    } as unknown as Mocked<SiengeClient>;

    creditorClient = new CreditorClient(mockSiengeClient);
  });

  describe('getById', () => {
    it('should call get on SiengeClient with correct URL', async () => {
      const mockCreditor = { creditorId: 10 } as SiengeCreditor;
      mockSiengeClient.get.mockResolvedValue(mockCreditor);

      const result = await creditorClient.getById(10);

      expect(mockSiengeClient.get).toHaveBeenCalledWith('/creditors/10', undefined);
      expect(result).toEqual(mockCreditor);
    });

    it('should pass context to SiengeClient', async () => {
      const context = { correlationId: '123' };
      await creditorClient.getById(10, context);

      expect(mockSiengeClient.get).toHaveBeenCalledWith('/creditors/10', context);
    });
  });

  describe('list', () => {
    it('should call paginateAll on SiengeClient with correct URL and filters', async () => {
      const mockCreditors = [{ creditorId: 1 }] as SiengeCreditor[];
      mockSiengeClient.paginateAll.mockResolvedValue(mockCreditors);

      const filters = { cnpj: '123' };
      const result = await creditorClient.list(filters);

      expect(mockSiengeClient.paginateAll).toHaveBeenCalledWith('/creditors', filters, undefined);
      expect(result).toEqual(mockCreditors);
    });
  });

  describe('listPaged', () => {
    it('should call get with pagination params', async () => {
      const mockResponse = { results: [], resultSetMetadata: { count: 0, offset: 0, limit: 100 } };
      mockSiengeClient.get.mockResolvedValue(mockResponse);

      const filters = { cnpj: '123', limit: 50, offset: 10 };
      const result = await creditorClient.listPaged(filters);

      expect(mockSiengeClient.get).toHaveBeenCalledWith('/creditors', undefined, {
        params: { cnpj: '123', limit: 50, offset: 10 },
      });
      expect(result).toEqual(mockResponse);
    });

    it('should use default pagination params if not provided', async () => {
      mockSiengeClient.get.mockResolvedValue({});

      await creditorClient.listPaged();

      expect(mockSiengeClient.get).toHaveBeenCalledWith('/creditors', undefined, {
        params: { limit: 100, offset: 0 },
      });
    });
  });

  describe('extractPrimaryEmail', () => {
    it('should return null if no contacts', () => {
      const creditor = { contacts: [] } as unknown as SiengeCreditor;
      expect(creditorClient.extractPrimaryEmail(creditor)).toBeNull();
    });

    it('should return first non-empty email', () => {
      const creditor = {
        contacts: [
          { email: '  ' },
          { email: ' test@example.com ' },
          { email: 'other@example.com' },
        ],
      } as unknown as SiengeCreditor;
      
      expect(creditorClient.extractPrimaryEmail(creditor)).toBe('test@example.com');
    });

    it('should return null if no valid email in contacts', () => {
      const creditor = {
        contacts: [
          { email: '  ' },
          { email: null as any },
        ],
      } as unknown as SiengeCreditor;
      
      expect(creditorClient.extractPrimaryEmail(creditor)).toBeNull();
    });
  });
});
