import Button from "../Button.jsx";
import EmptyState from "../EmptyState.jsx";
import { buildClientTimeline } from "../../services/clientCare.js";

const typeStyles = {
  Atendimento: "bg-blue-50 text-brand ring-blue-100",
  "Ficha criada": "bg-green-50 text-success ring-green-100",
  "Ficha editada": "bg-green-50 text-success ring-green-100",
  Documento: "bg-slate-100 text-slate-700 ring-slate-200",
  "Documento assinado": "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Orçamento: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  "Foto anexada": "bg-amber-50 text-amber-800 ring-amber-100",
  Evolução: "bg-red-50 text-red-700 ring-red-100",
  "Anamnese clássica": "bg-blue-50 text-brand ring-blue-100"
};

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function TimelineTab({ care, appointments, setActiveTab }) {
  const items = buildClientTimeline({ care, appointments });

  if (!items.length) {
    return (
      <EmptyState
        title="Linha do tempo vazia"
        description="Atendimentos, fichas, documentos, fotos, evoluções e orçamentos aparecerão aqui automaticamente."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm font-black text-ink">Linha do tempo do cliente</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Visão cronológica completa do prontuário, juntando rotina, documentação, fotos e evolução.
        </p>
      </div>

      <div className="relative space-y-3 before:absolute before:bottom-0 before:left-5 before:top-0 before:w-px before:bg-[#D8E0EA]">
        {items.map((item) => (
          <article key={item.id} className="relative grid gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 pl-12 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <span className="absolute left-[13px] top-5 h-4 w-4 rounded-full border-4 border-white bg-brand shadow-sm" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${typeStyles[item.type] || typeStyles.Atendimento}`}>
                  {item.type}
                </span>
                <span className="text-xs font-bold text-muted">{formatDateTime(item.date)}</span>
              </div>
              <h3 className="mt-2 text-base font-black text-ink">{item.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted">{item.summary}</p>
            </div>
            {item.tab ? (
              <Button variant="secondary" size="sm" onClick={() => setActiveTab(item.tab)}>
                Ver detalhes
              </Button>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
