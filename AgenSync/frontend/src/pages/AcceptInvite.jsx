import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BrandLogo from "../components/BrandLogo.jsx";
import Button from "../components/Button.jsx";
import Message from "../components/Message.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { validateWorkspaceInvite } from "../services/workspaceTeamService.js";

const initialForm = {
  name: "",
  password: ""
};

function roleLabel(role) {
  if (role === "admin") return "Administrador";
  if (role === "professional") return "Profissional";
  return "Membro";
}

export default function AcceptInvite() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, acceptInvite } = useAuth();
  const [invite, setInvite] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    validateWorkspaceInvite(token)
      .then((data) => {
        if (!active) return;
        const nextInvite = data.invite || null;
        setInvite(nextInvite);
        setForm((current) => ({
          ...current,
          name: nextInvite?.name || ""
        }));
      })
      .catch((err) => {
        if (active) setError(err.message || "Nao foi possivel validar o convite.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const loggedEmail = String(user?.email || "").trim().toLowerCase();
  const inviteEmail = String(invite?.email || "").trim().toLowerCase();
  const emailMismatch = Boolean(isAuthenticated && inviteEmail && loggedEmail && inviteEmail !== loggedEmail);
  const needsPassword = !isAuthenticated;
  const needsName = !isAuthenticated && invite?.existingUser !== true;
  const canSubmit = useMemo(() => {
    if (!invite?.valid || emailMismatch) return false;
    if (needsName && form.name.trim().length < 2) return false;
    if (needsPassword && form.password.length < 1) return false;
    return true;
  }, [emailMismatch, form.name, form.password, invite?.valid, needsName, needsPassword]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");

    try {
      await acceptInvite({
        token,
        name: form.name.trim(),
        password: form.password
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Nao foi possivel aceitar o convite.");
    } finally {
      setSubmitting(false);
    }
  }

  const invalidMessage = invite && !invite.valid
    ? invite.expired
      ? "Este convite expirou. Solicite um novo convite ao responsavel pelo workspace."
      : "Este convite nao esta mais disponivel."
    : "";

  return (
    <main className="min-h-screen bg-[#050710] px-4 py-6 text-slate-100 sm:px-6 lg:px-10 lg:py-10">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_36px_100px_rgba(6,8,20,0.72)] backdrop-blur-xl lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="relative hidden min-h-[580px] overflow-hidden bg-gradient-to-br from-[#1A0B2E] via-[#2A0F4F] to-[#143C85] p-9 lg:block">
            <div className="pointer-events-none absolute inset-0 opacity-35">
              <svg viewBox="0 0 860 760" className="h-full w-full">
                <path d="M-10 105C95 35 215 40 305 105C395 170 390 280 306 340C238 390 134 406 75 470C16 534 30 650 132 760" stroke="white" strokeWidth="1.2" fill="none" />
                <path d="M655 760C605 700 575 656 548 610C520 562 520 518 550 486C582 452 635 454 672 486C706 514 730 564 744 620C758 676 786 726 846 760" stroke="white" strokeWidth="1.2" fill="none" />
              </svg>
            </div>
            <div className="relative z-10">
              <BrandLogo src="/AgenSync_sidebar.png" className="h-20 w-[18rem]" imageClassName="opacity-100" />
              <h1 className="mt-14 max-w-md text-4xl font-black tracking-tight text-white">Bem-vindo ao workspace</h1>
              <p className="mt-4 max-w-md text-base font-semibold leading-7 text-blue-100/90">
                Seu acesso sera vinculado ao papel definido pelo responsavel da conta.
              </p>
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="bg-[#0A0F24]/88 px-5 py-7 sm:px-8 sm:py-10 lg:px-12">
            <div className="mx-auto max-w-md">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200/85">Convite AgenSync</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Aceitar convite</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
                Confirme seus dados para entrar no workspace com o acesso correto.
              </p>

              <div className="mt-7 space-y-4">
                {loading || authLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-300">
                    Validando convite...
                  </div>
                ) : null}

                <Message type="error">{error || invalidMessage}</Message>

                {invite?.valid ? (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Workspace</p>
                      <p className="mt-1 text-base font-black text-white">{invite.workspaceName || "Workspace AgenSync"}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Email</p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-100">{invite.email}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Perfil</p>
                        <p className="mt-1 text-sm font-bold text-slate-100">{roleLabel(invite.role)}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {emailMismatch ? (
                  <Message type="error">
                    Voce esta logado como {user?.email}. Este convite pertence a {invite?.email}.
                  </Message>
                ) : null}

                {invite?.valid && needsName ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                      Nome
                    </span>
                    <input
                      required
                      minLength={2}
                      value={form.name}
                      onChange={(event) => update("name", event.target.value)}
                      className="min-h-12 w-full rounded-2xl border border-white/10 bg-[#0C122A] px-4 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-[#7E4FFF] focus:ring-4 focus:ring-[#7E4FFF]/20"
                      placeholder="Seu nome completo"
                    />
                  </label>
                ) : null}

                {invite?.valid && needsPassword ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-300">
                      Senha
                    </span>
                    <input
                      required
                      type="password"
                      minLength={invite.existingUser ? 1 : 6}
                      value={form.password}
                      onChange={(event) => update("password", event.target.value)}
                      className="min-h-12 w-full rounded-2xl border border-white/10 bg-[#0C122A] px-4 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-[#7E4FFF] focus:ring-4 focus:ring-[#7E4FFF]/20"
                      placeholder={invite.existingUser ? "Senha da sua conta" : "Crie uma senha"}
                    />
                  </label>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  loading={submitting}
                  loadingLabel="Aceitando..."
                  disabled={!canSubmit}
                  className="w-full rounded-2xl"
                >
                  Aceitar convite
                </Button>

                <Link to="/login" className="block text-center text-sm font-bold text-[#AFC7FF] transition hover:text-white">
                  Entrar com outra conta
                </Link>
              </div>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
