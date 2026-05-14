import { statusLabel } from "../utils.js";

const styles = {
  agendado: "bg-[#DBEAFE] text-[#1E3A8A] ring-blue-200",
  concluido: "bg-[#D1FAE5] text-[#166534] ring-green-200",
  cancelado: "bg-red-100 text-red-700 ring-red-200",
  nao_compareceu: "bg-amber-100 text-amber-800 ring-amber-200",
  paid: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  trial: "bg-blue-100 text-blue-800 ring-blue-200",
  past_due: "bg-amber-100 text-amber-800 ring-amber-200",
  canceled: "bg-red-100 text-red-700 ring-red-200"
};

const labels = {
  paid: "Pago",
  trial: "Teste",
  past_due: "Inadimplente",
  canceled: "Cancelado"
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 transition ${styles[status] || styles.agendado}`}>
      {labels[status] || statusLabel(status)}
    </span>
  );
}
