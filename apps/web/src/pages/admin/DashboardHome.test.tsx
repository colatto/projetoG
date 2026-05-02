import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardHome from './DashboardHome';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: getMock,
  },
}));

describe('DashboardHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({
      data: {
        cotacoes_abertas: 3,
        cotacoes_aguardando_revisao: 2,
        pedidos_atrasados: 18,
        pedidos_em_avaria: 4,
        falhas_integracao: 7,
        data_snapshot: '2026-05-02',
      },
    });
  });

  it('loads resumo and renders five quick-summary cards with values', async () => {
    render(
      <MemoryRouter>
        <DashboardHome />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/dashboard/resumo');
    });

    expect(screen.getByText('Cotações abertas')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Aguardando revisão')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Pedidos atrasados')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('Pedidos em avaria')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Falhas de integração')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});
