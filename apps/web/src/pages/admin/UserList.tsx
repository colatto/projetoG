import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { User } from '../../contexts/AuthContext';
import { UserRole, UserStatus } from '@projetog/domain';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../../components/ui/Button';

/** Extended type for user list items — the /users endpoint returns more fields than the auth User type */
interface UserListItem extends User {
  created_at: string;
}

export default function UserList() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);

      const response = await api.get(`/users?${params.toString()}`);
      setUsers(response.data.data ?? []);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string }; status?: number } };
      const msg = apiErr.response?.data?.message || 'Falha ao carregar lista de usuários.';
      setError(msg);
      console.error('Erro na listagem de usuários:', msg);
    } finally {
      setIsLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers();
    });
  }, [loadUsers]);

  const renderBadge = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ATIVO:
        return <span className="badge badge-success">Ativo</span>;
      case UserStatus.PENDENTE:
        return <span className="badge badge-warning">Pendente</span>;
      case UserStatus.BLOQUEADO:
        return <span className="badge badge-error">Bloqueado</span>;
      case UserStatus.REMOVIDO:
        return <span className="badge badge-gray">Removido</span>;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 style={{ fontSize: '24px', margin: 0 }}>Usuários</h1>
          <p className="text-muted" style={{ fontSize: '14px' }}>
            Gerencie acessos internos e de fornecedores.
          </p>
        </div>
        <Link to="/admin/users/new">
          <Button variant="primary" className="gap-2">
            <Plus size={16} /> Novo Usuário
          </Button>
        </Link>
      </div>

      <div
        className="card mb-6"
        style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}
      >
        <div style={{ flex: 1 }}>
          <label className="form-label" style={{ marginBottom: 4 }}>
            Busca
          </label>
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-gray-400)' }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Buscar por nome ou e-mail..."
              style={{ paddingLeft: '2.25rem' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div style={{ width: '200px' }}>
          <label className="form-label" style={{ marginBottom: 4 }}>
            Perfil
          </label>
          <select
            className="form-input"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">Todos os perfis</option>
            {Object.values(UserRole).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 p-3 rounded"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--color-error)',
            border: '1px solid var(--color-error)',
            fontSize: '0.875rem',
          }}
        >
          ⚠ {error}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {isLoading ? (
          <div className="text-center" style={{ padding: '3rem' }}>
            Carregando...
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Criado Em</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: 'center',
                        padding: '2rem',
                        color: 'var(--color-gray-500)',
                      }}
                    >
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                      <td>{renderBadge(u.status)}</td>
                      <td>{format(new Date(u.created_at), 'dd/MM/yyyy', { locale: ptBR })}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/admin/users/${u.id}`}
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.75rem' }}
                        >
                          Gerenciar
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
