import { describe, it, expect } from 'vitest';
import {
  mapCreditorToSupplier,
  mapCreditorContacts,
  extractCreditorEmail,
} from '../../mappers/creditor-mapper.js';
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SiengeCreditor } from '../../types/sienge-types.js';

describe('Creditor Mapper', () => {
  describe('mapCreditorToSupplier', () => {
    it('should map creditor to local supplier correctly', () => {
      const creditor: SiengeCreditor = {
        creditorId: 100,
        creditorName: 'Supplier A',
        tradeName: 'Supplier A LTDA',
        cpf: null,
        cnpj: '12345678901234',
        contacts: [],
      };

      const result = mapCreditorToSupplier(creditor, 500);

      expect(result).toEqual({
        id: 500,
        creditorId: 100,
        name: 'Supplier A',
        tradeName: 'Supplier A LTDA',
        accessStatus: null,
      });
    });

    it('should handle null tradeName', () => {
      const creditor = {
        creditorId: 100,
        creditorName: 'Supplier A',
      } as SiengeCreditor;

      const result = mapCreditorToSupplier(creditor, 500);

      expect(result.tradeName).toBeNull();
    });
  });

  describe('mapCreditorContacts', () => {
    it('should return empty array if contacts is undefined or empty', () => {
      expect(
        mapCreditorContacts({ creditorId: 1, creditorName: 'A' } as unknown as SiengeCreditor, 1),
      ).toEqual([]);
      expect(
        mapCreditorContacts(
          { creditorId: 1, creditorName: 'A', contacts: [] } as unknown as SiengeCreditor,
          1,
        ),
      ).toEqual([]);
    });

    it('should map valid contacts and set first valid as primary', () => {
      const creditor = {
        creditorId: 1,
        creditorName: 'Supplier A',
        contacts: [
          { name: 'Contact 1', email: '  ' }, // empty email
          { name: 'Contact 2', email: ' contact2@example.com ' }, // valid
          { name: 'Contact 3', email: 'contact3@example.com' }, // valid
        ],
      } as unknown as SiengeCreditor;

      const result = mapCreditorContacts(creditor, 500);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        supplierId: 500,
        name: 'Contact 2',
        email: 'contact2@example.com',
        isPrimary: true,
      });
      expect(result[1]).toEqual({
        supplierId: 500,
        name: 'Contact 3',
        email: 'contact3@example.com',
        isPrimary: false,
      });
    });

    it('should fallback to creditorName if contact name is missing', () => {
      const creditor = {
        creditorId: 1,
        creditorName: 'Supplier A',
        contacts: [{ name: '', email: 'contact@example.com' }],
      } as unknown as SiengeCreditor;

      const result = mapCreditorContacts(creditor, 500);

      expect(result[0].name).toBe('Supplier A');
    });
  });

  describe('extractCreditorEmail', () => {
    it('should return the first valid email', () => {
      const creditor = {
        creditorId: 1,
        creditorName: 'A',
        contacts: [
          { name: 'C1', email: '  ' },
          { name: 'C2', email: 'c2@example.com' },
        ],
      } as unknown as SiengeCreditor;

      const result = extractCreditorEmail(creditor);

      expect(result.email).toBe('c2@example.com');
      expect(result.hasValidEmail).toBe(true);
      expect(result.allContacts).toHaveLength(2);
    });

    it('should return null and hasValidEmail false if no valid email exists', () => {
      const creditor = {
        creditorId: 1,
        creditorName: 'A',
        contacts: [
          { name: 'C1', email: '  ' },
          { name: 'C2', email: null as any },
        ],
      } as unknown as SiengeCreditor;

      const result = extractCreditorEmail(creditor);

      expect(result.email).toBeNull();
      expect(result.hasValidEmail).toBe(false);
    });

    it('should handle missing contacts gracefully', () => {
      const creditor = { creditorId: 1, creditorName: 'A' } as unknown as SiengeCreditor;

      const result = extractCreditorEmail(creditor);

      expect(result.email).toBeNull();
      expect(result.hasValidEmail).toBe(false);
      expect(result.allContacts).toEqual([]);
    });
  });
});
