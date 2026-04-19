import Button from "../Button.jsx";
import Field, { readOnlyInputClass } from "../Field.jsx";

export default function ClientDataTab({ client, care, appointments, onEdit }) {
  const completed = appointments.filter((appointment) => appointment.status === "concluido").length;

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <input readOnly value={client.name} className={readOnlyInputClass} />
          </Field>
          <Field label="Telefone">
            <input readOnly value={client.phone} className={readOnlyInputClass} />
          </Field>
        </div>
        <Field label="Observações">
          <textarea readOnly value={client.notes || ""} className={`${readOnlyInputClass} min-h-28 resize-none`} />
        </Field>
        <Button variant="secondary" className="w-full sm:w-auto" onClick={onEdit}>
          Editar dados do cliente
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Atendimentos</p>
          <p className="mt-2 text-2xl font-black text-ink">{appointments.length}</p>
          <p className="text-sm text-muted">{completed} concluído(s)</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Fichas</p>
          <p className="mt-2 text-2xl font-black text-ink">{care.forms.length}</p>
          <p className="text-sm text-muted">Prontuário personalizado</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Fotos</p>
          <p className="mt-2 text-2xl font-black text-ink">{care.photos.length}</p>
          <p className="text-sm text-muted">Anexos e evolução visual</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Documentos</p>
          <p className="mt-2 text-2xl font-black text-ink">{care.documents.length}</p>
          <p className="text-sm text-muted">Termos e assinaturas</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Evoluções</p>
          <p className="mt-2 text-2xl font-black text-ink">{care.evolutions.length}</p>
          <p className="text-sm text-muted">{care.budgets.length} orçamento(s)</p>
        </div>
      </div>
    </div>
  );
}
