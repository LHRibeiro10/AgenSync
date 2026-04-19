import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Loading from "./components/Loading.jsx";
import PageTransition from "./components/PageTransition.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";
import Agenda from "./pages/Agenda.jsx";
import Appointments from "./pages/Appointments.jsx";
import Clients from "./pages/Clients.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Expenses from "./pages/Expenses.jsx";
import Finance from "./pages/Finance.jsx";
import History from "./pages/History.jsx";
import Login from "./pages/Login.jsx";
import Products from "./pages/Products.jsx";
import ProductSales from "./pages/ProductSales.jsx";
import Professionals from "./pages/Professionals.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Services from "./pages/Services.jsx";
import Settings from "./pages/Settings.jsx";
import Subscriptions from "./pages/Subscriptions.jsx";

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

export default function App() {
  return (
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
  );
}
