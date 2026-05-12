import Card, { CardHeader } from "../components/Card.jsx";
import PageHeader from "../components/PageHeader.jsx";

const platformMetrics = [
  "Total de assinantes",
  "Contas ativas",
  "Contas vencidas",
  "Receita estimada",
  "Quantidade por plano",
  "Profissionais por conta",
  "Admins por conta",
  "Logs e auditoria"
];

export default function PlatformDashboard() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Painel da plataforma"
        description="Base estrutural para operacao, suporte avancado, auditoria e modo GOD do AgenSync."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {platformMetrics.slice(0, 4).map((metric) => (
          <article key={metric} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">{metric}</p>
            <p className="mt-2 text-3xl font-black text-ink">--</p>
          </article>
        ))}
      </section>

      <Card>
        <CardHeader
          title="Arquitetura de plataforma"
          description="O usuario platform_owner deve operar fora do workspace comum e futuramente acessar contas, planos, impersonacao e auditoria."
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {platformMetrics.map((metric) => (
            <div key={metric} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="text-sm font-black text-ink">{metric}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
