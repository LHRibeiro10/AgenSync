import { useMemo } from "react";
import { useParams } from "react-router-dom";
import Card, { CardHeader } from "../components/Card.jsx";
import PageHeader from "../components/PageHeader.jsx";

const platformSections = {
  dashboard: {
    title: "Painel da plataforma",
    description: "Base estrutural para operacao, suporte avancado, auditoria e modo GOD do AgenSync.",
    metrics: [
      ["Total de assinantes", "--"],
      ["Contas ativas", "--"],
      ["Contas vencidas", "--"],
      ["Receita estimada", "--"]
    ],
    cardTitle: "Arquitetura de plataforma",
    cardDescription: "O usuario platform_owner opera fora do workspace comum e pode evoluir para acessar contas, planos, impersonacao e auditoria.",
    items: [
      "Quantidade por plano",
      "Profissionais por conta",
      "Admins por conta",
      "Logs e auditoria",
      "Status de assinatura",
      "Suporte avancado"
    ]
  },
  contas: {
    title: "Contas",
    description: "Visao estrutural das contas, assinantes, usuarios vinculados e status operacional.",
    metrics: [
      ["Contas cadastradas", "--"],
      ["Contas ativas", "--"],
      ["Admins", "--"],
      ["Profissionais", "--"]
    ],
    cardTitle: "Gestao de contas",
    cardDescription: "Preparado para listar contas, abrir detalhes, impersonar workspace e acompanhar saude da assinatura.",
    items: [
      "Lista de contas",
      "Status da assinatura",
      "Usuarios por conta",
      "Profissionais por conta",
      "Impersonar conta",
      "Inativar usuario"
    ]
  },
  planos: {
    title: "Planos",
    description: "Estrutura para controlar planos, limites, recursos liberados e futuras cobrancas.",
    metrics: [
      ["Planos ativos", "--"],
      ["Contas pagas", "--"],
      ["Trials", "--"],
      ["Receita prevista", "--"]
    ],
    cardTitle: "Planos e permisssoes comerciais",
    cardDescription: "Pagamentos seguem desativados por enquanto; o banco ja reconhece as contas como pagas ate a cobranca real entrar.",
    items: [
      "Plano atual",
      "Limite de profissionais",
      "Recursos liberados",
      "Status pago",
      "Alterar plano",
      "Desbloquear assinatura"
    ]
  },
  auditoria: {
    title: "Auditoria",
    description: "Base para logs, eventos sensiveis, acoes administrativas e trilha de suporte.",
    metrics: [
      ["Eventos hoje", "--"],
      ["Acoes admin", "--"],
      ["Falhas de acesso", "--"],
      ["Alertas", "--"]
    ],
    cardTitle: "Logs e rastreabilidade",
    cardDescription: "Preparado para registrar acessos, alteracoes de plano, impersonacao e operacoes sensiveis.",
    items: [
      "Login e logout",
      "Alteracao de permissao",
      "Mudanca de plano",
      "Impersonacao",
      "Bloqueios",
      "Exportacao futura"
    ]
  },
  suporte: {
    title: "Modo GOD",
    description: "Base de suporte maximo para diagnostico, desbloqueio, impersonacao e operacoes criticas.",
    metrics: [
      ["Acesso total", "ON"],
      ["Impersonacao", "--"],
      ["Desbloqueios", "--"],
      ["Acoes criticas", "--"]
    ],
    cardTitle: "Ferramentas de suporte avancado",
    cardDescription: "Estrutura reservada ao platform_owner para operar fora dos workspaces e resolver problemas de contas.",
    items: [
      "Impersonar conta",
      "Desbloquear assinatura",
      "Alterar plano",
      "Inativar usuario",
      "Reprocessar status",
      "Auditar conta"
    ]
  }
};

function MetricGrid({ metrics }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value]) => (
        <article key={label} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">{label}</p>
          <p className="mt-2 text-3xl font-black text-ink">{value}</p>
        </article>
      ))}
    </section>
  );
}

export default function PlatformDashboard() {
  const { section } = useParams();
  const activeSection = useMemo(() => platformSections[section] || platformSections.dashboard, [section]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title={activeSection.title} description={activeSection.description} />

      <MetricGrid metrics={activeSection.metrics} />

      <Card>
        <CardHeader title={activeSection.cardTitle} description={activeSection.cardDescription} />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeSection.items.map((item) => (
            <div key={item} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="text-sm font-black text-ink">{item}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
