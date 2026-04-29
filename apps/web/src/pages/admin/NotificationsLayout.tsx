import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

export default function NotificationsLayout() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
        <Link
          to="/admin/notifications"
          style={{
            padding: '1rem 2rem',
            textDecoration: 'none',
            color:
              currentPath === '/admin/notifications'
                ? 'var(--color-primary)'
                : 'var(--color-gray-500)',
            borderBottom:
              currentPath === '/admin/notifications'
                ? '2px solid var(--color-primary)'
                : '2px solid transparent',
            fontWeight: currentPath === '/admin/notifications' ? 600 : 400,
          }}
        >
          Logs de Envio
        </Link>
        <Link
          to="/admin/notifications/templates"
          style={{
            padding: '1rem 2rem',
            textDecoration: 'none',
            color:
              currentPath === '/admin/notifications/templates'
                ? 'var(--color-primary)'
                : 'var(--color-gray-500)',
            borderBottom:
              currentPath === '/admin/notifications/templates'
                ? '2px solid var(--color-primary)'
                : '2px solid transparent',
            fontWeight: currentPath === '/admin/notifications/templates' ? 600 : 400,
          }}
        >
          Templates
        </Link>
      </div>
      <div>
        <Outlet />
      </div>
    </div>
  );
}
