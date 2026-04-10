import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { UserRole } from '@projetog/domain';

// Pages
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Layout
import AdminLayout from './pages/admin/AdminLayout';

// Admin Pages
import UserList from './pages/admin/UserList';
import UserCreate from './pages/admin/UserCreate';
import UserManage from './pages/admin/UserManage';

const PlaceholderDashboard = () => (
  <div style={{ padding: '2rem', textAlign: 'center', marginTop: '10vh' }}>
    <h1 style={{ fontSize: '32px' }}>Bem-vindo ao Portal GRF</h1>
    <p style={{ color: 'var(--color-gray-500)', marginTop: '1rem' }}>
      Selecione uma opção no menu lateral.
    </p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/esqueci-senha" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Rotas Protegidas Root / Compartilhadas */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/" element={<PlaceholderDashboard />} />

              {/* Apenas Administradores */}
              <Route element={<ProtectedRoute allowedRoles={[UserRole.ADMINISTRADOR]} />}>
                <Route path="/admin/users" element={<UserList />} />
                <Route path="/admin/users/new" element={<UserCreate />} />
                <Route path="/admin/users/:id" element={<UserManage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch All */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
