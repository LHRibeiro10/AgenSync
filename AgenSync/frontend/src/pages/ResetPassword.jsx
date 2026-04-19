import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import BrandLogo from "../components/BrandLogo.jsx";

function Field({ label, type = "text", value, onChange, minLength = 1, autoComplete }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">{label}</span>
      <input
        required
        type={type}
        minLength={minLength}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-2xl border border-white/70 bg-white/70 px-4 text-sm font-bold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_24px_rgba(15,23,42,0.06)] outline-none transition placeholder:text-slate-400 hover:bg-white/85 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
      />
    </label>
  );
}

function Feedback({ type, message }) {
  if (!message) return null;
  const classes =
    type === "success"
      ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-800"
      : "border-red-200/80 bg-red-50/80 text-red-700";

  return <div className={`rounded-2xl border px-4 py-3 text-sm font-bold leading-6 ${classes}`}>{message}</div>;
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const {
    applyPasswordResetSessionFromUrl,
    getPasswordResetTokenFromUrl,
    resetPassword
  } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  useEffect(() => {
    let active = true;

    async function prepareResetSession() {
      setInitializing(true);
      setFeedback({ type: "", message: "" });

      try {
        const sessionInfo = await applyPasswordResetSessionFromUrl(window.location.href);
        const tokenFromUrl = getPasswordResetTokenFromUrl(window.location.href);
        if (!active) return;

        if (tokenFromUrl) setToken(tokenFromUrl);
        if (sessionInfo?.token) setToken(sessionInfo.token);

        if (sessionInfo?.ready === false && !tokenFromUrl) {
          setFeedback({ type: "error", message: "Link invalido ou expirado. Solicite um novo email de recuperacao." });
        }
      } catch (error) {
        if (active) {
          setFeedback({ type: "error", message: error.message || "Nao foi possivel validar o link de redefinicao." });
        }
      } finally {
        if (active) setInitializing(false);
      }
    }

    prepareResetSession();

    return () => {
      active = false;
    };
  }, [applyPasswordResetSessionFromUrl, getPasswordResetTokenFromUrl]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ type: "", message: "" });

    if (password.length < 6) {
      setFeedback({ type: "error", message: "A nova senha precisa ter pelo menos 6 caracteres." });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({ type: "error", message: "As senhas informadas precisam ser iguais." });
      return;
    }

    setLoading(true);
    try {
      const data = await resetPassword({ token, password });
      setFeedback({
        type: "success",
        message: data?.message || "Senha atualizada com sucesso. Voce ja pode entrar com a nova senha."
      });
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => navigate("/login"), 1200);
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Nao foi possivel redefinir a senha." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#EEF4FB] px-4 py-5 text-slate-950 sm:px-6 lg:py-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.18),transparent_28%),radial-gradient(circle_at_82%_28%,rgba(99,102,241,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.82),rgba(219,234,254,0.52))]" />
      <div className="absolute left-[8%] top-[12%] h-40 w-72 rotate-[-18deg] rounded-[42px] bg-white/35 blur-2xl" />
      <div className="absolute bottom-[10%] right-[6%] h-44 w-80 rotate-[16deg] rounded-[48px] bg-blue-400/15 blur-2xl" />

      <section className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl items-center justify-center lg:min-h-screen">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[480px] rounded-[34px] border border-white/70 bg-white/45 p-5 shadow-[0_34px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl transition-all duration-300 sm:p-7"
        >
          <div className="flex items-center justify-between gap-3">
            <BrandLogo className="h-12 w-36" />
            <span className="rounded-full border border-white/70 bg-white/50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700 shadow-sm">
              Seguranca
            </span>
          </div>

          <div className="mt-7 text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">Recuperacao</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Redefinir senha</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-slate-600">
              Defina uma nova senha para recuperar seu acesso ao AgenSync.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <Field
              label="Nova senha"
              type="password"
              minLength={6}
              value={password}
              autoComplete="new-password"
              onChange={setPassword}
            />
            <Field
              label="Confirmar nova senha"
              type="password"
              minLength={6}
              value={confirmPassword}
              autoComplete="new-password"
              onChange={setConfirmPassword}
            />

            <Feedback type={feedback.type} message={feedback.message} />

            <button
              type="submit"
              disabled={loading || initializing}
              className="min-h-13 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_42px_rgba(37,99,235,0.26)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(37,99,235,0.34)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-65"
            >
              {initializing ? "Validando link..." : loading ? "Atualizando..." : "Atualizar senha"}
            </button>
          </div>

          <div className="mt-6 text-center text-sm font-bold text-slate-600">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="font-black text-blue-700 hover:text-blue-900"
            >
              Voltar ao login
            </button>
          </div>

          <p className="mt-5 rounded-2xl border border-white/70 bg-white/45 px-4 py-3 text-center text-xs font-bold text-slate-500">
            Sem link valido? <Link to="/login" className="text-blue-700 hover:text-blue-900">Solicite nova recuperacao</Link>.
          </p>
        </form>
      </section>
    </main>
  );
}

