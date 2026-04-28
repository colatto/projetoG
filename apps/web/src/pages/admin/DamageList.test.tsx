import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DamageList from './DamageList';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: getMock,
  },
}));

describe('DamageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends building_id filter and renders status badge', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'damage-1',
            purchase_order_id: 1001,
            item_number: 2,
            supplier_id: 77,
            building_id: 55,
            status: 'em_reposicao',
            created_at: '2026-04-28T10:00:00Z',
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <DamageList />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Em reposição')).toBeInTheDocument();
    expect(screen.getByText('#55')).toBeInTheDocument();

    const numericInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(numericInputs[2], { target: { value: '12' } });

    await waitFor(() => {
      expect(getMock).toHaveBeenLastCalledWith('/damages', {
        params: {
          status: undefined,
          supplier_id: undefined,
          purchase_order_id: undefined,
          building_id: 12,
        },
      });
    });
  });
});
