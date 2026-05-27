import { useNavigate } from "react-router-dom";
import Button from "../Button.jsx";
import Card from "../Card.jsx";
import Icon from "../Icon.jsx";
import { useOnboarding } from "../../contexts/OnboardingContext.jsx";

export default function FirstStepsCard() {
  const navigate = useNavigate();
  const {
    checklist,
    checklistLoading,
    progress,
    startTour,
    openWelcomeAndRestart,
    resetOnboarding
  } = useOnboarding();

  return (
    <Card className="border-[#DBEAFE] bg-gradient-to-br from-white to-[#F8FBFF] p-4 sm:p-5" data-tour-id="onboarding-checklist">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Guia inicial</p>
          <h2 className="mt-1 text-xl font-black text-ink">Primeiros passos</h2>
          <p className="mt-1 text-sm font-medium text-muted">
            {checklist.completed} de {checklist.total} concluidos
          </p>
        </div>
        {checklistLoading ? (
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            Atualizando...
          </span>
        ) : checklist.done ? (
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-success">
            Concluido
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-brand">
            Em andamento
          </span>
        )}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
          style={{ width: `${Math.round(checklist.ratio * 100)}%` }}
        />
      </div>

      <div className="mt-4 space-y-3">
        {checklist.items.map((item) => (
          <article
            key={item.key}
            className="rounded-2xl border border-[#E2E8F0] bg-white p-3 sm:p-4"
            data-tour-id={`check-step-${item.key}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${
                      item.done ? "bg-emerald-50 text-success" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.done ? <Icon name="check" className="h-4 w-4" /> : checklist.items.indexOf(item) + 1}
                  </span>
                  <p className="truncate text-sm font-black text-ink">{item.label}</p>
                </div>
                <p className="mt-2 text-sm text-muted">{item.description}</p>
              </div>
              <Button
                size="sm"
                variant={item.done ? "secondary" : "primary"}
                className="w-full sm:w-auto"
                onClick={() => navigate(item.actionPath)}
              >
                {item.actionLabel}
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4">
        <Button size="sm" variant="secondary" onClick={startTour}>
          {progress.skippedTour || progress.tourCompleted ? "Rever guia" : "Continuar guia"}
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button size="sm" variant="ghost" onClick={openWelcomeAndRestart}>
          Reabrir boas-vindas
        </Button>
        <Button size="sm" variant="ghost" onClick={() => resetOnboarding({ notify: true })}>
          Reiniciar progresso
        </Button>
      </div>
    </Card>
  );
}
