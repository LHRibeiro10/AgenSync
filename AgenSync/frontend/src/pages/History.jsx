import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import FilterBar, { periodLabel, rangeForPeriod } from "../components/FilterBar.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { money, statusOptions } from "../utils.js";

export default function History() {
  const initialRange = rangeForPeriod("thisMonth");
  const [filters, setFilters] = useState({
    period: "thisMonth",
    startDate: initialRange.startDate,
    endDate: initialRange.endDate,
    clientId: "",
    status: "",
    search: ""
  });
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const appointmentsData = await api.appointmentsOverview({
        startDate: nextFilters.startDate,
        endDate: nextFilters.endDate,
        clientId: nextFilters.clientId,
        status: nextFilters.status
      });
      setAppointments(appointmentsData.appointments);
      if (appointmentsData.bootstrap?.clients) {
        setClients(appointmentsData.bootstrap.clients);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetFilters() {
    const range = rangeForPeriod("thisMonth");
    const next = {
      period: "thisMonth",
      startDate: range.startDate,
      endDate: range.endDate,
      clientId: "",
      status: "",
      search: ""
    };
    setFilters(next);
    load(next);
  }

  const visibleAppointments = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    if (!search) return appointments;

    return appointments.filter((appointment) =>
      [appointment.client?.name, appointment.service?.name, appointment.notes]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search))
    );
  }, [appointments, filters.search]);

  return (
    <div className="space-y-5">
      <PageHeader title="Histórico" description="Filtre atendimentos por período, cliente e status." />
      <Message type="error">{error}</Message>

      <FilterBar
        title="Pesquisar histórico"
        description="Combine período, cliente, status e busca por nome para revisar atendimentos."
        period={filters.period}
        startDate={filters.startDate}
        endDate={filters.endDate}
        onPeriodChange={(value) => update("period", value)}
        onStartDateChange={(value) => update("startDate", value)}
        onEndDateChange={(value) => update("endDate", value)}
        searchValue={filters.search}
        onSearchChange={(value) => update("search", value)}
        searchPlaceholder="Buscar cliente, serviço ou observação"
        clientValue={filters.clientId}
        onClientChange={(value) => update("clientId", value)}
        clientOptions={clients}
        statusValue={filters.status}
        onStatusChange={(value) => update("status", value)}
        statusOptions={statusOptions}
        onSubmit={() => load(filters)}
        onClear={resetFilters}
        resultLabel={periodLabel(filters)}
      />

      <Card>
        {loading ? (
          <Loading label="Carregando histórico..." />
        ) : (
          <div className="compact-scroll-list divide-y divide-[#E2E8F0]">
            {visibleAppointments.length ? (
              visibleAppointments.map((appointment) => (
                <article key={appointment.id} className="grid cursor-pointer gap-3 p-4 transition duration-200 hover:bg-[#F8FAFC] active:bg-[#DBEAFE]/40 lg:grid-cols-[120px_1fr_auto] lg:items-center">
                  <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                    <p className="text-xs font-bold text-muted">{appointment.date}</p>
                    <p className="text-xl font-black text-ink">{appointment.startTime}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-black tracking-tight text-ink">{appointment.client.name}</p>
                    <p className="text-sm font-bold text-muted">{appointment.service.name}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 lg:justify-end">
                    <StatusBadge status={appointment.status} />
                    <span className="font-black text-ink">{money(appointment.price)}</span>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState title="Nenhum atendimento encontrado" description="Ajuste os filtros para ampliar a busca." />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
