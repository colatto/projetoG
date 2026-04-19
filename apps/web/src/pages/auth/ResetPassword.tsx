import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, ResetPasswordDto } from '@projetog/shared';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import logoGrf from '../../assets/GRFlogo.png';

type FlowType = 'first-access' | 'recovery';

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [apiError, setApiError] = useState<string | null>(null);

  // Detect flow context: Supabase invite links contain type=invite,
  // recovery links contain type=recovery. We also check hash params
  // as Supabase may send tokens via URL fragment.
  const flowType = useMemo<FlowType>(() => {
    const queryParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.replace('#', '?'));

    const typeParam = queryParams.get('type') || hashParams.get('type') || '';
    return typeParam === 'invite' || typeParam === 'signup' ? 'first-access' : 'recovery';
  }, [location]);

  const isFirstAccess = flowType === 'first-access';

  // Derive token from URL params — avoids setState inside useEffect
  const token = useMemo(() => {
    const queryParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.replace('#', '?'));
    return queryParams.get('token') || hashParams.get('access_token') || '';
  }, [location]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordDto>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordDto) => {
    try {
      setApiError(null);
      const payload = { ...data, token: token || data.token };

      await api.post('/auth/reset-password', payload);
      navigate('/login', {
        state: {
          message: isFirstAccess
            ? 'Senha definida com sucesso. Você já pode fazer login.'
            : 'Senha redefinida com sucesso. Você já pode fazer login.',
        },
      });
    } catch (error: unknown) {
      setApiError(
        getApiErrorMessage(error, 'Link inválido ou expirado. Solicite um novo na tela de login.'),
      );
    }
  };

  return (
    <div
      className="flex justify-center items-center h-screen w-full"
      style={{ background: 'var(--color-gray-50)' }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '2.5rem 2rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
        }}
      >
        <div className="text-center mb-6">
          <img
            src={logoGrf}
            alt="GRF Incorporadora"
            style={{
              height: '65px',
              margin: '0 auto',
              marginBottom: '1.5rem',
              display: 'block',
            }}
          />
          <h2
            style={{
              color: 'var(--color-primary)',
              fontSize: '1.25rem',
              marginBottom: '0.25rem',
            }}
          >
            {isFirstAccess ? 'Definir Senha' : 'Nova Senha'}
          </h2>
          <p className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 500 }}>
            {isFirstAccess
              ? 'Bem-vindo ao Portal GRF! Defina sua senha de acesso.'
              : 'A senha deve conter no mínimo 8 caracteres.'}
          </p>
        </div>

        {apiError && (
          <div
            className="mb-4 p-3 rounded"
            style={{
              backgroundColor: 'var(--color-error)',
              color: 'white',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          >
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          {!token && (
            <Input
              label="Token de Segurança"
              type="text"
              placeholder="Cole seu código ou token aqui"
              {...register('token')}
              error={errors.token?.message}
            />
          )}

          <Input
            label={isFirstAccess ? 'Defina sua senha' : 'Digite a nova senha'}
            type="password"
            placeholder="Mínimo 8 caracteres"
            {...register('new_password')}
            error={errors.new_password?.message}
          />

          <Button type="submit" className="w-full mt-4" isLoading={isSubmitting}>
            {isFirstAccess ? 'Definir Senha e Acessar' : 'Salvar e Acessar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
