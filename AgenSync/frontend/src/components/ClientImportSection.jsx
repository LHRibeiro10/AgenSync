import { useMemo, useRef, useState } from "react";
import { api } from "../api/client.js";
import Button from "./Button.jsx";
import Icon from "./Icon.jsx";
import Loading from "./Loading.jsx";
import Message from "./Message.jsx";
import { useToast } from "./Toast.jsx";
import {
  detectDuplicateClients,
  downloadClientImportTemplate,
  parseGenericClientsFile,
  parseSimpleAgendaClientsFile
} from "../services/clientImport.js";
import { parseVCardFile } from "../services/vcardImport.js";
import { detectDevicePlatform } from "../utils/deviceDetect.js";

const statusClasses = {
  pronto: "border-green-200 bg-green-50 text-success",
  duplicado: "border-amber-200 bg-amber-50 text-amber-800",
  erro: "border-red-200 bg-red-50 text-danger"
};

const sources = [
  { value: "simples-agenda", label: "Simples Agenda (CSV/Excel)", accept: ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { value: "generic", label: "Planilha (CSV/Excel)", accept: ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { value: "vcard", label: "vCard (.vcf)", accept: ".vcf" }
];

const vCardTutorialBySource = {
  android: {
    steps: "Abra Contatos → Menu ⋮ → Gerenciar contatos → Exportar → salve o .vcf → faça upload aqui.",
    asset: "TUTORIAL_ANDROID_ASSET"
  },
  iphone: {
    steps: "Acesse icloud.com/contacts → selecione todos → engrenagem → Exportar vCard → faça upload aqui.",
    asset: "TUTORIAL_IPHONE_ASSET"
  },
  desktop: {
    steps: "Acesse contacts.google.com → Exportar → formato vCard → faça upload aqui.",
    asset: "TUTORIAL_DESKTOP_ASSET"
  }
};

function StatusPill({ status }) {
  const label = status === "pronto" ? "Pronto" : status === "duplicado" ? "Duplicado" : "Erro";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${statusClasses[status]}`}>
      {label}
    </span>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-xl font-black text-ink">{value}</p>
    </div>
  );
}

function VCardTutorial() {
  const platform = useMemo(() => detectDevicePlatform(), []);
  const tutorial = vCardTutorialBySource[platform];

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <p className="text-sm font-black text-ink">Como exportar seus contatos</p>
      <p className="mt-1 text-sm leading-6 text-muted">{tutorial.steps}</p>
      {/* Placeholder for onboarding GIF/image asset, to be provided later. */}
      <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-blue-200 bg-white text-xs font-bold uppercase tracking-wide text-blue-300">
        {tutorial.asset}
      </div>
    </div>
  );
}

export default function ClientImportSection() {
  const fileInputRef = useRef(null);
  const { showToast } = useToast();
  const [source, setSource] = useState("simples-agenda");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [recognizedColumns, setRecognizedColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const stats = useMemo(() => {
    const ready = rows.filter((row) => row.status === "pronto").length;
    const duplicates = rows.filter((row) => row.status === "duplicado").length;
    const errors = rows.filter((row) => row.status === "erro").length;
    const importable = rows.filter((row) => row.status !== "erro" && (!skipDuplicates || row.status !== "duplicado")).length;
    return { ready, duplicates, errors, importable, total: rows.length };
  }, [rows, skipDuplicates]);

  function resetImport() {
    setFileName("");
    setRows([]);
    setRecognizedColumns([]);
    setError("");
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function changeSource(nextSource) {
    setSource(nextSource);
    resetImport();
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setSummary(null);
    setFileName(file.name);

    try {
      const [parsed, clientsData] = await Promise.all([
        source === "vcard"
          ? parseVCardFile(file)
          : source === "generic"
            ? parseGenericClientsFile(file)
            : parseSimpleAgendaClientsFile(file),
        api.listClients({ take: 300 })
      ]);
      const nextRows = detectDuplicateClients(parsed.rows, clientsData.clients || []);
      setRows(nextRows);
      setRecognizedColumns(parsed.recognizedColumns || []);
      showToast(`${parsed.totalRows} contato(s) lido(s).`);
    } catch (err) {
      setRows([]);
      setRecognizedColumns([]);
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function importClients() {
    const clients = rows
      .filter((row) => row.status !== "erro")
      .filter((row) => !skipDuplicates || row.status !== "duplicado")
      .map((row) => row.client);

    if (!clients.length) {
      showToast("Nao ha clientes validos para importar.", "error");
      return;
    }

    setImporting(true);
    setError("");

    try {
      const result = await api.importClients({ clients, skipDuplicates });
      setSummary(result.summary);
      showToast("Importacao concluida.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setImporting(false);
    }
  }

  const activeSource = sources.find((item) => item.value === source) || sources[0];

  return (
    <section className="overflow-hidden rounded-lg border border-[#DDE6F0] bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-[#E2E8F0] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-brand">Importacao</p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-ink">Importar clientes</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Importe clientes de outro sistema, de um cartão de contatos (vCard) ou de uma planilha própria.
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon name="clients" className="h-5 w-5" />
        </span>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <Message type="error">{error}</Message>

        <div className="flex flex-wrap gap-2">
          {sources.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => changeSource(item.value)}
              className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                source === item.value
                  ? "border-brand bg-brand text-white"
                  : "border-[#E2E8F0] bg-white text-muted hover:border-brand/40 hover:text-brand"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {source === "vcard" ? <VCardTutorial /> : null}

        {source === "generic" ? (
          <div className="flex flex-col gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-muted">
              Use o modelo com as colunas Nome, Telefone, Email, DataNascimento e Observações.
            </p>
            <Button variant="secondary" onClick={downloadClientImportTemplate}>
              Baixar modelo
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-black text-ink">{fileName || "Nenhum arquivo selecionado"}</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {source === "vcard"
                ? "Aguardando arquivo .vcf"
                : `Colunas reconhecidas: ${recognizedColumns.length ? recognizedColumns.join(", ") : "aguardando arquivo"}`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={fileInputRef}
              type="file"
              accept={activeSource.accept}
              className="sr-only"
              onChange={handleFileChange}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={loading || importing}>
              Selecionar arquivo
            </Button>
            {rows.length ? (
              <Button variant="secondary" onClick={resetImport} disabled={importing}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? <Loading label="Lendo arquivo..." /> : null}

        {rows.length ? (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <SummaryItem label="Linhas lidas" value={stats.total} />
              <SummaryItem label="Novos clientes" value={stats.ready} />
              <SummaryItem label="Duplicados" value={stats.duplicates} />
              <SummaryItem label="Com erro" value={stats.errors} />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(event) => setSkipDuplicates(event.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-brand"
              />
              <span>
                <span className="block text-sm font-black text-ink">Ignorar possiveis duplicados</span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  Duplicados são detectados por telefone ou e-mail já cadastrados. Desmarque para importar todos os
                  registros válidos, inclusive os marcados como duplicados (o cadastro existente será mantido, não
                  sobrescrito).
                </span>
              </span>
            </label>

            <div className="overflow-hidden rounded-lg border border-[#E2E8F0]">
              <div className="max-h-[420px] overflow-auto">
                <table className="min-w-[900px] w-full border-collapse bg-white text-left text-sm">
                  <thead className="sticky top-0 bg-[#F8FAFC] text-xs font-black uppercase tracking-[0.12em] text-muted">
                    <tr>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Nome</th>
                      <th className="px-3 py-3">Telefone</th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">Observacao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {rows.map((row) => (
                      <tr key={`${row.lineNumber}-${row.client.name}-${row.client.phone}`} className="align-top">
                        <td className="px-3 py-3"><StatusPill status={row.status} /></td>
                        <td className="px-3 py-3 font-black text-ink">{row.client.name || `Linha ${row.lineNumber}`}</td>
                        <td className="px-3 py-3 font-semibold text-muted">{row.client.phone || "Sem telefone"}</td>
                        <td className="px-3 py-3 font-semibold text-muted">{row.client.email || "-"}</td>
                        <td className="max-w-[280px] px-3 py-3 text-muted">
                          {row.errors.length ? row.errors.join(" ") : row.client.notes || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-[#E2E8F0] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-muted">
                {stats.importable} cliente(s) serao enviados para importacao.
              </p>
              <Button onClick={importClients} loading={importing} disabled={!stats.importable}>
                Importar {stats.importable} contato{stats.importable === 1 ? "" : "s"} selecionado{stats.importable === 1 ? "" : "s"}
              </Button>
            </div>
          </>
        ) : !loading ? (
          <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-8 text-center">
            <p className="text-sm font-black text-ink">Selecione um arquivo para ver a pre-visualizacao.</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              Nenhum contato e acessado automaticamente. A leitura acontece somente depois do upload do arquivo.
            </p>
          </div>
        ) : null}

        {summary ? (
          <div className="grid gap-3 rounded-lg border border-green-200 bg-green-50 p-4 sm:grid-cols-4">
            <SummaryItem label="Total lido" value={summary.totalRows || 0} />
            <SummaryItem label="Importados" value={summary.imported || 0} />
            <SummaryItem label="Duplicados ignorados" value={summary.duplicatesIgnored || 0} />
            <SummaryItem label="Erros" value={summary.errors || 0} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
