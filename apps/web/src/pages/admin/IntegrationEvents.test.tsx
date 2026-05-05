import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IntegrationEvents from './IntegrationEvents';
import { UserRole, UserStatus } from '@projetog/domain';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

const mockUseAuth = vi.fn(() => ({
  user: {
    id: 'u1',
    email: 'compras@test.com',
    name: 'Compras',
    role: UserRole.COMPRAS,
    status: UserStatus.ATIVO,
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockUseAuth(),
}));

function eventsListResponse() {
  return {
    data: {
      data: [
        {
          id: 'evt-1',
          event_type: 'webhook_received',
          status: 'success',
          direction: 'inbound',
          endpoint: '/webhooks/sienge',
          created_at: new Date().toISOString(),
          related_entity_id: null,
          retry_count: 0,
          max_retries: 0,
          next_retry_at: null,
        },
      ],
      pagination: { total: 45, page: 1, limit: 20 },
    },
  };
}

describe('IntegrationEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    postMock.mockResolvedValue({ data: { message: 'ok' } });
    mockUseAuth.mockImplementation(() => ({
      user: {
        id: 'u1',
        email: 'compras@test.com',
        name: 'Compras',
        role: UserRole.COMPRAS,
        status: UserStatus.ATIVO,
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    }));
  });

  function renderScreen() {
    return render(<IntegrationEvents />);
  }

  it('renders filter bar with status, event type, direction and date inputs', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/auth/me') {
        return Promise.resolve({
          data: {
            data: {
              id: 'u1',
              email: 'x@test.com',
              name: 'Test',
              role: UserRole.COMPRAS,
              status: UserStatus.ATIVO,
            },
          },
        });
      }
      if (url === '/integration/events') {
        return Promise.resolve(eventsListResponse());
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    renderScreen();

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/integration/events', {
        params: { page: 1, limit: 20 },
      });
    });

    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de evento')).toBeInTheDocument();
    expect(screen.getByLabelText('Direção')).toBeInTheDocument();
    expect(screen.getByLabelText('Data inicial')).toBeInTheDocument();
    expect(screen.getByLabelText('Data final')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar filtros' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tentativas' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Próximo retry' })).toBeInTheDocument();
  });

  it('applies filters and resets to page 1', async () => {
    let integrationCalls = 0;
    getMock.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/auth/me') {
        return Promise.resolve({
          data: {
            data: {
              id: 'u1',
              email: 'x@test.com',
              name: 'Test',
              role: UserRole.COMPRAS,
              status: UserStatus.ATIVO,
            },
          },
        });
      }
      if (url === '/integration/events') {
        integrationCalls += 1;
        if (integrationCalls === 1) {
          return Promise.resolve(eventsListResponse());
        }
        expect(config?.params?.page).toBe(1);
        expect(config?.params?.status).toBe('failure');
        expect(config?.params?.event_type).toBe('sync_orders');
        expect(config?.params?.direction).toBe('outbound');
        expect(typeof config?.params?.date_from).toBe('string');
        expect(typeof config?.params?.date_to).toBe('string');
        return Promise.resolve(eventsListResponse());
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    renderScreen();

    await waitFor(() => expect(integrationCalls).toBeGreaterThanOrEqual(1));

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failure' } });
    fireEvent.change(screen.getByLabelText('Tipo de evento'), { target: { value: 'sync_orders' } });
    fireEvent.change(screen.getByLabelText('Direção'), { target: { value: 'outbound' } });
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-04-30' } });

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => expect(integrationCalls).toBeGreaterThanOrEqual(2));
  });

  it('clear filters loads without query filters', async () => {
    let integrationCalls = 0;
    getMock.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/auth/me') {
        return Promise.resolve({
          data: {
            data: {
              id: 'u1',
              email: 'x@test.com',
              name: 'Test',
              role: UserRole.COMPRAS,
              status: UserStatus.ATIVO,
            },
          },
        });
      }
      if (url === '/integration/events') {
        integrationCalls += 1;
        if (integrationCalls <= 2) {
          expect(config?.params).toEqual({ page: 1, limit: 20 });
        }
        return Promise.resolve(eventsListResponse());
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    renderScreen();

    await waitFor(() => expect(integrationCalls).toBe(1));

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failure' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() => expect(integrationCalls).toBeGreaterThanOrEqual(2));

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));

    await waitFor(() => expect(integrationCalls).toBeGreaterThanOrEqual(3));
  });

  it('pagination Próxima requests page 2', async () => {
    let lastPage = 0;
    getMock.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
      if (url === '/auth/me') {
        return Promise.resolve({
          data: {
            data: {
              id: 'u1',
              email: 'x@test.com',
              name: 'Test',
              role: UserRole.COMPRAS,
              status: UserStatus.ATIVO,
            },
          },
        });
      }
      if (url === '/integration/events') {
        lastPage = Number(config?.params?.page ?? 0);
        return Promise.resolve({
          data: {
            data: [],
            pagination: { total: 45, page: lastPage, limit: 20 },
          },
        });
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    renderScreen();

    await waitFor(() => expect(lastPage).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() => expect(lastPage).toBe(2));
  });

  it('shows Reprocessar for failure when user is Compras and posts retry', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/auth/me') {
        return Promise.resolve({
          data: {
            data: {
              id: 'u1',
              email: 'x@test.com',
              name: 'Test',
              role: UserRole.COMPRAS,
              status: UserStatus.ATIVO,
            },
          },
        });
      }
      if (url === '/integration/events') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'fail-id',
                event_type: 'webhook_failed',
                status: 'failure',
                direction: 'inbound',
                endpoint: '/webhooks/sienge',
                created_at: new Date().toISOString(),
                error_message: 'boom',
                retry_count: 1,
                max_retries: 3,
                next_retry_at: null,
              },
            ],
            pagination: { total: 1, page: 1, limit: 20 },
          },
        });
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reprocessar' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reprocessar' }));

    expect(screen.getByText(/Tem certeza que deseja reprocessar este evento/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/integration/events/fail-id/retry');
    });

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/integration/events', {
        params: { page: 1, limit: 20 },
      });
    });
  });

  it('does not show Reprocessar for Administrador', async () => {
    mockUseAuth.mockImplementation(() => ({
      user: {
        id: 'adm',
        email: 'adm@test.com',
        name: 'Admin',
        role: UserRole.ADMINISTRADOR,
        status: UserStatus.ATIVO,
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    }));

    getMock.mockImplementation((url: string) => {
      if (url === '/auth/me') {
        return Promise.resolve({
          data: {
            data: {
              id: 'u1',
              email: 'adm@test.com',
              name: 'Admin',
              role: UserRole.ADMINISTRADOR,
              status: UserStatus.ATIVO,
            },
          },
        });
      }
      if (url === '/integration/events') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'fail-id',
                event_type: 'webhook_failed',
                status: 'failure',
                direction: 'inbound',
                endpoint: '/webhooks/sienge',
                created_at: new Date().toISOString(),
                error_message: 'boom',
                retry_count: 1,
                max_retries: 3,
              },
            ],
            pagination: { total: 1, page: 1, limit: 20 },
          },
        });
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    render(<IntegrationEvents />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Reprocessar' })).not.toBeInTheDocument();
    });
  });
});
