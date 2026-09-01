import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo.jsx";
import Button from "../components/Button.jsx";
import Icon from "../components/Icon.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { businessTypes, createBlankService, findBusinessType, getSuggestedServices } from "../data/businessOnboarding.js";
import { getCurrentPlan } from "../config/plans.js";
import {
  completeInitialOnboarding,
  getInitialOnboardingStatus,
  saveInitialBusiness,
  saveInitialBusinessType,
  saveInitialClients,
  saveInitialProfessionals,
  saveInitialServices
} from "../services/initialOnboardingService.js";

const steps = [
  { key: "business", label: "Negócio", title: "Vamos configurar seu negócio" },
  { key: "type", label: "Tipo", title: "Escolha o tipo de negócio" },
  { key: "services", label: "Serviços", title: "Escolha os serviços que você oferece" },
  { key: "professionals", label: "Profissionais", title: "Cadastre quem realiza os atendimentos" },
  { key: "clients", label: "Clientes", title: "Adicione seus primeiros clientes" },
  { key: "finish", label: "Finalizar", title: "Seu AgenSync está quase pronto" }
];

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clientDraft() {
  return {
    id: `client_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: "",
    phone: "",
    email: "",
    notes: ""
  };
}

function professionalDraft(user) {
  return {
    id: `professional_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: user?.name || "",
    email: "",
    phone: "",
    role: "Profissional principal",
    monthlyGoal: "",
    isActive: true
  };
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-ink">{label}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

const inputClass =
  "min-h-12 w-full rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink shadow-sm outline-none placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10";

export default function InitialOnboarding() {
  const navigate = useNavigate();
  const { user, refreshSession } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [counts, setCounts] = useState({ services: 0, professionals: 0, clients: 0 });
  const [business, setBusiness] = useState({
    businessName: "",
    businessPhone: "",
    businessCity: "",
    businessAddress: ""
  });
  const [businessType, setBusinessType] = useState("Outro");
  const [businessTypeCustom, setBusinessTypeCustom] = useState("");
  const [services, setServices] = useState(() => getSuggestedServices("Outro"));
  const [professionals, setProfessionals] = useState(() => [professionalDraft(user)]);
  const [clients, setClients] = useState([]);

  const activeStep = steps[stepIndex];
  const selectedType = findBusinessType(businessType);
  const selectedServices = services.filter((service) => service.selected !== false && service.name.trim());
  const validClients = clients.filter((client) => client.name.trim() && client.phone.trim());
  const currentPlan = getCurrentPlan(user);
  const reachedProfessionalLimit = professionals.length >= currentPlan.maxProfessionals;
  const summary = useMemo(
    () => ({
      businessName: business.businessName || user?.businessName || "Seu negócio",
      type: selectedType.id === "personalizada" ? businessTypeCustom || "Personalizada" : businessType,
      services: Math.max(counts.services || 0, selectedServices.length),
      professionals: Math.max(counts.professionals || 0, professionals.filter((item) => item.name.trim()).length),
      clients: Math.max(counts.clients || 0, validClients.length)
    }),
    [business.businessName, businessType, businessTypeCustom, counts, professionals, selectedServices.length, selectedType.id, user?.businessName, validClients.length]
  );

  useEffect(() => {
    let active = true;

    getInitialOnboardingStatus()
      .then((data) => {
        if (!active) return;
        if (data.onboardingCompleted && !data.onboardingRequired) {
          navigate("/", { replace: true });
          return;
        }

        const nextUser = data.user || user || {};
        setCounts(data.counts || {});
        setBusiness({
          businessName: nextUser.businessName || "",
          businessPhone: nextUser.businessPhone || "",
          businessCity: nextUser.businessCity || "",
          businessAddress: nextUser.businessAddress || ""
        });
        setBusinessType(nextUser.businessType || "Outro");
        setBusinessTypeCustom(nextUser.businessTypeCustom || "");
        setServices(getSuggestedServices(nextUser.businessType || "Outro"));
        setProfessionals([professionalDraft(nextUser)]);
      })
      .catch((err) => {
        if (active) setError(err.message || "Não foi possível carregar o onboarding.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate, user]);

  function updateBusiness(field, value) {
    setBusiness((current) => ({ ...current, [field]: value }));
  }

  function selectType(type) {
    setBusinessType(type.label);
    if (type.id !== "personalizada") setBusinessTypeCustom("");
    setServices(getSuggestedServices(type.id));
  }

  function updateService(id, patch) {
    setServices((current) => current.map((service) => (service.id === id ? { ...service, ...patch } : service)));
  }

  function removeService(id) {
    setServices((current) => current.filter((service) => service.id !== id));
  }

  function updateProfessional(id, patch) {
    setProfessionals((current) =>
      current.map((professional) => (professional.id === id ? { ...professional, ...patch } : professional))
    );
  }

  function updateClient(id, patch) {
    setClients((current) => current.map((client) => (client.id === id ? { ...client, ...patch } : client)));
  }

  async function saveCurrentStep({ skip = false } = {}) {
    if (activeStep.key === "business") {
      if (!business.businessName.trim()) throw new Error("Informe o nome do negócio.");
      return saveInitialBusiness(business);
    }

    if (activeStep.key === "type") {
      if (selectedType.id === "personalizada" && !businessTypeCustom.trim()) {
        throw new Error("Informe qual tipo de serviço você presta.");
      }
      return saveInitialBusinessType({ businessType, businessTypeCustom });
    }

    if (activeStep.key === "services") {
      if (skip) return saveInitialServices({ skip: true });
      if (!selectedServices.length) throw new Error("Adicione pelo menos um serviço ou pule esta etapa.");
      return saveInitialServices({
        services: selectedServices.map((service) => ({
          name: service.name,
          priceDefault: cleanNumber(service.priceDefault),
          durationMinutes: Number(service.durationMinutes) || 60,
          isActive: service.isActive !== false
        }))
      });
    }

    if (activeStep.key === "professionals") {
      const activeProfessionals = professionals.filter((professional) => professional.name.trim());
      if (!activeProfessionals.length) throw new Error("Mantenha pelo menos um profissional.");
      return saveInitialProfessionals({ professionals: activeProfessionals });
    }

    if (activeStep.key === "clients") {
      if (skip || !validClients.length) return saveInitialClients({ skip: true });
      return saveInitialClients({ clients: validClients });
    }

    return null;
  }

  async function goNext(options = {}) {
    setError("");
    setSaving(true);

    try {
      if (activeStep.key === "finish") {
        const data = await completeInitialOnboarding();
        setCounts(data.counts || counts);
        await refreshSession?.({ silent: true }).catch(() => null);
        showToast("Onboarding concluído. Sua conta está pronta.");
        navigate("/", { replace: true });
        return;
      }

      const data = await saveCurrentStep(options);
      if (data?.counts) setCounts(data.counts);
      if (options.skip) showToast("Etapa pulada. Você pode completar depois.");
      setStepIndex((current) => Math.min(current + 1, steps.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Não foi possível salvar esta etapa.");
      showToast(err.message || "Não foi possível salvar esta etapa.", "error");
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    setError("");
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  if (loading) return <Loading label="Preparando configuração inicial..." />;

  return (
    <main className="min-h-screen bg-canvas px-4 py-5 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white px-4 py-3 shadow-soft">
          <BrandLogo src="/AgenSync_sidebar.png" className="h-11 w-40" />
          <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-brand">
            Setup inicial
          </span>
        </header>

        <section className="mt-5 grid flex-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-line bg-white p-4 shadow-soft lg:self-start">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Em poucos minutos</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-ink">Seu sistema pronto para uso</h1>
            <div className="mt-5 space-y-2">
              {steps.map((step, index) => {
                const active = index === stepIndex;
                const done = index < stepIndex;
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => index < stepIndex && setStepIndex(index)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-brand bg-blue-50 text-brand"
                        : done
                          ? "border-green-200 bg-green-50 text-success"
                          : "border-line bg-white text-muted"
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-black shadow-sm">
                      {done ? <Icon name="check" className="h-4 w-4" /> : index + 1}
                    </span>
                    <span className="text-sm font-black">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <form
            className="flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-soft"
            onSubmit={(event) => {
              event.preventDefault();
              goNext();
            }}
          >
            <div className="border-b border-line p-4 sm:p-6">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-300"
                  style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
                />
              </div>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-brand">
                Etapa {stepIndex + 1} de {steps.length}
                {stepIndex + 1 < steps.length
                  ? ` · ~${Math.max(1, Math.ceil(((steps.length - stepIndex - 1) * 20) / 60))} minuto(s) restante(s)`
                  : " · Quase lá!"}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">{activeStep.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                Em poucos minutos seu sistema já estará pronto para o primeiro agendamento.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <Message type="error">{error}</Message>

              {activeStep.key === "business" ? (
                <div className="grid gap-4">
                  <Field label="Nome do negócio">
                    <input
                      required
                      value={business.businessName}
                      onChange={(event) => updateBusiness("businessName", event.target.value)}
                      className={inputClass}
                      placeholder="Nome do seu negócio"
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Telefone do negócio">
                      <input
                        value={business.businessPhone}
                        onChange={(event) => updateBusiness("businessPhone", event.target.value)}
                        className={inputClass}
                        placeholder="(11) 99999-9999"
                      />
                    </Field>
                    <Field label="Cidade">
                      <input
                        value={business.businessCity}
                        onChange={(event) => updateBusiness("businessCity", event.target.value)}
                        className={inputClass}
                        placeholder="São Paulo"
                      />
                    </Field>
                  </div>
                  <Field label="Endereço">
                    <input
                      value={business.businessAddress}
                      onChange={(event) => updateBusiness("businessAddress", event.target.value)}
                      className={inputClass}
                      placeholder="Rua, número e bairro"
                    />
                  </Field>
                </div>
              ) : null}

              {activeStep.key === "type" ? (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {businessTypes.map((type) => {
                      const active = type.label === businessType || type.id === findBusinessType(businessType).id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => selectType(type)}
                          className={`min-h-32 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-panel ${
                            active ? "border-brand bg-blue-50 text-brand" : "border-line bg-white text-ink hover:border-brand/40"
                          }`}
                        >
                          <Icon name={type.icon} className="h-6 w-6" />
                          <span className="mt-3 block text-base font-black">{type.label}</span>
                          <span className="mt-1 block text-sm font-semibold leading-5 text-muted">{type.description}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedType.id === "personalizada" ? (
                    <Field label="Qual tipo de serviço você presta?">
                      <input
                        required
                        value={businessTypeCustom}
                        onChange={(event) => setBusinessTypeCustom(event.target.value)}
                        className={inputClass}
                        placeholder="Ex: Consultoria, terapia, aulas particulares"
                      />
                    </Field>
                  ) : null}
                </div>
              ) : null}

              {activeStep.key === "services" ? (
                <div className="space-y-3">
                  <div className="hidden rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-muted sm:grid sm:grid-cols-[auto_minmax(0,1.4fr)_140px_140px_auto] sm:items-center sm:gap-3">
                    <span>Status</span>
                    <span>Serviço</span>
                    <span>Valor (R$)</span>
                    <span>Duração (min)</span>
                    <span>Ação</span>
                  </div>
                  {services.map((service) => (
                    <div key={service.id} className="grid gap-3 rounded-xl border border-line bg-slate-50 p-3 sm:grid-cols-[auto_minmax(0,1.4fr)_140px_140px_auto] sm:items-end">
                      <label className="flex min-h-12 items-center gap-2 text-sm font-black text-ink">
                        <input
                          type="checkbox"
                          checked={service.selected !== false}
                          onChange={(event) => updateService(service.id, { selected: event.target.checked })}
                          className="h-5 w-5 accent-brand"
                        />
                        Ativo
                      </label>
                      <Field label="Nome do serviço">
                        <input
                          value={service.name}
                          onChange={(event) => updateService(service.id, { name: event.target.value })}
                          className={inputClass}
                          placeholder="Ex: Consulta"
                        />
                      </Field>
                      <Field label="Valor cobrado">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-muted">
                            R$
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={service.priceDefault}
                            onChange={(event) => updateService(service.id, { priceDefault: event.target.value })}
                            className={`${inputClass} pl-10`}
                            placeholder="0,00"
                          />
                        </div>
                      </Field>
                      <Field label="Duração">
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            value={service.durationMinutes}
                            onChange={(event) => updateService(service.id, { durationMinutes: event.target.value })}
                            className={`${inputClass} pr-12`}
                            placeholder="60"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black uppercase text-muted">
                            min
                          </span>
                        </div>
                      </Field>
                      <Button type="button" variant="secondary" className="min-h-12" onClick={() => removeService(service.id)}>
                        Remover
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" onClick={() => setServices((current) => [...current, createBlankService()])}>
                    Adicionar serviço
                  </Button>
                </div>
              ) : null}

              {activeStep.key === "professionals" ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <p className="text-sm font-black text-brand">
                      Seu plano {currentPlan.displayName} permite até {currentPlan.maxProfessionals} profissional
                      {currentPlan.maxProfessionals === 1 ? "" : "is"}.
                    </p>
                    {reachedProfessionalLimit ? (
                      <p className="mt-1 text-sm font-semibold leading-6 text-blue-900">
                        Você atingiu o limite do seu plano. Faça upgrade para cadastrar mais profissionais agora, ou
                        continue e adicione os demais depois.
                      </p>
                    ) : null}
                  </div>

                  {professionals.map((professional) => (
                    <div key={professional.id} className="grid gap-3 rounded-xl border border-line bg-slate-50 p-3 sm:grid-cols-2">
                      <Field label="Nome">
                        <input
                          required
                          value={professional.name}
                          onChange={(event) => updateProfessional(professional.id, { name: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Telefone">
                        <input
                          value={professional.phone}
                          onChange={(event) => updateProfessional(professional.id, { phone: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Email">
                        <input
                          type="email"
                          value={professional.email}
                          onChange={(event) => updateProfessional(professional.id, { email: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Meta mensal">
                        <input
                          type="number"
                          min="0"
                          value={professional.monthlyGoal}
                          onChange={(event) => updateProfessional(professional.id, { monthlyGoal: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  ))}
                  {reachedProfessionalLimit ? (
                    <Button type="button" variant="secondary" onClick={() => navigate("/configuracoes")}>
                      Fazer upgrade de plano
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setProfessionals((current) => [...current, professionalDraft(user)])}
                    >
                      Adicionar profissional
                    </Button>
                  )}
                </div>
              ) : null}

              {activeStep.key === "clients" ? (
                <div className="space-y-3">
                  {!clients.length ? (
                    <div className="rounded-xl border border-dashed border-line bg-slate-50 p-5 text-center">
                      <p className="text-base font-black text-ink">Você pode começar sem clientes cadastrados.</p>
                      <p className="mt-1 text-sm font-semibold text-muted">Adicione agora ou pule e cadastre depois.</p>
                    </div>
                  ) : null}
                  {clients.map((client) => (
                    <div key={client.id} className="grid gap-3 rounded-xl border border-line bg-slate-50 p-3 sm:grid-cols-2">
                      <Field label="Nome">
                        <input
                          value={client.name}
                          onChange={(event) => updateClient(client.id, { name: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Telefone">
                        <input
                          value={client.phone}
                          onChange={(event) => updateClient(client.id, { phone: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Email">
                        <input
                          type="email"
                          value={client.email}
                          onChange={(event) => updateClient(client.id, { email: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Observação">
                        <input
                          value={client.notes}
                          onChange={(event) => updateClient(client.id, { notes: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="secondary"
                        className="sm:col-span-2"
                        onClick={() => setClients((current) => current.filter((item) => item.id !== client.id))}
                      >
                        Remover cliente
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" onClick={() => setClients((current) => [...current, clientDraft()])}>
                    Adicionar cliente
                  </Button>
                </div>
              ) : null}

              {activeStep.key === "finish" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Negócio", summary.businessName],
                    ["Tipo", summary.type],
                    ["Serviços", summary.services],
                    ["Profissionais", summary.professionals],
                    ["Clientes", summary.clients]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-line bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">{label}</p>
                      <p className="mt-2 text-2xl font-black text-ink">{value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <footer className="sticky bottom-0 grid gap-2 border-t border-line bg-white/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:p-5">
              <Button type="button" variant="secondary" onClick={goBack} disabled={stepIndex === 0 || saving}>
                Voltar
              </Button>
              <div className="grid gap-2 sm:flex sm:items-center">
                {["services", "clients"].includes(activeStep.key) ? (
                  <Button type="button" variant="secondary" loading={saving} onClick={() => goNext({ skip: true })}>
                    Pular etapa
                  </Button>
                ) : null}
                <Button type="submit" loading={saving} size="lg">
                  {activeStep.key === "finish" ? "Ir para o Dashboard" : "Continuar"}
                </Button>
              </div>
            </footer>
          </form>
        </section>
      </div>
    </main>
  );
}
