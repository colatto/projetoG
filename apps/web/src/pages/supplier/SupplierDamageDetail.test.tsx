import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SupplierDamageDetail from './SupplierDamageDetail';

const { getMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: getMock,
    patch: patchMock,
  },
}));

describe('SupplierDamageDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders supplier audit timeline from damage detail payload', async () => {
    getMock.mockResolvedValue({
      data: {
        id: 'damage-1',
        purchase_order_id: 1001,
        item_number: 4,
        status: 'em_reposicao',
        description: 'Embalagem danificada',
        suggested_action: 'reposicao',
        final_action: 'reposicao',
        damage_replacements: [],
        damage_audit_logs: [
          {
            id: 'audit-1',
            event_type: 'sugestao_enviada',
            actor_profile: 'fornecedor',
            created_at: '2026-04-28T10:00:00Z',
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={['/supplier/damages/damage-1']}>
        <Routes>
          <Route path="/supplier/damages/:damageId" element={<SupplierDamageDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Histórico de Auditoria')).toBeInTheDocument();
    expect(screen.getByText('sugestao_enviada')).toBeInTheDocument();
    expect(screen.getByText('fornecedor')).toBeInTheDocument();
    expect(screen.getByText('Em reposição')).toBeInTheDocument();
  });
});
