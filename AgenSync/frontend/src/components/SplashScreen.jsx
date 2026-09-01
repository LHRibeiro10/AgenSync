import { useEffect, useState } from "react";
import BrandLogo from "./BrandLogo.jsx";

export default function SplashScreen({ firstName, onDone, durationMs = 2500 }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFading(true), durationMs);
    const doneTimer = window.setTimeout(() => onDone?.(), durationMs + 300);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [durationMs, onDone]);

  return (
    <main
      className={`fixed inset-0 z-[999] flex items-center justify-center overflow-hidden bg-[#050710] px-4 text-slate-100 transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(55,18,112,0.58),transparent_38%),radial-gradient(circle_at_86%_12%,rgba(28,88,196,0.46),transparent_36%),linear-gradient(145deg,#04050C_0%,#080B18_48%,#050711_100%)]" />
      <div className="pointer-events-none absolute -left-20 top-16 h-72 w-72 rounded-full bg-[#7E4FFF]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#2563EB]/20 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <BrandLogo src="/AgenSync_sidebar.png" className="h-16 w-[14rem] sm:h-20 sm:w-[17rem]" imageClassName="opacity-100" />
        <p className="mt-8 text-xl font-black text-white sm:text-2xl">
          Seja bem-vindo{firstName ? `, ${firstName}` : ""}! 🎉
        </p>
        <p className="mt-2 text-sm font-semibold text-blue-100/80">Estamos preparando tudo para você...</p>

        <div className="mt-8 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
          <div className="splash-progress-bar h-full w-1/3 rounded-full bg-brand" />
        </div>
      </div>
    </main>
  );
}
