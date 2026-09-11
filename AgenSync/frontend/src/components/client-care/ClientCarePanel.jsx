import { useEffect, useState } from "react";
import Button from "../Button.jsx";
import Card from "../Card.jsx";
import BudgetsTab from "./BudgetsTab.jsx";
import ClientDataTab from "./ClientDataTab.jsx";
import DocumentsTab from "./DocumentsTab.jsx";
import EvolutionTab from "./EvolutionTab.jsx";
import HistoryTab from "./HistoryTab.jsx";
import PhotosTab from "./PhotosTab.jsx";
import ProntuaryFormsTab from "./ProntuaryFormsTab.jsx";
import TimelineTab from "./TimelineTab.jsx";

const tabs = [
  { id: "data", label: "Dados" },
  { id: "history", label: "Histórico" },
  { id: "forms", label: "Fichas" },
  { id: "evolution", label: "Evolução" },
  { id: "photos", label: "Fotos" },
  { id: "documents", label: "Documentos" },
  { id: "budgets", label: "Orçamentos" },
  { id: "timeline", label: "Linha do tempo" }
];

export default function ClientCarePanel({
  client,
  activeTab,
  setActiveTab,
  care,
  onCareChange,
  appointments,
  historyLoading,
  services,
  products,
  onEdit,
  onClose,
  onOpenClient,
  showToast
}) {
  const [renderedTab, setRenderedTab] = useState(activeTab);
  const [leavingTab, setLeavingTab] = useState(false);

  useEffect(() => {
    if (activeTab === renderedTab) return undefined;

    setLeavingTab(true);
    const timer = window.setTimeout(() => {
      setRenderedTab(activeTab);
      setLeavingTab(false);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [activeTab, renderedTab]);

  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#E2E8F0] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Atendimento completo</p>
          <h2 className="mt-1 truncate text-xl font-black tracking-tight text-ink">
            {client.name}
            {typeof client.idade === "number" ? (
              <span className="ml-2 align-middle text-xs font-black uppercase tracking-[0.1em] text-muted">
                {client.idade} anos
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">{client.phone || "Sem telefone"}</p>
        </div>
        <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <div className="border-b border-[#E2E8F0] px-3 sm:px-5">
        <div className="scrollbar-thin flex snap-x gap-2 overflow-x-auto scroll-smooth py-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-11 shrink-0 snap-start whitespace-nowrap rounded-lg px-4 text-sm font-black transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${
                activeTab === tab.id ? "bg-brand text-white shadow-sm" : "bg-zinc-100 text-muted hover:bg-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 p-3 sm:p-5 lg:p-6">
        <div key={renderedTab} className={leavingTab ? "tab-panel-exit" : "tab-panel-enter"}>
          {renderedTab === "data" ? (
            <ClientDataTab
              client={client}
              care={care}
              appointments={appointments}
              onEdit={onEdit}
              onOpenClient={onOpenClient}
            />
          ) : null}
          {renderedTab === "history" ? <HistoryTab appointments={appointments} loading={historyLoading} /> : null}
          {renderedTab === "forms" ? (
            <ProntuaryFormsTab client={client} care={care} onCareChange={onCareChange} showToast={showToast} />
          ) : null}
          {renderedTab === "evolution" ? (
            <EvolutionTab client={client} care={care} onCareChange={onCareChange} showToast={showToast} />
          ) : null}
          {renderedTab === "photos" ? (
            <PhotosTab client={client} care={care} onCareChange={onCareChange} showToast={showToast} />
          ) : null}
          {renderedTab === "documents" ? (
            <DocumentsTab client={client} care={care} onCareChange={onCareChange} showToast={showToast} />
          ) : null}
          {renderedTab === "budgets" ? (
            <BudgetsTab
              client={client}
              care={care}
              services={services}
              products={products}
              onCareChange={onCareChange}
              showToast={showToast}
            />
          ) : null}
          {renderedTab === "timeline" ? (
            <TimelineTab care={care} appointments={appointments} setActiveTab={setActiveTab} />
          ) : null}
        </div>
      </div>
    </Card>
  );
}
