import Button from "../Button.jsx";
import Field, { readOnlyInputClass } from "../Field.jsx";

export default function ClientDataTab({ client, care, appointments, onEdit, onOpenClient }) {
  const completed = appointments.filter((appointment) => appointment.status === "concluido").length;
  const hasResponsavel = Boolean(client.responsavelId || client.responsavelNome || client.responsavelTelefone);
  const hasEmergencyContact = Boolean(
    client.contatoEmergenciaNome || client.contatoEmergenciaTelefone || client.contatoEmergenciaParentesco
  );
  const dependentes = Array.isArray(client.dependentes) ? client.dependentes : [];

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <input readOnly value={client.name} className={readOnlyInputClass} />
          </Field>
          <Field label="Telefone">
            <input readOnly value={client.phone || "Sem telefone"} className={readOnlyInputClass} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Idade">
            <input
              readOnly
              value={typeof client.idade === "number" ? `${client.idade} anos` : "—"}
              className={readOnlyInputClass}
            />
          </Field>
          <Field label="Sexo">
            <input readOnly value={client.sexo || "—"} className={readOnlyInputClass} />
          </Field>
        </div>

        {hasEmergencyContact ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Contato de emergência</p>
            <p className="mt-2 text-sm font-black text-ink">
              {client.contatoEmergenciaNome || "—"}
              {client.contatoEmergenciaParentesco ? ` (${client.contatoEmergenciaParentesco})` : ""}
            </p>
            <p className="text-sm text-muted">{client.contatoEmergenciaTelefone || "Sem telefone"}</p>
          </div>
        ) : null}

        {hasResponsavel ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Responsável</p>
            <p className="mt-2 text-sm font-black text-ink">
              {client.responsavelNome || "—"}
              {client.responsavelParentesco ? ` (${client.responsavelParentesco})` : ""}
            </p>
            <p className="text-sm text-muted">{client.responsavelTelefone || "Sem telefone"}</p>
            {client.responsavelId && onOpenClient ? (
              <Button variant="ghost" className="mt-2" onClick={() => onOpenClient(client.responsavelId)}>
                Ver perfil do responsável
              </Button>
            ) : null}
          </div>
        ) : null}

        {dependentes.length ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Dependentes</p>
            <ul className="mt-2 space-y-2">
              {dependentes.map((dependente) => (
                <li key={dependente.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink">
                    {dependente.name}
                    {typeof dependente.idade === "number" ? ` · ${dependente.idade} anos` : ""}
                  </span>
                  {onOpenClient ? (
                    <Button variant="ghost" onClick={() => onOpenClient(dependente.id)}>
                      Ver
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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
