import Button from "../Button.jsx";
import { useOnboarding } from "../../contexts/OnboardingContext.jsx";

export default function WelcomeOnboardingModal() {
  const { welcomeOpen, startTour, skipTour, setDemoEnabled } = useOnboarding();

  if (!welcomeOpen) return null;

  return (
    <div className="agensync-overlay z-[70] flex items-end bg-slate-950/55 p-3 sm:items-center sm:justify-center sm:p-6">
      <section className="w-full rounded-3xl border border-white/70 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.28)] sm:max-w-lg sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">Onboarding</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Bem-vindo ao AgenSync</h2>
        <p className="mt-3 text-sm font-medium leading-6 text-muted">
          Vamos configurar seu fluxo inicial em poucos passos para voce dominar o sistema enquanto usa.
        </p>

        <div className="mt-6 grid gap-3">
          <Button size="lg" onClick={startTour}>
            Comecar
          </Button>
          <Button size="md" variant="secondary" onClick={skipTour}>
            Pular tour
          </Button>
          <Button size="md" variant="ghost" onClick={() => setDemoEnabled(true)}>
            Ver exemplo preenchido
          </Button>
        </div>
      </section>
    </div>
  );
}
