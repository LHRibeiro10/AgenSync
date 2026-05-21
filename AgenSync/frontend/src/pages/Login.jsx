import { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import BrandLogo from "../components/BrandLogo.jsx";
import SvgIcon from "../components/SvgIcon.jsx";

const initialForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: ""
};

const views = {
  login: {
    title: "Entrar na sua conta",
    subtitle: "Acesse o AgenSync e continue gerenciando seu negócio.",
    panelTitle: "Bem-vindo de volta",
    panelDescription: "Organize sua agenda, clientes e finanças em um só lugar."
  },
  register: {
    title: "Criar conta",
    subtitle: "Comece agora e configure seu acesso inicial no AgenSync.",
    panelTitle: "Seu negócio, em controle",
    panelDescription: "Crie sua conta e centralize atendimento, clientes e financeiro com visual profissional."
  },
  recovery: {
    title: "Recuperar senha",
    subtitle: "Receba um link seguro para redefinir seu acesso.",
    panelTitle: "Recuperacao segura",
    panelDescription: "Informe o e-mail da conta para receber o link de redefinição."
  }
};

const highlights = [
  {
    key: "appointments",
    title: "Agendamentos inteligentes",
    description: "Visual claro de horarios e conflitos prevenidos automaticamente."
  },
  {
    key: "clients",
    title: "Gestao de clientes",
    description: "Historico, dados e relacionamento organizados no mesmo fluxo."
  },
  {
    key: "finance",
    title: "Controle financeiro",
    description: "Receitas, despesas e performance com visao direta para decisoes."
  }
];

function AuthInput({
  label,
  icon,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  required = true
}) {
  return (
    <label className="login-auth-input block">
      <span className="login-auth-label mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
        {label}
      </span>
      <div className="relative">
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          <SvgIcon name={icon} />
        </div>
        <input
          required={required}
          type={type}
          value={value}
          minLength={minLength}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="login-auth-field min-h-12 w-full rounded-2xl border border-white/10 bg-[#0C122A] pl-11 pr-4 text-sm font-semibold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 placeholder:text-slate-500 hover:border-white/20 focus:border-[#7E4FFF] focus:ring-4 focus:ring-[#7E4FFF]/20"
        />
      </div>
    </label>
  );
}

function AuthMessage({ type, children }) {
  if (!children) return null;

  const classes =
    type === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : "border-red-500/30 bg-red-500/10 text-red-200";

  return <div className={`login-auth-message rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 ${classes}`}>{children}</div>;
}

