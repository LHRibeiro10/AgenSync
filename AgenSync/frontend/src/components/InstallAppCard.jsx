import Button from "./Button.jsx";
import Icon from "./Icon.jsx";
import { useInstallPrompt } from "../hooks/useInstallPrompt.js";

export default function InstallAppCard() {
  const {
    canInstall,
    promptInstall,
    dismissInstallPrompt,
    isAndroid,
    isDesktop,
    isDismissed,
    isIOS,
    isStandalone
  } = useInstallPrompt();

  if (isStandalone || isDismissed) return null;

  const installText = isDesktop
    ? "Abra como app no computador, com acesso rapido pela barra de tarefas."
    : "Instale no celular para abrir o AgenSync direto da tela inicial.";

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-3 shadow-soft sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand sm:h-10 sm:w-10">
            <Icon name={isIOS ? "appointments" : "download"} className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-black text-ink sm:text-base">Baixar versão app</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-brand">
                Android · Desktop · iPhone
              </span>
            </div>
            <p className="text-xs font-semibold leading-5 text-muted sm:text-sm">
              {isIOS
                ? "No iPhone, adicione o AgenSync à tela de início pelo Safari."
                : installText}
            </p>

            {isIOS ? (
              <ol className="mt-2 grid gap-1 text-xs font-bold leading-5 text-slate-600 sm:grid-cols-3">
                <li>1. Abra no Safari</li>
                <li>2. Toque em Compartilhar</li>
                <li>3. Adicionar à Tela de Início</li>
              </ol>
            ) : !canInstall ? (
              <p className="text-xs font-bold leading-5 text-slate-500">
                Se o botão ainda não aparecer, abra pelo Chrome ou Edge e aguarde o navegador liberar a instalação.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button variant="secondary" size="sm" onClick={dismissInstallPrompt}>
            Ocultar
          </Button>
          {!isIOS ? (
            <>
              <Button size="sm" onClick={promptInstall} disabled={!canInstall || !isAndroid}>
                Android
              </Button>
              <Button size="sm" onClick={promptInstall} disabled={!canInstall || !isDesktop}>
                Desktop
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
