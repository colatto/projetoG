import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginDto } from '@projetog/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import logoGrf from '../../assets/GRFlogo.png';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginDto>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginDto) => {
    try {
      setApiError(null);
      await login(data);
      navigate('/'); // Vai para o Dashboard padrao (admin ou fornecedor)
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        setApiError('Credenciais inválidas ou acesso bloqueado.');
      } else {
        setApiError('Ocorreu um erro no servidor. Tente novamente mais tarde.');
      }
    }
  };

  return (
    <div className="flex justify-center items-center h-screen w-full" style={{ background: 'var(--color-gray-50)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)' }}>
        <div className="text-center mb-6">
          <img src={logoGrf} alt="GRF Incorporadora" style={{ height: '65px', margin: '0 auto', marginBottom: '1.5rem', display: 'block' }} />
          <h2 style={{ color: 'var(--color-primary)', fontSize: '1.25rem', marginBottom: '0.25rem' }}>Acesso ao portal</h2>
          <p className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 500 }}>Insira suas credenciais corporativas</p>
        </div>

        {apiError && (
          <div className="mb-4 p-3 rounded" style={{ backgroundColor: 'var(--color-error)', color: 'white', fontSize: '0.875rem', textAlign: 'center' }}>
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="E-mail"
            type="email"
            placeholder="usuario@dominio.com.br"
            {...register('email')}
            error={errors.email?.message}
          />

          <Input
            label="Senha"
            type="password"
            placeholder="********"
            {...register('password')}
            error={errors.password?.message}
          />

          <Button type="submit" className="w-full" isLoading={isSubmitting} style={{ backgroundColor: 'var(--color-primary-dark)', padding: '0.625rem', fontSize: '0.875rem' }}>
            Entrar
          </Button>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
            <Link to="/esqueci-senha" style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', textDecoration: 'none' }}>
              Esqueci minha senha
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
