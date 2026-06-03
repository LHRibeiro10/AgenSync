import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import FilterBar, { periodLabel, rangeForPeriod } from "../components/FilterBar.jsx";
import InstallAppCard from "../components/InstallAppCard.jsx";
import Message from "../components/Message.jsx";
import FirstStepsCard from "../components/onboarding/FirstStepsCard.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../components/Toast.jsx";
import { PLAN_FEATURES, canUsePlanFeature } from "../config/plans.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useOnboarding } from "../contexts/OnboardingContext.jsx";
import { useWorkspaceView } from "../contexts/WorkspaceViewContext.jsx";
import { listExpenses, sumExpenses } from "../services/expenses.js";
import { listProductSales, sumProductSales } from "../services/products.js";
import { listProfessionals } from "../services/professionalService.js";
import { listSubscriptionCycles, subscriptionSummary, sumPaidSubscriptionCycles } from "../services/subscriptions.js";
import { money } from "../utils.js";

const MONTHLY_GOAL_KEY = "agensync_monthly_goal";
const DASHBOARD_VIEW_CACHE_KEY = "agensync_dashboard_view_cache_v1";
const DASHBOARD_VIEW_CACHE_TTL_MS = 5 * 60 * 1000;
const DASHBOARD_PROFESSIONALS_CACHE_KEY = "agensync_dashboard_professionals_cache_v1";
const DEFAULT_MONTHLY_GOAL = 3000;
const WORKDAY_SLOTS = 8;
const EMPTY_SUBSCRIPTION_SUMMARY = { activeCount: 0, pending: 0, overdue: 0, expected: 0, received: 0, pendingAmount: 0 };
const EMPTY_DASHBOARD_DATA = {
  appointmentsToday: 0,
  earnedToday: 0,
  servicesPeriod: 0,
  productsPeriod: 0,
  subscriptionsPeriod: 0,
  grossPeriod: 0,
  expensesPeriod: 0,
  netPeriod: 0,
  servicesDay: 0,
  productsDay: 0,
  subscriptionsDay: 0,
  grossDay: 0,
  expensesDay: 0,
  netDay: 0,
  servicesMonth: 0,
  productsMonth: 0,
  subscriptionsMonth: 0,
  grossMonth: 0,
  expensesMonth: 0,
  netMonth: 0,
  todayAppointments: [],
  productSales: [],
  subscriptionCycles: [],
  subscriptionSummary: EMPTY_SUBSCRIPTION_SUMMARY,
  nextAppointment: null
};

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatInputDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function daysBetween(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function previousRange(filters) {
  const amount = daysBetween(filters.startDate, filters.endDate);
  const previousEnd = addDays(parseDate(filters.startDate), -1);
  const previousStart = addDays(previousEnd, -(amount - 1));
  return {
    startDate: formatInputDate(previousStart),
    endDate: formatInputDate(previousEnd)
  };
}

function monthRangeUntil(value) {
  return {
    startDate: `${value.slice(0, 7)}-01`,
    endDate: value
  };
}

function earnedCompleted(appointments) {
  return appointments
    .filter((appointment) => appointment.status === "concluido")
    .reduce((total, appointment) => total + Number(appointment.price || 0), 0);
}

function selectedProfessionalLabel(professionalId, professionals) {
  if (!professionalId) return "Todos os profissionais";
  return professionals.find((professional) => professional.id === professionalId)?.name || "Profissional";
}

function resultLabelFor(filters, professionals) {
  return `Visao: ${selectedProfessionalLabel(filters.professionalId, professionals)} | Periodo: ${periodLabel(filters)}`;
}

function filterKey(filters) {
  return [filters.period, filters.startDate, filters.endDate, filters.professionalId || ""].join("|");
}

function buildTeamComparison(appointments, professionals, monthlyGoal) {
  const activeProfessionals = professionals.filter((professional) => professional.isActive !== false);
  const rows = new Map();
  const goalBase = Math.max(activeProfessionals.length || 1, 1);
  const professionalGoal = monthlyGoal / goalBase;

  activeProfessionals.forEach((professional) => {
    rows.set(professional.id, {
      id: professional.id,
      name: professional.name,
      role: professional.role || "Profissional",
      revenue: 0,
      appointments: 0,
      completed: 0,
      cancellations: 0,
      clients: new Set(),
      goal: professionalGoal
    });
  });

  appointments.forEach((appointment) => {
    const id = appointment.professionalId || "unassigned";
    if (!rows.has(id)) {
      rows.set(id, {
        id,
        name: appointment.professional?.name || "Sem profissional",
        role: "Sem vinculo",
        revenue: 0,
        appointments: 0,
        completed: 0,
        cancellations: 0,
        clients: new Set(),
        goal: professionalGoal
      });
    }

    const row = rows.get(id);
    row.appointments += 1;

    if (appointment.status === "concluido") {
      row.completed += 1;
      row.revenue += Number(appointment.price || 0);
      if (appointment.clientId) row.clients.add(appointment.clientId);
    }

    if (appointment.status === "cancelado") {
      row.cancellations += 1;
    }
  });

  return [...rows.values()]
    .map((row) => ({
      ...row,
      clientsCount: row.clients.size,
      averageTicket: row.completed > 0 ? row.revenue / row.completed : 0,
      goalProgress: row.goal > 0 ? Math.round((row.revenue / row.goal) * 100) : 0
    }))
    .sort((first, second) => second.revenue - first.revenue);
}

function readMonthlyGoal() {
  const saved = Number(localStorage.getItem(MONTHLY_GOAL_KEY));
  return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_MONTHLY_GOAL;
}

function dashboardCacheId(user, filters) {
  return [
    user?.id || "",
    user?.currentWorkspaceId || user?.currentWorkspace?.id || "",
    filterKey(filters)
  ].join("|");
}

function readJsonCache(key) {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeJsonCache(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}

function readDashboardSnapshot(user, filters) {
  const cached = readJsonCache(DASHBOARD_VIEW_CACHE_KEY);
  if (!cached || cached.cacheId !== dashboardCacheId(user, filters)) return null;
  if (Date.now() - Number(cached.savedAt || 0) > DASHBOARD_VIEW_CACHE_TTL_MS) return null;
  return cached.snapshot || null;
}

function writeDashboardSnapshot(user, filters, snapshot) {
  writeJsonCache(DASHBOARD_VIEW_CACHE_KEY, {
    cacheId: dashboardCacheId(user, filters),
    savedAt: Date.now(),
    snapshot
  });
}

function readProfessionalsSnapshot(user) {
  const cached = readJsonCache(DASHBOARD_PROFESSIONALS_CACHE_KEY);
  const workspaceId = user?.currentWorkspaceId || user?.currentWorkspace?.id || "";
  if (!cached || cached.userId !== user?.id || cached.workspaceId !== workspaceId) return null;
  if (Date.now() - Number(cached.savedAt || 0) > DASHBOARD_VIEW_CACHE_TTL_MS) return null;
  return Array.isArray(cached.professionals) ? cached.professionals : null;
}

function writeProfessionalsSnapshot(user, professionals) {
  writeJsonCache(DASHBOARD_PROFESSIONALS_CACHE_KEY, {
    userId: user?.id || "",
    workspaceId: user?.currentWorkspaceId || user?.currentWorkspace?.id || "",
    savedAt: Date.now(),
    professionals
  });
}

function bestClientFrom(appointments, sales = [], subscriptionCycles = []) {
  const totals = new Map();

  appointments
    .filter((appointment) => appointment.status === "concluido")
    .forEach((appointment) => {
      const name = appointment.client?.name || "Cliente";
      const current = totals.get(name) || { name, total: 0, count: 0 };
      current.total += Number(appointment.price || 0);
      current.count += 1;
      totals.set(name, current);
    });

  sales
    .filter((sale) => sale.clientName)
    .forEach((sale) => {
      const name = sale.clientName;
      const current = totals.get(name) || { name, total: 0, count: 0 };
      current.total += Number(sale.total || 0);
      current.count += 1;
      totals.set(name, current);
    });

  subscriptionCycles
    .filter((cycle) => cycle.status === "paid")
    .forEach((cycle) => {
      const name = cycle.clientName || "Cliente";
      const current = totals.get(name) || { name, total: 0, count: 0 };
      current.total += Number(cycle.amount || 0);
      current.count += 1;
      totals.set(name, current);
    });

  return [...totals.values()].sort((first, second) => second.total - first.total)[0] || null;
}

function bestDayFrom(appointments, sales = [], subscriptionCycles = []) {
  const totals = new Map();

  appointments
    .filter((appointment) => appointment.status === "concluido")
    .forEach((appointment) => {
      const current = totals.get(appointment.date) || 0;
      totals.set(appointment.date, current + Number(appointment.price || 0));
    });

  sales.forEach((sale) => {
    const current = totals.get(sale.date) || 0;
    totals.set(sale.date, current + Number(sale.total || 0));
  });

  subscriptionCycles
    .filter((cycle) => cycle.status === "paid" && cycle.paidAt)
    .forEach((cycle) => {
      const current = totals.get(cycle.paidAt) || 0;
      totals.set(cycle.paidAt, current + Number(cycle.amount || 0));
    });

  const best = [...totals.entries()].sort((first, second) => second[1] - first[1])[0];
  if (!best) return null;

  return {
    date: best[0],
    total: best[1],
    label: weekdayFormatter.format(parseDate(best[0]))
  };
}

function InsightCard({ label, value, detail, tone = "blue" }) {
  const toneClass =
    tone === "green"
      ? "bg-[#D1FAE5] text-success"
      : tone === "red"
        ? "bg-red-50 text-red-700"
        : "bg-[#DBEAFE] text-brand";

  return (
    <article className="group rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-soft active:scale-[0.99]">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${toneClass}`}>
        {label}
      </span>
      <p className="mt-3 text-base font-black leading-6 text-ink">{value}</p>
      {detail ? <p className="mt-2 text-sm font-medium leading-6 text-muted">{detail}</p> : null}
    </article>
  );
}

function LoadingValue({ loading, children, className = "h-7 w-28" }) {
  if (!loading) return children;

  return (
    <span
      className={`skeleton-line inline-block max-w-full rounded-full align-middle ${className}`}
      aria-label="Carregando"
    />
  );
}

export default function Dashboard() {
  const {
    selectedProfessionalId,
    setSelectedProfessionalId,
    period: workspacePeriod,
    setPeriod: setWorkspacePeriod,
    canManageWorkspace,
    isProfessional,
    viewReady
  } = useWorkspaceView();
  const { user } = useAuth();
  const canUseProfessionalFilters = canUsePlanFeature(user, PLAN_FEATURES.PROFESSIONAL_FILTERS);
  const canUseTeamComparison = canUsePlanFeature(user, PLAN_FEATURES.TEAM_COMPARISON);
  const initialRange = rangeForPeriod(workspacePeriod || "today");
  const [filters, setFilters] = useState({
    period: workspacePeriod || "today",
    startDate: initialRange.startDate,
    endDate: initialRange.endDate,
    professionalId: selectedProfessionalId || ""
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [data, setData] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [teamAppointments, setTeamAppointments] = useState([]);
  const [previousAppointments, setPreviousAppointments] = useState([]);
  const [previousSales, setPreviousSales] = useState([]);
  const [previousExpenses, setPreviousExpenses] = useState([]);
  const [previousSubscriptions, setPreviousSubscriptions] = useState([]);
  const [tomorrowAppointments, setTomorrowAppointments] = useState([]);
  const [monthlyGoal, setMonthlyGoal] = useState(() => readMonthlyGoal());
  const [goalDraft, setGoalDraft] = useState(() => String(readMonthlyGoal()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const lastLoadedFiltersKey = useRef("");
  const { showToast } = useToast();
  const { progress } = useOnboarding();

  function applyDashboardSnapshot(snapshot) {
    setData(snapshot.data || null);
    setPreviousAppointments(snapshot.previousAppointments || []);
    setTeamAppointments(snapshot.teamAppointments || []);
    setPreviousSales(snapshot.previousSales || []);
    setPreviousExpenses(snapshot.previousExpenses || []);
    setPreviousSubscriptions(snapshot.previousSubscriptions || []);
    setTomorrowAppointments(snapshot.tomorrowAppointments || []);
  }

  async function load(nextFilters = appliedFilters) {
    lastLoadedFiltersKey.current = filterKey(nextFilters);
    const cachedSnapshot = readDashboardSnapshot(user, nextFilters);
    if (cachedSnapshot) {
      applyDashboardSnapshot(cachedSnapshot);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const comparisonRange = previousRange(nextFilters);
      const tomorrow = formatInputDate(addDays(parseDate(rangeForPeriod("today").endDate), 1));
      const effectiveProfessionalId = canUseProfessionalFilters ? nextFilters.professionalId || "" : "";
      const scopedParams = effectiveProfessionalId ? { professionalId: effectiveProfessionalId } : {};

      try {
        const overview = await api.dashboardOverview({
          startDate: nextFilters.startDate,
          endDate: nextFilters.endDate,
          comparisonStartDate: comparisonRange.startDate,
          comparisonEndDate: comparisonRange.endDate,
          tomorrowDate: tomorrow,
          includeTeam: Boolean(canManageWorkspace && canUseTeamComparison && effectiveProfessionalId),
          ...scopedParams
        });

        if (overview?.dashboard) {
          const dashboardData = overview.dashboard;
          const periodAppointments = overview.appointments?.period || [];
          const previousPeriodAppointments = overview.appointments?.previous || [];
          const periodExpenses = overview.expenses?.period || [];
          const periodSales = overview.sales?.period || [];
          const periodSubscriptions = overview.subscriptions?.period || [];
          const daySubscriptions = overview.subscriptions?.day || [];
          const monthExpenses = overview.expenses?.month || [];
          const monthSales = overview.sales?.month || [];
          const monthSubscriptions = overview.subscriptions?.month || [];
          const comparisonExpenses = overview.expenses?.comparison || [];
          const comparisonSales = overview.sales?.comparison || [];
          const comparisonSubscriptions = overview.subscriptions?.comparison || [];
          const currentSubscriptionSummary = overview.subscriptions?.summary || {};
          const tomorrowPeriodAppointments = overview.appointments?.tomorrow || [];
          const daySales = periodSales.filter((sale) => sale.date === nextFilters.endDate);
          const dayExpenses = periodExpenses.filter((expense) => expense.date === nextFilters.endDate);
          const servicesPeriod = earnedCompleted(periodAppointments);
          const productsPeriod = sumProductSales(periodSales);
          const subscriptionsPeriod = sumPaidSubscriptionCycles(periodSubscriptions);
          const isProfessionalScope = Boolean(effectiveProfessionalId);
          const visibleProductsPeriod = isProfessionalScope ? 0 : productsPeriod;
          const visibleSubscriptionsPeriod = isProfessionalScope ? 0 : subscriptionsPeriod;
          const grossPeriod = servicesPeriod + visibleProductsPeriod + visibleSubscriptionsPeriod;
          const totalExpensesPeriod = isProfessionalScope ? 0 : sumExpenses(periodExpenses);
          const servicesDay = dashboardData.earnedToday;
          const productsDay = sumProductSales(daySales);
          const subscriptionsDay = sumPaidSubscriptionCycles(daySubscriptions);
          const visibleProductsDay = isProfessionalScope ? 0 : productsDay;
          const visibleSubscriptionsDay = isProfessionalScope ? 0 : subscriptionsDay;
          const grossDay = servicesDay + visibleProductsDay + visibleSubscriptionsDay;
          const totalExpensesDay = isProfessionalScope ? 0 : sumExpenses(dayExpenses);
          const servicesMonth = dashboardData.earnedMonth;
          const productsMonth = sumProductSales(monthSales);
          const subscriptionsMonth = sumPaidSubscriptionCycles(monthSubscriptions);
          const visibleProductsMonth = isProfessionalScope ? 0 : productsMonth;
          const visibleSubscriptionsMonth = isProfessionalScope ? 0 : subscriptionsMonth;
          const grossMonth = servicesMonth + visibleProductsMonth + visibleSubscriptionsMonth;
          const totalExpensesMonth = isProfessionalScope ? 0 : sumExpenses(monthExpenses);

          const snapshot = {
            data: {
            ...dashboardData,
            appointmentsToday: periodAppointments.length,
            earnedToday: grossPeriod,
            servicesPeriod,
            productsPeriod: visibleProductsPeriod,
            subscriptionsPeriod: visibleSubscriptionsPeriod,
            grossPeriod,
            expensesPeriod: totalExpensesPeriod,
            netPeriod: grossPeriod - totalExpensesPeriod,
            servicesDay,
            productsDay: visibleProductsDay,
            subscriptionsDay: visibleSubscriptionsDay,
            grossDay,
            expensesDay: totalExpensesDay,
            netDay: grossDay - totalExpensesDay,
            servicesMonth,
            productsMonth: visibleProductsMonth,
            subscriptionsMonth: visibleSubscriptionsMonth,
            grossMonth,
            expensesMonth: totalExpensesMonth,
            netMonth: grossMonth - totalExpensesMonth,
            todayAppointments: periodAppointments,
            productSales: isProfessionalScope ? [] : periodSales,
            subscriptionCycles: isProfessionalScope ? [] : periodSubscriptions,
            subscriptionSummary: isProfessionalScope
              ? { activeCount: 0, pending: 0, overdue: 0, expected: 0, received: 0 }
              : currentSubscriptionSummary
            },
            previousAppointments: previousPeriodAppointments,
            teamAppointments: overview.appointments?.team || periodAppointments,
            previousSales: isProfessionalScope ? [] : comparisonSales,
            previousExpenses: isProfessionalScope ? [] : comparisonExpenses,
            previousSubscriptions: isProfessionalScope ? [] : comparisonSubscriptions,
            tomorrowAppointments: tomorrowPeriodAppointments
          };
          applyDashboardSnapshot(snapshot);
          writeDashboardSnapshot(user, nextFilters, snapshot);
          return;
        }
      } catch (overviewError) {
        // Mantem compatibilidade apenas com backends antigos que ainda nao tenham /dashboard/overview.
        if (overviewError?.status !== 404) {
          throw overviewError;
        }
      }

      const [dashboardData, appointmentsData, previousData, tomorrowData, teamData] = await Promise.all([
        api.dashboard({ date: nextFilters.endDate, ...scopedParams }),
        api.listAppointments({
          startDate: nextFilters.startDate,
          endDate: nextFilters.endDate,
          ...scopedParams
        }),
        api.listAppointments({
          startDate: comparisonRange.startDate,
          endDate: comparisonRange.endDate,
          status: "concluido",
          ...scopedParams
        }),
        api.listAppointments({ date: tomorrow, ...scopedParams }),
        canManageWorkspace && canUseTeamComparison && effectiveProfessionalId
          ? api.listAppointments({
              startDate: nextFilters.startDate,
              endDate: nextFilters.endDate
            })
          : Promise.resolve(null)
      ]);

      const monthRange = monthRangeUntil(nextFilters.endDate);
      const fallbackProfessionalScope = Boolean(effectiveProfessionalId);
      const [
        periodExpenses,
        periodSales,
        periodSubscriptions,
        daySubscriptions,
        monthExpenses,
        monthSales,
        monthSubscriptions,
        comparisonExpenses,
        comparisonSales,
        comparisonSubscriptions,
        currentSubscriptionSummary
      ] = await Promise.all([
        fallbackProfessionalScope ? Promise.resolve([]) : listExpenses({
          startDate: nextFilters.startDate,
          endDate: nextFilters.endDate
        }),
        fallbackProfessionalScope ? Promise.resolve([]) : listProductSales({
          startDate: nextFilters.startDate,
          endDate: nextFilters.endDate
        }),
        fallbackProfessionalScope ? Promise.resolve([]) : listSubscriptionCycles({
          startDate: nextFilters.startDate,
          endDate: nextFilters.endDate
        }),
        fallbackProfessionalScope ? Promise.resolve([]) : listSubscriptionCycles({
          startDate: nextFilters.endDate,
          endDate: nextFilters.endDate
        }),
        fallbackProfessionalScope ? Promise.resolve([]) : listExpenses(monthRange),
        fallbackProfessionalScope ? Promise.resolve([]) : listProductSales(monthRange),
        fallbackProfessionalScope ? Promise.resolve([]) : listSubscriptionCycles(monthRange),
        fallbackProfessionalScope ? Promise.resolve([]) : listExpenses(comparisonRange),
        fallbackProfessionalScope ? Promise.resolve([]) : listProductSales(comparisonRange),
        fallbackProfessionalScope ? Promise.resolve([]) : listSubscriptionCycles(comparisonRange),
        fallbackProfessionalScope
          ? Promise.resolve({ activeCount: 0, pending: 0, overdue: 0, expected: 0, received: 0 })
          : subscriptionSummary({ month: nextFilters.endDate.slice(0, 7) })
      ]);

      const daySales = periodSales.filter((sale) => sale.date === nextFilters.endDate);
      const dayExpenses = periodExpenses.filter((expense) => expense.date === nextFilters.endDate);
      const servicesPeriod = earnedCompleted(appointmentsData.appointments);
      const productsPeriod = sumProductSales(periodSales);
      const subscriptionsPeriod = sumPaidSubscriptionCycles(periodSubscriptions);
      const isProfessionalScope = Boolean(effectiveProfessionalId);
      const visibleProductsPeriod = isProfessionalScope ? 0 : productsPeriod;
      const visibleSubscriptionsPeriod = isProfessionalScope ? 0 : subscriptionsPeriod;
      const grossPeriod = servicesPeriod + visibleProductsPeriod + visibleSubscriptionsPeriod;
      const totalExpensesPeriod = isProfessionalScope ? 0 : sumExpenses(periodExpenses);
      const servicesDay = dashboardData.earnedToday;
      const productsDay = sumProductSales(daySales);
      const subscriptionsDay = sumPaidSubscriptionCycles(daySubscriptions);
      const visibleProductsDay = isProfessionalScope ? 0 : productsDay;
      const visibleSubscriptionsDay = isProfessionalScope ? 0 : subscriptionsDay;
      const grossDay = servicesDay + visibleProductsDay + visibleSubscriptionsDay;
      const totalExpensesDay = isProfessionalScope ? 0 : sumExpenses(dayExpenses);
      const servicesMonth = dashboardData.earnedMonth;
      const productsMonth = sumProductSales(monthSales);
      const subscriptionsMonth = sumPaidSubscriptionCycles(monthSubscriptions);
      const visibleProductsMonth = isProfessionalScope ? 0 : productsMonth;
      const visibleSubscriptionsMonth = isProfessionalScope ? 0 : subscriptionsMonth;
      const grossMonth = servicesMonth + visibleProductsMonth + visibleSubscriptionsMonth;
      const totalExpensesMonth = isProfessionalScope ? 0 : sumExpenses(monthExpenses);

      const snapshot = {
        data: {
        ...dashboardData,
        appointmentsToday: appointmentsData.appointments.length,
        earnedToday: grossPeriod,
        servicesPeriod,
        productsPeriod: visibleProductsPeriod,
        subscriptionsPeriod: visibleSubscriptionsPeriod,
        grossPeriod,
        expensesPeriod: totalExpensesPeriod,
        netPeriod: grossPeriod - totalExpensesPeriod,
        servicesDay,
        productsDay: visibleProductsDay,
        subscriptionsDay: visibleSubscriptionsDay,
        grossDay,
        expensesDay: totalExpensesDay,
        netDay: grossDay - totalExpensesDay,
        servicesMonth,
        productsMonth: visibleProductsMonth,
        subscriptionsMonth: visibleSubscriptionsMonth,
        grossMonth,
        expensesMonth: totalExpensesMonth,
        netMonth: grossMonth - totalExpensesMonth,
        todayAppointments: appointmentsData.appointments,
        productSales: isProfessionalScope ? [] : periodSales,
        subscriptionCycles: isProfessionalScope ? [] : periodSubscriptions,
        subscriptionSummary: isProfessionalScope
          ? { activeCount: 0, pending: 0, overdue: 0, expected: 0, received: 0 }
          : currentSubscriptionSummary
        },
        previousAppointments: previousData.appointments,
        teamAppointments: teamData?.appointments || appointmentsData.appointments,
        previousSales: isProfessionalScope ? [] : comparisonSales,
        previousExpenses: isProfessionalScope ? [] : comparisonExpenses,
        previousSubscriptions: isProfessionalScope ? [] : comparisonSubscriptions,
        tomorrowAppointments: tomorrowData.appointments
      };
      applyDashboardSnapshot(snapshot);
      writeDashboardSnapshot(user, nextFilters, snapshot);
    } catch (err) {
      setData(null);
      setTeamAppointments([]);
      setPreviousAppointments([]);
      setPreviousSales([]);
      setPreviousExpenses([]);
      setPreviousSubscriptions([]);
      setTomorrowAppointments([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!viewReady) return;

    const nextPeriod = workspacePeriod || "today";
    const range = nextPeriod === "custom" ? filters : rangeForPeriod(nextPeriod);
    const next = {
      period: nextPeriod,
      startDate: range.startDate,
      endDate: range.endDate,
      professionalId: canUseProfessionalFilters ? selectedProfessionalId || "" : ""
    };
    const nextKey = filterKey(next);

    if (nextKey !== filterKey(filters)) {
      setFilters(next);
      setAppliedFilters(next);
    }

    if (nextKey === lastLoadedFiltersKey.current) {
      return;
    }

    load(next);
  }, [canUseProfessionalFilters, selectedProfessionalId, viewReady, workspacePeriod]);

  useEffect(() => {
    if (!viewReady) return undefined;
    let ignore = false;
    const cachedProfessionals = readProfessionalsSnapshot(user);
    if (cachedProfessionals) setProfessionals(cachedProfessionals);

    async function loadProfessionals() {
      try {
        const result = await listProfessionals({ active: true });
        if (!ignore) {
          const nextProfessionals = result.professionals || [];
          setProfessionals(nextProfessionals);
          writeProfessionalsSnapshot(user, nextProfessionals);
        }
      } catch {
        if (!ignore && !cachedProfessionals) setProfessionals([]);
      }
    }

    loadProfessionals();

    return () => {
      ignore = true;
    };
  }, [user, viewReady]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function applyFilters() {
    const next = canUseProfessionalFilters ? filters : { ...filters, professionalId: "" };
    setWorkspacePeriod(filters.period);
    setSelectedProfessionalId(next.professionalId);
    setAppliedFilters(next);
    load(next);
  }

  function resetFilters() {
    const range = rangeForPeriod("today");
    const next = {
      period: "today",
      startDate: range.startDate,
      endDate: range.endDate,
      professionalId: isProfessional || canUseProfessionalFilters ? selectedProfessionalId || "" : ""
    };
    setWorkspacePeriod(next.period);
    setSelectedProfessionalId(next.professionalId);
    setFilters(next);
    setAppliedFilters(next);
    load(next);
  }

  function saveMonthlyGoal() {
    const value = Number(goalDraft);
    if (!Number.isFinite(value) || value <= 0) {
      showToast("Informe uma meta maior que zero.", "error");
      return;
    }

    localStorage.setItem(MONTHLY_GOAL_KEY, String(value));
    setMonthlyGoal(value);
    showToast("Meta mensal atualizada.");
  }

  const isInitialLoading = !data;
  const isRefreshing = loading && Boolean(data);
  const dashboard = data || EMPTY_DASHBOARD_DATA;
  const periodAppointments = dashboard.todayAppointments || [];
  const periodSales = dashboard.productSales || [];
  const periodSubscriptions = dashboard.subscriptionCycles || [];
  const isScopedView = Boolean(appliedFilters.professionalId);
  const viewLabel = selectedProfessionalLabel(appliedFilters.professionalId, professionals);
  const recurring = dashboard.subscriptionSummary || EMPTY_SUBSCRIPTION_SUMMARY;
  const previousEarned = earnedCompleted(previousAppointments);
  const previousNet =
    previousEarned + sumProductSales(previousSales) + sumPaidSubscriptionCycles(previousSubscriptions) - sumExpenses(previousExpenses);
  const growth =
    previousNet > 0 && data
      ? Math.round(((dashboard.netPeriod - previousNet) / previousNet) * 100)
      : null;
  const cancellations = periodAppointments.filter((appointment) => appointment.status === "cancelado").length;
  const tomorrowBooked = tomorrowAppointments.filter((appointment) => appointment.status !== "cancelado").length;
  const freeTomorrowSlots = Math.max(0, WORKDAY_SLOTS - tomorrowBooked);
  const bestClient = useMemo(
    () => bestClientFrom(periodAppointments, periodSales, periodSubscriptions),
    [periodAppointments, periodSales, periodSubscriptions]
  );
  const bestDay = useMemo(
    () => bestDayFrom(periodAppointments, periodSales, periodSubscriptions),
    [periodAppointments, periodSales, periodSubscriptions]
  );
  const goalProgress = data ? Math.min((dashboard.netMonth / monthlyGoal) * 100, 100) : 0;
  const goalRemaining = data ? Math.max(monthlyGoal - dashboard.netMonth, 0) : monthlyGoal;
  const netMargin = data && dashboard.grossPeriod > 0 ? Math.round((dashboard.netPeriod / dashboard.grossPeriod) * 100) : 0;
  const teamComparison = useMemo(
    () => buildTeamComparison(teamAppointments, professionals, monthlyGoal),
    [monthlyGoal, professionals, teamAppointments]
  );
  const selectedProfessionalStats = isScopedView
    ? teamComparison.find((row) => row.id === appliedFilters.professionalId)
    : null;
  const topProfessional = teamComparison[0] || null;
  const scopedTicket = selectedProfessionalStats?.averageTicket || 0;
  const contextualGoalProgress = selectedProfessionalStats
    ? Math.min(selectedProfessionalStats.goalProgress, 100)
    : goalProgress;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumo por período, próximos horários e faturamento confirmado."
      />

      <Message type="error" actionLabel="Tentar novamente" onAction={() => load(appliedFilters)}>
        {error}
      </Message>
      <Message>{isRefreshing ? "Atualizando indicadores do dashboard..." : ""}</Message>

      <FilterBar
        title="Filtrar dashboard"
        description="Escolha o período para atualizar indicadores, insights e agenda exibida."
        period={filters.period}
        startDate={filters.startDate}
        endDate={filters.endDate}
        professionalValue={canUseProfessionalFilters ? filters.professionalId : ""}
        professionalOptions={professionals}
        professionalDisabled={!canManageWorkspace || !canUseProfessionalFilters}
        professionalAllLabel="Todos os profissionais"
        onProfessionalChange={(value) => updateFilter("professionalId", value)}
        onPeriodChange={(value) => updateFilter("period", value)}
        onStartDateChange={(value) => updateFilter("startDate", value)}
        onEndDateChange={(value) => updateFilter("endDate", value)}
        onSubmit={applyFilters}
        onClear={resetFilters}
        resultLabel={resultLabelFor(
          canUseProfessionalFilters ? appliedFilters : { ...appliedFilters, professionalId: "" },
          professionals
        )}
      />

      {!isInitialLoading && !progress.hasSeenWelcome ? <FirstStepsCard /> : null}
      <InstallAppCard />

      <>
          <section className="grid gap-3 lg:hidden">
            <article className="rounded-[24px] border border-blue-200/70 bg-blue-50/80 p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Líquido hoje</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-blue-800">
                <LoadingValue loading={isInitialLoading} className="h-9 w-32">{money(dashboard.netDay)}</LoadingValue>
              </p>
              <p className="mt-1 text-xs font-bold text-blue-700/80">
                Entradas <LoadingValue loading={isInitialLoading} className="h-3 w-16">{money(dashboard.grossDay)}</LoadingValue> · Saídas{" "}
                <LoadingValue loading={isInitialLoading} className="h-3 w-16">{money(dashboard.expensesDay)}</LoadingValue>
              </p>
            </article>

            <div className="grid grid-cols-2 gap-3">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-soft">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Atendimentos</p>
                <p className="mt-1 text-2xl font-black text-ink">
                  <LoadingValue loading={isInitialLoading} className="h-7 w-10">{dashboard.appointmentsToday}</LoadingValue>
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-soft">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Próximo</p>
                <p className="mt-1 text-2xl font-black text-brand">
                  <LoadingValue loading={isInitialLoading} className="h-7 w-16">
                    {dashboard.nextAppointment ? dashboard.nextAppointment.startTime : "Livre"}
                  </LoadingValue>
                </p>
              </article>
            </div>
          </section>

          <section className="hidden overflow-hidden rounded-[32px] border border-slate-200/80 bg-slate-50/80 p-6 shadow-[0_28px_70px_rgba(15,23,42,0.08)] sm:p-8 lg:block">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,460px)_250px] xl:items-stretch">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">Resumo do período</p>
                <h2 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
                  Controle sua agenda e seus ganhos em tempo real.
                </h2>
                <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-slate-600">
                  Em {periodLabel(appliedFilters).toLowerCase()}, entraram{" "}
                  <LoadingValue loading={isInitialLoading} className="h-4 w-20">{money(dashboard.grossPeriod)}</LoadingValue>, saíram{" "}
                  <LoadingValue loading={isInitialLoading} className="h-4 w-20">{money(dashboard.expensesPeriod)}</LoadingValue> e sobraram{" "}
                  <LoadingValue loading={isInitialLoading} className="h-4 w-20">{money(dashboard.netPeriod)}</LoadingValue>.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">Meta mensal líquida</p>
                    <h3 className="mt-2 text-3xl font-black tracking-tight text-ink">
                      <LoadingValue loading={isInitialLoading} className="h-9 w-36">{money(dashboard.netMonth)}</LoadingValue>
                    </h3>
                    <p className="mt-1 text-sm font-bold text-slate-500">de {money(monthlyGoal)} definidos para este mês</p>
                  </div>
                  <span className="rounded-full bg-[#DBEAFE] px-3 py-1 text-sm font-black text-brand">
                    <LoadingValue loading={isInitialLoading} className="h-5 w-9">{Math.round(goalProgress)}%</LoadingValue>
                  </span>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-700 ease-out"
                    style={{ width: `${goalProgress}%` }}
                  />
                </div>
                <p className="mt-4 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
                  Faltam <LoadingValue loading={isInitialLoading} className="h-4 w-24">{money(goalRemaining)}</LoadingValue> para bater a meta.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    type="number"
                    min="1"
                    step="50"
                    value={goalDraft}
                    onChange={(event) => setGoalDraft(event.target.value)}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-bold text-ink shadow-sm transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                    aria-label="Editar meta mensal"
                  />
                  <Button size="sm" onClick={saveMonthlyGoal}>
                    Salvar
                  </Button>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Líquido do período</p>
                <p className="mt-2 text-4xl font-extrabold text-success">
                  <LoadingValue loading={isInitialLoading} className="h-10 w-36">{money(dashboard.netPeriod)}</LoadingValue>
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  <LoadingValue loading={isInitialLoading} className="h-4 w-44">{freeTomorrowSlots} horário(s) livre(s) amanhã</LoadingValue>
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              to="/agenda"
              label={isScopedView ? `Faturamento de ${viewLabel}` : "Faturamento geral"}
              value={<LoadingValue loading={isInitialLoading} className="h-8 w-24">{money(dashboard.servicesPeriod)}</LoadingValue>}
              detail={
                <LoadingValue loading={isInitialLoading} className="h-3 w-32">
                  {`${dashboard.appointmentsToday} atendimento(s) no recorte`}
                </LoadingValue>
              }
              icon="agenda"
              tone="blue"
            />
            <StatCard
              to="/agenda"
              label="Atendimentos"
              value={<LoadingValue loading={isInitialLoading} className="h-8 w-10">{dashboard.appointmentsToday}</LoadingValue>}
              detail={isScopedView ? `Agenda de ${viewLabel}` : "Todos os profissionais"}
              icon="dashboard"
              tone="default"
            />
            <StatCard
              label={isScopedView ? "Ticket medio" : "Top profissional"}
              value={
                <LoadingValue loading={isInitialLoading} className="h-8 w-28">
                  {isScopedView ? money(scopedTicket) : topProfessional?.name || "Sem ranking"}
                </LoadingValue>
              }
              detail={
                isInitialLoading ? (
                  <LoadingValue loading className="h-3 w-32">Carregando</LoadingValue>
                ) : isScopedView ? (
                  "Media dos atendimentos concluidos"
                ) : topProfessional ? (
                  money(topProfessional.revenue)
                ) : (
                  "Conclua atendimentos para medir"
                )
              }
              icon="finance"
              tone="leaf"
            />
            <StatCard
              label={isScopedView ? "Meta do profissional" : "Meta da equipe"}
              value={
                <LoadingValue loading={isInitialLoading} className="h-8 w-14">
                  {`${Math.round(contextualGoalProgress)}%`}
                </LoadingValue>
              }
              detail={isScopedView ? `Base: ${money(selectedProfessionalStats?.goal || 0)}` : `Base mensal: ${money(monthlyGoal)}`}
              icon="finance"
              tone="blue"
            />
            <StatCard
              to={isScopedView ? "/agenda" : "/financeiro"}
              label={isScopedView ? "Cancelamentos" : "Liquido no periodo"}
              value={
                <LoadingValue loading={isInitialLoading} className="h-8 w-24">
                  {isScopedView ? cancellations : money(dashboard.netPeriod)}
                </LoadingValue>
              }
              detail={
                <LoadingValue loading={isInitialLoading} className="h-3 w-28">
                  {isScopedView ? "No periodo selecionado" : `Margem ${netMargin}% do periodo`}
                </LoadingValue>
              }
              tone={isScopedView && cancellations ? "expense" : "leaf"}
            />
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Previsto no mes</p>
              <p className="mt-2 text-2xl font-black text-brand">
                <LoadingValue loading={isInitialLoading} className="h-7 w-28">{money(recurring.expected)}</LoadingValue>
              </p>
              <p className="mt-1 text-xs font-bold text-muted">
                <LoadingValue loading={isInitialLoading} className="h-3 w-32">{recurring.activeCount} mensalista(s) ativo(s)</LoadingValue>
              </p>
            </article>
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Realizado</p>
              <p className="mt-2 text-2xl font-black text-success">
                <LoadingValue loading={isInitialLoading} className="h-7 w-28">{money(recurring.received)}</LoadingValue>
              </p>
              <p className="mt-1 text-xs font-bold text-muted">Concluido ou pago</p>
            </article>
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Pendente</p>
              <p className="mt-2 text-2xl font-black text-ink">
                <LoadingValue loading={isInitialLoading} className="h-7 w-28">
                  {money(recurring.pendingAmount || Math.max((recurring.expected || 0) - (recurring.received || 0), 0))}
                </LoadingValue>
              </p>
              <p className="mt-1 text-xs font-bold text-muted">
                <LoadingValue loading={isInitialLoading} className="h-3 w-28">{recurring.pending} competencia(s)</LoadingValue>
              </p>
            </article>
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Atrasadas</p>
              <p className="mt-2 text-2xl font-black text-red-600">
                <LoadingValue loading={isInitialLoading} className="h-7 w-10">{recurring.overdue}</LoadingValue>
              </p>
              <p className="mt-1 text-xs font-bold text-muted">Mensalidades vencidas</p>
            </article>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-panel">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Hoje</p>
              <p className="mt-2 text-sm font-bold text-muted">Serviços <LoadingValue loading={isInitialLoading} className="h-4 w-20">{money(dashboard.servicesDay)}</LoadingValue></p>
              <p className="mt-1 text-sm font-bold text-muted">Produtos <LoadingValue loading={isInitialLoading} className="h-4 w-20">{money(dashboard.productsDay)}</LoadingValue></p>
              <p className="mt-1 text-sm font-bold text-muted">Mensalidades <LoadingValue loading={isInitialLoading} className="h-4 w-20">{money(dashboard.subscriptionsDay)}</LoadingValue></p>
              <p className="mt-1 text-sm font-bold text-red-600">Despesas <LoadingValue loading={isInitialLoading} className="h-4 w-20">{money(dashboard.expensesDay)}</LoadingValue></p>
              <p className="mt-3 text-2xl font-black text-success">Líquido <LoadingValue loading={isInitialLoading} className="h-7 w-28">{money(dashboard.netDay)}</LoadingValue></p>
            </article>
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-panel">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Mês</p>
              <p className="mt-2 text-sm font-bold text-muted">Serviços <LoadingValue loading={isInitialLoading} className="h-4 w-20">{money(dashboard.servicesMonth)}</LoadingValue></p>
              <p className="mt-1 text-sm font-bold text-muted">Produtos <LoadingValue loading={isInitialLoading} className="h-4 w-20">{money(dashboard.productsMonth)}</LoadingValue></p>
              <p className="mt-1 text-sm font-bold text-muted">Mensalidades <LoadingValue loading={isInitialLoading} className="h-4 w-20">{money(dashboard.subscriptionsMonth)}</LoadingValue></p>
              <p className="mt-1 text-sm font-bold text-red-600">Despesas <LoadingValue loading={isInitialLoading} className="h-4 w-20">{money(dashboard.expensesMonth)}</LoadingValue></p>
              <p className="mt-3 text-2xl font-black text-success">Líquido <LoadingValue loading={isInitialLoading} className="h-7 w-28">{money(dashboard.netMonth)}</LoadingValue></p>
            </article>
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-panel">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Agenda amanhã</p>
              <p className="mt-2 text-3xl font-black text-brand">
                <LoadingValue loading={isInitialLoading} className="h-9 w-24">{freeTomorrowSlots} livres</LoadingValue>
              </p>
              <p className="mt-1 text-sm font-bold text-muted">
                <LoadingValue loading={isInitialLoading} className="h-4 w-40">
                  {tomorrowBooked} ocupado(s) de {WORKDAY_SLOTS} horários
                </LoadingValue>
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                  style={{ width: `${Math.min((tomorrowBooked / WORKDAY_SLOTS) * 100, 100)}%` }}
                />
              </div>
            </article>
          </section>

          {canManageWorkspace && canUseTeamComparison && !isProfessional && teamComparison.length > 1 ? (
            <Card className="overflow-hidden">
              <CardHeader
                title="Comparativo da equipe"
                description="Ranking por profissional no periodo selecionado."
                action={
                  <span className="rounded-full bg-[#DBEAFE] px-3 py-1.5 text-xs font-black text-brand">
                    {viewLabel}
                  </span>
                }
              />
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full border-collapse text-left">
                  <thead className="bg-[#F8FAFC] text-xs font-black uppercase tracking-[0.14em] text-muted">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Profissional</th>
                      <th className="px-4 py-3">Faturamento</th>
                      <th className="px-4 py-3">Atendimentos</th>
                      <th className="px-4 py-3">Ticket medio</th>
                      <th className="px-4 py-3">Meta</th>
                      <th className="px-4 py-3">Cancelamentos</th>
                      <th className="px-4 py-3">Clientes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {teamComparison.map((professional, index) => (
                      <tr key={professional.id} className="transition hover:bg-[#F8FAFC]">
                        <td className="px-4 py-4 text-sm font-black text-brand">{index + 1}</td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-black text-ink">{professional.name}</p>
                          <p className="text-xs font-bold text-muted">{professional.role}</p>
                        </td>
                        <td className="px-4 py-4 text-sm font-black text-success">{money(professional.revenue)}</td>
                        <td className="px-4 py-4 text-sm font-bold text-ink">{professional.appointments}</td>
                        <td className="px-4 py-4 text-sm font-bold text-ink">{money(professional.averageTicket)}</td>
                        <td className="px-4 py-4">
                          <div className="min-w-[120px]">
                            <div className="flex items-center justify-between gap-2 text-xs font-black text-brand">
                              <span>{professional.goalProgress}%</span>
                              <span>{money(professional.goal)}</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                              <div
                                className="h-full rounded-full bg-success"
                                style={{ width: `${Math.min(professional.goalProgress, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-red-600">{professional.cancellations}</td>
                        <td className="px-4 py-4 text-sm font-bold text-ink">{professional.clientsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          <section className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
            <Card>
              <CardHeader title="Agenda do período" description={periodLabel(appliedFilters)} />
              <div className="compact-scroll-list divide-y divide-[#E2E8F0]">
                {isInitialLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <article
                      key={`appointment-loading-${index}`}
                      className="grid gap-3 p-4 md:grid-cols-[92px_minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="skeleton-line h-14 rounded-xl" />
                      <div className="min-w-0 space-y-2">
                        <div className="skeleton-line h-4 w-48 max-w-full rounded-full" />
                        <div className="skeleton-line h-3 w-32 max-w-full rounded-full" />
                      </div>
                      <div className="skeleton-line h-8 w-24 rounded-full" />
                    </article>
                  ))
                ) : periodAppointments.length ? (
                  periodAppointments.map((appointment) => (
                    <article
                      key={appointment.id}
                      className="grid cursor-pointer gap-3 p-4 transition duration-200 hover:bg-[#F8FAFC] active:bg-[#DBEAFE]/40 md:grid-cols-[92px_minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="rounded-xl bg-brand/10 px-3 py-2 text-brand md:text-center">
                        <p className="text-xl font-black">{appointment.startTime}</p>
                        <p className="text-xs font-bold">até {appointment.endTime}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-black text-ink">{appointment.client.name}</p>
                        <p className="text-sm font-bold text-muted">{appointment.service.name}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                        <StatusBadge status={appointment.status} />
                        <span className="font-black text-ink">{money(appointment.price)}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState title="Nenhum agendamento no período" description="Altere o filtro para visualizar outros horários." />
                )}
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-brand">Próximo horário</p>
              {isInitialLoading ? (
                <div className="mt-5 space-y-3">
                  <div className="skeleton-line h-12 w-24 rounded-full" />
                  <div className="space-y-2">
                    <div className="skeleton-line h-5 w-44 rounded-full" />
                    <div className="skeleton-line h-4 w-32 rounded-full" />
                  </div>
                  <div className="skeleton-line h-10 rounded-xl" />
                </div>
              ) : dashboard.nextAppointment ? (
                <div className="mt-5 space-y-3">
                  <p className="text-5xl font-black text-brand">{dashboard.nextAppointment.startTime}</p>
                  <div>
                    <p className="text-lg font-black text-ink">{dashboard.nextAppointment.client.name}</p>
                    <p className="text-sm text-muted">{dashboard.nextAppointment.service.name}</p>
                  </div>
                  <p className="rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm font-bold text-muted">
                    {dashboard.nextAppointment.date} · {money(dashboard.nextAppointment.price)}
                  </p>
                </div>
              ) : (
                <EmptyState title="Agenda tranquila" description="Nenhum atendimento futuro em aberto." />
              )}
            </Card>
          </section>

          <section>
            <Card className="p-0">
              <CardHeader title="Insights automáticos" description="Sinais rápidos para agir melhor durante a semana." />
              <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2">
                <InsightCard
                  label="Crescimento"
                  value={
                    <LoadingValue loading={isInitialLoading} className="h-5 w-40">
                      {growth !== null
                        ? `${growth >= 0 ? "+" : ""}${growth}% vs período anterior`
                        : "Sem base anterior suficiente"}
                    </LoadingValue>
                  }
                  detail="Comparação com o mesmo número de dias antes do período atual."
                  tone={growth !== null && growth >= 0 ? "green" : "blue"}
                />
                <InsightCard
                  label="Melhor dia"
                  value={
                    <LoadingValue loading={isInitialLoading} className="h-5 w-40">
                      {bestDay ? `${bestDay.label} foi seu melhor dia` : "Ainda sem melhor dia"}
                    </LoadingValue>
                  }
                  detail={
                    isInitialLoading ? (
                      <LoadingValue loading className="h-4 w-36">Carregando</LoadingValue>
                    ) : bestDay ? (
                      `${money(bestDay.total)} confirmado nesse dia.`
                    ) : (
                      "Conclua atendimentos para medir desempenho."
                    )
                  }
                />
                <InsightCard
                  label="Horários livres"
                  value={
                    <LoadingValue loading={isInitialLoading} className="h-5 w-36">
                      {`${freeTomorrowSlots} horário(s) livre(s) amanhã`}
                    </LoadingValue>
                  }
                  detail="Estimativa baseada em uma agenda comercial de 8 horários."
                />
                <InsightCard
                  label="Cancelamentos"
                  value={
                    <LoadingValue loading={isInitialLoading} className="h-5 w-36">
                      {`${cancellations} cancelamento(s) no período`}
                    </LoadingValue>
                  }
                  detail={cancellations ? "Vale tentar preencher esses espaços com clientes recorrentes." : "Boa previsibilidade para seu atendimento."}
                  tone={cancellations ? "red" : "green"}
                />
                <InsightCard
                  label="Cliente destaque"
                  value={
                    <LoadingValue loading={isInitialLoading} className="h-5 w-44">
                      {bestClient ? `${bestClient.name} · ${money(bestClient.total)}` : "Sem cliente destaque"}
                    </LoadingValue>
                  }
                  detail={
                    isInitialLoading ? (
                      <LoadingValue loading className="h-4 w-44">Carregando</LoadingValue>
                    ) : bestClient ? (
                      `${bestClient.count} movimentação(ões) com receita no período.`
                    ) : (
                      "O ranking aparece quando houver faturamento concluído."
                    )
                  }
                  tone="green"
                />
                <InsightCard
                  label="Produtos"
                  value={
                    <LoadingValue loading={isInitialLoading} className="h-5 w-32">
                      {`${money(dashboard.productsPeriod)} em vendas`}
                    </LoadingValue>
                  }
                  detail={
                    <LoadingValue loading={isInitialLoading} className="h-4 w-44">
                      {`${periodSales.length} venda(s) registrada(s) fora dos serviços.`}
                    </LoadingValue>
                  }
                />
              </div>
            </Card>

            <Card className="hidden">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Meta mensal líquida</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">{money(dashboard.netMonth)}</h2>
                  <p className="mt-1 text-sm font-medium text-muted">de {money(monthlyGoal)} definidos para este mês</p>
                </div>
                <span className="rounded-full bg-[#DBEAFE] px-3 py-1 text-sm font-black text-brand">
                  {Math.round(goalProgress)}%
                </span>
              </div>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#E2E8F0]">
                <div
                  className="h-full rounded-full bg-success transition-all duration-700 ease-out"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>

              <p className="mt-4 rounded-2xl bg-[#F8FAFC] px-3 py-2 text-sm font-bold text-muted">
                Faltam {money(goalRemaining)} para bater a meta.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-muted">Editar meta</span>
                  <input
                    type="number"
                    min="1"
                    step="50"
                    value={goalDraft}
                    onChange={(event) => setGoalDraft(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 text-sm font-bold text-ink shadow-sm transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                  />
                </label>
                <Button className="w-full self-end sm:w-auto" onClick={saveMonthlyGoal}>
                  Salvar
                </Button>
              </div>
            </Card>
          </section>
      </>
    </div>
  );
}

