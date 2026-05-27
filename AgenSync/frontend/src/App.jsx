import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AccessDenied from "./components/AccessDenied.jsx";
import Layout from "./components/Layout.jsx";
import Loading from "./components/Loading.jsx";
import PageTransition from "./components/PageTransition.jsx";
import { canUsePlanFeature } from "./config/plans.js";
import { useAuth } from "./contexts/AuthContext.jsx";

const Agenda = lazy(() => import("./pages/Agenda.jsx"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const Appointments = lazy(() => import("./pages/Appointments.jsx"));
const Clients = lazy(() => import("./pages/Clients.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Expenses = lazy(() => import("./pages/Expenses.jsx"));
const Finance = lazy(() => import("./pages/Finance.jsx"));
const History = lazy(() => import("./pages/History.jsx"));
const InitialOnboarding = lazy(() => import("./pages/InitialOnboarding.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const PlatformDashboard = lazy(() => import("./pages/PlatformDashboard.jsx"));
const Products = lazy(() => import("./pages/Products.jsx"));
const ProductSales = lazy(() => import("./pages/ProductSales.jsx"));
const Professionals = lazy(() => import("./pages/Professionals.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const Services = lazy(() => import("./pages/Services.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Subscriptions = lazy(() => import("./pages/Subscriptions.jsx"));

function ProtectedRoute() {
  const { loading, isAuthenticated, hasPlatformAccess, user, workspaceRole } = useAuth();
  const location = useLocation();
  const isPlatformPath =
    location.pathname.startsWith("/platform") ||
    location.pathname.startsWith("/plataforma") ||
    location.pathname.startsWith("/admin/platform");

  if (loading) return <Loading label="Abrindo sua agenda..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasPlatformAccess && workspaceRole === "owner" && user?.onboardingCompleted === false && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  if (hasPlatformAccess && !isPlatformPath) {
    return <Navigate to="/platform" replace />;
  }
  if (!hasPlatformAccess && isPlatformPath) {
    return <Navigate to="/" replace />;
  }
  return <Layout />;
}

function PublicRoute({ children }) {
  const { loading, isAuthenticated, user, hasPlatformAccess, workspaceRole } = useAuth();

  if (loading) return <Loading label="Preparando acesso..." />;
  if (isAuthenticated && !hasPlatformAccess && workspaceRole === "owner" && user?.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function OnboardingRoute() {
  const { loading, isAuthenticated, hasPlatformAccess, user, workspaceRole } = useAuth();

  if (loading) return <Loading label="Preparando configuração inicial..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (hasPlatformAccess) return <Navigate to="/platform" replace />;
  if (workspaceRole !== "owner") return <Navigate to="/" replace />;
  if (user?.onboardingCompleted === true) return <Navigate to="/" replace />;
  return (
    <PageTransition>
      <InitialOnboarding />
    </PageTransition>
  );
}

function AdminRoute({ children }) {
  const { loading, isAdmin } = useAuth();

  if (loading) return <Loading label="Validando acesso admin..." />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function PlatformRoute({ children }) {
  const { loading, hasPlatformAccess } = useAuth();

  if (loading) return <Loading label="Validando acesso da plataforma..." />;
  if (!hasPlatformAccess) return <Navigate to="/" replace />;
  return children;
}

function PermissionRoute({ children, permission, feature, title, description }) {
  const { loading, user, canAccess } = useAuth();

  if (loading) return <Loading label="Validando acesso..." />;
  if (permission && !canAccess(permission)) {
    return (
      <AccessDenied
        title={title}
        description={description || "Seu perfil atual nao libera esta area."}
      />
    );
  }
  if (feature && !canUsePlanFeature(user, feature)) {
    return (
      <AccessDenied
        title={title || "Recurso do plano"}
        description={description || "Este recurso esta disponivel em outro plano do AgenSync."}
      />
    );
  }
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<Loading label="Carregando tela..." />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <PageTransition>
                <Login />
              </PageTransition>
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PageTransition>
              <ResetPassword />
            </PageTransition>
          }
        />
        <Route
          path="/accept-invite/:token"
          element={
            <PageTransition>
              <AcceptInvite />
            </PageTransition>
          }
        />
        <Route
          path="/convite/:token"
          element={
            <PageTransition>
              <AcceptInvite />
            </PageTransition>
          }
        />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route element={<ProtectedRoute />}>
          <Route index element={<Dashboard />} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
          <Route path="platform" element={<PlatformRoute><PlatformDashboard /></PlatformRoute>} />
          <Route path="platform/:section" element={<PlatformRoute><PlatformDashboard /></PlatformRoute>} />
          <Route path="admin/platform" element={<PlatformRoute><PlatformDashboard /></PlatformRoute>} />
          <Route path="admin/platform/:section" element={<PlatformRoute><PlatformDashboard /></PlatformRoute>} />
          <Route path="plataforma" element={<PlatformRoute><PlatformDashboard /></PlatformRoute>} />
          <Route path="plataforma/:section" element={<PlatformRoute><PlatformDashboard /></PlatformRoute>} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="agenda/semanal" element={<Agenda initialView="week" />} />
          <Route path="agenda/diaria" element={<Agenda initialView="day" />} />
          <Route path="agenda/horarios" element={<Agenda focus="workingHours" />} />
          <Route path="agendamentos" element={<PermissionRoute permission="clients"><Appointments /></PermissionRoute>} />
          <Route path="clientes" element={<PermissionRoute permission="clients"><Clients section="clients" /></PermissionRoute>} />
          <Route path="clientes/atendimento" element={<PermissionRoute permission="clients"><Clients section="attendance" /></PermissionRoute>} />
          <Route path="clientes/fichas" element={<PermissionRoute permission="clients"><Clients section="forms" /></PermissionRoute>} />
          <Route path="clientes/evolucao" element={<PermissionRoute permission="clients"><Clients section="evolution" /></PermissionRoute>} />
          <Route path="clientes/documentos" element={<PermissionRoute permission="clients"><Clients section="documents" /></PermissionRoute>} />
          <Route path="clientes/linha-do-tempo" element={<PermissionRoute permission="clients"><Clients section="timeline" /></PermissionRoute>} />
          <Route path="profissionais" element={<PermissionRoute permission="professionals"><Professionals /></PermissionRoute>} />
          <Route path="servicos" element={<PermissionRoute permission="services"><Services /></PermissionRoute>} />
          <Route path="produtos" element={<PermissionRoute permission="products"><Products /></PermissionRoute>} />
          <Route path="produtos/:section" element={<Navigate to="/produtos" replace />} />
          <Route path="vendas" element={<PermissionRoute permission="sales"><ProductSales mode="new" /></PermissionRoute>} />
          <Route path="vendas/nova" element={<PermissionRoute permission="sales"><ProductSales mode="new" /></PermissionRoute>} />
          <Route path="vendas/historico" element={<PermissionRoute permission="sales"><ProductSales mode="history" /></PermissionRoute>} />
          <Route
            path="vendas/comissoes"
            element={<PermissionRoute permission="sales"><ProductSales mode="commissions" /></PermissionRoute>}
          />
          <Route path="vendas/relatorios" element={<PermissionRoute permission="reports"><ProductSales mode="reports" /></PermissionRoute>} />
          <Route path="mensalidades" element={<PermissionRoute permission="subscriptions"><Subscriptions /></PermissionRoute>} />
          <Route path="historico" element={<History />} />
          <Route path="financeiro" element={<PermissionRoute permission="finance"><Finance /></PermissionRoute>} />
          <Route path="relatorios" element={<PermissionRoute permission="reports"><Finance /></PermissionRoute>} />
          <Route path="despesas" element={<PermissionRoute permission="expenses"><Expenses /></PermissionRoute>} />
          <Route path="configuracoes" element={<PermissionRoute permission="settings"><Settings /></PermissionRoute>} />
          <Route
            path="configuracoes/permissoes-especiais"
            element={<PermissionRoute permission="settings"><Settings section="specialPermissions" /></PermissionRoute>}
          />
          <Route
            path="configuracoes/auditoria"
            element={<PermissionRoute permission="settings"><Settings section="audit" /></PermissionRoute>}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
