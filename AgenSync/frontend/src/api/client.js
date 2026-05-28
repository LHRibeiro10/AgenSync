import {
  appointmentService,
  adminService,
  authService,
  clientService,
  dashboardService,
  financeService,
  professionalService,
  platformService,
  serviceCatalogService
} from "../services/index.js";

export const api = {
  register: async (payload) => {
    const result = await authService.register(payload);
    return { token: result.token || "", user: result.user };
  },
  login: async (payload) => {
    const result = await authService.login(payload);
    return { token: result.token || "", user: result.user };
  },
  me: async () => {
    const result = await authService.restoreSession();
    return { user: result.user };
  },
  updateUserSettings: (payload) => authService.updateUserSettings(payload),
  forgotPassword: (payload) => authService.forgotPassword(payload),
  resetPassword: (payload) => authService.resetPassword(payload),

  listClients: (params) => clientService.listClients(params),
  clientsOverview: (params) => clientService.clientsOverview(params),
  createClient: (payload) => clientService.createClient(payload),
  importClients: (payload) => clientService.importClients(payload),
  updateClient: (id, payload) => clientService.updateClient(id, payload),
  deleteClient: (id) => clientService.deleteClient(id),

  listProfessionals: (params) => professionalService.listProfessionals(params),
  createProfessional: (payload) => professionalService.createProfessional(payload),
  createProfessionalAccess: (id, payload) => professionalService.createProfessionalAccess(id, payload),
  updateProfessionalAccess: (id, payload) => professionalService.updateProfessionalAccess(id, payload),
  updateProfessional: (id, payload) => professionalService.updateProfessional(id, payload),
  deleteProfessional: (id) => professionalService.deleteProfessional(id),

  listServices: (params) => serviceCatalogService.listServices(params),
  createService: (payload) => serviceCatalogService.createService(payload),
  updateService: (id, payload) => serviceCatalogService.updateService(id, payload),
  deleteService: (id) => serviceCatalogService.deleteService(id),

  listAppointments: (params) => appointmentService.listAppointments(params),
  appointmentsOverview: (params) => appointmentService.appointmentsOverview(params),
  getAppointment: (id) => appointmentService.getAppointment(id),
  createAppointment: (payload) => appointmentService.createAppointment(payload),
  updateAppointment: (id, payload) => appointmentService.updateAppointment(id, payload),
  deleteAppointment: (id) => appointmentService.deleteAppointment(id),

  dashboard: (params) => dashboardService.getDashboard(params),
  dashboardOverview: (params) => dashboardService.getDashboardOverview(params),
  finance: (params) => financeService.getFinanceSummary(params),
  adminSummary: () => adminService.getAdminSummary(),
  listAdminUsers: (params) => adminService.listAdminUsers(params),
  updateAdminUserRole: (id, role) => adminService.updateAdminUserRole(id, role),
  listAdminAuditLogs: (params) => adminService.listAdminAuditLogs(params),

  platformOverview: (params) => platformService.getPlatformOverview(params),
  listPlatformWorkspaces: (params) => platformService.listPlatformWorkspaces(params),
  getPlatformWorkspace: (id, params) => platformService.getPlatformWorkspace(id, params),
  updatePlatformWorkspaceStatus: (id, payload) => platformService.updatePlatformWorkspaceStatus(id, payload),
  updatePlatformWorkspacePlan: (id, payload) => platformService.updatePlatformWorkspacePlan(id, payload),
  deletePlatformWorkspace: (id, payload) => platformService.deletePlatformWorkspace(id, payload),
  updatePlatformUserStatus: (id, payload) => platformService.updatePlatformUserStatus(id, payload)
};