export default function Login() {
  const { login, register, forgotPassword, resendConfirmation, authConfigurationError } = useAuth();
  const [view, setView] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [rememberMe, setRememberMe] = useState(true);

  const currentView = views[view];
  const isLogin = view === "login";
  const isRegister = view === "register";
  const isRecovery = view === "recovery";
  const canResendConfirmation =
    isLogin &&
    ["EMAIL_NOT_CONFIRMED", "EMAIL_CONFIRMATION_REQUIRED"].includes(feedback.code) &&
    form.email.trim();

  const actionLabel = useMemo(() => {
    if (isLogin) return "Entrar";
    if (isRegister) return "Criar conta";
    return "Enviar link";
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
      businessName: "",
      businessType: ""
    });

    if (data?.emailConfirmationRequired) {
      setView("login");
      setFeedback({
        type: "success",
        code: "EMAIL_CONFIRMATION_REQUIRED",
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
    <main className="login-page relative min-h-screen overflow-hidden bg-[#050710] px-4 py-6 text-slate-100 sm:px-6 lg:px-10 lg:py-10">
      <div className="login-bg-1 pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(55,18,112,0.58),transparent_38%),radial-gradient(circle_at_86%_12%,rgba(28,88,196,0.46),transparent_36%),linear-gradient(145deg,#04050C_0%,#080B18_48%,#050711_100%)]" />
      <div className="login-bg-2 pointer-events-none absolute -left-20 top-16 h-72 w-72 rounded-full bg-[#7E4FFF]/20 blur-3xl" />
      <div className="login-bg-3 pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#2563EB]/20 blur-3xl" />

      <section className="login-shell relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl items-center justify-center">
        <div className="login-frame grid w-full gap-5 rounded-[28px] border border-white/10 bg-white/[0.03] p-3 shadow-[0_36px_100px_rgba(6,8,20,0.72)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr] lg:gap-0">
          <aside className="login-marketing order-2 relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#1A0B2E] via-[#2A0F4F] to-[#143C85] p-7 sm:p-10 lg:order-1 lg:min-h-[680px]">
            <div className="pointer-events-none absolute inset-0 opacity-35">
              <svg viewBox="0 0 860 760" className="h-full w-full">
                <path d="M-10 105C95 35 215 40 305 105C395 170 390 280 306 340C238 390 134 406 75 470C16 534 30 650 132 760" stroke="white" strokeWidth="1.2" fill="none" />
                <path d="M655 760C605 700 575 656 548 610C520 562 520 518 550 486C582 452 635 454 672 486C706 514 730 564 744 620C758 676 786 726 846 760" stroke="white" strokeWidth="1.2" fill="none" />
                <path d="M702 760C652 700 622 656 595 610C567 562 567 518 597 486C629 452 682 454 719 486C753 514 777 564 791 620C805 676 833 726 893 760" stroke="white" strokeWidth="1.2" fill="none" />
              </svg>
            </div>
            <div className="pointer-events-none absolute right-7 top-8 h-28 w-11 bg-[radial-gradient(circle,rgba(255,255,255,0.9)_2px,transparent_3px)] [background-size:11px_11px]" />

            <div className="relative z-10 page-transition">
              <div className="flex w-full justify-center">
                <BrandLogo
                  src="/AgenSync_sidebar.png"
                  className="login-brand-logo h-20 w-[18rem] sm:h-24 sm:w-[21rem]"
                  imageClassName="opacity-100"
                />
              </div>

              <h1 className="mt-10 text-4xl font-black tracking-tight text-white sm:text-5xl">{currentView.panelTitle}</h1>
              <p className="mt-4 max-w-lg text-lg font-medium leading-relaxed text-blue-100/90 sm:text-xl">
                {currentView.panelDescription}
              </p>

              <div className="mt-10 space-y-4">
                {highlights.map((item, index) => (
                  <article
                    key={item.key}
                    className="page-transition rounded-2xl border border-white/15 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-sm"
                    style={{ animationDelay: `${80 + index * 70}ms` }} // Consider moving inline styles to CSS classes if possible
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white/15 text-white">
                        <SvgIcon name={item.key} />
                      </span>
                      <div>
                        <p className="text-sm font-black text-white">{item.title}</p>
                        <p className="mt-1 text-xs font-medium leading-5 text-blue-100/85">{item.description}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </aside>

          <form
            onSubmit={handleSubmit}
            className="login-form-card order-1 rounded-[22px] border border-white/10 bg-[#0A0F24]/88 px-6 py-7 shadow-[0_24px_50px_rgba(4,6,16,0.6)] backdrop-blur-xl sm:px-8 sm:py-9 lg:order-2 lg:min-h-[680px] lg:px-10 lg:py-11"
          >
            <div className="login-form-inner mx-auto w-full max-w-[380px] page-transition">
              <p className="login-form-kicker text-xs font-black uppercase tracking-[0.16em] text-violet-200/85">Acesso seguro</p>
              <h2 className="login-form-title mt-3 text-3xl font-black tracking-tight text-white sm:text-[2.2rem]">{currentView.title}</h2>
              <p className="login-form-subtitle mt-3 text-sm font-semibold leading-6 text-slate-300">{currentView.subtitle}</p>

              {!isRecovery ? (
                <div className="login-tabs mt-7 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => switchView("login")}
                    className={`min-h-11 rounded-xl text-sm font-bold transition duration-200 ${
                      isLogin
                        ? "bg-gradient-to-r from-[#402180] to-[#2455C6] text-white shadow-[0_8px_24px_rgba(38,88,199,0.42)]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView("register")}
                    className={`min-h-11 rounded-xl text-sm font-bold transition duration-200 ${
                      isRegister
                        ? "bg-gradient-to-r from-[#402180] to-[#2455C6] text-white shadow-[0_8px_24px_rgba(38,88,199,0.42)]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Criar conta
                  </button>
                </div>
              ) : null}

              <div key={view} className="login-fields tab-panel-enter mt-7 space-y-4">
                {isRegister ? (
                  <AuthInput
                    label="Nome"
                    icon="user"
                    value={form.name}
                    minLength={2}
                    autoComplete="name"
                    onChange={(value) => update("name", value)}
                    placeholder="Seu nome completo"
                  />
                ) : null}

                <AuthInput
                  label="E-mail"
                  icon="email"
                  type="email"
                  value={form.email}
                  autoComplete="email"
                  onChange={(value) => update("email", value)}
                  placeholder="voce@empresa.com"
                />

                {!isRecovery ? (
                  <AuthInput
                    label="Senha"
                    icon="lock"
                    type="password"
                    value={form.password}
                    minLength={isRegister ? 6 : 1}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    onChange={(value) => update("password", value)}
                    placeholder="Digite sua senha"
                  />
                ) : null}

                {isRegister ? (
                  <AuthInput
                    label="Confirmar senha"
                    icon="lock"
                    type="password"
                    value={form.confirmPassword}
                    minLength={6}
                    autoComplete="new-password"
                    onChange={(value) => update("confirmPassword", value)}
                    placeholder="Repita sua senha"
                  />
                ) : null}

                {isLogin ? (
                  <div className="login-remember-row flex items-center justify-between gap-3 text-sm">
                    <label className="inline-flex items-center gap-2 font-semibold text-slate-300">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) => setRememberMe(event.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-[#0C122A] text-[#7E4FFF] focus:ring-[#7E4FFF]/40"
                      />
                      Lembrar de mim
                    </label>
                    <button
                      type="button"
                      onClick={() => switchView("recovery")}
                      className="font-semibold text-slate-300 transition duration-200 hover:text-[#89AFFF]"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                ) : null}

                {isRecovery ? (
                  <p className="login-recovery-note rounded-2xl border border-[#7E4FFF]/30 bg-[#7E4FFF]/10 px-4 py-3 text-sm font-semibold text-violet-100">
                    Enviaremos um link para redefinir sua senha no e-mail informado.
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
                    className="login-resend-button w-full rounded-2xl border border-[#7E4FFF]/35 bg-[#7E4FFF]/10 px-4 py-3 text-sm font-bold text-violet-100 transition duration-200 hover:bg-[#7E4FFF]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resendingConfirmation ? "Reenviando..." : "Reenviar e-mail de confirmação"}
                  </button>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="login-submit-button min-h-12 w-full rounded-2xl bg-gradient-to-r from-[#2A0F4F] via-[#47218E] to-[#1E63D6] px-5 py-3 text-base font-black text-white shadow-[0_18px_34px_rgba(26,11,46,0.58)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
                >
                  {loading ? "Processando..." : actionLabel}
                </button>
              </div>

              <div className="login-form-footer mt-7 text-center text-sm font-semibold text-slate-300">
                {isRecovery ? (
                  <button
                    type="button"
                    onClick={() => switchView("login")}
                    className="text-[#89AFFF] transition duration-200 hover:text-[#AFC7FF]"
                  >
                    Voltar ao login
                  </button>
                ) : isLogin ? (
                  <span>
                    Não tem conta?{" "}
                    <button
                      type="button"
                      onClick={() => switchView("register")}
                      className="text-[#89AFFF] transition duration-200 hover:text-[#AFC7FF]"
                    >
                      Criar conta
                    </button>
                  </span>
                ) : (
                  <span>
                    Ja tem conta?{" "}
                    <button
                      type="button"
                      onClick={() => switchView("login")}
                      className="text-[#89AFFF] transition duration-200 hover:text-[#AFC7FF]"
                    >
                      Entrar
                    </button>
                  </span>
                )}
              </div>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
