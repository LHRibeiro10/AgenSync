import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import { useAuth } from "./AuthContext.jsx";

const OnboardingContext = createContext(null);

const STORAGE_PREFIX = "agensync_onboarding_v1";

const TOUR_STEPS = [
  {
    id: "dashboard",
    path: "/",
    title: "Dashboard",
    description: "Aqui voce acompanha a visao geral do negocio, filtra por periodo e profissional e compara resultados sem trocar de tela."
  },
  {
    id: "agenda",
    path: "/agenda/semanal",
    title: "Agenda",
    description: "O modulo de agenda agora separa a visao semanal, diaria e os horarios de trabalho para manter a operacao mais leve."
  },
  {
    id: "clients",
    path: "/clientes",
    title: "Clientes",
    description: "Clientes funciona como um mini CRM: cadastro, atendimento, fichas, evolucao, documentos e linha do tempo ficam conectados ao cliente."
  },
  {
    id: "services",
    path: "/servicos",
    title: "Servicos",
    description: "Cadastre os servicos que voce oferece e use esses dados nos agendamentos e no financeiro."
  },
  {
    id: "products",
    path: "/produtos",
    title: "Produtos e estoque",
    description: "Produtos concentra catalogo, estoque, reposicao, categorias e entradas rapidas em uma unica tela."
  },
  {
    id: "sales",
    path: "/vendas/nova",
    title: "Vendas",
    description: "Use vendas para registrar rapidamente uma nova venda, consultar historico e acompanhar comissoes e relatorios."
  },
  {
    id: "finance",
    path: "/financeiro",
    title: "Financeiro",
    description: "Veja entradas, despesas, mensalidades, lucro liquido e relatorios com filtros reutilizaveis."
  }
];

const STEP_LABELS = {
  service: "Criar primeiro servico",
  client: "Cadastrar primeiro cliente",
  appointment: "Fazer primeiro agendamento"
};

const STEP_ACTIONS = {
  service: "/servicos",
  client: "/clientes",
  appointment: "/agendamentos"
};

function createDefaultProgress() {
  return {
    hasSeenWelcome: false,
    skippedTour: false,
    tourCompleted: false,
    steps: {
      service: false,
      client: false,
      appointment: false
    }
  };
}

function normalizeProgress(value) {
  const safe = value && typeof value === "object" ? value : {};
  const steps = safe.steps && typeof safe.steps === "object" ? safe.steps : {};

  return {
    hasSeenWelcome: Boolean(safe.hasSeenWelcome),
    skippedTour: Boolean(safe.skippedTour),
    tourCompleted: Boolean(safe.tourCompleted),
    steps: {
      service: Boolean(steps.service),
      client: Boolean(steps.client),
      appointment: Boolean(steps.appointment)
    }
  };
}

function storageKeyFor(user) {
  const userKey = user?.id || user?.email || "anonymous";
  return `${STORAGE_PREFIX}:${userKey}`;
}

function stepFromPath(pathname) {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return 0;
  if (pathname.startsWith("/agenda")) return 1;
  if (pathname.startsWith("/clientes")) return 2;
  if (pathname.startsWith("/servicos")) return 3;
  if (pathname.startsWith("/produtos")) return 4;
  if (pathname.startsWith("/vendas")) return 5;
  if (pathname.startsWith("/financeiro")) return 6;
  return -1;
}

