function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeFilePart(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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

export function buildSignedDocumentHtml({ client, document }) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(document.title)} - AgenSync</title>
    <style>
      :root {
        color: #111827;
        font-family: Inter, Arial, sans-serif;
      }
      body {
        margin: 0;
        background: #f1f5f9;
        padding: 32px;
      }
      main {
        max-width: 860px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 32px;
      }
      header {
        border-bottom: 4px solid #2563eb;
        padding-bottom: 18px;
        margin-bottom: 28px;
      }
      .brand {
        color: #2563eb;
        font-size: 28px;
        font-weight: 900;
        letter-spacing: 0.02em;
      }
      h1 {
        margin: 12px 0 0;
        font-size: 24px;
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }
      .box {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px;
      }
      .label {
        color: #64748b;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .value {
        margin-top: 4px;
        font-weight: 800;
      }
      .content {
        white-space: pre-wrap;
        line-height: 1.55;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 18px;
      }
      .signature {
        margin-top: 28px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
      }
      .signature img {
        display: block;
        width: 100%;
        max-height: 180px;
        object-fit: contain;
        background: #ffffff;
      }
      footer {
        margin-top: 24px;
        color: #64748b;
        font-size: 12px;
        text-align: right;
      }
      @media print {
        @page {
          size: A4;
          margin: 10mm;
        }
        * {
          box-shadow: none !important;
        }
        body {
          background: #ffffff;
          padding: 0;
        }
        main {
          max-width: none;
          border: 0;
          border-radius: 0;
          padding: 0;
        }
        header {
          break-inside: avoid;
          page-break-inside: avoid;
          margin-bottom: 14px;
          padding-bottom: 12px;
          border-bottom-width: 2px;
        }
        .brand {
          font-size: 20px;
        }
        h1 {
          margin-top: 6px;
          font-size: 18px;
          line-height: 1.2;
        }
        .meta {
          gap: 8px;
          margin-bottom: 14px;
        }
        .box {
          break-inside: avoid;
          page-break-inside: avoid;
          padding: 8px;
        }
        .label {
          font-size: 10px;
        }
        .value {
          font-size: 12px;
        }
        .content {
          padding: 12px;
          font-size: 12px;
          line-height: 1.42;
          min-height: 0;
        }
        .signature {
          break-inside: avoid;
          page-break-inside: avoid;
          margin-top: 14px;
          padding: 10px;
        }
        .signature img {
          max-height: 96px;
        }
        footer {
          break-inside: avoid;
          page-break-inside: avoid;
          margin-top: 12px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div class="brand">AgenSync</div>
        <h1>${escapeHtml(document.title)}</h1>
      </header>
      <section class="meta">
        <div class="box">
          <div class="label">Cliente</div>
          <div class="value">${escapeHtml(client.name)}</div>
        </div>
        <div class="box">
          <div class="label">Telefone</div>
          <div class="value">${escapeHtml(client.phone)}</div>
        </div>
        <div class="box">
          <div class="label">Criado em</div>
          <div class="value">${escapeHtml(formatDateTime(document.createdAt))}</div>
        </div>
        <div class="box">
          <div class="label">Assinado em</div>
          <div class="value">${escapeHtml(formatDateTime(document.signedAt))}</div>
        </div>
      </section>
      <section class="content">${escapeHtml(document.content)}</section>
      <section class="signature">
        <div class="label">Assinatura digital</div>
        <img src="${document.signatureImage}" alt="Assinatura digital do cliente" />
      </section>
      <footer>Documento exportado pelo AgenSync</footer>
    </main>
  </body>
</html>`;
}

export function exportSignedDocument({ client, document }) {
  if (!document.signatureImage) {
    throw new Error("Assine o documento antes de exportar.");
  }

  const html = buildSignedDocumentHtml({ client, document });
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const filename = `agensync-documento-assinado-${sanitizeFilePart(client.name)}-${sanitizeFilePart(document.title)}.html`;
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return filename;
}

export function printSignedDocument({ client, document }) {
  if (!document.signatureImage) {
    throw new Error("Assine o documento antes de imprimir.");
  }

  const iframe = window.document.createElement("iframe");
  iframe.setAttribute("title", "Impressão do documento assinado");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    iframe.contentWindow?.removeEventListener?.("afterprint", cleanup);
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }

  iframe.addEventListener(
    "load",
    () => {
      iframe.contentWindow?.addEventListener?.("afterprint", cleanup, { once: true });
      window.setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 80);
      window.setTimeout(cleanup, 30000);
    },
    { once: true }
  );

  window.document.body.appendChild(iframe);
  iframe.srcdoc = buildSignedDocumentHtml({ client, document });
}
