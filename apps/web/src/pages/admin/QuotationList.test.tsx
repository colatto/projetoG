import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole } from '@projetog/domain';
import QuotationList from './QuotationList';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: getMock,
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: UserRole.ADMINISTRADOR } }),
}));

describe('QuotationList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prioritizes FORNECEDOR_INVALIDO_MAPA in status badge when mixed with integrada', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 42,
            quotation_date: '2026-04-01',
            end_at: null,
            end_date: '2026-04-20',
            supplier_negotiations: [
              {
                supplier_id: 1,
                status: 'INTEGRADA_SIENGE',
                read_at: '2026-04-02T10:00:00Z',
                latest_response_id: 'r1',
                closed_order_id: null,
                suppliers: { name: 'Alpha' },
              },
              {
                supplier_id: 2,
                status: 'FORNECEDOR_INVALIDO_MAPA',
                read_at: null,
                latest_response_id: null,
                closed_order_id: null,
                suppliers: { name: 'Beta' },
              },
            ],
          },
        ],
        pagination: { total: 1 },
      },
    });

    render(
      <MemoryRouter>
        <QuotationList />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/quotations', {
        params: { page: 1, limit: 20 },
      });
    });

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Forn. inválido')).toBeInTheDocument();
    expect(within(table).queryByText('Integrada')).not.toBeInTheDocument();
  });

  it('shows truncated supplier summary and count', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 7,
            quotation_date: '2026-04-01',
            end_date: '2026-04-10',
            supplier_negotiations: [
              {
                supplier_id: 10,
                status: 'AGUARDANDO_RESPOSTA',
                read_at: null,
                latest_response_id: null,
                closed_order_id: null,
                suppliers: { name: 'Acme Ltda' },
              },
              {
                supplier_id: 11,
                status: 'AGUARDANDO_RESPOSTA',
                read_at: null,
                latest_response_id: null,
                closed_order_id: null,
                suppliers: { name: 'Beta SA' },
              },
            ],
          },
        ],
        pagination: { total: 1 },
      },
    });

    render(
      <MemoryRouter>
        <QuotationList />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Acme Ltda/)).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
    const cell = screen.getByTitle('Acme Ltda, Beta SA');
    expect(cell).toBeInTheDocument();
  });

  it('shows Fechado chip when supplier closed', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 99,
            quotation_date: '2026-04-01',
            end_date: '2026-04-10',
            supplier_negotiations: [
              {
                supplier_id: 5,
                status: 'FORNECEDOR_FECHADO',
                read_at: '2026-04-02T10:00:00Z',
                latest_response_id: 'x',
                closed_order_id: 5001,
                suppliers: { name: 'Gamma' },
              },
            ],
          },
        ],
        pagination: { total: 1 },
      },
    });

    render(
      <MemoryRouter>
        <QuotationList />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Fechado')).toBeInTheDocument();
    expect(screen.getByText('#5001')).toBeInTheDocument();
  });

  it('requests status filter when selected', async () => {
    getMock.mockResolvedValue({
      data: { data: [], pagination: { total: 0 } },
    });

    render(
      <MemoryRouter>
        <QuotationList />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Status');
    fireEvent.change(select, { target: { value: 'FORNECEDOR_INVALIDO_MAPA' } });

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/quotations', {
        params: { page: 1, limit: 20, status: 'FORNECEDOR_INVALIDO_MAPA' },
      });
    });
  });

  it('sends require_action when Exigem ação is checked', async () => {
    getMock.mockResolvedValue({
      data: { data: [], pagination: { total: 0 } },
    });

    render(
      <MemoryRouter>
        <QuotationList />
      </MemoryRouter>,
    );

    const cb = await screen.findByRole('checkbox', { name: /Exigem ação/i });
    fireEvent.click(cb);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/quotations', {
        params: { page: 1, limit: 20, require_action: true },
      });
    });
  });
});
