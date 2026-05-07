import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import Button from "./Button.jsx";
import Icon from "./Icon.jsx";

const helpByRoute = [
  {
    match: (path) => path === "/",
    title: "Ajuda do Dashboard",
    intro: "Use esta tela para acompanhar o resumo do negocio e decidir o que precisa de atencao primeiro.",
    steps: [
      "Ajuste o periodo no filtro para atualizar os indicadores.",
      "Veja proximos horarios para agir antes dos atendimentos.",
      "Compare entradas, despesas e lucro para entender o resultado do periodo."
    ]
  },
  {
    match: (path) => path.startsWith("/agenda"),
    title: "Ajuda da Agenda",
    intro: "Aqui voce acompanha os horarios por dia e organiza a rotina de atendimento.",
    steps: [
      "Use os dias da semana para navegar entre datas.",
      "Abra um atendimento para revisar status, cliente e servico.",
      "Configure horarios quando precisar ajustar a disponibilidade."
    ]
  },
  {
    match: (path) => path.startsWith("/agendamentos"),
    title: "Ajuda de Agendamentos",
    intro: "Esta pagina cria e edita atendimentos com cliente, profissional, servico, data e valor.",
    steps: [
      "Escolha cliente e servico antes de definir horario.",
      "Confira preco, duracao e profissional antes de salvar.",
      "Altere o status para concluido, cancelado ou nao compareceu quando necessario."
    ]
  },
  {
    match: (path) => path.startsWith("/clientes"),
    title: "Ajuda de Clientes",
    intro: "Aqui ficam cadastro, historico, fotos, documentos, orcamentos e evolucao de cada cliente.",
    steps: [
      "Cadastre nome e telefone para liberar agendamentos.",
      "Abra Atendimento para ver fichas, historico e documentos.",
      "Use Inativar para ocultar o cliente dos fluxos novos sem perder historico."
    ]
  },
  {
    match: (path) => path.startsWith("/profissionais"),
    title: "Ajuda de Profissionais",
    intro: "Use esta tela para organizar quem atende e quais profissionais aparecem na agenda.",
    steps: [
      "Cadastre o profissional com nome e dados principais.",
      "Mantenha ativos apenas os profissionais disponiveis.",
      "Use a selecao no agendamento para distribuir os atendimentos."
    ]
  },
  {
    match: (path) => path.startsWith("/servicos"),
    title: "Ajuda de Servicos",
    intro: "Servicos definem o que voce vende em atendimento, com preco e duracao padrao.",
    steps: [
      "Cadastre nome, preco e tempo medio.",
      "Inative servicos que nao sao mais oferecidos.",
      "Use valores padrao para agilizar novos agendamentos."
    ]
  },
  {
    match: (path) => path.startsWith("/produtos"),
    title: "Ajuda de Produtos",
    intro: "Produtos controlam estoque, preco de venda e itens usados ou vendidos no atendimento.",
    steps: [
      "Cadastre custo, preco de venda e estoque atual.",
      "Acompanhe estoque minimo para evitar falta.",
      "Inative produtos fora do catalogo sem apagar historico."
    ]
  },
  {
    match: (path) => path.startsWith("/vendas"),
    title: "Ajuda de Vendas",
    intro: "Registre vendas de produtos e acompanhe o impacto delas no financeiro.",
    steps: [
      "Escolha produto, quantidade e cliente quando houver.",
      "Confira o total antes de salvar.",
      "Use filtros para revisar vendas por periodo ou cliente."
    ]
  },
  {
    match: (path) => path.startsWith("/mensalidades"),
    title: "Ajuda de Mensalidades",
    intro: "Mensalidades servem para planos recorrentes, pacotes e clientes com pagamento fixo.",
    steps: [
      "Crie um plano vinculado ao cliente.",
      "Defina valor, vencimento e data inicial.",
      "Registre pagamentos para manter o financeiro atualizado."
    ]
  },
  {
    match: (path) => path.startsWith("/historico"),
    title: "Ajuda do Historico",
    intro: "O historico mostra atendimentos passados e ajuda a conferir o relacionamento com clientes.",
    steps: [
      "Filtre por cliente, status ou periodo.",
      "Use o historico para revisar atendimentos concluidos.",
      "Corrija registros antigos quando encontrar algum dado errado."
    ]
  },
  {
    match: (path) => path.startsWith("/financeiro") || path.startsWith("/relatorios"),
    title: "Ajuda do Financeiro",
    intro: "Esta pagina consolida entradas, saidas, lucro e exportacao para planilha.",
    steps: [
      "Escolha o periodo que quer analisar.",
      "Compare receitas com despesas cadastradas.",
      "Use exportar Excel quando precisar guardar ou enviar um relatorio."
    ]
  },
  {
    match: (path) => path.startsWith("/despesas"),
    title: "Ajuda de Despesas",
    intro: "Despesas registram custos do negocio para deixar o lucro mais realista.",
    steps: [
      "Cadastre descricao, categoria, valor e data.",
      "Use recorrencia para contas que se repetem.",
      "Revise despesas pelo financeiro para conferir o lucro liquido."
    ]
  },
  {
    match: (path) => path.startsWith("/configuracoes"),
    title: "Ajuda de Configuracoes",
    intro: "Aqui voce ajusta identidade do negocio, tipo de negocio, importacao e dados da conta.",
    steps: [
      "Envie a logo e confira a previa antes de salvar.",
      "Atualize o nome do negocio para aparecer no sistema.",
      "Escolha o tipo de negocio para receber sugestoes de servicos."
    ]
  },
  {
    match: (path) => path.startsWith("/admin"),
    title: "Ajuda do Admin",
    intro: "O painel admin acompanha usuarios, atividade e auditoria do sistema.",
    steps: [
      "Veja indicadores gerais no topo.",
      "Use a lista de usuarios para revisar perfis e funcoes.",
      "Consulte auditoria para investigar eventos importantes."
    ]
  }
];

function helpForPath(pathname) {
  return (
    helpByRoute.find((item) => item.match(pathname)) || {
      title: "Ajuda da pagina",
      intro: "Use esta ajuda para entender a tela atual.",
      steps: ["Confira os campos principais.", "Salve alteracoes apenas depois de revisar.", "Volte ao menu lateral para acessar outras areas."]
    }
  );
}

export default function ContextHelpWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const help = useMemo(() => helpForPath(location.pathname), [location.pathname]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="fixed bottom-5 right-5 z-[55] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open ? (
        <section className="w-[calc(100vw-2.5rem)] max-w-sm rounded-2xl border border-[#DDE6F0] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand">Duvidas rapidas</p>
              <h2 className="mt-1 text-lg font-black text-ink">{help.title}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted">{help.intro}</p>
          <ol className="mt-3 space-y-2 text-sm font-bold leading-5 text-slate-700">
            {help.steps.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-black text-brand">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-blue-200 bg-brand text-white shadow-[0_16px_34px_rgba(37,99,235,0.34)] transition hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
        aria-label="Abrir ajuda da pagina"
      >
        <Icon name="message" className="h-5 w-5" />
      </button>
    </div>
  );
}
