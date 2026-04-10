import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema, CreateUserDto } from '@projetog/shared';
import { UserRole } from '@projetog/domain';
import { api } from '../../lib/api';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function UserCreate() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const { register, handleSubmit, watch, control, formState: { errors, isSubmitting } } = useForm<CreateUserDto>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      role: UserRole.FORNECEDOR
    }
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: CreateUserDto) => {
    try {
      setApiError(null);
      await api.post('/users', data);
      navigate('/admin/users', { state: { message: 'Usuário criado com sucesso. O e-mail de acesso foi enviado.' }});
    } catch (error: any) {
      setApiError(error.response?.data?.message || 'Falha ao provisionar usuário. Verifique os dados.');
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="mb-6 flex gap-4 items-center">
        <Link to="/admin/users" className="btn btn-outline" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontSize: '24px', margin: 0 }}>Novo Acesso</h1>
          <p className="text-muted" style={{ fontSize: '14px' }}>Criar conta e enviar magic link de primeiro acesso.</p>
        </div>
      </div>

      <div className="card">
        {apiError && (
          <div className="mb-4 p-3 rounded" style={{ backgroundColor: 'var(--color-error)', color: 'white', fontSize: '0.875rem' }}>
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group mb-6">
            <label className="form-label mb-2">Perfil do Acesso</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {Object.values(UserRole).map(role => (
                <label key={role} style={{ 
                  border: `1px solid ${selectedRole === role ? 'var(--color-primary)' : 'var(--color-gray-200)'}`,
                  background: selectedRole === role ? 'rgba(70,94,190,0.05)' : 'white',
                  padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                  <input type="radio" value={role} {...register('role')} style={{ width: 16, height: 16 }} />
                  <span style={{ textTransform: 'capitalize', fontWeight: selectedRole === role ? 600 : 400 }}>{role}</span>
                </label>
              ))}
            </div>
            {errors.role && <p className="form-error mt-2">{errors.role.message}</p>}
          </div>

          <Input 
            label="Nome Completo" 
            placeholder="Ex: João da Silva"
            {...register('name')}
            error={errors.name?.message}
          />
          
          <Input 
            label="E-mail" 
            type="email" 
            placeholder="Ex: usuario@dominio.com.br"
            {...register('email')}
            error={errors.email?.message}
          />

          {selectedRole === UserRole.FORNECEDOR && (
            <div className="mb-4 p-4 rounded" style={{ backgroundColor: 'var(--color-gray-50)', border: '1px dashed var(--color-gray-300)' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: '0.5rem' }}>Vinculação Operacional</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginBottom: '1rem' }}>
                Fornecedores precisam ser mapeados ao código Sienge para acessar o backoffice e faturamentos.
              </p>
              
              <Controller
                name="supplier_id"
                control={control}
                render={({ field }) => (
                  <Input 
                    label="Código de Fornecedor (supplierId)" 
                    type="number" 
                    placeholder="ID no Sienge"
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    value={field.value || ''}
                    error={errors.supplier_id?.message}
                  />
                )}
              />
            </div>
          )}

          <div className="mt-8 flex justify-end gap-2">
            <Link to="/admin/users" className="btn btn-outline">Cancelar</Link>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>Criar e Enviar Convite</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
