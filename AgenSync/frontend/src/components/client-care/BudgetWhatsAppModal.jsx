import { useEffect, useState } from "react";
import Button from "../Button.jsx";
import { buildBudgetWhatsAppMessage, buildWhatsAppUrl, whatsappPhone } from "../../services/budgetWhatsApp.js";

function copyWithFallback(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    return Promise.reject(new Error("Não foi possível copiar a mensagem."));
  }

  return Promise.resolve();
}

export default function BudgetWhatsAppModal({ open, client, budget, onClose, showToast }) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open && budget) {
      setMessage(buildBudgetWhatsAppMessage({ client, budget }));
    }
  }, [open, client, budget]);

  if (!open || !budget) return null;

  const phoneDigits = whatsappPhone(client.phone);
  const hasPhone = Boolean(phoneDigits);

  async function copyMessage() {
    try {
      await copyWithFallback(message);
      showToast("Mensagem copiada.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function openWhatsApp() {
    if (!hasPhone) {
      showToast("Cadastre um telefone para abrir o WhatsApp.", "error");
      return;
    }

    window.open(buildWhatsAppUrl(client.phone, message), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="agensync-overlay z-50 flex items-end bg-ink/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <div className="max-h-[92vh] w-full overflow-auto rounded-xl border border-[#E2E8F0] bg-white shadow-panel sm:max-w-2xl">
        <div className="border-b border-[#E2E8F0] p-4">
          <h2 className="text-lg font-black text-ink">Enviar orçamento por WhatsApp</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Revise a mensagem antes de abrir a conversa com o cliente.
          </p>
        </div>

        <div className="space-y-4 p-4">
          <div className={`rounded-xl border px-4 py-3 ${hasPhone ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50"}`}>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Telefone do cliente</p>
            <p className={`mt-1 text-base font-black ${hasPhone ? "text-success" : "text-danger"}`}>
              {client.phone || "Telefone não cadastrado"}
            </p>
            {!hasPhone ? (
              <p className="mt-1 text-sm font-medium text-danger">Adicione um telefone ao cliente para abrir o WhatsApp.</p>
            ) : null}
          </div>

          <label className="block">
            <span className="text-sm font-black text-ink">Mensagem</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="mt-1 min-h-72 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm font-semibold leading-6 text-ink shadow-sm transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Fechar
            </Button>
            <Button variant="secondary" className="w-full" onClick={copyMessage}>
              Copiar mensagem
            </Button>
            <Button className="w-full" onClick={openWhatsApp} disabled={!hasPhone}>
              Abrir WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
