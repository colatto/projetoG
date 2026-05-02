import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UserRole, UserStatus } from '@projetog/domain';
import AdminLayout from './AdminLayout';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Pedidos but not Follow-up, Avarias or Dashboard for VISUALIZADOR_PEDIDOS', () => {
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
      <MemoryRouter initialEntries={['/admin/orders']}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin/orders" element={<span>orders-page</span>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Pedidos' })).toHaveAttribute('href', '/admin/orders');
    expect(screen.queryByRole('link', { name: 'Follow-up' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Avarias' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
});
