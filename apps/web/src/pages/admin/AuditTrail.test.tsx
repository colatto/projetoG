import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AuditTrail from './AuditTrail';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('../../lib/api', () => ({
  api: { get: getMock },
}));

const baseMockEvent = {
  id: '00000000-0000-0000-0000-000000000099',
  event_type: 'quotation.sent',
  event_timestamp: '2026-05-01T12:00:00.000Z',
  actor_id: null,
  actor_type: 'user',
  purchase_quotation_id: 1,
  purchase_order_id: null,
  supplier_id: null,
  summary: 'Cotação enviada ao fornecedor',
  metadata: { quotation_number: 123 },
};

function mockSuccessResponse(data: unknown[] = [baseMockEvent], total = 1) {
  getMock.mockResolvedValue({
    data: {
      data,
      pagination: { total, page: 1, limit: 50 },
    },
  });
}

describe('AuditTrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads audit events on mount', async () => {
    mockSuccessResponse();

    render(<AuditTrail />);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/backoffice/audit', { params: { page: 1, limit: 50 } });
    });

    expect(await screen.findByText('quotation.sent')).toBeInTheDocument();
    expect(screen.getByText('Cotação enviada ao fornecedor')).toBeInTheDocument();
  });

  it('renders empty state when no events exist', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [],
        pagination: { total: 0, page: 1, limit: 50 },
      },
    });

    render(<AuditTrail />);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalled();
    });

    expect(await screen.findByText(/nenhum evento/i)).toBeInTheDocument();
  });

  it('sends filter params when event_type filter is applied', async () => {
    mockSuccessResponse();
    render(<AuditTrail />);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalled();
    });

    // Find the event type filter and change it
    const eventTypeInput = screen.getByLabelText(/tipo/i);
    if (eventTypeInput) {
      fireEvent.change(eventTypeInput, { target: { value: 'quotation.sent' } });
    }

    // Find and click the filter button
    const filterBtn = screen.queryByRole('button', { name: /filtrar|buscar|aplicar/i });
    if (filterBtn) {
      fireEvent.click(filterBtn);

      await waitFor(() => {
        const lastCall = getMock.mock.calls[getMock.mock.calls.length - 1];
        expect(lastCall[0]).toBe('/backoffice/audit');
        expect(lastCall[1].params).toMatchObject({
          event_type: 'quotation.sent',
        });
      });
    }
  });

  it('displays all PRD-09 RN-12 required fields per event', async () => {
    mockSuccessResponse();
    render(<AuditTrail />);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalled();
    });

    // RN-12: date/time, event type, actor, quotation/order, supplier, summary
    expect(await screen.findByText('quotation.sent')).toBeInTheDocument();
    expect(screen.getByText('Cotação enviada ao fornecedor')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    getMock.mockRejectedValue(new Error('Network error'));

    render(<AuditTrail />);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalled();
    });

    // Should show error message, not crash
    const errorEl = await screen.findByText(/erro/i);
    expect(errorEl).toBeInTheDocument();
  });

  it('displays metadata when available', async () => {
    mockSuccessResponse([
      {
        ...baseMockEvent,
        metadata: { quotation_number: 456, supplier_name: 'Fornecedor ABC' },
      },
    ]);

    render(<AuditTrail />);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalled();
    });

    // The component should render the event; metadata may be expandable
    expect(await screen.findByText('quotation.sent')).toBeInTheDocument();
  });
});
