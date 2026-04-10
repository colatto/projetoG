import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginDto } from '@projetog/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

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
    <div className="flex justify-center items-center h-screen w-full" style={{ background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-6">
          <div className="mx-auto bg-white p-2 rounded-full mb-4 inline-block" style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-primary-dark)' }}>
            <span style={{ color: 'var(--color-primary-dark)', fontWeight: 'bold', fontSize: '24px' }}>GRF</span>
          </div>
          <h2>Acesso ao Portal</h2>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>Insira suas credenciais corporativas</p>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
            <Link to="/esqueci-senha" style={{ fontSize: '0.75rem' }}>
              Esqueci minha senha
            </Link>
          </div>

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
