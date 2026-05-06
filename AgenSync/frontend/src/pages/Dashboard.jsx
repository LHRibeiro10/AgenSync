import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import FilterBar, { periodLabel, rangeForPeriod } from "../components/FilterBar.jsx";
import InstallAppCard from "../components/InstallAppCard.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import FirstStepsCard from "../components/onboarding/FirstStepsCard.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../components/Toast.jsx";
import { useOnboarding } from "../contexts/OnboardingContext.jsx";
import { listExpenses, sumExpenses } from "../services/expenses.js";
import { listProductSales, sumProductSales } from "../services/products.js";
import { listSubscriptionCycles, subscriptionSummary, sumPaidSubscriptionCycles } from "../services/subscriptions.js";
import { money } from "../utils.js";

const MONTHLY_GOAL_KEY = "agensync_monthly_goal";
const DEFAULT_MONTHLY_GOAL = 3000;
const WORKDAY_SLOTS = 8;

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

function readMonthlyGoal() {
  const saved = Number(localStorage.getItem(MONTHLY_GOAL_KEY));
  return Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_MONTHLY_GOAL;
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

export default function Dashboard() {
  const initialRange = rangeForPeriod("today");
  const [filters, setFilters] = useState({
    period: "today",
    startDate: initialRange.startDate,
    endDate: initialRange.endDate
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [data, setData] = useState(null);
  const [previousAppointments, setPreviousAppointments] = useState([]);
  const [previousSales, setPreviousSales] = useState([]);
  const [previousExpenses, setPreviousExpenses] = useState([]);
  const [previousSubscriptions, setPreviousSubscriptions] = useState([]);
  const [tomorrowAppointments, setTomorrowAppointments] = useState([]);
  const [monthlyGoal, setMonthlyGoal] = useState(() => readMonthlyGoal());
  const [goalDraft, setGoalDraft] = useState(() => String(readMonthlyGoal()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const { progress } = useOnboarding();

  async function load(nextFilters = appliedFilters) {
    setLoading(true);
    setError("");

    try {
      const comparisonRange = previousRange(nextFilters);
      const tomorrow = formatInputDate(addDays(parseDate(rangeForPeriod("today").endDate), 1));

      const [dashboardData, appointmentsData, previousData, tomorrowData] = await Promise.all([
        api.dashboard({ date: nextFilters.endDate }),
        api.listAppointments({
          startDate: nextFilters.startDate,
          endDate: nextFilters.endDate
        }),
        api.listAppointments({
          startDate: comparisonRange.startDate,
          endDate: comparisonRange.endDate,
          status: "concluido"
        }),
        api.listAppointments({ date: tomorrow })
      ]);

      const monthRange = monthRangeUntil(nextFilters.endDate);
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
        listExpenses({
          startDate: nextFilters.startDate,
          endDate: nextFilters.endDate
        }),
        listProductSales({
          startDate: nextFilters.startDate,
          endDate: nextFilters.endDate
        }),
        listSubscriptionCycles({
          startDate: nextFilters.startDate,
          endDate: nextFilters.endDate
        }),
        listSubscriptionCycles({
          startDate: nextFilters.endDate,
          endDate: nextFilters.endDate
        }),
        listExpenses(monthRange),
        listProductSales(monthRange),
        listSubscriptionCycles(monthRange),
        listExpenses(comparisonRange),
        listProductSales(comparisonRange),
        listSubscriptionCycles(comparisonRange),
        subscriptionSummary({ month: nextFilters.endDate.slice(0, 7) })
      ]);

      const daySales = periodSales.filter((sale) => sale.date === nextFilters.endDate);
      const dayExpenses = periodExpenses.filter((expense) => expense.date === nextFilters.endDate);
      const servicesPeriod = earnedCompleted(appointmentsData.appointments);
      const productsPeriod = sumProductSales(periodSales);
      const subscriptionsPeriod = sumPaidSubscriptionCycles(periodSubscriptions);
      const grossPeriod = servicesPeriod + productsPeriod + subscriptionsPeriod;
      const totalExpensesPeriod = sumExpenses(periodExpenses);
      const servicesDay = dashboardData.earnedToday;
      const productsDay = sumProductSales(daySales);
      const subscriptionsDay = sumPaidSubscriptionCycles(daySubscriptions);
      const grossDay = servicesDay + productsDay + subscriptionsDay;
      const totalExpensesDay = sumExpenses(dayExpenses);
      const servicesMonth = dashboardData.earnedMonth;
      const productsMonth = sumProductSales(monthSales);
      const subscriptionsMonth = sumPaidSubscriptionCycles(monthSubscriptions);
      const grossMonth = servicesMonth + productsMonth + subscriptionsMonth;
      const totalExpensesMonth = sumExpenses(monthExpenses);

      setData({
        ...dashboardData,
        appointmentsToday: appointmentsData.appointments.length,
        earnedToday: grossPeriod,
        servicesPeriod,
        productsPeriod,
        subscriptionsPeriod,
        grossPeriod,
        expensesPeriod: totalExpensesPeriod,
        netPeriod: grossPeriod - totalExpensesPeriod,
        servicesDay,
        productsDay,
        subscriptionsDay,
        grossDay,
        expensesDay: totalExpensesDay,
        netDay: grossDay - totalExpensesDay,
        servicesMonth,
        productsMonth,
        subscriptionsMonth,
        grossMonth,
        expensesMonth: totalExpensesMonth,
        netMonth: grossMonth - totalExpensesMonth,
        todayAppointments: appointmentsData.appointments,
        productSales: periodSales,
        subscriptionCycles: periodSubscriptions,
        subscriptionSummary: currentSubscriptionSummary
      });
      setPreviousAppointments(previousData.appointments);
      setPreviousSales(comparisonSales);
      setPreviousExpenses(comparisonExpenses);
      setPreviousSubscriptions(comparisonSubscriptions);
      setTomorrowAppointments(tomorrowData.appointments);
    } catch (err) {
      setData(null);
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
    load(appliedFilters);
  }, []);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function applyFilters() {
    setAppliedFilters(filters);
    load(filters);
  }

  function resetFilters() {
    const range = rangeForPeriod("today");
    const next = {
      period: "today",
      startDate: range.startDate,
      endDate: range.endDate
    };
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

  const periodAppointments = data?.todayAppointments || [];
  const periodSales = data?.productSales || [];
  const periodSubscriptions = data?.subscriptionCycles || [];
  const recurring = data?.subscriptionSummary || { activeCount: 0, pending: 0, overdue: 0, expected: 0, received: 0 };
  const previousEarned = earnedCompleted(previousAppointments);
  const previousNet =
    previousEarned + sumProductSales(previousSales) + sumPaidSubscriptionCycles(previousSubscriptions) - sumExpenses(previousExpenses);
  const growth =
    previousNet > 0 && data
      ? Math.round(((data.netPeriod - previousNet) / previousNet) * 100)
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
  const goalProgress = data ? Math.min((data.netMonth / monthlyGoal) * 100, 100) : 0;
  const goalRemaining = data ? Math.max(monthlyGoal - data.netMonth, 0) : monthlyGoal;
  const netMargin = data && data.grossPeriod > 0 ? Math.round((data.netPeriod / data.grossPeriod) * 100) : 0;

  if (loading && !data && !error) return <Loading label="Carregando dashboard..." />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumo por período, próximos horários e faturamento confirmado."
      />

      <Message type="error" actionLabel="Tentar novamente" onAction={() => load(appliedFilters)}>
        {error}
      </Message>

      <FilterBar
        title="Filtrar dashboard"
        description="Escolha o período para atualizar indicadores, insights e agenda exibida."
        period={filters.period}
        startDate={filters.startDate}
        endDate={filters.endDate}
        onPeriodChange={(value) => updateFilter("period", value)}
        onStartDateChange={(value) => updateFilter("startDate", value)}
        onEndDateChange={(value) => updateFilter("endDate", value)}
        onSubmit={applyFilters}
        onClear={resetFilters}
        resultLabel={periodLabel(appliedFilters)}
      />

      {!progress.hasSeenWelcome ? <FirstStepsCard /> : null}
      <InstallAppCard />

      {data ? (
        <>
          <section className="grid gap-3 lg:hidden">
            <article className="rounded-[24px] border border-blue-200/70 bg-blue-50/80 p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Líquido hoje</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-blue-800">{money(data.netDay)}</p>
              <p className="mt-1 text-xs font-bold text-blue-700/80">
                Entradas {money(data.grossDay)} · Saídas {money(data.expensesDay)}
              </p>
            </article>

            <div className="grid grid-cols-2 gap-3">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-soft">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Atendimentos</p>
                <p className="mt-1 text-2xl font-black text-ink">{data.appointmentsToday}</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-soft">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Próximo</p>
                <p className="mt-1 text-2xl font-black text-brand">
                  {data.nextAppointment ? data.nextAppointment.startTime : "Livre"}
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
                  Em {periodLabel(appliedFilters).toLowerCase()}, entraram {money(data.grossPeriod)}, saíram {money(data.expensesPeriod)} e sobraram {money(data.netPeriod)}.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">Meta mensal líquida</p>
                    <h3 className="mt-2 text-3xl font-black tracking-tight text-ink">{money(data.netMonth)}</h3>
                    <p className="mt-1 text-sm font-bold text-slate-500">de {money(monthlyGoal)} definidos para este mês</p>
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
                <p className="mt-4 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
                  Faltam {money(goalRemaining)} para bater a meta.
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
                <p className="mt-2 text-4xl font-extrabold text-success">{money(data.netPeriod)}</p>
                <p className="mt-2 text-sm font-semibold text-slate-500">{freeTomorrowSlots} horário(s) livre(s) amanhã</p>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard to="/agenda" label="Serviços" value={money(data.servicesPeriod)} detail={`${data.appointmentsToday} atendimento(s)`} icon="agenda" tone="blue" />
            <StatCard to="/vendas" label="Produtos" value={money(data.productsPeriod)} detail={`${periodSales.length} venda(s)`} icon="products" tone="leaf" />
            <StatCard to="/mensalidades" label="Mensalidades" value={money(data.subscriptionsPeriod)} detail={`${recurring.activeCount} ativa(s)`} icon="finance" tone="blue" />
            <StatCard to="/despesas" label="Despesas no período" value={money(data.expensesPeriod)} tone="expense" />
            <StatCard
              to="/financeiro"
              label="Líquido no período"
              value={money(data.netPeriod)}
              detail={`Margem ${netMargin}% do período`}
              tone="leaf"
            />
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Mensalidades ativas</p>
              <p className="mt-2 text-2xl font-black text-brand">{recurring.activeCount}</p>
            </article>
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Pendentes</p>
              <p className="mt-2 text-2xl font-black text-ink">{recurring.pending}</p>
            </article>
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Atrasadas</p>
              <p className="mt-2 text-2xl font-black text-red-600">{recurring.overdue}</p>
            </article>
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Previsto no mês</p>
              <p className="mt-2 text-2xl font-black text-success">{money(recurring.expected)}</p>
            </article>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-panel">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Hoje</p>
              <p className="mt-2 text-sm font-bold text-muted">Serviços {money(data.servicesDay)}</p>
              <p className="mt-1 text-sm font-bold text-muted">Produtos {money(data.productsDay)}</p>
              <p className="mt-1 text-sm font-bold text-muted">Mensalidades {money(data.subscriptionsDay)}</p>
              <p className="mt-1 text-sm font-bold text-red-600">Despesas {money(data.expensesDay)}</p>
              <p className="mt-3 text-2xl font-black text-success">Líquido {money(data.netDay)}</p>
            </article>
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-panel">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Mês</p>
              <p className="mt-2 text-sm font-bold text-muted">Serviços {money(data.servicesMonth)}</p>
              <p className="mt-1 text-sm font-bold text-muted">Produtos {money(data.productsMonth)}</p>
              <p className="mt-1 text-sm font-bold text-muted">Mensalidades {money(data.subscriptionsMonth)}</p>
              <p className="mt-1 text-sm font-bold text-red-600">Despesas {money(data.expensesMonth)}</p>
              <p className="mt-3 text-2xl font-black text-success">Líquido {money(data.netMonth)}</p>
            </article>
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-panel">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Agenda amanhã</p>
              <p className="mt-2 text-3xl font-black text-brand">{freeTomorrowSlots} livres</p>
              <p className="mt-1 text-sm font-bold text-muted">
                {tomorrowBooked} ocupado(s) de {WORKDAY_SLOTS} horários
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                  style={{ width: `${Math.min((tomorrowBooked / WORKDAY_SLOTS) * 100, 100)}%` }}
                />
              </div>
            </article>
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
            <Card>
              <CardHeader title="Agenda do período" description={periodLabel(appliedFilters)} />
              <div className="compact-scroll-list divide-y divide-[#E2E8F0]">
                {periodAppointments.length ? (
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
              {data.nextAppointment ? (
                <div className="mt-5 space-y-3">
                  <p className="text-5xl font-black text-brand">{data.nextAppointment.startTime}</p>
                  <div>
                    <p className="text-lg font-black text-ink">{data.nextAppointment.client.name}</p>
                    <p className="text-sm text-muted">{data.nextAppointment.service.name}</p>
                  </div>
                  <p className="rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm font-bold text-muted">
                    {data.nextAppointment.date} · {money(data.nextAppointment.price)}
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
                    growth !== null
                      ? `${growth >= 0 ? "+" : ""}${growth}% vs período anterior`
                      : "Sem base anterior suficiente"
                  }
                  detail="Comparação com o mesmo número de dias antes do período atual."
                  tone={growth !== null && growth >= 0 ? "green" : "blue"}
                />
                <InsightCard
                  label="Melhor dia"
                  value={bestDay ? `${bestDay.label} foi seu melhor dia` : "Ainda sem melhor dia"}
                  detail={bestDay ? `${money(bestDay.total)} confirmado nesse dia.` : "Conclua atendimentos para medir desempenho."}
                />
                <InsightCard
                  label="Horários livres"
                  value={`${freeTomorrowSlots} horário(s) livre(s) amanhã`}
                  detail="Estimativa baseada em uma agenda comercial de 8 horários."
                />
                <InsightCard
                  label="Cancelamentos"
                  value={`${cancellations} cancelamento(s) no período`}
                  detail={cancellations ? "Vale tentar preencher esses espaços com clientes recorrentes." : "Boa previsibilidade para seu atendimento."}
                  tone={cancellations ? "red" : "green"}
                />
                <InsightCard
                  label="Cliente destaque"
                  value={bestClient ? `${bestClient.name} · ${money(bestClient.total)}` : "Sem cliente destaque"}
                  detail={bestClient ? `${bestClient.count} movimentação(ões) com receita no período.` : "O ranking aparece quando houver faturamento concluído."}
                  tone="green"
                />
                <InsightCard
                  label="Produtos"
                  value={`${money(data.productsPeriod)} em vendas`}
                  detail={`${periodSales.length} venda(s) registrada(s) fora dos serviços.`}
                />
              </div>
            </Card>

            <Card className="hidden">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Meta mensal líquida</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">{money(data.netMonth)}</h2>
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
      ) : null}
    </div>
  );
}
