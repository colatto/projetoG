import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, ResetPasswordDto } from '@projetog/shared';
import { api } from '../../lib/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase Magic Link sends token usually in the hash for PKCE or inside query strings depending on auth.admin link payload.
    // Let's assume it routes here as ?token=XYZ or #access_token=XYZ
    const queryParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.replace('#', '?'));

    const extractedToken = queryParams.get('token') || hashParams.get('access_token') || '';
    setToken(extractedToken);
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
      // Inclui o token se ele nao veio no hook form (para o caso de recuperacao linkada)
      const payload = { ...data, token: token || data.token };

      await api.post('/auth/reset-password', payload);
      navigate('/login', {
        state: { message: 'Senha registrada com sucesso. Você já pode fazer login.' },
      });
    } catch (error: any) {
      setApiError(
        error.response?.data?.message ||
          'Link inválido ou expirado. Solicite um novo na tela de login.',
      );
    }
  };

  return (
    <div
      className="flex justify-center items-center h-screen w-full"
      style={{ background: 'var(--color-gray-50)' }}
    >
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-6">
          <h2>Nova Senha</h2>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            A senha deve conter no mínimo 8 caracteres.
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

        {/* If token couldn't be extracted, we let the user manually input it just in case */}
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
            label="Digite a nova senha"
            type="password"
            placeholder="Mínimo 8 caracteres"
            {...register('new_password')}
            error={errors.new_password?.message}
          />

          <Button type="submit" className="w-full mt-4" isLoading={isSubmitting}>
            Salvar e Acessar
          </Button>
        </form>
      </div>
    </div>
  );
}
