import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import IntegrationEvents from './pages/admin/IntegrationEvents';
import AuditTrail from './pages/admin/AuditTrail';
import QuotationList from './pages/admin/QuotationList';
import QuotationDetail from './pages/admin/QuotationDetail';
import SupplierQuotationList from './pages/supplier/SupplierQuotationList';
import SupplierQuotationDetail from './pages/supplier/SupplierQuotationDetail';
import OrderList from './pages/admin/OrderList';
import OrderDetail from './pages/admin/OrderDetail';
import SupplierOrderList from './pages/supplier/SupplierOrderList';
import SupplierOrderDetail from './pages/supplier/SupplierOrderDetail';
import NotificationsLayout from './pages/admin/NotificationsLayout';
import NotificationLogs from './pages/admin/NotificationLogs';
import NotificationTemplates from './pages/admin/NotificationTemplates';
import FollowUpList from './pages/admin/FollowUpList';
import FollowUpDetail from './pages/admin/FollowUpDetail';
import SupplierFollowUpList from './pages/supplier/SupplierFollowUpList';
import SupplierFollowUpDetail from './pages/supplier/SupplierFollowUpDetail';
import DamageList from './pages/admin/DamageList';
import DamageDetail from './pages/admin/DamageDetail';
import SupplierDamageList from './pages/supplier/SupplierDamageList';
import SupplierDamageDetail from './pages/supplier/SupplierDamageDetail';
import DamageCreate from './pages/damages/DamageCreate';
import DashboardHome from './pages/admin/DashboardHome';
import DashboardLeadTime from './pages/admin/DashboardLeadTime';
import DashboardAtrasos from './pages/admin/DashboardAtrasos';
import DashboardCriticidade from './pages/admin/DashboardCriticidade';
import DashboardRankingFornecedores from './pages/admin/DashboardRankingFornecedores';
import DashboardAvarias from './pages/admin/DashboardAvarias';

const PlaceholderDashboard = () => (
  <div style={{ padding: '2rem', textAlign: 'center', marginTop: '10vh' }}>
    <h1 style={{ fontSize: '32px' }}>Bem-vindo ao Portal GRF</h1>
    <p style={{ color: 'var(--color-gray-500)', marginTop: '1rem' }}>
      Selecione uma opção no menu lateral.
    </p>
  </div>
);

function PasswordResetRedirect({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace('#', '?'));

  const hasPasswordResetToken =
    queryParams.has('token_hash') ||
    hashParams.has('token_hash') ||
    queryParams.has('token') ||
    hashParams.has('access_token');
  const flowType = queryParams.get('type') || hashParams.get('type');
  const isPasswordFlow = flowType === 'recovery' || flowType === 'invite' || flowType === 'signup';

  if (location.pathname !== '/reset-password' && (hasPasswordResetToken || isPasswordFlow)) {
    return <Navigate to={`/reset-password${location.search}${location.hash}`} replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PasswordResetRedirect>
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

                <Route
                  element={
                    <ProtectedRoute allowedRoles={[UserRole.ADMINISTRADOR, UserRole.COMPRAS]} />
                  }
                >
                  <Route path="/admin/dashboard" element={<DashboardHome />} />
                  <Route path="/admin/dashboard/lead-time" element={<DashboardLeadTime />} />
                  <Route path="/admin/dashboard/atrasos" element={<DashboardAtrasos />} />
                  <Route path="/admin/dashboard/criticidade" element={<DashboardCriticidade />} />
                  <Route
                    path="/admin/dashboard/ranking-fornecedores"
                    element={<DashboardRankingFornecedores />}
                  />
                  <Route path="/admin/dashboard/avarias" element={<DashboardAvarias />} />
                  <Route path="/admin/integration" element={<IntegrationEvents />} />
                  <Route path="/admin/audit" element={<AuditTrail />} />
                  <Route path="/admin/quotations" element={<QuotationList />} />
                  <Route path="/admin/quotations/:id" element={<QuotationDetail />} />
                  <Route path="/admin/notifications" element={<NotificationsLayout />}>
                    <Route index element={<NotificationLogs />} />
                    <Route path="templates" element={<NotificationTemplates />} />
                  </Route>
                </Route>

                <Route
                  element={
                    <ProtectedRoute
                      allowedRoles={[
                        UserRole.ADMINISTRADOR,
                        UserRole.COMPRAS,
                        UserRole.VISUALIZADOR_PEDIDOS,
                      ]}
                    />
                  }
                >
                  <Route path="/admin/orders" element={<OrderList />} />
                  <Route path="/admin/orders/:purchaseOrderId" element={<OrderDetail />} />
                </Route>

                <Route
                  element={
                    <ProtectedRoute allowedRoles={[UserRole.ADMINISTRADOR, UserRole.COMPRAS]} />
                  }
                >
                  <Route path="/admin/followup" element={<FollowUpList />} />
                  <Route path="/admin/followup/:purchaseOrderId" element={<FollowUpDetail />} />
                  <Route path="/admin/damages" element={<DamageList />} />
                  <Route path="/admin/damages/new" element={<DamageCreate />} />
                  <Route path="/admin/damages/:damageId" element={<DamageDetail />} />
                </Route>

                {/* Portal do Fornecedor */}
                <Route element={<ProtectedRoute allowedRoles={[UserRole.FORNECEDOR]} />}>
                  <Route path="/supplier/quotations" element={<SupplierQuotationList />} />
                  <Route path="/supplier/quotations/:id" element={<SupplierQuotationDetail />} />
                  <Route path="/supplier/orders" element={<SupplierOrderList />} />
                  <Route
                    path="/supplier/orders/:purchaseOrderId"
                    element={<SupplierOrderDetail />}
                  />
                  <Route path="/supplier/followup" element={<SupplierFollowUpList />} />
                  <Route
                    path="/supplier/followup/:purchaseOrderId"
                    element={<SupplierFollowUpDetail />}
                  />
                  <Route path="/supplier/damages" element={<SupplierDamageList />} />
                  <Route path="/supplier/damages/new" element={<DamageCreate />} />
                  <Route path="/supplier/damages/:damageId" element={<SupplierDamageDetail />} />
                </Route>
              </Route>
            </Route>

            {/* Catch All */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PasswordResetRedirect>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
