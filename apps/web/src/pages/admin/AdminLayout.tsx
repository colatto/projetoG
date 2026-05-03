import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  Cable,
  FileText,
  Package,
  BellRing,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';
import { UserRole } from '@projetog/domain';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    logout();
  };

  const navItems = [
    {
      name: 'Dashboard',
      path: '/admin/dashboard',
      icon: <LayoutDashboard size={20} />,
      roles: [UserRole.ADMINISTRADOR, UserRole.COMPRAS],
    },
    {
      name: 'Gestão de Usuários',
      path: '/admin/users',
      icon: <Users size={20} />,
      roles: [UserRole.ADMINISTRADOR],
    },
    {
      name: 'Integração Sienge',
      path: '/admin/integration',
      icon: <Cable size={20} />,
      roles: [UserRole.ADMINISTRADOR, UserRole.COMPRAS],
    },
    {
      name: 'Auditoria',
      path: '/admin/audit',
      icon: <ClipboardList size={20} />,
      roles: [UserRole.ADMINISTRADOR, UserRole.COMPRAS],
    },
    {
      name: 'Cotações',
      path: '/admin/quotations',
      icon: <FileText size={20} />,
      roles: [UserRole.ADMINISTRADOR, UserRole.COMPRAS],
    },
    {
      name: 'Pedidos',
      path: '/admin/orders',
      icon: <Package size={20} />,
      roles: [UserRole.ADMINISTRADOR, UserRole.COMPRAS, UserRole.VISUALIZADOR_PEDIDOS],
    },
    {
      name: 'Notificações',
      path: '/admin/notifications',
      icon: <FileText size={20} />,
      roles: [UserRole.ADMINISTRADOR, UserRole.COMPRAS],
    },
    {
      name: 'Follow-up',
      path: '/admin/followup',
      icon: <BellRing size={20} />,
      roles: [UserRole.ADMINISTRADOR, UserRole.COMPRAS],
    },
    {
      name: 'Avarias',
      path: '/admin/damages',
      icon: <AlertTriangle size={20} />,
      roles: [UserRole.ADMINISTRADOR, UserRole.COMPRAS],
    },
    {
      name: 'Minhas Cotações',
      path: '/supplier/quotations',
      icon: <FileText size={20} />,
      roles: [UserRole.FORNECEDOR],
    },
    {
      name: 'Meus Pedidos',
      path: '/supplier/orders',
      icon: <Package size={20} />,
      roles: [UserRole.FORNECEDOR],
    },
    {
      name: 'Meus Follow-ups',
      path: '/supplier/followup',
      icon: <BellRing size={20} />,
      roles: [UserRole.FORNECEDOR],
    },
    {
      name: 'Minhas Avarias',
      path: '/supplier/damages',
      icon: <AlertTriangle size={20} />,
      roles: [UserRole.FORNECEDOR],
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--color-gray-50)',
        flexDirection: 'row',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: '260px',
          backgroundColor: 'var(--color-primary-dark)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ width: '100%' }}>
          <div
            style={{
              padding: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                backgroundColor: 'var(--color-accent)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              G
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: '600' }}>Portal GRF</span>
          </div>

          <nav style={{ padding: '1rem 0' }}>
            {navItems
              .filter((item) => user && item.roles.includes(user.role))
              .map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1.5rem',
                      color: isActive ? 'white' : 'var(--color-gray-300)',
                      backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                      borderLeft: isActive
                        ? '4px solid var(--color-accent)'
                        : '4px solid transparent',
                      textDecoration: 'none',
                    }}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                );
              })}
          </nav>
        </div>

        <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--color-gray-300)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            <LogOut size={18} />
            Sair do sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header
          style={{
            height: '70px',
            backgroundColor: 'white',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{user?.name}</div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-gray-500)',
                  textTransform: 'capitalize',
                }}
              >
                {user?.role}{' '}
                {user?.role === UserRole.ADMINISTRADOR && (
                  <ShieldCheck size={12} className="inline ml-1" color="var(--color-primary)" />
                )}
              </div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: 'var(--color-gray-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-gray-600)',
                fontWeight: 'bold',
              }}
            >
              {user?.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
