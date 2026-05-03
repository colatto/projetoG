import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AuditTrail from './AuditTrail';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('../../lib/api', () => ({
  api: { get: getMock },
}));

describe('AuditTrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads audit events on mount', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: '00000000-0000-0000-0000-000000000099',
            event_type: 'quotation.sent',
            event_timestamp: '2026-05-01T12:00:00.000Z',
            actor_id: null,
            actor_type: 'user',
            purchase_quotation_id: 1,
            purchase_order_id: null,
            supplier_id: null,
            summary: 'Teste',
            metadata: {},
          },
        ],
        pagination: { total: 1, page: 1, limit: 50 },
      },
    });

    render(<AuditTrail />);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/backoffice/audit', { params: { page: 1, limit: 50 } });
    });

    expect(await screen.findByText('quotation.sent')).toBeInTheDocument();
    expect(screen.getByText('Teste')).toBeInTheDocument();
  });
});
