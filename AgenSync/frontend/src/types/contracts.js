export const endpointContracts = Object.freeze({
  auth: {
    login: "POST /auth/login",
    register: "POST /auth/register",
    forgotPassword: "POST /auth/forgot-password",
    resetPassword: "POST /auth/reset-password",
    me: "GET /auth/me"
  },
  clients: {
    list: "GET /clients",
    create: "POST /clients",
    update: "PUT /clients/:id",
    delete: "DELETE /clients/:id"
  },
  appointments: {
    list: "GET /appointments",
    create: "POST /appointments",
    update: "PUT /appointments/:id",
    delete: "DELETE /appointments/:id"
  },
  services: {
    list: "GET /services",
    create: "POST /services",
    update: "PUT /services/:id",
    delete: "DELETE /services/:id"
  },
  documents: {
    list: "GET /documents",
    create: "POST /documents",
    update: "PUT /documents/:id",
    delete: "DELETE /documents/:id"
  },
  budgets: {
    list: "GET /budgets",
    create: "POST /budgets",
    update: "PUT /budgets/:id",
    delete: "DELETE /budgets/:id"
  },
  expenses: {
    list: "GET /expenses",
    create: "POST /expenses",
    update: "PUT /expenses/:id",
    delete: "DELETE /expenses/:id"
  },
  products: {
    list: "GET /products",
    create: "POST /products",
    update: "PUT /products/:id",
    delete: "DELETE /products/:id"
  },
  sales: {
    list: "GET /sales",
    create: "POST /sales"
  },
  monthlyPlans: {
    list: "GET /subscriptions/monthly-plans",
    create: "POST /subscriptions/monthly-plans",
    update: "PUT /subscriptions/monthly-plans/:id",
    cancel: "POST /subscriptions/monthly-plans/:id/cancel",
    payments: "POST /subscriptions/monthly-plans/:id/payments"
  }
});
