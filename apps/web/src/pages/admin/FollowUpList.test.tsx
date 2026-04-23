import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
            promised_date_current: '2026-04-30',
            order_date: '2026-04-10',
            current_notification_number: 2,
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
      expect(getMock).toHaveBeenCalledWith('/followup/orders', { params: { status: undefined } });
    });

    expect(await screen.findByText('Fornecedor Teste')).toBeInTheDocument();
    expect(screen.getAllByText('ATIVO').length).toBeGreaterThan(0);
  });
});
