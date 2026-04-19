export const endpoints = Object.freeze({
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    me: "/auth/me",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password"
  },
  clients: {
    list: "/clients",
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
