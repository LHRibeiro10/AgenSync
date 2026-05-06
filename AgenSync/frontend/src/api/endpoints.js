export const endpoints = Object.freeze({
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    me: "/auth/me",
    logout: "/auth/logout",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password"
  },
  notificationTokens: "/notification-tokens",
  notifications: {
    list: "/notifications",
    read: (id) => `/notifications/${id}/read`,
    readAll: "/notifications/read-all"
  },
  admin: {
    summary: "/admin/summary",
    users: "/admin/users",
    userRole: (id) => `/admin/users/${id}/role`,
    auditLogs: "/admin/audit-logs"
  },
  clients: {
    list: "/clients",
    import: "/clients/import",
    byId: (id) => `/clients/${id}`
  },
  professionals: {
    list: "/professionals",
    byId: (id) => `/professionals/${id}`
  },
  services: {
    list: "/services",
    byId: (id) => `/services/${id}`
  },
  appointments: {
    list: "/appointments",
    byId: (id) => `/appointments/${id}`
  },
  dashboard: "/dashboard",
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
    monthlyPlanById: (id) => `/subscriptions/monthly-plans/${id}`
  }
});
