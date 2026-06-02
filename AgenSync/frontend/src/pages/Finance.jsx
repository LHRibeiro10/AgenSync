import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import FilterBar, { periodLabel, rangeForPeriod } from "../components/FilterBar.jsx";
import Icon from "../components/Icon.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { api } from "../api/client.js";
import { useWorkspaceView } from "../contexts/WorkspaceViewContext.jsx";
import {
  expenseCategories,
  expenseCategoryLabel,
  listExpenses,
  sumExpenses
} from "../services/expenses.js";
import { exportFinancialReportExcel } from "../services/excelReport.js";
import { listProductSales, sumProductSales } from "../services/products.js";
import { listSubscriptionCycles, sumExpectedSubscriptionCycles, sumPaidSubscriptionCycles } from "../services/subscriptions.js";
import { useToast } from "../components/Toast.jsx";
import { money } from "../utils.js";

const MONTHLY_GOAL = 3000;
const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

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

function monthRangeUntil(value) {
  return {
    startDate: `${value.slice(0, 7)}-01`,
    endDate: value
  };
}

function lastSevenDays(value) {
  const selected = parseDate(value);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(selected, index - 6);
    return {
      date: formatInputDate(date),
      label: weekday.format(date).replace(".", "")
    };
  });
}

function AnimatedNumber({ value, format = (item) => item }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame;
    const start = performance.now();
    const duration = 850;
    const target = Number(value || 0);

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return format(display);
}

function FinanceMetricCard({ label, value, icon = "finance", helper, tone = "green" }) {
  const valueClass =
    tone === "red" ? "text-red-600" : tone === "blue" ? "text-brand" : tone === "dark" ? "text-ink" : "text-success";
  const iconClass =
    tone === "red" ? "bg-red-50 text-red-600" : tone === "blue" ? "bg-[#DBEAFE] text-brand" : "bg-[#D1FAE5] text-success";

  return (
    <article className="group rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-panel active:scale-[0.99]">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition duration-200 group-hover:scale-105 ${iconClass}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-muted">{label}</p>
      <strong className={`mt-2 block break-words text-2xl font-black tracking-tight sm:text-3xl ${valueClass}`}>
        <AnimatedNumber value={value} format={money} />
      </strong>
      {helper ? <p className="mt-2 text-sm font-medium text-muted">{helper}</p> : null}
    </article>
  );
}

