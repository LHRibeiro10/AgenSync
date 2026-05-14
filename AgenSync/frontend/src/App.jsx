import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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
const ModulePlaceholder = lazy(() => import("./pages/ModulePlaceholder.jsx"));
const PlatformDashboard = lazy(() => import("./pages/PlatformDashboard.jsx"));
const Products = lazy(() => import("./pages/Products.jsx"));
const ProductSales = lazy(() => import("./pages/ProductSales.jsx"));
const Professionals = lazy(() => import("./pages/Professionals.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const Services = lazy(() => import("./pages/Services.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Subscriptions = lazy(() => import("./pages/Subscriptions.jsx"));

function ProtectedRoute() {
  const { loading, isAuthenticated, hasPlatformAccess } = useAuth();
  const location = useLocation();
  const isPlatformPath =
    location.pathname.startsWith("/platform") ||
    location.pathname.startsWith("/plataforma") ||
    location.pathname.startsWith("/admin/platform");

  if (loading) return <Loading label="Abrindo sua agenda..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (hasPlatformAccess && !isPlatformPath) {
    return <Navigate to="/platform" replace />;
  }
  if (!hasPlatformAccess && isPlatformPath) {
    return <Navigate to="/" replace />;
  }
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

function PlatformRoute({ children }) {
  const { loading, hasPlatformAccess } = useAuth();

  if (loading) return <Loading label="Validando acesso da plataforma..." />;
  if (!hasPlatformAccess) return <Navigate to="/" replace />;
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
          <Route path="agendamentos" element={<Appointments />} />
          <Route path="clientes" element={<Clients section="clients" />} />
          <Route path="clientes/atendimento" element={<Clients section="attendance" />} />
          <Route path="clientes/fichas" element={<Clients section="forms" />} />
          <Route path="clientes/evolucao" element={<Clients section="evolution" />} />
          <Route path="clientes/documentos" element={<Clients section="documents" />} />
          <Route path="clientes/linha-do-tempo" element={<Clients section="timeline" />} />
          <Route path="profissionais" element={<Professionals />} />
          <Route path="servicos" element={<Services />} />
          <Route path="produtos" element={<Products mode="catalog" />} />
          <Route path="produtos/estoque" element={<Products mode="stock" />} />
          <Route
            path="produtos/movimentacoes"
            element={<ModulePlaceholder title="Movimentacoes de estoque" description="Base para entradas, saidas, ajustes, perdas e historico de estoque." items={["Entrada", "Saida", "Ajuste manual", "Perda", "Validade", "Fornecedor"]} />}
          />
          <Route
            path="produtos/reposicao"
            element={<ModulePlaceholder title="Reposicao" description="Estrutura para alertas inteligentes, ponto de reposicao e compras futuras." items={["Estoque baixo", "Sem estoque", "Sugestao de compra", "Custo medio"]} />}
          />
          <Route
            path="produtos/categorias"
            element={<ModulePlaceholder title="Categorias" description="Preparado para organizar catalogo, estoque e relatorios por familia de produtos." items={["Categorias", "Margem por grupo", "Alertas por grupo"]} />}
          />
          <Route path="vendas" element={<ProductSales mode="new" />} />
          <Route path="vendas/nova" element={<ProductSales mode="new" />} />
          <Route path="vendas/historico" element={<ProductSales mode="history" />} />
          <Route
            path="vendas/comissoes"
            element={<ModulePlaceholder title="Comissoes" description="Base para regras de comissao por profissional, produto, servico e periodo." items={["Profissional", "Percentual", "Venda", "Pagamento", "Periodo"]} />}
          />
          <Route path="vendas/relatorios" element={<ProductSales mode="reports" />} />
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
