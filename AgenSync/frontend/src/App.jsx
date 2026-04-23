import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Loading from "./components/Loading.jsx";
import PageTransition from "./components/PageTransition.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";

const Agenda = lazy(() => import("./pages/Agenda.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const Appointments = lazy(() => import("./pages/Appointments.jsx"));
const Clients = lazy(() => import("./pages/Clients.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Expenses = lazy(() => import("./pages/Expenses.jsx"));
const Finance = lazy(() => import("./pages/Finance.jsx"));
const History = lazy(() => import("./pages/History.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Products = lazy(() => import("./pages/Products.jsx"));
const ProductSales = lazy(() => import("./pages/ProductSales.jsx"));
const Professionals = lazy(() => import("./pages/Professionals.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const Services = lazy(() => import("./pages/Services.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Subscriptions = lazy(() => import("./pages/Subscriptions.jsx"));

function ProtectedRoute() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) return <Loading label="Abrindo sua agenda..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout />;
}

function PublicRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) return <Loading label="Preparando acesso..." />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { loading, isAdmin } = useAuth();

  if (loading) return <Loading label="Validando acesso admin..." />;
  if (!isAdmin) return <Navigate to="/" replace />;
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
          <Route path="agenda" element={<Agenda />} />
          <Route path="agendamentos" element={<Appointments />} />
          <Route path="clientes" element={<Clients />} />
          <Route path="profissionais" element={<Professionals />} />
          <Route path="servicos" element={<Services />} />
          <Route path="produtos" element={<Products />} />
          <Route path="vendas" element={<ProductSales />} />
          <Route path="mensalidades" element={<Subscriptions />} />
          <Route path="historico" element={<History />} />
          <Route path="financeiro" element={<Finance />} />
          <Route path="relatorios" element={<Finance />} />
          <Route path="despesas" element={<Expenses />} />
          <Route path="configuracoes" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
