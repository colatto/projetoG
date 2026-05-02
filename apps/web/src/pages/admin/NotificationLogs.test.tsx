import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationLogs from './NotificationLogs';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: getMock,
  },
}));

function defaultResponse() {
  return {
    data: {
      data: [],
      pagination: { total: 0, page: 1, per_page: 20 },
    },
  };
}

describe('NotificationLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue(defaultResponse());
  });

  it('renders the filter bar with all six filters', async () => {
    render(<NotificationLogs />);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Data inicial')).toBeInTheDocument();
    expect(screen.getByText('Data final')).toBeInTheDocument();
    expect(screen.getByText('Cotação ID')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor ID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar filtros' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeInTheDocument();
  });

  it('initial load fetches without filters (only page and limit)', async () => {
    render(<NotificationLogs />);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/notifications/logs', {
        params: { page: 1, limit: 20 },
      });
    });
  });

  it('applies filters and resets to page 1 on Aplicar filtros', async () => {
    render(<NotificationLogs />);

    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'new_quotation' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'sent' } });
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-04-30' } });
    fireEvent.change(screen.getByLabelText('Cotação ID'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Fornecedor ID'), { target: { value: '77' } });

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith('/notifications/logs', {
        params: {
          page: 1,
          limit: 20,
          type: 'new_quotation',
          status: 'sent',
          start_date: '2026-04-01',
          end_date: '2026-04-30',
          quotation_id: 123,
          supplier_id: 77,
        },
      });
    });
  });

  it('clears filters and reloads logs without filter params', async () => {
    render(<NotificationLogs />);
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'new_quotation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith('/notifications/logs', {
        params: { page: 1, limit: 20, type: 'new_quotation' },
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));

    await waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith('/notifications/logs', {
        params: { page: 1, limit: 20 },
      });
    });

    expect((screen.getByLabelText('Tipo') as HTMLSelectElement).value).toBe('');
  });

  it('renders log rows when API returns data and translates type/status labels', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'log-1',
            type: 'new_quotation',
            status: 'sent',
            quotation_id: 555,
            subject: 'Sua cotação chegou',
            recipient_email: 'forn@example.com',
            created_at: '2026-04-15T10:00:00.000Z',
            sent_at: '2026-04-15T10:00:01.000Z',
          },
        ],
        pagination: { total: 1, page: 1, per_page: 20 },
      },
    });

    render(<NotificationLogs />);

    expect(await screen.findByText('Sua cotação chegou')).toBeInTheDocument();
    // "Nova cotação" e "Enviado" aparecem tanto no <select> de filtros quanto no badge da linha
    expect(screen.getAllByText('Nova cotação').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Enviado').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('forn@example.com')).toBeInTheDocument();
    expect(screen.getByText('Total de 1 registros')).toBeInTheDocument();
  });
});
