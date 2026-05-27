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
import { useOnboarding } from "../contexts/OnboardingContext.jsx";
import { useToast } from "../components/Toast.jsx";
import ClientCarePanel from "../components/client-care/ClientCarePanel.jsx";
import { getClientCare, loadClientCare } from "../services/clientCare.js";
import {
  importSingleContact,
  normalizeContactPhone,
  supportsContactPicker
} from "../services/contactImportService.js";
import { listProducts } from "../services/products.js";

const emptyForm = { name: "", phone: "", notes: "" };

const clientSections = {
  clients: ["Clientes", "Cadastro, status e dados principais dos clientes.", "data", "Cadastro", "Atendimento", "Cadastre, edite e inative clientes sem misturar prontuario e documentos."],
  attendance: ["Atendimento", "Abra o atendimento completo do cliente com historico, dados e registros vinculados.", "history", "Operacao", "Abrir atendimento", "Selecione um cliente para iniciar o atendimento contextual."],
  forms: ["Fichas", "Fichas personalizadas e anamnese ficam conectadas ao cliente.", "forms", "Prontuario", "Ver fichas", "Escolha um cliente para preencher ou revisar fichas."],
  evolution: ["Evolucao", "Registre evolucao, observacoes tecnicas e fotos do processo.", "evolution", "Acompanhamento", "Ver evolucao", "Escolha um cliente para registrar uma nova evolucao."],
  documents: ["Documentos", "Documentos, termos e assinatura ficam organizados por cliente.", "documents", "Arquivos", "Ver documentos", "Escolha um cliente para gerenciar documentos e assinaturas."],
  timeline: ["Linha do tempo", "Uma visao cronologica do relacionamento, fichas, evolucoes e atendimentos.", "timeline", "Historico completo", "Ver linha do tempo", "Escolha um cliente para acompanhar toda a jornada."]
};

export default function Clients({ section = "clients" }) {
  const [sectionTitle, sectionDescription, sectionTab, sectionEyebrow, sectionAction, sectionFocus] = clientSections[section] || clientSections.clients;
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
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [contactImportSupported, setContactImportSupported] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const { markStepComplete } = useOnboarding();
  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const isDocumentsLayout = Boolean(selectedClient && activeTab === "documents");
  const activeClientsCount = clients.filter((client) => client.isActive !== false).length;
  const inactiveClientsCount = clients.length - activeClientsCount;

  async function loadClients() {
    const clientsData = await api.listClients({ includeInactive: true });
    setClients(clientsData.clients);
    if (clientsData.clients.length) {
      markStepComplete("client", { toast: false });
    }
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
    setContactImportSupported(supportsContactPicker());
  }, []);

  useEffect(() => {
    setActiveTab(sectionTab);
  }, [sectionTab]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([api.listClients({ includeInactive: true }), api.listServices({ active: true }), listProducts({ activeOnly: true })])
      .then(([clientsData, servicesData, activeProducts]) => {
        if (!active) return;
        setClients(clientsData.clients);
        if (clientsData.clients.length) {
          markStepComplete("client", { toast: false });
        }
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
  }, [markStepComplete]);

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

  function focusCreateForm() {
    const element = window.document.getElementById("clients-create-form");
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      const firstInput = element?.querySelector("input");
      firstInput?.focus();
    }, 220);
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

  async function importContact() {
    const result = await importSingleContact();

    if (result.reason === "unsupported") {
      showToast("Importacao de contatos nao disponivel neste dispositivo.", "error");
      return;
    }

    if (result.reason === "cancelled") return;

    if (result.reason === "error") {
      showToast("Nao foi possivel importar o contato.", "error");
      return;
    }

    if (!result.contact?.phone) {
      showToast("O contato selecionado nao tem telefone.", "error");
      if (result.contact?.name) {
        setForm((current) => ({ ...current, name: result.contact.name }));
      }
      return;
    }

    setForm((current) => ({
      ...current,
      name: result.contact.name || current.name,
      phone: result.contact.phone
    }));
    showToast("Contato importado. Revise os dados antes de salvar.");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      phone: normalizeContactPhone(form.phone)
    };

    if (payload.phone.length < 8) {
      const message = "Informe um telefone valido.";
      setError(message);
      showToast(message, "error");
      setSaving(false);
      return;
    }

    try {
      if (editing) {
        await api.updateClient(editing, payload);
        showToast("Cliente atualizado.");
      } else {
        await api.createClient(payload);
        markStepComplete("client", { toast: false });
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

  async function toggleClientStatus(client) {
    const nextIsActive = client.isActive === false;
    setStatusUpdatingId(client.id);
    setError("");

    try {
      await api.updateClient(client.id, {
        name: client.name,
        phone: client.phone,
        notes: client.notes || "",
        isActive: nextIsActive
      });
      showToast(nextIsActive ? "Cliente reativado." : "Cliente inativado.");
      await loadClients();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setStatusUpdatingId("");
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title={sectionTitle} description={sectionDescription} />
      <Message type="error" actionLabel="Tentar novamente" onAction={retryLoadClients}>
        {error}
      </Message>

      <Card className="p-4 sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">{sectionEyebrow}</p>
        <p className="mt-2 text-sm font-bold leading-6 text-muted">{sectionFocus}</p>
      </Card>

      <section
        className={`grid xl:items-start ${
          isDocumentsLayout ? "gap-6 xl:grid-cols-[minmax(260px,26%)_minmax(0,74%)]" : "gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"
        }`}
      >
        <div className="order-3 min-w-0 xl:col-start-2">
          <Card className="overflow-hidden">
            <CardHeader
              title="Clientes cadastrados"
              description={`${activeClientsCount} ativo(s)${inactiveClientsCount ? `, ${inactiveClientsCount} inativo(s)` : ""}`}
            />
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
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-black text-ink">{client.name}</p>
                          {client.isActive === false ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 ring-1 ring-slate-200">
                              Inativo
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm font-medium text-muted">{client.phone}</p>
                        {client.notes ? <p className="mt-2 text-sm text-muted">{client.notes}</p> : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2 md:min-w-[360px]">
                        <Button variant="secondary" onClick={() => openClient(client, sectionTab)}>
                          {sectionAction}
                        </Button>
                        <Button variant="secondary" onClick={() => startEdit(client)}>
                          Editar
                        </Button>
                        <Button
                          variant="secondary"
                          loading={statusUpdatingId === client.id}
                          onClick={() => toggleClientStatus(client)}
                        >
                          {client.isActive === false ? "Reativar" : "Inativar"}
                        </Button>
                        <Button variant="danger" onClick={() => setPendingDelete(client)}>
                          Excluir
                        </Button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div>
                    <EmptyState
                      title="Voce ainda nao cadastrou clientes."
                      description="Comece adicionando seu primeiro cliente."
                      action={
                        <Button onClick={focusCreateForm}>Adicionar primeiro cliente</Button>
                      }
                    />
                  </div>
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

        <Card
          as="form"
          id="clients-create-form"
          onSubmit={handleSubmit}
          className="order-2 space-y-4 p-4 sm:p-5 xl:sticky xl:top-24 xl:col-start-1 xl:row-start-1 xl:self-start"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-black text-ink">{editing ? "Editar cliente" : "Novo cliente"}</h2>
              <p className="mt-1 text-sm text-muted">Telefone e observações ficam disponíveis nos agendamentos.</p>
            </div>
            {contactImportSupported ? (
              <Button variant="secondary" size="sm" onClick={importContact}>
                Importar contato
              </Button>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold leading-5 text-muted">
                Importacao de contatos nao disponivel neste dispositivo.
              </p>
            )}
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
