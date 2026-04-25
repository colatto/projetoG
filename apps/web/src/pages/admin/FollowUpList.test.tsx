import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FollowUpList from './FollowUpList';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: getMock,
  },
}));

describe('FollowUpList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and renders follow-up rows', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'trk-1',
            purchase_order_id: 1001,
            supplier_id: 44,
            status: 'ATIVO',
            building_id: 12,
            promised_date_current: '2026-04-30',
            order_date: '2026-04-10',
            current_notification_number: 2,
            linked_quotation_id: 555,
            purchase_orders: { local_status: 'ATIVO', pending_quantity: 8, building_id: 12 },
            suppliers: { name: 'Fornecedor Teste' },
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <FollowUpList />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/followup/orders', {
        params: { status: undefined, supplier_id: undefined, building_id: undefined },
      });
    });

    expect(await screen.findByText('Fornecedor Teste')).toBeInTheDocument();
    expect(screen.getAllByText('ATIVO').length).toBeGreaterThan(0);
  });

  it('applies supplier and building filters in request params', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });

    render(
      <MemoryRouter>
        <FollowUpList />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Nenhum follow-up encontrado.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Fornecedor (ID)'), { target: { value: '77' } });
    await waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith('/followup/orders', {
        params: { status: undefined, supplier_id: 77, building_id: undefined },
      });
    });

    fireEvent.change(screen.getByLabelText('Obra (ID)'), { target: { value: '12' } });
    await waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith('/followup/orders', {
        params: { status: undefined, supplier_id: 77, building_id: 12 },
      });
    });
  });
});
