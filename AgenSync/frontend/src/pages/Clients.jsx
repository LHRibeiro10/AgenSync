import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Field, { inputClass } from "../components/Field.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useToast } from "../components/Toast.jsx";
import ClientCarePanel from "../components/client-care/ClientCarePanel.jsx";
import { getClientCare, loadClientCare } from "../services/clientCare.js";
import { listProducts } from "../services/products.js";

const emptyForm = { name: "", phone: "", notes: "" };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [activeTab, setActiveTab] = useState("data");
  const [clientCare, setClientCare] = useState(getClientCare(""));
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const isDocumentsLayout = Boolean(selectedClient && activeTab === "documents");

  async function loadClients() {
    const clientsData = await api.listClients();
    setClients(clientsData.clients);
  }

  async function retryLoadClients() {
    setError("");
    try {
      await loadClients();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([api.listClients(), api.listServices({ active: true }), listProducts({ activeOnly: true })])
      .then(([clientsData, servicesData, activeProducts]) => {
        if (!active) return;
        setClients(clientsData.clients);
        setServices(servicesData.services);
        setProducts(activeProducts);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedClientId) return;

    let active = true;
    setHistoryLoading(true);
    Promise.all([api.listAppointments({ clientId: selectedClientId }), loadClientCare(selectedClientId)])
      .then(([appointmentsData, care]) => {
        if (!active) return;
        setAppointments(appointmentsData.appointments);
        setClientCare(care);
      })
      .catch((err) => {
        if (active) {
          setAppointments([]);
          showToast(err.message, "error");
        }
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedClientId && clients.length && !clients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId("");
      setAppointments([]);
      setClientCare(getClientCare(""));
    }
  }, [clients, selectedClientId]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openClient(client, tab = "data") {
    setSelectedClientId(client.id);
    setActiveTab(tab);
    setClientCare(getClientCare(client.id));
  }

  function startEdit(client) {
    setEditing(client.id);
    setForm({ name: client.name, phone: client.phone, notes: client.notes || "" });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (editing) {
        await api.updateClient(editing, form);
        showToast("Cliente atualizado.");
      } else {
        await api.createClient(form);
        showToast("Cliente cadastrado.");
      }
      resetForm();
      await loadClients();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setError("");

    try {
      await api.deleteClient(pendingDelete.id);
      showToast("Cliente excluído.");
      if (selectedClientId === pendingDelete.id) {
        setSelectedClientId("");
        setAppointments([]);
        setClientCare(getClientCare(""));
      }
      setPendingDelete(null);
      await loadClients();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
      setPendingDelete(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Clientes" description="Dados, histórico, fichas personalizadas, evolução, fotos, documentos, orçamentos e assinatura em um só lugar." />
      <Message type="error" actionLabel="Tentar novamente" onAction={retryLoadClients}>
        {error}
      </Message>

      <section
        className={`grid xl:items-start ${
          isDocumentsLayout ? "gap-6 xl:grid-cols-[minmax(260px,26%)_minmax(0,74%)]" : "gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"
        }`}
      >
        <div className="order-3 min-w-0 xl:col-start-2">
          <Card className="overflow-hidden">
            <CardHeader title="Clientes cadastrados" description={`${clients.length} registro(s) no app local`} />
            {loading ? (
              <Loading label="Carregando clientes..." />
            ) : (
              <div className="compact-scroll-list divide-y divide-[#E2E8F0]">
                {clients.length ? (
                  clients.map((client) => (
                    <article
                      key={client.id}
                      className={`grid gap-4 p-4 transition duration-200 md:grid-cols-[minmax(0,1fr)_minmax(260px,auto)] md:items-center ${
                        selectedClientId === client.id ? "bg-blue-50" : "hover:bg-[#F8FAFC] active:bg-[#DBEAFE]/40"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-base font-black text-ink">{client.name}</p>
                        <p className="text-sm font-medium text-muted">{client.phone}</p>
                        {client.notes ? <p className="mt-2 text-sm text-muted">{client.notes}</p> : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:min-w-[260px]">
                        <Button variant="secondary" onClick={() => openClient(client)}>
                          Atendimento
                        </Button>
                        <Button variant="secondary" onClick={() => startEdit(client)}>
                          Editar
                        </Button>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState title="Nenhum cliente cadastrado" description="Cadastre o primeiro cliente para criar agendamentos." />
                )}
              </div>
            )}
          </Card>
        </div>

        {selectedClient ? (
          <div className="order-1 min-w-0 xl:col-start-2 xl:row-start-1">
            <ClientCarePanel
              client={selectedClient}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              care={clientCare}
              onCareChange={setClientCare}
              appointments={appointments}
              historyLoading={historyLoading}
              services={services}
              products={products}
              onEdit={() => startEdit(selectedClient)}
              onClose={() => setSelectedClientId("")}
              showToast={showToast}
            />
          </div>
        ) : null}

        <Card as="form" onSubmit={handleSubmit} className="order-2 space-y-4 p-4 sm:p-5 xl:sticky xl:top-24 xl:col-start-1 xl:row-start-1 xl:self-start">
          <div>
            <h2 className="text-lg font-black text-ink">{editing ? "Editar cliente" : "Novo cliente"}</h2>
            <p className="mt-1 text-sm text-muted">Telefone e observações ficam disponíveis nos agendamentos.</p>
          </div>

          <Field label="Nome">
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              className={inputClass}
              placeholder="Nome do cliente"
            />
          </Field>
          <Field label="Telefone">
            <input
              required
              minLength={8}
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              className={inputClass}
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="Observações">
            <textarea
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              className={`${inputClass} min-h-28 resize-none`}
              placeholder="Preferências, restrições ou detalhes importantes"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            {editing ? (
              <Button variant="secondary" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" loading={saving} className={editing ? "" : "col-span-2"}>
              {editing ? "Atualizar" : "Cadastrar"}
            </Button>
          </div>
        </Card>
      </section>

      {/* Floating action button for mobile */}
      <div className="fixed bottom-6 right-6 z-50 lg:hidden">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand shadow-[0_12px_24px_rgba(37,99,235,0.32)] transition active:scale-95"
          aria-label="Cadastrar cliente"
        >
          <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir cliente?"
        description={
          pendingDelete
            ? `${pendingDelete.name} será removido se não houver agendamentos vinculados.`
            : ""
        }
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
