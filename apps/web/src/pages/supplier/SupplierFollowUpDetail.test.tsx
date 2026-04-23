import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SupplierFollowUpDetail from './SupplierFollowUpDetail';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: getMock,
    post: postMock,
  },
}));

describe('SupplierFollowUpDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends confirm request and reloads detail', async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          purchase_order_id: 123,
          status: 'ATIVO',
          order_date: '2026-04-01',
          promised_date_current: '2026-04-15',
          suggested_date_status: null,
        },
      })
      .mockResolvedValueOnce({
        data: {
          purchase_order_id: 123,
          status: 'CONCLUIDO',
          order_date: '2026-04-01',
          promised_date_current: '2026-04-15',
          suggested_date_status: null,
        },
      });

    postMock.mockResolvedValue({ data: { status: 'confirmed' } });

    render(
      <MemoryRouter initialEntries={['/supplier/followup/123']}>
        <Routes>
          <Route path="/supplier/followup/:purchaseOrderId" element={<SupplierFollowUpDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Follow-up do Pedido #123')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Confirmarei entrega no prazo'));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/followup/orders/123/confirm');
    });
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(2);
    });
  });
});
