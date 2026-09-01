import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./api/client.js";
import AccessDenied from "./components/AccessDenied.jsx";
import Button from "./components/Button.jsx";
import Layout from "./components/Layout.jsx";
import Loading from "./components/Loading.jsx";
import PageTransition from "./components/PageTransition.jsx";
import SplashScreen from "./components/SplashScreen.jsx";
import { canUsePlanFeature } from "./config/plans.js";
import { useAuth } from "./contexts/AuthContext.jsx";

const SPLASH_SHOWN_KEY = "agensync:splash-shown";

function hasShownSplash() {
  try {
    return Boolean(window.sessionStorage.getItem(SPLASH_SHOWN_KEY));
  } catch {
    return true;
  }
}

function markSplashShown() {
  try {
    window.sessionStorage.setItem(SPLASH_SHOWN_KEY, "1");
  } catch {
    // sessionStorage unavailable (private mode, etc.) — splash just won't persist across reloads.
  }
}

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

function SubscriptionBlockedScreen() {
  const { user, logout } = useAuth();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState("");
  const workspace = user?.currentWorkspace || {};
  const access = workspace.accessStatus || {};
  const trialExpired = access.reason === "trial_expired";
  const title = trialExpired ? "Seu período de teste grátis terminou." : "Sua assinatura está vencida.";
  const description = trialExpired
    ? "Assine agora para continuar usando o AgenSync."
    : "Regularize o pagamento para continuar usando o AgenSync.";
  const primaryLabel = trialExpired ? "Assinar agora" : "Regularizar pagamento";

  async function startCheckout() {
    setLoadingCheckout(true);
    setError("");
    try {
      const response = await api.createBillingCheckoutSession({
        planSlug: workspace.plan || user?.plan || "padrao",
        successUrl: `${window.location.origin}/configuracoes`,
        cancelUrl: `${window.location.origin}/configuracoes`
      });
      const checkout = response.checkout || response;
      const url = checkout.checkoutUrl || checkout.invoiceUrl || checkout.url;
      if (!url) throw new Error("Nenhuma URL de pagamento foi retornada.");
      window.location.assign(url);
    } catch (err) {
      setError(err.message || "Nao foi possivel iniciar o pagamento.");
    } finally {
      setLoadingCheckout(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 text-ink sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col justify-center">
        <section className="rounded-lg border border-[#DDE6F0] bg-white p-6 shadow-panel sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-brand">Plano e assinatura</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-ink">{title}</h1>
          <p className="mt-3 text-base font-bold leading-7 text-muted">{description}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button type="button" size="lg" loading={loadingCheckout} onClick={startCheckout}>
              {primaryLabel}
            </Button>
            <Button type="button" variant="secondary" size="lg" onClick={() => window.location.assign("/configuracoes")}>
              Ver planos
            </Button>
          </div>
          {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-danger">{error}</p> : null}
          <Button type="button" variant="ghost" className="mt-5" onClick={logout}>
            Sair
          </Button>
        </section>
      </div>
    </div>
  );
}

function ProtectedRoute() {
  const { loading, isAuthenticated, hasPlatformAccess, user, workspaceRole } = useAuth();
  const location = useLocation();
  const [splashDone, setSplashDone] = useState(hasShownSplash);
  const isPlatformPath =
    location.pathname.startsWith("/platform") ||
    location.pathname.startsWith("/plataforma") ||
    location.pathname.startsWith("/admin/platform");

  if (loading) return <Loading label="Abrindo sua agenda..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const access = user?.currentWorkspace?.accessStatus;
  const billingPathAllowed = location.pathname.startsWith("/configuracoes");
  if (!hasPlatformAccess && access && access.allowed === false && !billingPathAllowed) {
    return <SubscriptionBlockedScreen />;
  }
  if (!hasPlatformAccess && workspaceRole === "owner" && user?.onboardingCompleted === false && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  if (hasPlatformAccess && !isPlatformPath) {
    return <Navigate to="/platform" replace />;
  }
  if (!hasPlatformAccess && isPlatformPath) {
    return <Navigate to="/" replace />;
  }
  if (!hasPlatformAccess && !splashDone) {
    return (
      <SplashScreen
        firstName={user?.name?.trim().split(" ")[0] || ""}
        onDone={() => {
          markSplashShown();
          setSplashDone(true);
        }}
      />
    );
  }
  return <Layout />;
}

function PublicRoute({ children }) {
  const { loading, isAuthenticated, user, hasPlatformAccess, workspaceRole } = useAuth();

  if (loading) return <Loading label="Preparando acesso..." />;
  if (isAuthenticated && hasPlatformAccess) return <Navigate to="/platform" replace />;
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
