import { useState } from "react";
import Button from "./Button.jsx";
import Icon from "./Icon.jsx";
import { useInstallPrompt } from "../hooks/useInstallPrompt.js";

const platformCopy = {
  android: {
    badge: "Android",
    title: "Instalar no Android",
    description: "Instale o AgenSync pelo Chrome e abra direto pela tela inicial.",
    button: "Instalar no Android",
    unavailable: "Abra pelo Chrome no Android e aguarde alguns segundos para o navegador liberar a instalacao."
  },
  desktop: {
    badge: "Desktop",
    title: "Instalar no computador",
    description: "Abra o AgenSync como app no computador, com acesso rapido pela barra de tarefas.",
    button: "Instalar no computador",
    unavailable: "Abra pelo Chrome ou Edge e aguarde alguns segundos para o navegador liberar a instalacao."
  },
  ios: {
    badge: "Apple",
    title: "Adicionar no iPhone ou iPad",
    description: "No iPhone e iPad, a instalacao e feita pelo botao Compartilhar do Safari.",
    button: "Ver passo a passo",
    unavailable: ""
  }
};

export default function InstallAppCard() {
  const [showAppleSteps, setShowAppleSteps] = useState(false);
  const {
    canInstall,
    promptInstall,
    dismissInstallPrompt,
    isDismissed,
    isIOS,
    isStandalone,
    platform
  } = useInstallPrompt();

  if (isStandalone || isDismissed) return null;

  const copy = platformCopy[platform] || platformCopy.desktop;

  async function handleInstall() {
    if (isIOS) {
      setShowAppleSteps((current) => !current);
      return;
    }

    await promptInstall();
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-3 shadow-soft sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand sm:h-10 sm:w-10">
            <Icon name={isIOS ? "appointments" : "download"} className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-black text-ink sm:text-base">{copy.title}</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-brand">
                {copy.badge}
              </span>
            </div>
            <p className="text-xs font-semibold leading-5 text-muted sm:text-sm">{copy.description}</p>

            {isIOS && showAppleSteps ? (
              <ol className="mt-2 grid gap-1 text-xs font-bold leading-5 text-slate-600 sm:grid-cols-3">
                <li>1. Abra no Safari</li>
                <li>2. Toque em Compartilhar</li>
                <li>3. Adicionar a Tela de Inicio</li>
              </ol>
            ) : !isIOS && !canInstall ? (
              <p className="text-xs font-bold leading-5 text-slate-500">{copy.unavailable}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button variant="secondary" size="sm" onClick={dismissInstallPrompt}>
            Ocultar
          </Button>
          <Button size="sm" onClick={handleInstall} disabled={!isIOS && !canInstall}>
            {copy.button}
          </Button>
        </div>
      </div>
    </section>
  );
}
