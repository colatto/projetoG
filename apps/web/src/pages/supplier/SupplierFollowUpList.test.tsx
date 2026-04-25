import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SupplierFollowUpList from './SupplierFollowUpList';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: getMock,
  },
}));

describe('SupplierFollowUpList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders required columns from supplier follow-up list', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'trk-1',
            purchase_order_id: 2001,
            status: 'ATIVO',
            order_date: '2026-04-10',
            promised_date_current: '2026-04-30',
            building_id: 9,
            current_notification_number: 2,
            purchase_orders: { local_status: 'REPOSICAO' },
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <SupplierFollowUpList />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/followup/orders');
    });

    expect(await screen.findByText('#2001')).toBeInTheDocument();
    expect(screen.getByText('Sim')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });
});
