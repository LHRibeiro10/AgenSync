import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import Button from "../components/Button.jsx";
import ClientImportSection from "../components/ClientImportSection.jsx";
import Icon from "../components/Icon.jsx";
import Message from "../components/Message.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { useOnboarding } from "../contexts/OnboardingContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { businessTypes, getSuggestedServices } from "../data/businessOnboarding.js";
import {
  DEFAULT_CONFIRMATION_MESSAGE,
  DEFAULT_REMINDER_MESSAGE,
  renderAppointmentMessage,
  WHATSAPP_VARIABLES
} from "../services/appointmentWhatsApp.js";
import {
  disablePushNotifications,
  enablePushNotifications,
  getNotificationSettings,
  notificationOffsetOptions,
  notificationSupport,
  testNotification,
  updateNotificationSettings
} from "../services/notificationService.js";
import { money } from "../utils.js";

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const fieldShellClass =
  "group flex min-h-14 items-center gap-3 rounded-lg border border-[#D8E0EA] bg-white px-3 py-2 shadow-sm transition duration-200 hover:border-brand/40 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10";

const inputClass =
  "min-w-0 flex-1 bg-transparent text-sm font-black text-ink outline-none placeholder:text-zinc-400";

const acceptedLogoTypes = ["image/png", "image/jpeg", "image/webp"];
const maxLogoFileSize = 4 * 1024 * 1024;
const maxLogoDataSize = 900000;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a logo."));
    image.src = src;
  });
}

async function imageFileToLogo(file) {
  if (!acceptedLogoTypes.includes(file.type)) {
    throw new Error("Use uma logo em PNG, JPG ou WEBP.");
  }

  if (file.size > maxLogoFileSize) {
    throw new Error("A logo precisa ter até 4 MB.");
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(rawDataUrl);
  const maxSize = 420;
  const ratio = Math.min(1, maxSize / image.width, maxSize / image.height);
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a logo.");

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const pngDataUrl = canvas.toDataURL("image/png");
  if (pngDataUrl.length <= maxLogoDataSize) return pngDataUrl;

  context.globalCompositeOperation = "destination-over";
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, width, height);
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.86);
  if (jpegDataUrl.length <= maxLogoDataSize) return jpegDataUrl;

  throw new Error("A logo ficou muito grande. Tente uma imagem mais simples.");
}

function LogoPreview({ logo, name, className = "" }) {
  return logo ? (
    <img
      src={logo}
      alt={`Logo ${name || "do negócio"}`}
      className={`h-full w-full rounded-lg object-cover ${className}`}
    />
  ) : (
    <Icon name="building" className={`h-8 w-8 ${className}`} />
  );
}

function SectionHeader({ eyebrow, title, description, icon }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#E2E8F0] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-brand">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-ink">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {icon ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon name={icon} className="h-5 w-5" />
        </span>
      ) : null}
    </div>
  );
}

function InfoField({ label, value, icon }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">{label}</p>
      <div className="mt-2 flex min-h-12 items-center gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3">
        <Icon name={icon} className="h-5 w-5 shrink-0 text-brand" />
        <p className="min-w-0 truncate text-sm font-black text-ink">{value || "Não informado"}</p>
      </div>
    </div>
  );
}

const defaultNotificationSettings = {
  appointmentNotificationsEnabled: true,
  appointmentNotificationOffsetMinutes: 30,
  appointmentNotificationChannels: ["internal", "push"],
  whatsappReminderMessage: DEFAULT_REMINDER_MESSAGE,
  whatsappConfirmationMessage: DEFAULT_CONFIRMATION_MESSAGE
};

const previewAppointment = {
  client: { name: "Maria", phone: "(11) 99999-9999" },
  service: { name: "Limpeza de pele" },
  professional: { name: "Ana" },
  date: "2026-05-21",
  startTime: "14:00",
  price: 120
};

