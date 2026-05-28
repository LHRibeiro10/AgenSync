export const endpoints = Object.freeze({
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    me: "/auth/me",
    logout: "/auth/logout",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
    deleteAccount: "/auth/me"
  },
  workspace: {
    members: "/workspace/members",
    memberById: (id) => `/workspace/members/${id}`,
    disableMember: (id) => `/workspace/members/${id}/disable`,
    enableMember: (id) => `/workspace/members/${id}/enable`,
    auditLogs: "/workspace/audit-logs",
    invites: "/workspace/invites",
    inviteById: (id) => `/workspace/invites/${id}`,
    cancelInvite: (id) => `/workspace/invites/${id}/cancel`,
    validateInvite: (token) => `/workspace/invites/validate/${encodeURIComponent(token)}`,
    acceptInvite: "/workspace/invites/accept"
  },
  onboarding: {
    status: "/onboarding/status",
    business: "/onboarding/business",
    type: "/onboarding/type",
    services: "/onboarding/services",
    professionals: "/onboarding/professionals",
    clients: "/onboarding/clients",
    complete: "/onboarding/complete"
  },
  notificationTokens: "/notification-tokens",
  notifications: {
    list: "/notifications",
    clear: "/notifications",
    delete: (id) => `/notifications/${id}`,
    read: (id) => `/notifications/${id}/read`,
    readAll: "/notifications/read-all",
    settings: "/notifications/settings",
    test: "/notifications/test",
    pushSubscribe: "/notifications/push/subscribe",
    pushUnsubscribe: "/notifications/push/unsubscribe"
  },
  appointmentReminders: {
    processDue: "/appointment-reminders/process-due"
  },
  admin: {
    summary: "/admin/summary",
    users: "/admin/users",
    userRole: (id) => `/admin/users/${id}/role`,
    auditLogs: "/admin/audit-logs"
  },
  platform: {
    overview: "/platform/overview",
    metrics: "/platform/metrics",
    workspaces: "/platform/workspaces",
    workspaceById: (id) => `/platform/workspaces/${id}`,
    workspaceStatus: (id) => `/platform/workspaces/${id}/status`,
    workspacePlan: (id) => `/platform/workspaces/${id}/plan`,
    workspaceDelete: (id) => `/platform/workspaces/${id}`,
    userStatus: (id) => `/platform/users/${id}/status`
  },
  clients: {
    list: "/clients",
    overview: "/clients/overview",
    import: "/clients/import",
    byId: (id) => `/clients/${id}`
  },
  professionals: {
    list: "/professionals",
    byId: (id) => `/professionals/${id}`,
    access: (id) => `/professionals/${id}/access`
  },
  services: {
    list: "/services",
    byId: (id) => `/services/${id}`
  },
  appointments: {
    list: "/appointments",
    overview: "/appointments/overview",
    byId: (id) => `/appointments/${id}`
  },
  dashboard: "/dashboard",
  dashboardOverview: "/dashboard/overview",
  finance: "/finance",
  products: {
    list: "/products",
    byId: (id) => `/products/${id}`
  },
  sales: {
    list: "/sales",
    byId: (id) => `/sales/${id}`
  },
  expenses: {
    list: "/expenses",
    byId: (id) => `/expenses/${id}`
  },
  documents: {
    list: "/documents",
    byId: (id) => `/documents/${id}`
  },
  budgets: {
    list: "/budgets",
    byId: (id) => `/budgets/${id}`
  },
  subscriptions: {
    monthlyPlans: "/subscriptions/monthly-plans",
    monthlyPlansOverview: "/subscriptions/monthly-plans/overview",
    monthlyPlanById: (id) => `/subscriptions/monthly-plans/${id}`
  }
});
