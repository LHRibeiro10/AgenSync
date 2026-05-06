import Button from "../Button.jsx";
import { useOnboarding } from "../../contexts/OnboardingContext.jsx";

export default function GuidedTourPopover() {
  const { tourActive, currentTourStep, tourIndex, tourSteps, previousTourStep, nextTourStep, skipTour } = useOnboarding();

  if (!tourActive || !currentTourStep) return null;

  const isFirstStep = tourIndex === 0;
  const isLastStep = tourIndex === tourSteps.length - 1;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[65] sm:inset-x-auto sm:bottom-5 sm:right-5">
      <section className="pointer-events-auto w-full rounded-3xl border border-white/80 bg-white p-4 shadow-[0_26px_70px_rgba(15,23,42,0.24)] sm:w-[380px] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand">
              Passo {tourIndex + 1} de {tourSteps.length}
            </p>
            <h3 className="mt-1 text-lg font-black text-ink">{currentTourStep.title}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={skipTour}>
            Encerrar
          </Button>
        </div>

        <p className="mt-3 text-sm font-medium leading-6 text-muted">{currentTourStep.description}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={previousTourStep} disabled={isFirstStep}>
            Voltar
          </Button>
          <Button size="sm" onClick={nextTourStep}>
            {isLastStep ? "Finalizar" : "Proximo"}
          </Button>
        </div>
      </section>
    </div>
  );
}
