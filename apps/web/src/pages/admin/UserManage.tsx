import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserStatus, UserRole } from '@projetog/domain';
import { ArrowLeft, Lock, Unlock, Mail, Trash } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export default function UserManage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const loadUser = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/users/${id}`);
      setUser(res.data.data);
    } catch (e) {
      setApiError('Não foi possível encontrar o usuário.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, [id]);

  const handleAction = async (
    action: 'block' | 'reactivate' | 'reset-password' | 'delete',
    confirmMsg?: string,
  ) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;

    try {
      setIsProcessing(true);
      if (action === 'delete') {
        await api.delete(`/users/${id}`);
        navigate('/admin/users');
      } else {
        await api.post(`/users/${id}/${action}`);
        await loadUser(); // Reload data after action
        alert(
          action === 'reset-password'
            ? 'Link de redefinição enviado com sucesso!'
            : 'Ação concluída com sucesso!',
        );
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Falha ao processar a requisição.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div style={{ padding: '2rem' }}>Carregando...</div>;
  if (!user) return <div style={{ padding: '2rem', color: 'red' }}>{apiError}</div>;

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="mb-6 flex gap-4 items-center">
        <Link to="/admin/users" className="btn btn-outline" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontSize: '24px', margin: 0 }}>Gerenciar Acesso</h1>
          <p className="text-muted" style={{ fontSize: '14px' }}>
            Detalhes e controle de segurança para {user.name}.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: 1 }}>
          <h2
            style={{
              fontSize: '18px',
              marginBottom: '1rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '0.5rem',
            }}
          >
            Perfil
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, auto) 1fr',
              gap: '1rem',
              fontSize: '14px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-gray-600)' }}>Nome</div>
            <div>{user.name}</div>

            <div style={{ fontWeight: 600, color: 'var(--color-gray-600)' }}>E-mail</div>
            <div>{user.email}</div>

            {user.original_email && (
              <>
                <div style={{ fontWeight: 600, color: 'var(--color-gray-600)' }}>
                  E-mail Original
                </div>
                <div style={{ color: 'var(--color-warning)' }}>
                  {user.original_email} (Alterado)
                </div>
              </>
            )}

            <div style={{ fontWeight: 600, color: 'var(--color-gray-600)' }}>Perfil</div>
            <div style={{ textTransform: 'capitalize' }}>{user.role}</div>

            {user.role === UserRole.FORNECEDOR && (
              <>
                <div style={{ fontWeight: 600, color: 'var(--color-gray-600)' }}>Supplier ID</div>
                <div>{user.supplier_id || 'Não Vinculado'}</div>
              </>
            )}

            <div style={{ fontWeight: 600, color: 'var(--color-gray-600)' }}>Criado em</div>
            <div>
              {format(new Date(user.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>

            <div style={{ fontWeight: 600, color: 'var(--color-gray-600)' }}>Status Atual</div>
            <div>
              <span
                className={`badge badge-${
                  user.status === UserStatus.ATIVO
                    ? 'success'
                    : user.status === UserStatus.PENDENTE
                      ? 'warning'
                      : user.status === UserStatus.BLOQUEADO
                        ? 'error'
                        : 'gray'
                }`}
              >
                {user.status}
              </span>
            </div>

            {user.status === UserStatus.BLOQUEADO && user.blocked_at && (
              <>
                <div style={{ fontWeight: 600, color: 'var(--color-error)' }}>Bloqueado em</div>
                <div style={{ color: 'var(--color-error)' }}>
                  {format(new Date(user.blocked_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </>
            )}
          </div>
        </div>

        <div
          className="card"
          style={{ width: 300, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          <h2 style={{ fontSize: '18px', marginBottom: '0.5rem' }}>Ações</h2>

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => handleAction('reset-password')}
            disabled={isProcessing || user.status === UserStatus.REMOVIDO}
          >
            <Mail size={16} /> Enviar Redefinição de Senha
          </Button>

          {user.status === UserStatus.BLOQUEADO ? (
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
              onClick={() => handleAction('reactivate')}
              disabled={isProcessing}
            >
              <Unlock size={16} /> Reativar Acesso
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
              onClick={() =>
                handleAction(
                  'block',
                  'Tem certeza que deseja bloquear este usuário? Ele perderá aceso imediatamente.',
                )
              }
              disabled={isProcessing || user.status === UserStatus.REMOVIDO}
            >
              <Lock size={16} /> Bloquear Acesso
            </Button>
          )}

          <hr style={{ margin: '0.5rem 0', borderColor: 'var(--border-color)', borderTop: 0 }} />

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            style={{
              color: 'var(--color-error)',
              border: 'none',
              background: 'rgba(239, 68, 68, 0.1)',
            }}
            onClick={() =>
              handleAction('delete', 'CUIDADO: Remoção não revogável do acesso. Confirmar?')
            }
            disabled={isProcessing || user.status === UserStatus.REMOVIDO}
          >
            <Trash size={16} /> Remover Definitivamente
          </Button>
        </div>
      </div>
    </div>
  );
}