function SwitchControl({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-left transition hover:border-brand/40"
    >
      <span className="min-w-0">
        <span className="block text-sm font-black text-ink">{label}</span>
        {description ? <span className="mt-1 block text-xs leading-5 text-muted">{description}</span> : null}
      </span>
      <span
        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${
          checked ? "justify-end bg-brand" : "justify-start bg-slate-300"
        }`}
      >
        <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
      </span>
    </button>
  );
}

function MessageEditor({ title, value, onChange, onRestore, preview }) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-black text-ink">{title}</h3>
          <p className="mt-1 text-xs font-bold leading-5 text-muted">Use variáveis para personalizar a mensagem.</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onRestore}>
          Restaurar padrão
        </Button>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 min-h-32 w-full resize-y rounded-lg border border-[#D8E0EA] bg-white px-3 py-3 text-sm font-semibold leading-6 text-ink shadow-sm hover:border-brand/40 focus:border-brand focus:ring-4 focus:ring-brand/10"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {WHATSAPP_VARIABLES.map((variable) => (
          <span key={variable} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-brand">
            {variable}
          </span>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">Preview</p>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-ink">{preview}</p>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, updateUserSettings, refreshSession } = useAuth();
  const { showToast } = useToast();
  const { startTour } = useOnboarding();
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [businessLogo, setBusinessLogo] = useState(user?.businessLogo || "");
  const [businessType, setBusinessType] = useState(user?.businessType || "Manicure");
  const [syncSuggestedServices, setSyncSuggestedServices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(defaultNotificationSettings);
  const [initialNotificationSettings, setInitialNotificationSettings] = useState(defaultNotificationSettings);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationTesting, setNotificationTesting] = useState(false);
  const [pushStatus, setPushStatus] = useState(() => notificationSupport());

  useEffect(() => {
    setBusinessName(user?.businessName || "");
    setBusinessLogo(user?.businessLogo || "");
    if (user?.businessType) setBusinessType(user.businessType);
  }, [user?.businessLogo, user?.businessName, user?.businessType]);

  useEffect(() => {
    let active = true;
    setNotificationLoading(true);

    getNotificationSettings()
      .then((data) => {
        if (!active) return;
        const settings = {
          ...defaultNotificationSettings,
          ...(data.settings || {})
        };
        setNotificationSettings(settings);
        setInitialNotificationSettings(settings);
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Nao foi possivel carregar configuracoes de notificacao.");
        }
      })
      .finally(() => {
        if (active) setNotificationLoading(false);
      });

    setPushStatus(notificationSupport());

    return () => {
      active = false;
    };
  }, []);

  const typeOptions = useMemo(() => {
    if (!businessType || businessTypes.some((type) => type.label === businessType)) {
      return businessTypes;
    }

    return [
      {
        id: "current",
        label: businessType,
        icon: "settings",
        description: "Tipo atual personalizado."
      },
      ...businessTypes
    ];
  }, [businessType]);

  const currentType = typeOptions.find((type) => type.label === businessType) || typeOptions[0];
  const isKnownBusinessType = businessTypes.some((type) => type.label === businessType);
  const suggestedServices = useMemo(
    () => (isKnownBusinessType ? getSuggestedServices(businessType) : []),
    [businessType, isKnownBusinessType]
  );
  const hasTypeChanged = Boolean(user?.businessType && businessType !== user.businessType);
  const hasBusinessNameChanged = businessName.trim() !== String(user?.businessName || "").trim();
  const hasLogoChanged = businessLogo !== String(user?.businessLogo || "");
  const hasNotificationChanges =
    JSON.stringify(notificationSettings) !== JSON.stringify(initialNotificationSettings);
  const hasChanges = hasTypeChanged || hasBusinessNameChanged || hasLogoChanged || hasNotificationChanges;
  const reminderPreview = renderAppointmentMessage({
    appointment: previewAppointment,
    user,
    template: notificationSettings.whatsappReminderMessage || DEFAULT_REMINDER_MESSAGE
  });
  const confirmationPreview = renderAppointmentMessage({
    appointment: previewAppointment,
    user,
    template: notificationSettings.whatsappConfirmationMessage || DEFAULT_CONFIRMATION_MESSAGE
  });

  function updateLocalNotificationSettings(patch) {
    setNotificationSettings((current) => ({
      ...current,
      ...patch
    }));
  }

  function selectBusinessType(type) {
    setBusinessType(type.label);
    setError("");
    if (type.label === user?.businessType) {
      setSyncSuggestedServices(false);
    }
  }

  async function addMissingSuggestedServices() {
    const data = await api.listServices();
    const existingNames = new Set((data.services || []).map((service) => normalizeName(service.name)));
    const missingServices = suggestedServices.filter((service) => !existingNames.has(normalizeName(service.name)));

    for (const service of missingServices) {
      await api.createService({
        name: service.name,
        priceDefault: Number(service.priceDefault || 0),
        durationMinutes: Number(service.durationMinutes || 60),
        isActive: true
      });
    }

    return missingServices.length;
  }

  async function handleLogoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const logo = await imageFileToLogo(file);
      setBusinessLogo(logo);
      setError("");
      showToast("Logo carregada. Salve para aplicar.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  function removeLogo() {
    setBusinessLogo("");
    setError("");
    showToast("Logo removida. Salve para aplicar.");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    setSavedFeedback(false);

    try {
      await updateUserSettings({
        businessName: businessName.trim(),
        businessLogo,
        businessType
      });

      const savedNotifications = await updateNotificationSettings(notificationSettings);
      const savedSettings = {
        ...defaultNotificationSettings,
        ...(savedNotifications.settings || notificationSettings)
      };

      setNotificationSettings(savedSettings);
      setInitialNotificationSettings(savedSettings);
      if (savedSettings.appointmentNotificationsEnabled) {
        const pushResult = await enablePushNotifications().catch((err) => ({ enabled: false, reason: err.message }));
        if (!pushResult.enabled && pushResult.reason === "unsupported") {
          showToast("Notificacoes internas ativadas. Push nao e suportado neste navegador.", "error");
        } else if (!pushResult.enabled && pushResult.reason === "permission_denied") {
          showToast("Notificacoes internas ativadas. Permissao de push negada.", "error");
        } else if (!pushResult.enabled && pushResult.reason === "missing_config") {
          showToast("Notificacoes internas ativadas. Push fica preparado para configuracao futura.");
        }
      } else {
        await disablePushNotifications().catch(() => null);
      }

      if (syncSuggestedServices && hasTypeChanged) {
        await addMissingSuggestedServices();
      }

      await refreshSession?.({ silent: true }).catch(() => null);
      setSyncSuggestedServices(false);
      setSavedFeedback(true);
      showToast("Configurações salvas com sucesso");
      window.setTimeout(() => setSavedFeedback(false), 2600);
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestNotification() {
    setNotificationTesting(true);
    setError("");

    try {
      const result = await testNotification();
      setPushStatus(notificationSupport());
      if (result.ok) {
        showToast("Notificação de teste enviada.");
        return;
      }

      if (result.reason === "unsupported") {
        showToast("Este navegador não suporta notificações.", "error");
      } else if (result.reason === "permission_denied") {
        showToast("Permissão de notificação negada neste navegador.", "error");
      } else {
        showToast("Não foi possível testar a notificação.", "error");
      }
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setNotificationTesting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <header className="rounded-lg border border-[#DDE6F0] bg-white p-4 shadow-soft sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand">Central do negócio</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">Configurações</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Organize a identidade do seu negócio, ajuste o tipo de operação e mantenha os dados da conta em um só lugar.
            </p>
          </div>

          <Button type="submit" loading={saving} size="lg" className="hidden rounded-lg px-6 lg:inline-flex">
            <Icon name="check" className="h-5 w-5" />
            Salvar alterações
          </Button>
        </div>
      </header>

      <Message type="error">{error}</Message>

      {savedFeedback ? (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-black text-success">
          <Icon name="check" className="h-5 w-5" />
          Configurações salvas com sucesso.
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-lg border border-[#DDE6F0] bg-white shadow-soft">
            <SectionHeader
              eyebrow="Perfil do negócio"
              title="Como o AgenSync apresenta sua marca"
              description="Este nome aparece nas áreas internas do sistema e ajuda a deixar a experiência mais profissional para o atendimento."
              icon="building"
            />

            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[210px_minmax(0,1fr)]">
              <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-brand/30 bg-brand/5 p-4 text-center">
                <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-white text-brand shadow-sm">
                  <LogoPreview logo={businessLogo} name={businessName} />
                </span>
                <p className="mt-4 text-sm font-black text-ink">Logo do negócio</p>
                <p className="mt-1 text-xs leading-5 text-muted">Use PNG, JPG ou WEBP. A imagem será compactada automaticamente.</p>
                <div className="mt-4 grid w-full gap-2">
                  <label
                    htmlFor="businessLogo"
                    className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-brand bg-brand px-3 text-sm font-black text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-brand-dark active:translate-y-0"
                  >
                    Enviar logo
                  </label>
                  <input
                    id="businessLogo"
                    type="file"
                    accept={acceptedLogoTypes.join(",")}
                    className="sr-only"
                    onChange={handleLogoChange}
                  />
                  {businessLogo ? (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="min-h-10 rounded-lg border border-red-200 bg-white px-3 text-sm font-black text-danger transition duration-200 hover:border-red-300 hover:bg-red-50"
                    >
                      Remover logo
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-black text-ink" htmlFor="businessName">
                    Nome do negócio
                  </label>
                  <div className={`mt-2 ${fieldShellClass}`}>
                    <Icon name="building" className="h-5 w-5 shrink-0 text-brand" />
                    <input
                      id="businessName"
                      required
                      minLength={2}
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      className={inputClass}
                      placeholder="Ex: Studio AgenSync"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">Prévia no sistema</p>
                  <div className="mt-3 flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-brand text-white">
                      <LogoPreview logo={businessLogo} name={businessName} className={businessLogo ? "bg-white" : "h-5 w-5"} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-ink">
                        {businessName.trim() || "Nome do negócio"}
                      </p>
                      <p className="text-xs font-bold text-muted">Aparece como identidade principal do AgenSync.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-[#DDE6F0] bg-white shadow-soft">
            <SectionHeader
              eyebrow="Tipo de negócio"
              title="Sugestões certas para começar mais rápido"
              description="Isso define sugestões de serviços e organização inicial do sistema."
              icon={currentType?.icon || "settings"}
            />

            <div className="space-y-5 p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                {typeOptions.map((type) => {
                  const active = type.label === businessType;

                  return (
                    <button
                      key={type.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectBusinessType(type)}
                      className={`group min-h-[154px] rounded-lg border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-panel focus:outline-none focus:ring-4 focus:ring-brand/15 ${
                        active
                          ? "border-brand bg-brand/5 shadow-[0_16px_36px_rgba(37,99,235,0.18)]"
                          : "border-[#E2E8F0] bg-white hover:border-brand/40"
                      }`}
                    >
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-lg transition duration-200 ${
                          active ? "bg-brand text-white" : "bg-[#EFF6FF] text-brand group-hover:bg-brand group-hover:text-white"
                        }`}
                      >
                        <Icon name={type.icon} className="h-6 w-6" />
                      </span>

                      <span className="mt-4 flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-base font-black text-ink">{type.label}</span>
                          <span className="mt-2 block text-sm leading-5 text-muted">{type.description}</span>
                        </span>
                        {active ? (
                          <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white">
                            Ativo
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-sm font-black text-ink">Serviços sugeridos para {businessType}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestedServices.length ? (
                      suggestedServices.map((service) => (
                        <span
                          key={service.id}
                          className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-black text-brand"
                        >
                          {service.name} · {money(service.priceDefault)}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-black text-muted">
                        Escolha um tipo padrão para ver sugestões automáticas.
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Tipo atual</p>
                  <p className="mt-1 text-lg font-black text-ink">{businessType}</p>
                </div>
              </div>

              {hasTypeChanged ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 transition duration-200 hover:border-brand/40">
                  <input
                    type="checkbox"
                    checked={syncSuggestedServices}
                    onChange={(event) => setSyncSuggestedServices(event.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 accent-brand"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-ink">
                      Deseja atualizar seus serviços automaticamente com base nesse tipo?
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted">
                      O AgenSync adiciona apenas sugestões que ainda não existem. Nenhum serviço atual será apagado.
                    </span>
                  </span>
                </label>
              ) : (
                <div className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold leading-6 text-muted">
                  Alterar o tipo não limita recursos e não remove clientes, agenda, financeiro ou serviços já cadastrados.
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-[#DDE6F0] bg-white shadow-soft">
            <SectionHeader
              eyebrow="Agenda"
              title="Notificações de agendamento"
              description="Defina se o AgenSync deve avisar antes dos atendimentos e com quanto tempo de antecedência."
              icon="bell"
            />

            <div className="space-y-5 p-4 sm:p-5">
              {notificationLoading ? (
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm font-black text-muted">
                  Carregando preferências de notificação...
                </div>
              ) : null}

              <SwitchControl
                checked={notificationSettings.appointmentNotificationsEnabled}
                onChange={(checked) => updateLocalNotificationSettings({ appointmentNotificationsEnabled: checked })}
                label={notificationSettings.appointmentNotificationsEnabled ? "Ativar notificações: Sim" : "Ativar notificações: Não"}
                description="Quando ativo, lembretes internos são criados antes dos agendamentos futuros."
              />

              <div>
                <label className="text-sm font-black text-ink" htmlFor="appointmentNotificationOffset">
                  Tempo antes do agendamento
                </label>
                <select
                  id="appointmentNotificationOffset"
                  value={notificationSettings.appointmentNotificationOffsetMinutes}
                  onChange={(event) =>
                    updateLocalNotificationSettings({ appointmentNotificationOffsetMinutes: Number(event.target.value) })
                  }
                  className="mt-2 min-h-12 w-full rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-black text-ink shadow-sm focus:border-brand focus:ring-4 focus:ring-brand/10"
                >
                  {notificationOffsetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Tipo de notificação</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-blue-100 bg-white p-3">
                    <input
                      type="checkbox"
                      checked={notificationSettings.appointmentNotificationChannels?.includes("internal")}
                      onChange={() => {}}
                      disabled
                      className="mt-1 h-5 w-5 accent-brand"
                    />
                    <span>
                      <span className="block text-sm font-black text-ink">Notificação interna</span>
                      <span className="mt-1 block text-xs leading-5 text-muted">Central do sistema e sino no layout.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-blue-100 bg-white p-3">
                    <input
                      type="checkbox"
                      checked={notificationSettings.appointmentNotificationChannels?.includes("push")}
                      onChange={(event) => {
                        const nextChannels = event.target.checked
                          ? [...new Set([...(notificationSettings.appointmentNotificationChannels || []), "push"])]
                          : (notificationSettings.appointmentNotificationChannels || []).filter((channel) => channel !== "push");
                        updateLocalNotificationSettings({ appointmentNotificationChannels: ["internal", ...nextChannels.filter((channel) => channel !== "internal")] });
                      }}
                      className="mt-1 h-5 w-5 accent-brand"
                    />
                    <span>
                      <span className="block text-sm font-black text-ink">Push notification</span>
                      <span className="mt-1 block text-xs leading-5 text-muted">Usa Notification API quando o navegador permitir.</span>
                    </span>
                  </label>
                </div>
                <p className="mt-3 text-xs font-bold leading-5 text-muted">
                  Email e WhatsApp automático ficam apenas preparados para etapas futuras.
                </p>
              </div>

              {!pushStatus.notificationApi ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-warning">
                  Este navegador não suporta notificações push. A central interna continua funcionando normalmente.
                </div>
              ) : pushStatus.permission === "denied" ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-danger">
                  A permissão de notificação foi negada neste navegador. Ative nas configurações do navegador para receber push.
                </div>
              ) : null}

              <Button type="button" variant="secondary" loading={notificationTesting} loadingLabel="Testando..." onClick={handleTestNotification}>
                <Icon name="bell" className="h-5 w-5" />
                Testar notificação
              </Button>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-[#DDE6F0] bg-white shadow-soft">
            <SectionHeader
              eyebrow="WhatsApp manual"
              title="Mensagens do WhatsApp"
              description="Edite os textos usados no preview antes de copiar ou abrir o WhatsApp. O envio continua manual."
              icon="message"
            />

            <div className="space-y-4 bg-[#F8FAFC] p-4 sm:p-5">
              <MessageEditor
                title="Lembrete de atendimento"
                value={notificationSettings.whatsappReminderMessage || DEFAULT_REMINDER_MESSAGE}
                onChange={(value) => updateLocalNotificationSettings({ whatsappReminderMessage: value })}
                onRestore={() => updateLocalNotificationSettings({ whatsappReminderMessage: DEFAULT_REMINDER_MESSAGE })}
                preview={reminderPreview}
              />
              <MessageEditor
                title="Confirmação de comparecimento"
                value={notificationSettings.whatsappConfirmationMessage || DEFAULT_CONFIRMATION_MESSAGE}
                onChange={(value) => updateLocalNotificationSettings({ whatsappConfirmationMessage: value })}
                onRestore={() => updateLocalNotificationSettings({ whatsappConfirmationMessage: DEFAULT_CONFIRMATION_MESSAGE })}
                preview={confirmationPreview}
              />
            </div>
          </section>

          <ClientImportSection />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <section className="overflow-hidden rounded-lg border border-[#DDE6F0] bg-white shadow-soft">
            <SectionHeader
              eyebrow="Conta"
              title="Dados de acesso"
              description="Informações usadas para identificar sua conta no AgenSync."
              icon="user"
            />

            <div className="space-y-4 p-4 sm:p-5">
              <InfoField label="Nome" value={user?.name} icon="user" />
              <InfoField label="Email" value={user?.email} icon="mail" />
              <InfoField label="Negócio" value={businessName || user?.businessName} icon="building" />
            </div>
          </section>

          <section className="rounded-lg border border-[#DDE6F0] bg-white p-4 shadow-soft sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Aparência</p>
            <h2 className="mt-2 text-xl font-black text-ink">Tema do sistema</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Escolha entre modo claro e modo noturno. O AgenSync mantém sua preferência neste navegador.
            </p>
            <ThemeToggle className="mt-4" />
          </section>

          <section className="rounded-lg border border-[#DDE6F0] bg-white p-4 shadow-soft sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Resumo</p>
            <h2 className="mt-2 text-xl font-black text-ink">Pronto para salvar</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Revise os dados e salve para aplicar a identidade do negócio e o tipo escolhido.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[#F8FAFC] px-3 py-3">
                <span className="text-sm font-bold text-muted">Alterações</span>
                <span className={`text-sm font-black ${hasChanges ? "text-brand" : "text-muted"}`}>
                  {hasChanges ? "Pendentes" : "Sem mudanças"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[#F8FAFC] px-3 py-3">
                <span className="text-sm font-bold text-muted">Serviços sugeridos</span>
                <span className="text-sm font-black text-ink">{syncSuggestedServices ? "Adicionar" : "Manter"}</span>
              </div>
            </div>

            <Button type="submit" loading={saving} size="lg" className="mt-5 w-full rounded-lg">
              <Icon name="check" className="h-5 w-5" />
              Salvar configurações
            </Button>
            <Button type="button" variant="secondary" size="lg" className="mt-3 hidden w-full rounded-lg lg:inline-flex" onClick={startTour}>
              <Icon name="appointments" className="h-5 w-5" />
              Assistir tutorial
            </Button>
          </section>
        </aside>
      </section>
      <button
        type="button"
        onClick={startTour}
        className="fixed bottom-5 left-5 z-[54] inline-flex min-h-12 max-w-[calc(100vw-6rem)] items-center justify-center gap-2 rounded-full border border-blue-200 bg-white px-4 text-sm font-black text-brand shadow-[0_16px_34px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 active:translate-y-0 active:scale-95 sm:bottom-6 sm:left-6 lg:hidden"
        aria-label="Assistir tutorial"
      >
        <Icon name="appointments" className="h-4 w-4" />
        Assistir tutorial
      </button>
    </form>
  );
}

