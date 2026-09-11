import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Button from "../Button.jsx";
import Icon from "../Icon.jsx";
import {
  buildAppointmentWhatsAppUrl,
  copyWithFallback,
  DEFAULT_CANCELLATION_MESSAGE,
  DEFAULT_CONFIRMATION_MESSAGE,
  DEFAULT_REMINDER_MESSAGE,
  normalizeWhatsAppPhone,
  renderAppointmentMessage,
  resolveClientWhatsAppPhone,
  WHATSAPP_VARIABLES
} from "../../services/appointmentWhatsApp.js";

function appointmentClient(appointment) {
  return appointment?.client?.name || appointment?.client || "Cliente";
}

const modeConfig = {
  reminder: {
    title: "Enviar lembrete",
    fallbackTemplate: DEFAULT_REMINDER_MESSAGE
  },
  confirmation: {
    title: "Confirmar comparecimento",
    fallbackTemplate: DEFAULT_CONFIRMATION_MESSAGE
  },
  cancellation: {
    title: "Enviar cancelamento",
    fallbackTemplate: DEFAULT_CANCELLATION_MESSAGE
  }
};

export default function AppointmentWhatsAppModal({
  appointment,
  mode = "confirmation",
  open,
  onClose,
  showToast,
  template,
  user
}) {
  const [message, setMessage] = useState("");

  const activeMode = modeConfig[mode] || modeConfig.confirmation;
  const title = activeMode.title;
  const fallbackTemplate = template || activeMode.fallbackTemplate;
  const resolvedPhone = resolveClientWhatsAppPhone(appointment?.client);
  const usingGuardianPhone = Boolean(!appointment?.client?.phone && resolvedPhone);
  const phoneStatus = useMemo(() => normalizeWhatsAppPhone(resolvedPhone), [resolvedPhone]);
  const hasValidPhone = phoneStatus.valid;

  useEffect(() => {
    if (open && appointment) {
      setMessage(renderAppointmentMessage({ appointment, user, template: fallbackTemplate }));
    }
  }, [appointment, fallbackTemplate, open, user]);

  if (!open || !appointment) return null;
  const canUsePortal = typeof document !== "undefined";

  async function copyMessage() {
    try {
      await copyWithFallback(message);
      showToast("Mensagem copiada.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function openWhatsApp() {
    if (!hasValidPhone) {
      showToast(phoneStatus.error, "error");
      return;
    }

    window.open(buildAppointmentWhatsAppUrl(resolvedPhone, message), "_blank", "noopener,noreferrer");
  }

  const modal = (
    <div className="agensync-overlay z-[90] flex items-end bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <div
        className="max-h-[92dvh] w-full overflow-hidden rounded-t-[28px] border border-[#E2E8F0] bg-white shadow-panel sm:max-w-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">WhatsApp manual</p>
            <h2 className="mt-2 text-xl font-black text-ink">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {appointmentClient(appointment)} · {appointment.startTime}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-lg font-black text-slate-500 transition hover:bg-slate-50"
            aria-label="Fechar"
          >
            X
          </button>
        </header>

        <div className="max-h-[calc(92dvh-92px)] overflow-y-auto p-4 sm:p-5">
          <div className={`rounded-xl border px-4 py-3 ${hasValidPhone ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"}`}>
            <div className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  hasValidPhone ? "bg-green-100 text-success" : "bg-red-100 text-danger"
                }`}
              >
                <Icon name="message" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">
                  {usingGuardianPhone ? "Telefone do responsável" : "Telefone do cliente"}
                </p>
                <p className={`mt-1 break-words text-base font-black ${hasValidPhone ? "text-success" : "text-danger"}`}>
                  {resolvedPhone || "Telefone não cadastrado"}
                </p>
                {!hasValidPhone ? <p className="mt-1 text-sm font-medium text-danger">{phoneStatus.error}</p> : null}
              </div>
            </div>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-black text-ink">Mensagem</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="mt-2 min-h-60 w-full resize-y rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm font-semibold leading-6 text-ink shadow-sm transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {WHATSAPP_VARIABLES.map((variable) => (
              <span key={variable} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-brand">
                {variable}
              </span>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Fechar
            </Button>
            <Button variant="secondary" className="w-full" onClick={copyMessage}>
              Copiar mensagem
            </Button>
            <Button className="w-full" onClick={openWhatsApp} disabled={!hasValidPhone}>
              Abrir WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return canUsePortal ? createPortal(modal, document.body) : modal;
}