function FinanceBreakdownPanel({ title, description, income, subscriptions, expenses, net, subscriptionHelper }) {
  const netIsPositive = net >= 0;

  return (
    <article className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">{title}</p>
          <p className="mt-1 text-sm font-bold text-muted">{description}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
            netIsPositive ? "bg-emerald-50 text-success" : "bg-red-50 text-red-600"
          }`}
        >
          {netIsPositive ? "Positivo" : "Negativo"}
        </span>
      </div>

      <div className="mt-5 rounded-2xl bg-[#F8FAFC] p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Resultado líquido</p>
        <p className={`mt-2 text-3xl font-black tracking-tight ${netIsPositive ? "text-success" : "text-red-600"}`}>
          <AnimatedNumber value={net} format={money} />
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Recebido</p>
          <p className="mt-2 text-lg font-black text-ink">{money(income)}</p>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Mensalidades</p>
          <p className="mt-2 text-lg font-black text-brand">{money(subscriptions)}</p>
          {subscriptionHelper ? <p className="mt-1 text-xs font-bold text-muted">{subscriptionHelper}</p> : null}
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Despesas</p>
          <p className="mt-2 text-lg font-black text-red-600">{money(expenses)}</p>
        </div>
      </div>
    </article>
  );
}

export default function Finance() {
  const navigate = useNavigate();
  const initialRange = rangeForPeriod("thisMonth");
  const [filters, setFilters] = useState({
    period: "thisMonth",
    startDate: initialRange.startDate,
    endDate: initialRange.endDate,
    category: "",
    search: ""
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [data, setData] = useState(null);
  const [completedAppointments, setCompletedAppointments] = useState([]);
  const [periodSales, setPeriodSales] = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const [monthSales, setMonthSales] = useState([]);
  const [periodSubscriptions, setPeriodSubscriptions] = useState([]);
  const [todaySubscriptions, setTodaySubscriptions] = useState([]);
  const [monthSubscriptions, setMonthSubscriptions] = useState([]);
  const [periodExpenses, setPeriodExpenses] = useState([]);
  const [todayExpenses, setTodayExpenses] = useState([]);
  const [monthExpenses, setMonthExpenses] = useState([]);
  const [previousWeekCompleted, setPreviousWeekCompleted] = useState([]);
  const [currentWeekSales, setCurrentWeekSales] = useState([]);
  const [previousWeekSales, setPreviousWeekSales] = useState([]);
  const [currentWeekSubscriptions, setCurrentWeekSubscriptions] = useState([]);
  const [previousWeekSubscriptions, setPreviousWeekSubscriptions] = useState([]);
  const [chartReady, setChartReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const { showToast } = useToast();
  const { selectedProfessionalId, viewReady } = useWorkspaceView();

  useEffect(() => {
    if (!viewReady) return undefined;
    let active = true;
    const selected = parseDate(appliedFilters.endDate);
    const currentWeekStart = formatInputDate(addDays(selected, -6));
    const previousStart = formatInputDate(addDays(selected, -13));
    const previousEnd = formatInputDate(addDays(selected, -7));
    const monthRange = monthRangeUntil(appliedFilters.endDate);
    const scopedParams = selectedProfessionalId ? { professionalId: selectedProfessionalId } : {};
    const isProfessionalScope = Boolean(selectedProfessionalId);

    setError("");
    setChartReady(false);

    Promise.all([
      api.finance({ date: appliedFilters.endDate, ...scopedParams }),
      api.listAppointments({
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
        status: "concluido",
        ...scopedParams
      }),
      api.listAppointments({
        startDate: previousStart,
        endDate: previousEnd,
        status: "concluido",
        ...scopedParams
      }),
      isProfessionalScope ? Promise.resolve([]) : listProductSales({
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate
      }),
      isProfessionalScope ? Promise.resolve([]) : listProductSales(monthRange),
      isProfessionalScope ? Promise.resolve([]) : listProductSales({
        startDate: currentWeekStart,
        endDate: appliedFilters.endDate
      }),
      isProfessionalScope ? Promise.resolve([]) : listProductSales({
        startDate: previousStart,
        endDate: previousEnd
      }),
      isProfessionalScope ? Promise.resolve([]) : listSubscriptionCycles({
        startDate: currentWeekStart,
        endDate: appliedFilters.endDate
      }),
      isProfessionalScope ? Promise.resolve([]) : listSubscriptionCycles({
        startDate: previousStart,
        endDate: previousEnd
      }),
      isProfessionalScope ? Promise.resolve([]) : listSubscriptionCycles({
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate
      }),
      isProfessionalScope ? Promise.resolve([]) : listSubscriptionCycles({
        startDate: appliedFilters.endDate,
        endDate: appliedFilters.endDate
      }),
      isProfessionalScope ? Promise.resolve([]) : listSubscriptionCycles(monthRange),
      isProfessionalScope ? Promise.resolve([]) : listExpenses({
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
        category: appliedFilters.category
      }),
      isProfessionalScope ? Promise.resolve([]) : listExpenses({
        ...monthRange,
        category: appliedFilters.category
      })
    ])
      .then(
        ([
          financeData,
          appointmentsData,
          previousData,
          nextPeriodSales,
          nextMonthSales,
          nextCurrentWeekSales,
          nextPreviousWeekSales,
          nextCurrentWeekSubscriptions,
          nextPreviousWeekSubscriptions,
          nextPeriodSubscriptions,
          nextTodaySubscriptions,
          nextMonthSubscriptions,
          nextPeriodExpenses,
          nextMonthExpenses
        ]) => {
          if (!active) return;

          setData(financeData);
          setCompletedAppointments(appointmentsData.appointments);
          setPreviousWeekCompleted(previousData.appointments);
          setPeriodSales(nextPeriodSales);
          setTodaySales(nextPeriodSales.filter((sale) => sale.date === appliedFilters.endDate));
          setMonthSales(nextMonthSales);
          setCurrentWeekSales(nextCurrentWeekSales);
          setPreviousWeekSales(nextPreviousWeekSales);
          setCurrentWeekSubscriptions(nextCurrentWeekSubscriptions);
          setPreviousWeekSubscriptions(nextPreviousWeekSubscriptions);
          setPeriodSubscriptions(nextPeriodSubscriptions);
          setTodaySubscriptions(nextTodaySubscriptions);
          setMonthSubscriptions(nextMonthSubscriptions);
          setPeriodExpenses(nextPeriodExpenses);
          setTodayExpenses(nextPeriodExpenses.filter((expense) => expense.date === appliedFilters.endDate));
          setMonthExpenses(nextMonthExpenses);
          requestAnimationFrame(() => setChartReady(true));
        }
      )
      .catch((err) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [appliedFilters, reloadKey, selectedProfessionalId, viewReady]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function applyFilters() {
    setAppliedFilters(filters);
  }

  function resetFilters() {
    const range = rangeForPeriod("thisMonth");
    const next = {
      period: "thisMonth",
      startDate: range.startDate,
      endDate: range.endDate,
      category: "",
      search: ""
    };
    setFilters(next);
    setAppliedFilters(next);
  }

  const servicesPeriod = completedAppointments.reduce(
    (total, appointment) => total + Number(appointment.price || 0),
    0
  );
  const productsPeriod = sumProductSales(periodSales);
  const subscriptionsPeriod = sumPaidSubscriptionCycles(periodSubscriptions);
  const subscriptionsExpectedPeriod = sumExpectedSubscriptionCycles(periodSubscriptions);
  const subscriptionsPendingPeriod = periodSubscriptions.filter((cycle) => cycle.status === "pending").length;
  const subscriptionsOverduePeriod = periodSubscriptions.filter((cycle) => cycle.status === "overdue").length;
  const grossPeriod = servicesPeriod + productsPeriod + subscriptionsPeriod;
  const expensesPeriod = sumExpenses(periodExpenses);
  const netPeriod = grossPeriod - expensesPeriod;
  const productsToday = sumProductSales(todaySales);
  const subscriptionsToday = sumPaidSubscriptionCycles(todaySubscriptions);
  const expensesToday = sumExpenses(todayExpenses);
  const grossToday = data ? data.totalReceivedToday + productsToday + subscriptionsToday : 0;
  const netToday = grossToday - expensesToday;
  const productsMonth = sumProductSales(monthSales);
  const subscriptionsMonth = sumPaidSubscriptionCycles(monthSubscriptions);
  const subscriptionsExpectedMonth = sumExpectedSubscriptionCycles(monthSubscriptions);
  const expensesMonth = sumExpenses(monthExpenses);
  const grossMonth = data ? data.totalReceivedMonth + productsMonth + subscriptionsMonth : 0;
  const netMonth = grossMonth - expensesMonth;

  const searchedCompleted = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    if (!search) return completedAppointments;

    return completedAppointments.filter((appointment) =>
      [appointment.client?.name, appointment.service?.name, appointment.notes]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search))
    );
  }, [completedAppointments, filters.search]);

  const searchedSales = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    if (!search) return periodSales;

    return periodSales.filter((sale) =>
      [sale.productName, sale.clientName, sale.notes]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search))
    );
  }, [periodSales, filters.search]);

  const searchedSubscriptions = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const paidCycles = periodSubscriptions.filter((cycle) => cycle.status === "paid");
    if (!search) return paidCycles;

    return paidCycles.filter((cycle) =>
      [cycle.clientName, cycle.planName, cycle.notes]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search))
    );
  }, [periodSubscriptions, filters.search]);

  const chartData = useMemo(() => {
    const days = lastSevenDays(appliedFilters.endDate);
    return days.map((day) => {
      const gross = completedAppointments
        .filter((appointment) => appointment.date === day.date)
        .reduce((total, appointment) => total + Number(appointment.price || 0), 0);
      const products = periodSales
        .filter((sale) => sale.date === day.date)
        .reduce((total, sale) => total + Number(sale.total || 0), 0);
      const subscriptions = periodSubscriptions
        .filter((cycle) => cycle.status === "paid" && cycle.paidAt === day.date)
        .reduce((total, cycle) => total + Number(cycle.amount || 0), 0);
      const expenses = periodExpenses
        .filter((expense) => expense.date === day.date)
        .reduce((total, expense) => total + Number(expense.amount || 0), 0);

      return {
        ...day,
        value: Math.max(gross + products + subscriptions - expenses, 0)
      };
    });
  }, [completedAppointments, periodSales, periodSubscriptions, periodExpenses, appliedFilters.endDate]);

  const maxChartValue = Math.max(...chartData.map((item) => item.value), 1);
  const recentMovements = useMemo(
    () =>
      [
        ...searchedCompleted.map((appointment) => ({
          id: `appointment-${appointment.id}`,
          date: appointment.date,
          time: appointment.startTime || "",
          title: appointment.client.name,
          description: appointment.service.name,
          meta: `${appointment.date} · ${appointment.startTime}`,
          amount: Number(appointment.price || 0),
          type: "income"
        })),
        ...searchedSales.map((sale) => ({
          id: `sale-${sale.id}`,
          date: sale.date,
          time: "",
          title: sale.productName,
          description: `Venda de produto · ${sale.quantity} un.`,
          meta: sale.clientName ? `${sale.date} · ${sale.clientName}` : sale.date,
          amount: Number(sale.total || 0),
          type: "income"
        })),
        ...searchedSubscriptions.map((cycle) => ({
          id: `subscription-${cycle.id}`,
          date: cycle.paidAt || cycle.dueDate,
          time: "",
          title: cycle.clientName,
          description: `Mensalidade · ${cycle.planName}`,
          meta: cycle.paidAt || cycle.dueDate,
          amount: Number(cycle.amount || 0),
          type: "income"
        })),
        ...periodExpenses.map((expense) => ({
          id: `expense-${expense.id}`,
          date: expense.date,
          time: "",
          title: expense.description,
          description: expenseCategoryLabel(expense.category),
          meta: expense.date,
          amount: Number(expense.amount || 0),
          type: "expense"
        }))
      ]
        .filter((item) => item.title)
        .sort((first, second) => `${second.date} ${second.time}`.localeCompare(`${first.date} ${first.time}`))
        .slice(0, 10),
    [searchedCompleted, searchedSales, searchedSubscriptions, periodExpenses]
  );
  const previousWeekTotal = previousWeekCompleted.reduce(
    (total, appointment) => total + Number(appointment.price || 0),
    0
  ) + sumProductSales(previousWeekSales) + sumPaidSubscriptionCycles(previousWeekSubscriptions);
  const currentWeekTotal = data ? data.totalReceivedWeek + sumProductSales(currentWeekSales) + sumPaidSubscriptionCycles(currentWeekSubscriptions) : 0;
  const weekGrowth =
    previousWeekTotal > 0 && data
      ? Math.round(((currentWeekTotal - previousWeekTotal) / previousWeekTotal) * 100)
      : null;
  const goalProgress = data ? Math.min((netMonth / MONTHLY_GOAL) * 100, 100) : 0;
  const periodMargin = grossPeriod > 0 ? Math.round((netPeriod / grossPeriod) * 100) : 0;
  const expenseShare = grossPeriod > 0 ? Math.round((expensesPeriod / grossPeriod) * 100) : 0;
  const paidSubscriptionsCount = periodSubscriptions.filter((cycle) => cycle.status === "paid").length;
  const hasFinancialData =
    completedAppointments.length > 0 ||
    periodSales.length > 0 ||
    periodExpenses.length > 0 ||
    paidSubscriptionsCount > 0;

  function handleExportExcel() {
    if (!data || exporting) return;

    setExporting(true);
    try {
      const filename = exportFinancialReportExcel({
        periodLabel: periodLabel(appliedFilters),
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
        grossPeriod,
        expensesPeriod,
        netPeriod,
        servicesPeriod,
        productsPeriod,
        completedAppointments,
        periodExpenses: periodExpenses.map((expense) => ({
          ...expense,
          categoryLabel: expenseCategoryLabel(expense.category)
        })),
        periodSales
      });
      showToast(`Planilha ${filename} gerada.`);
    } catch {
      showToast("Não foi possível gerar a planilha.", "error");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    function exportFromMobileHeader() {
      handleExportExcel();
    }

    window.addEventListener("agensync:export-finance", exportFromMobileHeader);
    return () => window.removeEventListener("agensync:export-finance", exportFromMobileHeader);
  });

  if (!data && !error) return <Loading label="Carregando financeiro..." />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Financeiro"
        description="Entradas, despesas e resultado líquido para entender quanto realmente sobra."
        action={
          <Button onClick={handleExportExcel} loading={exporting} loadingLabel="Gerando...">
            Exportar Excel
          </Button>
        }
      />
      <Message type="error" actionLabel="Tentar novamente" onAction={() => setReloadKey((value) => value + 1)}>
        {error}
      </Message>

      <div className="no-print">
        <FilterBar
          title="Filtrar financeiro"
          description="Escolha período, categoria de despesa e busque serviços, produtos ou movimentações."
          period={filters.period}
          startDate={filters.startDate}
          endDate={filters.endDate}
          onPeriodChange={(value) => updateFilter("period", value)}
          onStartDateChange={(value) => updateFilter("startDate", value)}
          onEndDateChange={(value) => updateFilter("endDate", value)}
          searchValue={filters.search}
          onSearchChange={(value) => updateFilter("search", value)}
          searchPlaceholder="Buscar cliente, serviço ou produto"
          categoryValue={filters.category}
          onCategoryChange={(value) => updateFilter("category", value)}
          categoryOptions={expenseCategories}
          onSubmit={applyFilters}
          onClear={resetFilters}
          resultLabel={periodLabel(appliedFilters)}
        />
      </div>

      {data ? (
        <>
          {!hasFinancialData ? (
            <Card className="border-dashed border-[#BFDBFE] bg-white">
              <EmptyState
                title="Financeiro sem movimentacoes ainda."
                description="Conclua atendimentos e registre despesas para acompanhar seus ganhos."
                action={
                  <Button onClick={() => navigate("/agendamentos")}>
                    Criar primeiro atendimento
                  </Button>
                }
              />
            </Card>
          ) : null}

          <Card className="overflow-hidden border-[#E2E8F0] bg-white p-0 shadow-panel">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.42fr)]">
              <div className="p-5 sm:p-7">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">Resumo financeiro</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Resultado do período</h2>
                  </div>
                  <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-black text-muted ring-1 ring-[#E2E8F0]">
                    {periodLabel(appliedFilters)}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-success">Faturamento bruto</p>
                    <strong className="mt-3 block text-4xl font-black tracking-tight text-success">
                      <AnimatedNumber value={grossPeriod} format={money} />
                    </strong>
                    <p className="mt-3 text-sm font-bold leading-6 text-emerald-800">
                      Serviços {money(servicesPeriod)} · Produtos {money(productsPeriod)} · Mensalidades {money(subscriptionsPeriod)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">Total de despesas</p>
                    <strong className="mt-3 block text-4xl font-black tracking-tight text-red-600">
                      <AnimatedNumber value={expensesPeriod} format={money} />
                    </strong>
                    <p className="mt-3 text-sm font-bold leading-6 text-red-700">
                      Despesas consomem {expenseShare}% do faturamento bruto.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#DBEAFE] bg-[#EFF6FF] p-5 sm:p-7 lg:border-l lg:border-t-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">Resultado líquido</p>
                <strong className="mt-3 block text-4xl font-black tracking-tight text-brand sm:text-5xl">
                  <AnimatedNumber value={netPeriod} format={money} />
                </strong>
                <p className="mt-3 text-sm font-bold text-blue-900">O que sobrou depois das despesas.</p>
                <div className="mt-6 rounded-2xl bg-white/80 p-4 ring-1 ring-blue-100">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Margem do período</p>
                  <p className="mt-2 text-2xl font-black text-ink">{periodMargin}%</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#DBEAFE]">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                      style={{ width: `${Math.min(Math.max(periodMargin, 0), 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <section className="grid gap-4 xl:grid-cols-2">
            <FinanceBreakdownPanel
              title="Hoje"
              description="Resumo operacional do dia selecionado."
              income={grossToday}
              subscriptions={subscriptionsToday}
              expenses={expensesToday}
              net={netToday}
              subscriptionHelper="Pagas no dia"
            />
            <FinanceBreakdownPanel
              title="Mês até agora"
              description="Leitura acumulada do mês vigente."
              income={grossMonth}
              subscriptions={subscriptionsMonth}
              expenses={expensesMonth}
              net={netMonth}
              subscriptionHelper={`Previsto ${money(subscriptionsExpectedMonth)}`}
            />
          </section>

          <Card className="p-0">
            <CardHeader title="Mensalidades no financeiro" description="Somente cobranças pagas entram como receita confirmada." />
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Previsto no período</p>
                <p className="mt-2 text-2xl font-black text-ink">{money(subscriptionsExpectedPeriod)}</p>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Recebido no período</p>
                <p className="mt-2 text-2xl font-black text-success">{money(subscriptionsPeriod)}</p>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Pendentes</p>
                <p className="mt-2 text-2xl font-black text-brand">{subscriptionsPendingPeriod}</p>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Atrasadas</p>
                <p className="mt-2 text-2xl font-black text-red-600">{subscriptionsOverduePeriod}</p>
              </div>
            </div>
          </Card>

          <Card className="p-0">
            <CardHeader title="Meta e leitura financeira" description="Foque no líquido para tomar decisões melhores." />
            <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Meta líquida mensal</p>
                    <p className="mt-1 text-sm font-medium text-muted">
                      {money(netMonth)} de {money(MONTHLY_GOAL)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#DBEAFE] px-3 py-1 text-sm font-black text-brand">
                    {Math.round(goalProgress)}%
                  </span>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                    style={{ width: `${goalProgress}%` }}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
                <p className="text-sm font-black text-ink">
                  {weekGrowth !== null
                    ? `Bruto semanal ${weekGrowth >= 0 ? "+" : ""}${weekGrowth}% vs semana anterior`
                    : "Sem semana anterior para comparar"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Use o líquido para precificar melhor e controlar gastos recorrentes.
                </p>
              </div>
            </div>
          </Card>

          <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <Card className="p-0">
              <CardHeader title="Resultado líquido dos últimos 7 dias" description="Serviços + produtos menos despesas por dia." />
              <div className="p-3 sm:p-5">
                <div className="flex h-56 min-w-0 items-end gap-2 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:h-72 sm:gap-4 sm:p-4 sm:pr-8">
                  {chartData.map((item, index) => {
                    const height = chartReady ? Math.max((item.value / maxChartValue) * 100, item.value ? 12 : 4) : 4;

                    return (
                      <div key={item.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                        <div className="flex w-full flex-1 items-end">
                          <div
                            className="group relative w-full min-w-[18px] rounded-t-xl bg-brand shadow-sm transition-all duration-700 ease-out hover:bg-brand-dark sm:min-w-[36px] sm:rounded-t-2xl"
                            style={{ height: `${height}%`, transitionDelay: `${index * 60}ms` }}
                          >
                            <span className="absolute -top-9 left-1/2 hidden -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-xs font-black text-white shadow-soft group-hover:block">
                              {money(item.value)}
                            </span>
                          </div>
                        </div>
                        <span className="max-w-full truncate text-[10px] font-black uppercase text-muted sm:text-xs">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card className="p-0">
              <CardHeader title="Últimas movimentações" description="Serviços concluídos, vendas de produtos e despesas do período." />
              <div className="compact-scroll-list-sm divide-y divide-[#E2E8F0]">
                {recentMovements.map((movement) => (
                  <article key={movement.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-3 sm:p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-ink sm:text-base">{movement.title}</p>
                      <p className="mt-1 truncate text-xs font-bold text-muted sm:text-sm">{movement.description}</p>
                      <p className="mt-2 truncate text-xs font-bold text-muted">{movement.meta}</p>
                    </div>
                    <p className={`whitespace-nowrap text-sm font-black sm:text-lg ${movement.type === "expense" ? "text-red-600" : "text-success"}`}>
                      {movement.type === "expense" ? "-" : ""}{money(movement.amount)}
                    </p>
                  </article>
                ))}
                {!recentMovements.length ? (
                  <EmptyState title="Nenhuma movimentação" description="Ajuste os filtros para ampliar a busca." />
                ) : null}
              </div>
            </Card>
          </section>

          <section className="print-report rounded-[28px] border border-[#E2E8F0] bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-2 border-b border-[#E2E8F0] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">AgenSync</p>
                <h2 className="mt-1 text-2xl font-black text-ink">Relatório financeiro</h2>
                <p className="mt-1 text-sm font-medium text-muted">{periodLabel(appliedFilters)}</p>
              </div>
              <Button onClick={handleExportExcel} loading={exporting} loadingLabel="Gerando...">
                Exportar Excel
              </Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-2xl border border-[#E2E8F0] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Bruto</p>
                <p className="mt-2 text-2xl font-black text-success">{money(grossPeriod)}</p>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Serviços</p>
                <p className="mt-2 text-2xl font-black text-ink">{money(servicesPeriod)}</p>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Produtos</p>
                <p className="mt-2 text-2xl font-black text-ink">{money(productsPeriod)}</p>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Mensalidades</p>
                <p className="mt-2 text-2xl font-black text-ink">{money(subscriptionsPeriod)}</p>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Despesas</p>
                <p className="mt-2 text-2xl font-black text-red-600">{money(expensesPeriod)}</p>
              </div>
              <div className="rounded-2xl border border-[#E2E8F0] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Líquido</p>
                <p className="mt-2 text-2xl font-black text-brand">{money(netPeriod)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-4">
              <div>
                <h3 className="text-lg font-black text-ink">Atendimentos concluídos</h3>
                <div className="mt-3 overflow-hidden rounded-2xl border border-[#E2E8F0]">
                  {completedAppointments.length ? (
                    completedAppointments.map((appointment) => (
                      <div key={appointment.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#E2E8F0] p-3 last:border-b-0">
                        <div>
                          <p className="font-black text-ink">{appointment.client.name}</p>
                          <p className="text-sm text-muted">{appointment.service.name} · {appointment.date}</p>
                        </div>
                        <p className="font-black text-success">{money(appointment.price)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="p-4 text-sm text-muted">Nenhum atendimento concluído no período.</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-ink">Vendas de produtos</h3>
                <div className="mt-3 overflow-hidden rounded-2xl border border-[#E2E8F0]">
                  {periodSales.length ? (
                    periodSales.map((sale) => (
                      <div key={sale.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#E2E8F0] p-3 last:border-b-0">
                        <div>
                          <p className="font-black text-ink">{sale.productName}</p>
                          <p className="text-sm text-muted">
                            {sale.quantity} un. · {sale.date}{sale.clientName ? ` · ${sale.clientName}` : ""}
                          </p>
                        </div>
                        <p className="font-black text-success">{money(sale.total)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="p-4 text-sm text-muted">Nenhuma venda de produto no período.</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-ink">Mensalidades pagas</h3>
                <div className="mt-3 overflow-hidden rounded-2xl border border-[#E2E8F0]">
                  {searchedSubscriptions.length ? (
                    searchedSubscriptions.map((cycle) => (
                      <div key={cycle.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#E2E8F0] p-3 last:border-b-0">
                        <div>
                          <p className="font-black text-ink">{cycle.clientName}</p>
                          <p className="text-sm text-muted">{cycle.planName} · {cycle.paidAt || cycle.dueDate}</p>
                        </div>
                        <p className="font-black text-success">{money(cycle.amount)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="p-4 text-sm text-muted">Nenhuma mensalidade paga no período.</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-ink">Despesas</h3>
                <div className="mt-3 overflow-hidden rounded-2xl border border-[#E2E8F0]">
                  {periodExpenses.length ? (
                    periodExpenses.map((expense) => (
                      <div key={expense.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#E2E8F0] p-3 last:border-b-0">
                        <div>
                          <p className="font-black text-ink">{expense.description}</p>
                          <p className="text-sm text-muted">{expenseCategoryLabel(expense.category)} · {expense.date}</p>
                        </div>
                        <p className="font-black text-red-600">-{money(expense.amount)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="p-4 text-sm text-muted">Nenhuma despesa no período.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-[#F8FAFC] p-5 text-right">
              <p className="text-sm font-bold text-muted">Resultado líquido final</p>
              <p className="mt-1 text-3xl font-black text-brand">{money(netPeriod)}</p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
