export const workspaceNavigation = [
  { to: "/", label: "Dashboard", icon: "dashboard", tourId: "dashboard", permission: "dashboard" },
  {
    id: "agenda",
    label: "Agenda",
    icon: "agenda",
    tourId: "agenda",
    permission: "agenda",
    children: [
      { to: "/agenda/semanal", label: "Agenda semanal", permission: "agenda" },
      { to: "/agenda/diaria", label: "Agenda diaria", permission: "agenda" },
      { to: "/agenda/horarios", label: "Horarios de trabalho", permission: "agenda" }
    ]
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: "clients",
    tourId: "clients",
    permission: "clients",
    children: [
      { to: "/clientes", label: "Clientes", permission: "clients" },
      { to: "/clientes/atendimento", label: "Atendimento", permission: "clients" },
      { to: "/clientes/fichas", label: "Fichas", permission: "clients" },
      { to: "/clientes/evolucao", label: "Evolucao", permission: "clients" },
      { to: "/clientes/documentos", label: "Documentos", permission: "clients" },
      { to: "/clientes/linha-do-tempo", label: "Linha do tempo", permission: "clients" }
    ]
  },
  {
    id: "catalogo",
    label: "Catalogo",
    icon: "services",
    children: [
      { to: "/servicos", label: "Servicos", tourId: "services", permission: "services" },
      { to: "/produtos", label: "Produtos", tourId: "products", permission: "products" },
      { to: "/profissionais", label: "Profissionais", permission: "professionals" }
    ]
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: "finance",
    tourId: "finance",
    children: [
      { to: "/vendas/nova", label: "Nova venda", permission: "sales" },
      { to: "/mensalidades", label: "Mensalidades", permission: "subscriptions" },
      { to: "/financeiro", label: "Financeiro", permission: "finance" },
      { to: "/despesas", label: "Despesas", permission: "expenses" },
      { to: "/historico", label: "Historico", permission: "clients" },
      { to: "/vendas/historico", label: "Historico de vendas", permission: "sales" },
      { to: "/vendas/comissoes", label: "Comissoes", permission: "sales" },
      { to: "/vendas/relatorios", label: "Relatorios", permission: "reports" }
    ]
  },
  { to: "/admin", label: "Admin", icon: "settings", adminOnly: true, permission: "admin" },
  {
    id: "configuracoes",
    label: "Configuracoes",
    icon: "settings",
    permission: "settings",
    children: [
      { to: "/configuracoes", label: "Configuracoes gerais", permission: "settings", exact: true },
      { to: "/configuracoes/permissoes-especiais", label: "Permissoes especiais", permission: "settings" },
      { to: "/configuracoes/auditoria", label: "Auditoria de acesso", permission: "settings" }
    ]
  }
];

export const platformNavigation = [
  { to: "/platform", label: "Painel da plataforma", icon: "dashboard" },
  { to: "/platform/contas", label: "Contas", icon: "clients" },
  { to: "/platform/planos", label: "Planos", icon: "finance" },
  { to: "/platform/auditoria", label: "Auditoria", icon: "history" },
  { to: "/platform/suporte", label: "Suporte", icon: "settings" }
];
