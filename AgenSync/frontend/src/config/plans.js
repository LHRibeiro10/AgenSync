export const PLAN_SLUGS = Object.freeze({
  PADRAO: "padrao",
  EQUIPE: "equipe",
  PRO: "pro"
});

export const PLAN_FEATURES = Object.freeze({
  AGENDA: "agenda",
  CLIENTS: "clientes",
  SERVICES: "servicos",
  BASIC_FINANCE: "financeiro_basico",
  CLIENT_RECORDS: "fichas",
  DOCUMENTS: "documentos",
  MULTIPLE_PROFESSIONALS: "multiplos_profissionais",
  PROFESSIONAL_FILTERS: "filtros_por_profissional",
  TEAM_DASHBOARD: "dashboard_equipe",
  TEAM_COMPARISON: "comparativo_equipe",
  GOALS: "metas",
  SPECIAL_PERMISSIONS: "permissoes_especiais",
  ADVANCED_COMPARISONS: "comparativos_avancados",
  ADVANCED_REPORTS: "relatorios_avancados",
  MULTIPLE_ADMINS: "multiplos_admins",
  AUDIT: "auditoria",
  PREMIUM_RESOURCES: "recursos_premium"
});

const baseFeatures = [
  PLAN_FEATURES.AGENDA,
  PLAN_FEATURES.CLIENTS,
  PLAN_FEATURES.SERVICES,
  PLAN_FEATURES.BASIC_FINANCE,
  PLAN_FEATURES.CLIENT_RECORDS,
  PLAN_FEATURES.DOCUMENTS
];

const teamFeatures = [
  ...baseFeatures,
  PLAN_FEATURES.MULTIPLE_PROFESSIONALS,
  PLAN_FEATURES.PROFESSIONAL_FILTERS,
  PLAN_FEATURES.TEAM_DASHBOARD,
  PLAN_FEATURES.TEAM_COMPARISON,
  PLAN_FEATURES.GOALS
];

export const PLANS_CONFIG = Object.freeze({
  [PLAN_SLUGS.PADRAO]: Object.freeze({
    slug: PLAN_SLUGS.PADRAO,
    name: "Padrao",
    displayName: "Padrao",
    price: 29.9,
    maxUsers: 1,
    maxProfessionals: 1,
    maxAdmins: 0,
    features: baseFeatures,
    description: "Conta individual com agenda, clientes, servicos, financeiro basico, fichas e documentos."
  }),
  [PLAN_SLUGS.EQUIPE]: Object.freeze({
    slug: PLAN_SLUGS.EQUIPE,
    name: "Equipe",
    displayName: "Equipe",
    price: 44.9,
    maxUsers: 3,
    maxProfessionals: 3,
    maxAdmins: 0,
    features: teamFeatures,
    description: "Ate 3 profissionais com filtros, dashboard da equipe, comparativo simples e metas."
  }),
  [PLAN_SLUGS.PRO]: Object.freeze({
    slug: PLAN_SLUGS.PRO,
    name: "Pro",
    displayName: "Pro",
    price: 77.9,
    maxUsers: 13,
    maxProfessionals: 10,
    maxAdmins: 3,
    features: [
      ...teamFeatures,
      PLAN_FEATURES.SPECIAL_PERMISSIONS,
      PLAN_FEATURES.ADVANCED_COMPARISONS,
      PLAN_FEATURES.ADVANCED_REPORTS,
      PLAN_FEATURES.MULTIPLE_ADMINS,
      PLAN_FEATURES.AUDIT,
      PLAN_FEATURES.PREMIUM_RESOURCES
    ],
    description: "Estrutura ampliada para equipes maiores, multiplos admins e recursos premium."
  })
});

const aliases = new Map([
  ["padrao", PLAN_SLUGS.PADRAO],
  ["standard", PLAN_SLUGS.PADRAO],
  ["default", PLAN_SLUGS.PADRAO],
  ["basic", PLAN_SLUGS.PADRAO],
  ["basico", PLAN_SLUGS.PADRAO],
  ["equipe", PLAN_SLUGS.EQUIPE],
  ["team", PLAN_SLUGS.EQUIPE],
  ["teams", PLAN_SLUGS.EQUIPE],
  ["pro", PLAN_SLUGS.PRO],
  ["professional", PLAN_SLUGS.PRO],
  ["premium", PLAN_SLUGS.PRO]
]);

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizePlanSlug(value) {
  const raw = String(value || "").trim().toLowerCase();
  const key = normalizeKey(value);
  return aliases.get(raw) || aliases.get(key) || PLAN_SLUGS.PADRAO;
}

export function getPlanConfig(plan) {
  return PLANS_CONFIG[normalizePlanSlug(plan)] || PLANS_CONFIG[PLAN_SLUGS.PADRAO];
}

export function getCurrentPlan(user) {
  return getPlanConfig(user?.currentWorkspace?.plan || user?.plan || user?.platformPlan);
}

export function canUsePlanFeature(user, featureKey) {
  return getCurrentPlan(user).features.includes(featureKey);
}
