function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function SignedDocumentPreview({ client, document }) {
  return (
    <article className="signed-document-print print-report mx-auto max-w-[820px] rounded-xl border border-[#E2E8F0] bg-white p-5 text-ink shadow-soft sm:p-7">
      <header className="signed-document-header border-b-4 border-brand pb-4">
        <p className="signed-document-brand text-2xl font-black tracking-wide text-brand">AgenSync</p>
        <h1 className="signed-document-title mt-2 break-words text-2xl font-black leading-tight text-ink">
          {document.title}
        </h1>
      </header>

      <section className="signed-document-meta mt-5 grid gap-3 sm:grid-cols-2">
        <div className="signed-document-meta-card rounded-lg border border-[#E2E8F0] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Cliente</p>
          <p className="mt-1 font-black text-ink">{client.name}</p>
        </div>
        <div className="signed-document-meta-card rounded-lg border border-[#E2E8F0] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Telefone</p>
          <p className="mt-1 font-black text-ink">{client.phone || "-"}</p>
        </div>
        <div className="signed-document-meta-card rounded-lg border border-[#E2E8F0] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Criado em</p>
          <p className="mt-1 font-black text-ink">{formatDateTime(document.createdAt)}</p>
        </div>
        <div className="signed-document-meta-card rounded-lg border border-[#E2E8F0] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Assinado em</p>
          <p className="mt-1 font-black text-ink">{formatDateTime(document.signedAt)}</p>
        </div>
      </section>

      <section className="signed-document-content mt-5 whitespace-pre-wrap rounded-lg border border-[#E2E8F0] p-4 text-sm leading-7 text-ink">
        {document.content}
      </section>

      <section className="signed-document-signature mt-5 rounded-lg border border-[#E2E8F0] p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Assinatura digital</p>
        {document.signatureImage ? (
          <img
            src={document.signatureImage}
            alt="Assinatura digital do cliente"
            className="signed-document-signature-image mt-3 h-28 w-full object-contain"
          />
        ) : (
          <div className="mt-3 flex h-28 items-center justify-center rounded-lg bg-[#F8FAFC] text-sm font-bold text-muted">
            Documento ainda não assinado
          </div>
        )}
      </section>

      <footer className="signed-document-footer mt-5 text-right text-xs font-bold text-muted">
        Documento emitido pelo AgenSync
      </footer>
    </article>
  );
}
