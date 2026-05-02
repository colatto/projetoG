import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UserRole, UserStatus } from '@projetog/domain';
import OrderDetail from './OrderDetail';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: getMock,
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';

const orderRow = {
  id: 1,
  sienge_purchase_order_id: 9001,
  supplier_id: 77,
  local_status: 'PARCIALMENTE_ENTREGUE',
  created_at: '2026-04-01T12:00:00Z',
  last_delivery_date: '2026-04-10',
  total_quantity_ordered: '100',
  total_quantity_delivered: '40',
  pending_quantity: '60',
  has_divergence: false,
  suppliers: { name: 'Fornecedor X' },
};

const pendingDelivery = {
  id: 501,
  invoice_sequential_number: 123,
  delivery_date: '2026-04-09',
  delivered_quantity: '40',
  validation_status: 'AGUARDANDO_VALIDACAO',
  validation_notes: null,
  validated_at: null,
};

describe('OrderDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation((url: string) => {
      if (url === '/orders') {
        return Promise.resolve({ data: [orderRow] });
      }
      if (url === '/orders/1/deliveries') {
        return Promise.resolve({ data: [pendingDelivery] });
      }
      if (url === '/orders/1/status-history') {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  });

  it('does not show Revisar for VISUALIZADOR_PEDIDOS when delivery awaits validation', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'u1',
        email: 'v@test.com',
        name: 'Viewer',
        role: UserRole.VISUALIZADOR_PEDIDOS,
        status: UserStatus.ATIVO,
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/orders/1']}>
        <Routes>
          <Route path="/admin/orders/:purchaseOrderId" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Pedido #9001/)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Revisar' })).not.toBeInTheDocument();
  });

  it('shows Revisar for COMPRAS when delivery awaits validation', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'u2',
        email: 'c@test.com',
        name: 'Compras',
        role: UserRole.COMPRAS,
        status: UserStatus.ATIVO,
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/orders/1']}>
        <Routes>
          <Route path="/admin/orders/:purchaseOrderId" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Revisar' })).toBeInTheDocument();
  });
});