export function OnboardingProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, hasPlatformAccess } = useAuth();
  const { showToast } = useToast();
  const [progress, setProgress] = useState(createDefaultProgress);
  const [hydrated, setHydrated] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !user || hasPlatformAccess) {
      setProgress(createDefaultProgress());
      setTourActive(false);
      setTourIndex(0);
      setHydrated(false);
      return;
    }

    const key = storageKeyFor(user);
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      setProgress(normalizeProgress(parsed));
    } catch {
      setProgress(createDefaultProgress());
    } finally {
      setHydrated(true);
    }
  }, [hasPlatformAccess, isAuthenticated, user?.id, user?.email]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user || hasPlatformAccess) return;
    const key = storageKeyFor(user);
    window.localStorage.setItem(key, JSON.stringify(progress));
  }, [progress, hydrated, hasPlatformAccess, isAuthenticated, user?.id, user?.email]);

  const refreshChecklist = useCallback(async () => {
    if (!isAuthenticated || !user || hasPlatformAccess) return;

    setChecklistLoading(true);
    try {
      const [servicesData, clientsData, appointmentsData] = await Promise.all([
        api.listServices({ take: 1 }),
        api.listClients({ take: 1 }),
        api.listAppointments({ take: 1 })
      ]);

      const nextSteps = {
        service: Array.isArray(servicesData?.services) && servicesData.services.length > 0,
        client: Array.isArray(clientsData?.clients) && clientsData.clients.length > 0,
        appointment: Array.isArray(appointmentsData?.appointments) && appointmentsData.appointments.length > 0
      };
      const hasExistingSetup = Object.values(nextSteps).some(Boolean);

      setProgress((current) => ({
        ...current,
        hasSeenWelcome: current.hasSeenWelcome || hasExistingSetup,
        skippedTour: current.skippedTour || (!current.hasSeenWelcome && hasExistingSetup),
        steps: {
          service: current.steps.service || nextSteps.service,
          client: current.steps.client || nextSteps.client,
          appointment: current.steps.appointment || nextSteps.appointment
        }
      }));
    } catch {
      // Keep onboarding usable even if background sync fails.
    } finally {
      setChecklistLoading(false);
    }
  }, [hasPlatformAccess, isAuthenticated, user?.id]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user || hasPlatformAccess) return;
    refreshChecklist();
  }, [hydrated, hasPlatformAccess, isAuthenticated, user?.id, refreshChecklist]);

  useEffect(() => {
    if (!tourActive) return;
    const indexFromPath = stepFromPath(location.pathname);
    if (indexFromPath >= 0 && indexFromPath !== tourIndex) {
      setTourIndex(indexFromPath);
    }
  }, [location.pathname, tourActive, tourIndex]);

  const markStepComplete = useCallback(
    (step, options = {}) => {
      if (!Object.prototype.hasOwnProperty.call(STEP_LABELS, step)) return;
      const shouldToast = options.toast !== false;
      let completedNow = false;

      setProgress((current) => {
        if (current.steps[step]) return current;
        completedNow = true;
        return {
          ...current,
          steps: {
            ...current.steps,
            [step]: true
          }
        };
      });

      if (completedNow && shouldToast) {
        showToast(`Passo concluido: ${STEP_LABELS[step]}.`);
      }
    },
    [showToast]
  );

  const openWelcomeAndRestart = useCallback(() => {
    setProgress((current) => ({
      ...current,
      hasSeenWelcome: false,
      skippedTour: false,
      tourCompleted: false
    }));
    setTourActive(false);
    setTourIndex(0);
  }, []);

  const startTour = useCallback(() => {
    setProgress((current) => ({
      ...current,
      hasSeenWelcome: true,
      skippedTour: false
    }));
    setTourIndex(0);
    setTourActive(true);
    navigate(TOUR_STEPS[0].path);
  }, [navigate]);

  const skipTour = useCallback(() => {
    setProgress((current) => ({
      ...current,
      hasSeenWelcome: true,
      skippedTour: true
    }));
    setTourActive(false);
    showToast("Guia inicial pulado. Voce pode iniciar quando quiser.");
  }, [showToast]);

  const closeWelcome = useCallback(() => {
    setProgress((current) => ({
      ...current,
      hasSeenWelcome: true
    }));
  }, []);

  const finishTour = useCallback(() => {
    setProgress((current) => ({
      ...current,
      hasSeenWelcome: true,
      skippedTour: false,
      tourCompleted: true
    }));
    setTourActive(false);
    showToast("Guia inicial concluido.");
  }, [showToast]);

  const nextTourStep = useCallback(() => {
    if (!tourActive) return;
    const nextIndex = tourIndex + 1;
    if (nextIndex >= TOUR_STEPS.length) {
      finishTour();
      return;
    }

    setTourIndex(nextIndex);
    navigate(TOUR_STEPS[nextIndex].path);
  }, [finishTour, navigate, tourActive, tourIndex]);

  const previousTourStep = useCallback(() => {
    if (!tourActive) return;
    const previousIndex = Math.max(tourIndex - 1, 0);
    setTourIndex(previousIndex);
    navigate(TOUR_STEPS[previousIndex].path);
  }, [navigate, tourActive, tourIndex]);

  const stopTour = useCallback(() => {
    setTourActive(false);
  }, []);

  const resetOnboarding = useCallback(
    (options = {}) => {
      const shouldNotify = options.notify !== false;
      if (isAuthenticated && user) {
        window.localStorage.removeItem(storageKeyFor(user));
      }
      setProgress(createDefaultProgress());
      setTourActive(false);
      setTourIndex(0);
      setHydrated(Boolean(isAuthenticated && user));
      if (shouldNotify) {
        showToast("Primeiros passos reiniciados.");
      }
    },
    [isAuthenticated, user?.id, user?.email, showToast]
  );

  const checklist = useMemo(() => {
    const items = [
      {
        key: "service",
        label: "Criar primeiro servico",
        description: "Cadastre ao menos um servico para comecar a agenda.",
        done: progress.steps.service,
        actionPath: STEP_ACTIONS.service,
        actionLabel: progress.steps.service ? "Ver servicos" : "Criar servico"
      },
      {
        key: "client",
        label: "Cadastrar primeiro cliente",
        description: "Adicione seu primeiro cliente para iniciar atendimentos.",
        done: progress.steps.client,
        actionPath: STEP_ACTIONS.client,
        actionLabel: progress.steps.client ? "Ver clientes" : "Cadastrar cliente"
      },
      {
        key: "appointment",
        label: "Fazer primeiro agendamento",
        description: "Crie um atendimento para preencher sua agenda.",
        done: progress.steps.appointment,
        actionPath: STEP_ACTIONS.appointment,
        actionLabel: progress.steps.appointment ? "Ver agendamentos" : "Criar agendamento"
      }
    ];

    const completed = items.filter((item) => item.done).length;
    const total = items.length;
    const ratio = total ? completed / total : 0;

    return { items, completed, total, ratio, done: completed === total };
  }, [progress.steps]);

  const welcomeOpen = hydrated && isAuthenticated && !hasPlatformAccess && !progress.hasSeenWelcome;
  const currentTourStep = tourActive ? TOUR_STEPS[tourIndex] : null;

  const value = useMemo(
    () => ({
      progress,
      checklist,
      checklistLoading,
      welcomeOpen,
      tourActive,
      tourIndex,
      tourSteps: TOUR_STEPS,
      currentTourStep,
      startTour,
      skipTour,
      closeWelcome,
      nextTourStep,
      previousTourStep,
      stopTour,
      finishTour,
      refreshChecklist,
      markStepComplete,
      resetOnboarding,
      openWelcomeAndRestart
    }),
    [
      progress,
      checklist,
      checklistLoading,
      welcomeOpen,
      tourActive,
      tourIndex,
      currentTourStep,
      startTour,
      skipTour,
      closeWelcome,
      nextTourStep,
      previousTourStep,
      stopTour,
      finishTour,
      refreshChecklist,
      markStepComplete,
      resetOnboarding,
      openWelcomeAndRestart
    ]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding deve ser usado dentro de OnboardingProvider.");
  }
  return context;
}
