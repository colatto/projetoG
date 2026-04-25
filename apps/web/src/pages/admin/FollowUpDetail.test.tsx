import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FollowUpDetail from './FollowUpDetail';

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

describe('FollowUpDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notifications timeline from detail payload', async () => {
    getMock.mockResolvedValue({
      data: {
        id: 'trk-123',
        purchase_order_id: 123,
        status: 'ATIVO',
        supplier_id: 77,
        order_date: '2026-04-01',
        promised_date_current: '2026-04-15',
        current_notification_number: 2,
        date_changes: [],
        notifications: [
          {
            id: 'ntf-1',
            created_at: '2026-04-10T12:00:00.000Z',
            subject: 'Notificação 2',
            recipient_email: 'supplier@example.com',
            status: 'sent',
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={['/admin/followup/123']}>
        <Routes>
          <Route path="/admin/followup/:purchaseOrderId" element={<FollowUpDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Timeline de Notificações')).toBeInTheDocument();
    expect(screen.getByText('Notificação 2')).toBeInTheDocument();
    expect(screen.getByText('supplier@example.com')).toBeInTheDocument();
  });
});
