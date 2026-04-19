import { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import BrandLogo from "../components/BrandLogo.jsx";
import { getSuggestedServices } from "../data/businessOnboarding.js";

const initialForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: ""
};

const views = {
  login: {
    eyebrow: "Acesso seguro",
    title: "Entre no AgenSync",
    description: "Gerencie agenda, clientes e financeiro em um painel profissional."
  },
  register: {
    eyebrow: "Comece agora",
    title: "Crie sua conta",
    description: "Configure seu acesso inicial e personalize o negócio depois."
  },
  recovery: {
    eyebrow: "Recuperação",
    title: "Redefinir senha",
    description: "Solicite a recuperação para voltar ao controle da sua operação."
  }
};

function cleanInitialServices() {
  return getSuggestedServices("Manicure").map((service) => ({
    name: service.name,
    priceDefault: Number(service.priceDefault) || 0,
    durationMinutes: Number(service.durationMinutes) || 60,
    isActive: true
  }));
}

function AuthInput({ label, type = "text", value, onChange, placeholder, autoComplete, minLength }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">{label}</span>
      <input
        required
        type={type}
        value={value}
        minLength={minLength}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-12 w-full rounded-2xl border border-white/70 bg-white/70 px-4 text-sm font-bold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_24px_rgba(15,23,42,0.06)] outline-none transition placeholder:text-slate-400 hover:bg-white/85 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
      />
    </label>
  );
}

