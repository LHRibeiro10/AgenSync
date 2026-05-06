import Button from "./Button.jsx";
import Icon from "./Icon.jsx";
import { useInstallPrompt } from "../hooks/useInstallPrompt.js";

export default function InstallAppCard() {
  const { canInstall, promptInstall, dismissInstallPrompt } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand">
            <Icon name="download" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black text-ink">Instalar AgenSync</h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-muted">
              Instale o AgenSync para acessar mais rapido e receber lembretes.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={dismissInstallPrompt}>
            Agora nao
          </Button>
          <Button size="sm" onClick={promptInstall}>
            Instalar
          </Button>
        </div>
      </div>
    </section>
  );
}
