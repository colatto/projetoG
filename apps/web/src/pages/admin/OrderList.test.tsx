import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserRole, UserStatus } from '@projetog/domain';
import OrderList from './OrderList';

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

describe('OrderList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ data: [] });
  });

  it('shows read-only copy for VISUALIZADOR_PEDIDOS and hides Exigem ação', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: '1',
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
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Consulta de Pedidos' })).toBeInTheDocument();
    expect(screen.getByText(/Somente leitura/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Exigem ação/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/orders', {
        params: { sort_priority: true },
      });
    });
  });

  it('shows Exigem ação for COMPRAS and sends require_action when checked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: '2',
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
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/orders', {
        params: { sort_priority: true },
      });
    });

    const cb = screen.getByRole('checkbox', { name: /Exigem ação/i });
    fireEvent.click(cb);

    await waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith('/orders', {
        params: { sort_priority: true, require_action: true },
      });
    });
  });

  it('renders PRD-09 §14.1 mandatory columns (cotação, obra, data prometida)', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: '3',
        email: 'a@test.com',
        name: 'Admin',
        role: UserRole.ADMINISTRADOR,
        status: UserStatus.ATIVO,
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    getMock.mockResolvedValue({
      data: [
        {
          id: 1,
          sienge_purchase_order_id: 5001,
          supplier_id: 10,
          local_status: 'PENDENTE',
          created_at: '2026-05-01T10:00:00Z',
          last_delivery_date: null,
          total_quantity_ordered: '100.00',
          total_quantity_delivered: '25.00',
          pending_quantity: '75.00',
          has_divergence: false,
          suppliers: { name: 'Fornecedor Teste' },
          building_name: 'Obra Alpha',
          promised_date_current: '2026-06-15T00:00:00Z',
          purchase_quotation_id: 42,
        },
      ],
    });

    render(
      <MemoryRouter>
        <OrderList />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMock).toHaveBeenCalled();
    });

    // PRD-09 §14.1 — new mandatory columns
    expect(await screen.findByText('#42')).toBeInTheDocument(); // Cotação vinculada
    expect(screen.getByText('Obra Alpha')).toBeInTheDocument(); // Obra
    // Column headers
    expect(screen.getByText('Cotação')).toBeInTheDocument();
    expect(screen.getByText('Obra')).toBeInTheDocument();
    expect(screen.getByText('Data Prometida')).toBeInTheDocument();
  });
});