function AuthMessage({ type, children }) {
  if (!children) return null;

  const classes =
    type === "success"
      ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-800"
      : "border-red-200/80 bg-red-50/80 text-red-700";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-bold leading-6 ${classes}`}>
      {children}
    </div>
  );
}

export default function Login() {
  const { login, register, forgotPassword, resendConfirmation, authConfigurationError } = useAuth();
  const [view, setView] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const currentView = views[view];
  const isLogin = view === "login";
  const isRegister = view === "register";
  const isRecovery = view === "recovery";
  const canResendConfirmation = isLogin && feedback.code === "EMAIL_NOT_CONFIRMED" && form.email.trim();

  const actionLabel = useMemo(() => {
    if (isLogin) return "Entrar";
    if (isRegister) return "Criar conta";
    return "Enviar solicitação";
  }, [isLogin, isRegister]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function switchView(nextView) {
    setView(nextView);
    setFeedback({ type: "", message: "" });
    setLoading(false);
    setResendingConfirmation(false);
  }

  async function handleLogin() {
    await login({ email: form.email.trim(), password: form.password });
  }

  async function handleRegister() {
    if (form.password !== form.confirmPassword) {
      throw new Error("As senhas precisam ser iguais.");
    }

    const data = await register({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      businessName: form.name.trim() ? `Agenda de ${form.name.trim()}` : "Meu negócio",
      businessType: "Manicure",
      initialServices: cleanInitialServices()
    });

    if (data?.emailConfirmationRequired) {
      setFeedback({
        type: "success",
        message: data.message || "Conta criada. Verifique seu email para confirmar o acesso."
      });
      return;
    }

    setFeedback({ type: "success", message: "Conta criada com sucesso." });
  }

  async function handlePasswordRecovery() {
    const data = await forgotPassword({ email: form.email.trim() });
    setFeedback({
      type: "success",
      message: data?.message || "Enviamos um link para redefinir sua senha."
    });
  }

  async function handleResendConfirmation() {
    setResendingConfirmation(true);
    setFeedback({ type: "", message: "" });

    try {
      const data = await resendConfirmation({ email: form.email.trim() });
      setFeedback({
        type: "success",
        message: data?.message || "Reenviamos o email de confirmação."
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Não foi possível reenviar o email de confirmação.",
        code: err.code || ""
      });
    } finally {
      setResendingConfirmation(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback({ type: "", message: "" });
    setLoading(true);

    try {
      if (isLogin) await handleLogin();
      if (isRegister) await handleRegister();
      if (isRecovery) await handlePasswordRecovery();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Não foi possível concluir a operação.",
        code: err.code || ""
      });
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
        <div className="grid w-full items-center gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <aside className="hidden lg:block">
            <div className="max-w-md">
              <div className="inline-flex rounded-3xl border border-white/70 bg-white/50 px-5 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
                <BrandLogo className="h-12 w-40" />
              </div>
              <h1 className="mt-8 text-5xl font-black leading-tight tracking-tight text-slate-950">
                Organização premium para atendimentos reais.
              </h1>
              <p className="mt-5 text-base font-semibold leading-8 text-slate-600">
                Uma experiência limpa para criar horários, acompanhar clientes e manter a rotina do negócio sob controle.
              </p>
              <div className="mt-8 grid gap-3">
                {["Agenda inteligente", "Clientes e histórico", "Financeiro conectado"].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/70 bg-white/45 px-4 py-3 text-sm font-black text-slate-700 shadow-sm backdrop-blur-xl">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex justify-center">
            <form
              onSubmit={handleSubmit}
              className="w-full max-w-[480px] rounded-[34px] border border-white/70 bg-white/45 p-5 shadow-[0_34px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl transition-all duration-300 sm:p-7"
            >
              <div className="flex items-center justify-between gap-3">
                <BrandLogo className="h-12 w-36 lg:hidden" />
                <span className="rounded-full border border-white/70 bg-white/50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700 shadow-sm">
                  AgenSync
                </span>
              </div>

              <div className="mt-7 text-center">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">{currentView.eyebrow}</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  {currentView.title}
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-slate-600">
                  {currentView.description}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 rounded-2xl border border-white/70 bg-white/40 p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => switchView("login")}
                  className={`min-h-11 rounded-xl text-sm font-black transition ${
                    isLogin ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => switchView("register")}
                  className={`min-h-11 rounded-xl text-sm font-black transition ${
                    isRegister ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Cadastro
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {isRegister ? (
                  <AuthInput
                    label="Nome"
                    value={form.name}
                    minLength={2}
                    autoComplete="name"
                    onChange={(value) => update("name", value)}
                    placeholder="Seu nome completo"
                  />
                ) : null}

                <AuthInput
                  label="Email"
                  type="email"
                  value={form.email}
                  autoComplete="email"
                  onChange={(value) => update("email", value)}
                  placeholder="seu@email.com"
                />

                {!isRecovery ? (
                  <AuthInput
                    label="Senha"
                    type="password"
                    value={form.password}
                    minLength={isRegister ? 6 : 1}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    onChange={(value) => update("password", value)}
                    placeholder={isRegister ? "Crie uma senha segura" : "Sua senha"}
                  />
                ) : null}

                {isRegister ? (
                  <AuthInput
                    label="Confirmar senha"
                    type="password"
                    value={form.confirmPassword}
                    minLength={6}
                    autoComplete="new-password"
                    onChange={(value) => update("confirmPassword", value)}
                    placeholder="Repita sua senha"
                  />
                ) : null}

                {isRecovery ? (
                  <p className="rounded-2xl border border-blue-100/80 bg-blue-50/70 px-4 py-3 text-sm font-bold leading-6 text-blue-900">
                    Informe o email da conta para receber o link de redefinição de senha.
                  </p>
                ) : null}

                <AuthMessage type={feedback.type}>
                  {feedback.message || (isLogin ? authConfigurationError : "")}
                </AuthMessage>

                {canResendConfirmation ? (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resendingConfirmation}
                    className="w-full rounded-2xl border border-blue-200/80 bg-blue-50/80 px-4 py-3 text-sm font-black text-blue-800 transition hover:border-blue-300 hover:bg-blue-100/80 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resendingConfirmation ? "Reenviando..." : "Reenviar email de confirmação"}
                  </button>
                ) : null}

                {isLogin ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => switchView("recovery")}
                      className="text-sm font-black text-blue-700 transition hover:text-blue-900"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-13 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_42px_rgba(37,99,235,0.26)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(37,99,235,0.34)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-65"
                >
                  {loading ? "Processando..." : actionLabel}
                </button>
              </div>

              <div className="mt-6 text-center text-sm font-bold text-slate-600">
                {isRecovery ? (
                  <button type="button" onClick={() => switchView("login")} className="font-black text-blue-700 hover:text-blue-900">
                    Voltar ao login
                  </button>
                ) : isLogin ? (
                  <span>
                    Ainda não tem conta?{" "}
                    <button type="button" onClick={() => switchView("register")} className="font-black text-blue-700 hover:text-blue-900">
                      Criar conta
                    </button>
                  </span>
                ) : (
                  <span>
                    Já tem conta?{" "}
                    <button type="button" onClick={() => switchView("login")} className="font-black text-blue-700 hover:text-blue-900">
                      Entrar
                    </button>
                  </span>
                )}
              </div>

              {isLogin ? (
                <p className="mt-5 rounded-2xl border border-white/70 bg-white/45 px-4 py-3 text-center text-xs font-bold text-slate-500">
                  Acesso protegido por Supabase Auth.
                </p>
              ) : null}
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

