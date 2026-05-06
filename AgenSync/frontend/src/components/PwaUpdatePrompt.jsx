import { useRegisterSW } from "virtual:pwa-register/react";
import Button from "./Button.jsx";

export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(registration) {
      registration?.update?.().catch(() => null);
    },
    onRegisterError() {
      // PWA registration must never block the web app.
    }
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-3 bottom-4 z-[70] flex justify-center sm:inset-x-auto sm:right-5">
      <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-blue-100 bg-white p-3 text-sm font-bold text-ink shadow-panel">
        <span className="leading-5">Nova versao disponivel. Clique para atualizar.</span>
        <Button size="sm" onClick={() => updateServiceWorker(true)}>
          Atualizar
        </Button>
      </div>
    </div>
  );
}
