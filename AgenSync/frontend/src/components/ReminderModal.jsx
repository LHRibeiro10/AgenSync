import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { buildReminderMessage, buildWhatsappUrl, formatReminderDate, isValidWhatsappPhone, reminderSettingsFromUser } from "../services/reminders.js";
import Button from "./Button.jsx";
import { inputClass } from "./Field.jsx";
import Icon from "./Icon.jsx";
import { useToast } from "./Toast.jsx";

function InfoItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-black text-ink">{value || "Não informado"}</p>
    </div>
  );
}

export default function ReminderModal({ appointment, onClose }) {
  const [message, setMessage] = useState("");
  const { user } = useAuth();
  const { showToast } = useToast();
  const open = Boolean(appointment);
  const phone = appointment?.client?.phone || "";
  const whatsappUrl = buildWhatsappUrl(phone, message);
  const reminderSettings = reminderSettingsFromUser(user);

  useEffect(() => {
    if (appointment) setMessage(buildReminderMessage(appointment, user));
  }, [appointment, user]);

  if (!open) return null;

  async function copyMessage() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        const element = document.createElement("textarea");
        element.value = message;
        element.setAttribute("readonly", "");
        element.style.position = "absolute";
        element.style.left = "-9999px";
        document.body.appendChild(element);
        element.select();
        document.execCommand("copy");
        document.body.removeChild(element);
      }
      showToast("Mensagem copiada.");
    } catch {
      showToast("Não foi possível copiar a mensagem.", "error");
    }
  }

  function openWhatsapp() {
    if (!phone) {
      showToast("Cadastre um telefone para abrir o WhatsApp.", "error");
      return;
    }

    if (!isValidWhatsappPhone(phone)) {
      showToast("Telefone do cliente invalido. Revise o cadastro antes de enviar.", "error");
      return;
    }

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    showToast("Lembrete preparado para envio no WhatsApp.");
  }

  return (
    <div className="agensync-overlay z-50 flex items-end bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Fechar lembrete" />
      <section className="relative w-full rounded-[28px] border border-white/80 bg-white p-4 shadow-panel sm:max-w-xl sm:p-5">
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-brand">
              <Icon name="message" className="h-4 w-4" />
              Lembrete
            </span>
            <h2 className="mt-3 text-xl font-black tracking-tight text-ink">Enviar lembrete ao cliente</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              Revise a mensagem configurada antes de copiar ou abrir no WhatsApp.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-lg font-black text-ink transition active:scale-95"
            aria-label="Fechar"
          >
            X
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoItem label="Cliente" value={appointment.client?.name} />
          <InfoItem label="Telefone" value={phone || "Sem telefone cadastrado"} />
          <InfoItem label="Data" value={formatReminderDate(appointment.date)} />
          <InfoItem label="Horário" value={appointment.startTime} />
          <div className="sm:col-span-2">
            <InfoItem label="Serviço" value={appointment.service?.name} />
          </div>
        </div>

        {!phone ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
            Este cliente ainda não tem telefone cadastrado. Você ainda pode copiar a mensagem.
          </div>
        ) : null}

        {!reminderSettings.enabled ? (
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold leading-6 text-brand">
            Os lembretes por WhatsApp estao desativados nas configuracoes, mas voce ainda pode preparar um envio manual.
          </div>
        ) : null}

        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-muted">Mensagem pronta</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={`${inputClass} mt-1 min-h-36 resize-none leading-6`}
          />
        </label>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" size="lg" onClick={copyMessage}>
            Copiar mensagem
          </Button>
          <Button size="lg" onClick={openWhatsapp} disabled={!phone}>
            Abrir WhatsApp
          </Button>
        </div>
      </section>
    </div>
  );
}
