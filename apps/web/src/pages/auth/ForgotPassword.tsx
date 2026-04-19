import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, ForgotPasswordDto } from '@projetog/shared';
import { api } from '../../lib/api';
import { Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordDto>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordDto) => {
    try {
      setApiError(null);
      await api.post('/auth/forgot-password', data);
      setIsSuccess(true);
    } catch {
      setApiError('Não foi possível enviar a solicitação. Tente novamente mais tarde.');
    }
  };

  return (
    <div
      className="flex justify-center items-center h-screen w-full"
      style={{ background: 'var(--color-gray-50)' }}
    >
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        {!isSuccess ? (
          <>
            <div className="text-center mb-6">
              <h2>Redefinir Senha</h2>
              <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Informe seu e-mail e enviaremos um link seguro para você cadastrar uma nova senha.
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
              <Input
                label="E-mail vinculado à conta"
                type="email"
                placeholder="usuario@dominio.com.br"
                {...register('email')}
                error={errors.email?.message}
              />

              <div className="mt-4 flex-col flex gap-2">
                <Button type="submit" className="w-full" isLoading={isSubmitting}>
                  Enviar Link de Recuperação
                </Button>

                <Link to="/login" className="btn btn-outline text-center" style={{ width: '100%' }}>
                  Voltar ao login
                </Link>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center py-4 flex flex-col items-center">
            <CheckCircle size={48} color="var(--color-success)" style={{ marginBottom: '1rem' }} />
            <h2 className="mb-2">E-mail Enviado!</h2>
            <p className="text-muted mb-6" style={{ fontSize: '0.875rem' }}>
              Se existir uma conta ativa com este endereço, você receberá um link com validade de 24
              horas nas próximas instantes. Verifique também sua caixa de spam.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
              Voltar ao login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
