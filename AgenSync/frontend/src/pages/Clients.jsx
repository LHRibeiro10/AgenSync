import { useEffect, useState } from "react";
import { useSubmitLock } from "../hooks/useSubmitLock.js";
import { api } from "../api/client.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Field, { inputClass } from "../components/Field.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import ModalShell, { FormSection } from "../components/ModalShell.jsx";
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
import { imageAccept, imageFileToDataUrl } from "../components/client-care/photoUtils.js";
import { calcularIdade } from "../utils/idade.js";

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  birthDate: "",
  sexo: "",
  contatoEmergenciaNome: "",
  contatoEmergenciaTelefone: "",
  contatoEmergenciaParentesco: "",
  responsavelId: "",
  responsavelParentesco: "",
  responsavelNome: "",
  responsavelTelefone: "",
  zipCode: "",
  address: "",
  addressNumber: "",
  addressComplement: "",
  district: "",
  city: "",
  state: "",
  source: "",
  tags: "",
  internalPreferences: "",
  photoUrl: "",
  notes: ""
};

const originChannels = ["Instagram", "Indicação", "Google", "Passagem na rua", "Outro"];
const sexoOptions = ["Feminino", "Masculino", "Outro", "Prefiro não informar"];
const parentescoOptions = ["Mãe", "Pai", "Avó/Avô", "Tio/Tia", "Responsável legal", "Outro"];

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
  const [modalMode, setModalMode] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [activeTab, setActiveTab] = useState("data");
  const [clientCare, setClientCare] = useState(getClientCare(""));
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, guardSubmit] = useSubmitLock();
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [contactImportSupported, setContactImportSupported] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [error, setError] = useState("");
  const [guardianChoice, setGuardianChoice] = useState("");
  const [guardianSearch, setGuardianSearch] = useState("");
  const { showToast } = useToast();
  const { markStepComplete } = useOnboarding();
  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const isDocumentsLayout = Boolean(selectedClient && activeTab === "documents");
  const activeClientsCount = clients.filter((client) => client.isActive !== false).length;
  const inactiveClientsCount = clients.length - activeClientsCount;
  const formAge = form.birthDate ? calcularIdade(form.birthDate) : null;
  const isMinor = formAge !== null && formAge < 18;
  const guardianCandidates =
    guardianChoice === "link" && guardianSearch.trim().length >= 2
      ? (() => {
          const term = guardianSearch.trim().toLowerCase();
          const digits = term.replace(/\D/g, "");
          return clients
            .filter((client) => client.id !== editing)
            .filter(
              (client) =>
                client.name.toLowerCase().includes(term) ||
                (digits && (client.phone || "").replace(/\D/g, "").includes(digits))
            )
            .slice(0, 8);
        })()
      : [];

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

    api.clientsOverview({ includeInactive: true })
      .then((overview) => {
        if (!active) return;
        setClients(overview.clients || []);
        if (overview.clients?.length) {
          markStepComplete("client", { toast: false });
        }
        setServices(overview.bootstrap?.services || []);
        setProducts(overview.bootstrap?.products || []);
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

  useEffect(() => {
    function handleNewClientRequest() {
      openQuickCreate();
    }

    window.addEventListener("agensync:new-client", handleNewClientRequest);
    return () => window.removeEventListener("agensync:new-client", handleNewClientRequest);
  }, []);

  function openQuickCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setGuardianChoice("");
    setGuardianSearch("");
    setModalMode("quick");
  }

  function openCompleteCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setGuardianChoice("");
    setGuardianSearch("");
    setModalMode("complete");
  }

  function openClient(client, tab = "data") {
    setSelectedClientId(client.id);
    setActiveTab(tab);
    setClientCare(getClientCare(client.id));
  }

  function openClientById(clientId) {
    const client = clients.find((item) => item.id === clientId);
    if (!client) {
      showToast("Cliente não encontrado.", "error");
      return;
    }
    openClient(client, "data");
  }

  function startEdit(client) {
    setEditing(client.id);
    setForm({
      name: client.name,
      phone: client.phone || "",
      email: client.email || "",
      birthDate: client.birthDate || "",
      sexo: client.sexo || "",
      contatoEmergenciaNome: client.contatoEmergenciaNome || "",
      contatoEmergenciaTelefone: client.contatoEmergenciaTelefone || "",
      contatoEmergenciaParentesco: client.contatoEmergenciaParentesco || "",
      responsavelId: client.responsavelId || "",
      responsavelParentesco: client.responsavelParentesco || "",
      responsavelNome: client.responsavelNome || "",
      responsavelTelefone: client.responsavelTelefone || "",
      zipCode: client.zipCode || "",
      address: client.address || "",
      addressNumber: client.addressNumber || "",
      addressComplement: client.addressComplement || "",
      district: client.district || "",
      city: client.city || "",
      state: client.state || "",
      source: client.source || "",
      tags: client.tags || "",
      internalPreferences: client.internalPreferences || "",
      photoUrl: client.photoUrl || "",
      notes: client.notes || ""
    });
    setError("");
    setGuardianChoice(client.responsavelId ? "link" : client.responsavelNome || client.responsavelTelefone ? "manual" : "");
    setGuardianSearch(client.responsavelId ? client.responsavelNome || "" : "");
    setModalMode("complete");
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setGuardianChoice("");
    setGuardianSearch("");
    setModalMode(null);
  }

  function selectGuardian(candidate) {
    setForm((current) => ({
      ...current,
      responsavelId: candidate.id,
      responsavelNome: candidate.name,
      responsavelTelefone: candidate.phone || ""
    }));
    setGuardianSearch(candidate.name);
  }

  function clearGuardian() {
    setGuardianChoice("skip");
    setGuardianSearch("");
    setForm((current) => ({
      ...current,
      responsavelId: "",
      responsavelNome: "",
      responsavelTelefone: "",
      responsavelParentesco: ""
    }));
  }

  function useGuardianAsEmergencyContact() {
    setForm((current) => ({
      ...current,
      contatoEmergenciaNome: current.responsavelNome,
      contatoEmergenciaTelefone: current.responsavelTelefone,
      contatoEmergenciaParentesco: current.responsavelParentesco
    }));
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

  const tagList = form.tags
    ? form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  function addTag(rawTag) {
    const tag = rawTag.trim();
    if (!tag) return;
    if (tagList.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setTagInput("");
      return;
    }
    update("tags", [...tagList, tag].join(","));
    setTagInput("");
  }

  function removeTag(tag) {
    update("tags", tagList.filter((item) => item !== tag).join(","));
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPhotoError("");
    try {
      const dataUrl = await imageFileToDataUrl(file, 480);
      update("photoUrl", dataUrl);
    } catch (err) {
      setPhotoError(err.message);
      showToast(err.message, "error");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const phone = normalizeContactPhone(form.phone);
    if (phone && phone.length < 8) {
      const message = "Informe um telefone válido ou deixe o campo em branco.";
      setError(message);
      showToast(message, "error");
      return;
    }

    const payload = {
      ...form,
      phone,
      contatoEmergenciaTelefone: normalizeContactPhone(form.contatoEmergenciaTelefone),
      responsavelTelefone: normalizeContactPhone(form.responsavelTelefone)
    };

    await guardSubmit(async () => {
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
      }
    });
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
        phone: client.phone || "",
        email: client.email || "",
        birthDate: client.birthDate || "",
        sexo: client.sexo || "",
        contatoEmergenciaNome: client.contatoEmergenciaNome || "",
        contatoEmergenciaTelefone: client.contatoEmergenciaTelefone || "",
        contatoEmergenciaParentesco: client.contatoEmergenciaParentesco || "",
        responsavelId: client.responsavelId || "",
        responsavelParentesco: client.responsavelParentesco || "",
        responsavelNome: client.responsavelNome || "",
        responsavelTelefone: client.responsavelTelefone || "",
        zipCode: client.zipCode || "",
        address: client.address || "",
        addressNumber: client.addressNumber || "",
        addressComplement: client.addressComplement || "",
        district: client.district || "",
        city: client.city || "",
        state: client.state || "",
        source: client.source || "",
        tags: client.tags || "",
        internalPreferences: client.internalPreferences || "",
        photoUrl: client.photoUrl || "",
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
                          {typeof client.idade === "number" && client.idade < 18 ? (
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-amber-600 ring-1 ring-amber-200">
                              {client.idade} anos
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm font-medium text-muted">{client.phone || "Sem telefone"}</p>
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
                        <Button onClick={openQuickCreate}>Adicionar primeiro cliente</Button>
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
              onOpenClient={openClientById}
              showToast={showToast}
            />
          </div>
        ) : null}

        <Card className="order-2 space-y-4 p-4 sm:p-5 xl:sticky xl:top-24 xl:col-start-1 xl:row-start-1 xl:self-start">
          <div>
            <h2 className="text-lg font-black text-ink">Novo cliente</h2>
            <p className="mt-1 text-sm text-muted">Escolha um cadastro rápido ou preencha os dados completos.</p>
          </div>

          <div className="grid gap-2">
            <Button size="lg" onClick={openQuickCreate}>
              Cadastro rápido
            </Button>
            <Button variant="secondary" size="lg" onClick={openCompleteCreate}>
              Cadastro completo
            </Button>
          </div>

          {contactImportSupported ? (
            <Button variant="ghost" className="w-full" onClick={importContact}>
              Importar contato do celular
            </Button>
          ) : null}
        </Card>
      </section>

      {modalMode ? (
        <ModalShell
          title={editing ? "Editar cliente" : modalMode === "quick" ? "Cadastro rápido" : "Cadastro completo"}
          description={
            modalMode === "quick"
              ? "Nome e telefone bastam para começar. Complete os demais dados depois, se quiser."
              : "Telefone e observações ficam disponíveis nos agendamentos."
          }
          onClose={resetForm}
          wide={modalMode === "complete"}
          footer={
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={resetForm} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" form="client-form" loading={saving}>
                {editing ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          }
        >
          <form id="client-form" onSubmit={handleSubmit} className="space-y-5">
            <FormSection title="Identificação">
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-slate-50 text-sm font-black text-slate-400">
                  {form.photoUrl ? (
                    <img src={form.photoUrl} alt="Foto do cliente" className="h-full w-full object-cover" />
                  ) : (
                    (form.name || "?").trim().charAt(0).toUpperCase()
                  )}
                </span>
                <div className="min-w-0">
                  <label
                    htmlFor="client-photo-input"
                    className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-xl border border-line bg-white px-3 text-xs font-black text-ink shadow-sm transition hover:border-brand/40 hover:text-brand"
                  >
                    {form.photoUrl ? "Trocar foto" : "Adicionar foto"}
                  </label>
                  <input
                    id="client-photo-input"
                    type="file"
                    accept={imageAccept()}
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                  {photoError ? <p className="mt-1 text-xs font-bold text-danger">{photoError}</p> : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
                <Field label="Telefone (opcional)">
                  <input
                    minLength={8}
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    className={inputClass}
                    placeholder="(00) 00000-0000"
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Data de nascimento">
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={form.birthDate}
                    onChange={(event) => update("birthDate", event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Idade">
                  <div className={`${inputClass} flex items-center bg-slate-50 text-muted`}>
                    {formAge !== null ? `${formAge} ano(s)` : "—"}
                  </div>
                </Field>
              </div>

              {modalMode === "complete" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="E-mail">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => update("email", event.target.value)}
                      className={inputClass}
                      placeholder="cliente@email.com"
                    />
                  </Field>
                  <Field label="Sexo">
                    <select value={form.sexo} onChange={(event) => update("sexo", event.target.value)} className={inputClass}>
                      <option value="">Não informado</option>
                      {sexoOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : null}
            </FormSection>

            {isMinor ? (
              <FormSection title="Responsável (menor de idade)">
                <p className="text-sm font-bold text-muted">
                  {(form.name || "Este cliente").trim()} tem {formAge} ano(s). Gostaria de afiliar esse cliente com algum
                  cliente que seja Pai/Mãe ou responsável?
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant={guardianChoice === "link" ? "primary" : "secondary"}
                    onClick={() => setGuardianChoice("link")}
                  >
                    Buscar cliente responsável
                  </Button>
                  <Button
                    type="button"
                    variant={guardianChoice === "manual" ? "primary" : "secondary"}
                    onClick={() => setGuardianChoice("manual")}
                  >
                    Sem cadastro
                  </Button>
                  <Button
                    type="button"
                    variant={guardianChoice === "skip" ? "primary" : "secondary"}
                    onClick={clearGuardian}
                  >
                    Pular
                  </Button>
                </div>

                {guardianChoice === "link" ? (
                  <div className="space-y-2">
                    <Field label="Buscar por nome ou telefone">
                      <input
                        value={guardianSearch}
                        onChange={(event) => {
                          setGuardianSearch(event.target.value);
                          if (form.responsavelId) {
                            update("responsavelId", "");
                            update("responsavelNome", "");
                            update("responsavelTelefone", "");
                          }
                        }}
                        className={inputClass}
                        placeholder="Digite o nome ou telefone do responsável"
                      />
                    </Field>

                    {guardianSearch.trim().length >= 2 && !form.responsavelId ? (
                      <div className="max-h-40 overflow-y-auto rounded-xl border border-line">
                        {guardianCandidates.length ? (
                          guardianCandidates.map((candidate) => (
                            <button
                              type="button"
                              key={candidate.id}
                              onClick={() => selectGuardian(candidate)}
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-bold hover:bg-slate-50"
                            >
                              <span>{candidate.name}</span>
                              <span className="text-xs text-muted">{candidate.phone || "Sem telefone"}</span>
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-2 text-xs text-muted">Nenhum cliente encontrado.</p>
                        )}
                      </div>
                    ) : null}

                    {form.responsavelId ? (
                      <div className="flex items-center justify-between rounded-xl border border-line bg-slate-50 p-3">
                        <div>
                          <p className="text-sm font-black text-ink">{form.responsavelNome}</p>
                          <p className="text-xs text-muted">{form.responsavelTelefone || "Sem telefone"}</p>
                        </div>
                        <Button type="button" variant="ghost" onClick={clearGuardian}>
                          Remover
                        </Button>
                      </div>
                    ) : null}

                    <Field label="Parentesco">
                      <select
                        value={form.responsavelParentesco}
                        onChange={(event) => update("responsavelParentesco", event.target.value)}
                        className={inputClass}
                      >
                        <option value="">Selecione</option>
                        {parentescoOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </Field>

                    {form.responsavelId ? (
                      <Button type="button" variant="ghost" onClick={useGuardianAsEmergencyContact}>
                        Usar também como contato de emergência
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {guardianChoice === "manual" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nome do responsável">
                      <input
                        value={form.responsavelNome}
                        onChange={(event) => update("responsavelNome", event.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Telefone do responsável">
                      <input
                        value={form.responsavelTelefone}
                        onChange={(event) => update("responsavelTelefone", event.target.value)}
                        className={inputClass}
                        placeholder="(00) 00000-0000"
                      />
                    </Field>
                    <Field label="Parentesco">
                      <select
                        value={form.responsavelParentesco}
                        onChange={(event) => update("responsavelParentesco", event.target.value)}
                        className={inputClass}
                      >
                        <option value="">Selecione</option>
                        {parentescoOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" onClick={useGuardianAsEmergencyContact}>
                        Usar também como contato de emergência
                      </Button>
                    </div>
                  </div>
                ) : null}
              </FormSection>
            ) : null}

            <FormSection title="Contato de emergência (opcional)">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome">
                  <input
                    value={form.contatoEmergenciaNome}
                    onChange={(event) => update("contatoEmergenciaNome", event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Telefone">
                  <input
                    value={form.contatoEmergenciaTelefone}
                    onChange={(event) => update("contatoEmergenciaTelefone", event.target.value)}
                    className={inputClass}
                    placeholder="(00) 00000-0000"
                  />
                </Field>
                <Field label="Parentesco">
                  <select
                    value={form.contatoEmergenciaParentesco}
                    onChange={(event) => update("contatoEmergenciaParentesco", event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione</option>
                    {parentescoOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value="Amigo(a)">Amigo(a)</option>
                  </select>
                </Field>
              </div>
            </FormSection>

            {modalMode === "complete" ? (
              <>
                <FormSection title="Origem e tags">
                  <Field label="Canal de origem">
                    <select
                      value={form.source}
                      onChange={(event) => update("source", event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Não informado</option>
                      {originChannels.map((channel) => (
                        <option key={channel} value={channel}>
                          {channel}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tags">
                    <div className={`${inputClass} flex h-auto min-h-12 flex-wrap items-center gap-1.5 py-2`}>
                      {tagList.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-black text-brand"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            aria-label={`Remover tag ${tag}`}
                            className="text-brand/70 hover:text-brand"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === ",") {
                            event.preventDefault();
                            addTag(tagInput);
                          }
                        }}
                        onBlur={() => addTag(tagInput)}
                        placeholder={tagList.length ? "" : "Ex.: VIP, Mensalista"}
                        className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-sm font-bold text-ink outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </Field>
                </FormSection>

                <FormSection title="Endereço">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="CEP">
                      <input
                        value={form.zipCode}
                        onChange={(event) => update("zipCode", event.target.value)}
                        className={inputClass}
                        placeholder="00000-000"
                      />
                    </Field>
                    <Field label="Cidade">
                      <input
                        value={form.city}
                        onChange={(event) => update("city", event.target.value)}
                        className={inputClass}
                        placeholder="Cidade"
                      />
                    </Field>
                  </div>
                  <Field label="Endereço">
                    <input
                      value={form.address}
                      onChange={(event) => update("address", event.target.value)}
                      className={inputClass}
                      placeholder="Rua, avenida..."
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Número">
                      <input
                        value={form.addressNumber}
                        onChange={(event) => update("addressNumber", event.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Complemento">
                      <input
                        value={form.addressComplement}
                        onChange={(event) => update("addressComplement", event.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Bairro">
                      <input
                        value={form.district}
                        onChange={(event) => update("district", event.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </FormSection>
              </>
            ) : null}

            <FormSection title="Notas">
              <Field label="Observações">
                <textarea
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  className={`${inputClass} min-h-28 resize-none`}
                  placeholder="Preferências, restrições ou detalhes importantes"
                />
              </Field>
              {modalMode === "complete" ? (
                <Field label="Preferências internas (visível só para a equipe)">
                  <textarea
                    value={form.internalPreferences}
                    onChange={(event) => update("internalPreferences", event.target.value)}
                    className={`${inputClass} min-h-24 resize-none`}
                    placeholder="Notas internas que não aparecem para o cliente"
                  />
                </Field>
              ) : null}
            </FormSection>
          </form>
        </ModalShell>
      ) : null}

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
