export const businessTypes = [
  {
    id: "beleza_estetica",
    label: "Beleza e estética",
    icon: "aesthetics",
    description: "Atendimentos de beleza, cuidados e estética."
  },
  {
    id: "barbearia",
    label: "Barbearia",
    icon: "barber",
    description: "Corte, barba e combos rápidos."
  },
  {
    id: "manicure",
    label: "Manicure",
    icon: "manicure",
    description: "Unhas, alongamento e manutenção."
  },
  {
    id: "cabeleireiro",
    label: "Cabeleireiro",
    icon: "hairdresser",
    description: "Corte, escova e tratamentos."
  },
  {
    id: "clinica_estetica",
    label: "Clínica/Estética",
    icon: "aesthetics",
    description: "Procedimentos faciais e corporais."
  },
  {
    id: "academia",
    label: "Academia",
    icon: "professionals",
    description: "Planos, avaliação e treinos."
  },
  {
    id: "outro",
    label: "Outro",
    icon: "settings",
    description: "Comece com uma base flexível."
  },
  {
    id: "personalizada",
    label: "Personalizada",
    icon: "building",
    description: "Descreva seu tipo de serviço."
  }
];

const suggestedServicesByType = {
  beleza_estetica: [
    { name: "Limpeza de pele", priceDefault: 120, durationMinutes: 75 },
    { name: "Design de sobrancelhas", priceDefault: 45, durationMinutes: 40 },
    { name: "Massagem relaxante", priceDefault: 120, durationMinutes: 60 },
    { name: "Avaliação", priceDefault: 0, durationMinutes: 30 }
  ],
  barbearia: [
    { name: "Corte", priceDefault: 50, durationMinutes: 45 },
    { name: "Barba", priceDefault: 35, durationMinutes: 30 },
    { name: "Corte + barba", priceDefault: 75, durationMinutes: 60 },
    { name: "Sobrancelha", priceDefault: 25, durationMinutes: 20 }
  ],
  manicure: [
    { name: "Mão", priceDefault: 35, durationMinutes: 45 },
    { name: "Pé", priceDefault: 35, durationMinutes: 45 },
    { name: "Mão + Pé", priceDefault: 60, durationMinutes: 75 },
    { name: "Alongamento", priceDefault: 120, durationMinutes: 120 },
    { name: "Manutenção", priceDefault: 80, durationMinutes: 90 }
  ],
  cabeleireiro: [
    { name: "Corte", priceDefault: 70, durationMinutes: 60 },
    { name: "Escova", priceDefault: 60, durationMinutes: 45 },
    { name: "Hidratação", priceDefault: 120, durationMinutes: 60 },
    { name: "Coloração", priceDefault: 180, durationMinutes: 120 }
  ],
  clinica_estetica: [
    { name: "Limpeza de pele", priceDefault: 120, durationMinutes: 75 },
    { name: "Peeling", priceDefault: 150, durationMinutes: 60 },
    { name: "Drenagem", priceDefault: 130, durationMinutes: 60 },
    { name: "Massagem", priceDefault: 120, durationMinutes: 60 },
    { name: "Avaliação", priceDefault: 0, durationMinutes: 30 }
  ],
  academia: [
    { name: "Plano mensal", priceDefault: 120, durationMinutes: 30 },
    { name: "Plano trimestral", priceDefault: 330, durationMinutes: 30 },
    { name: "Avaliação física", priceDefault: 80, durationMinutes: 45 },
    { name: "Personal avulso", priceDefault: 100, durationMinutes: 60 }
  ],
  outro: [
    { name: "Serviço principal", priceDefault: 0, durationMinutes: 60 },
    { name: "Avaliação", priceDefault: 0, durationMinutes: 30 }
  ],
  personalizada: [
    { name: "Serviço principal", priceDefault: 0, durationMinutes: 60 }
  ]
};

const suggestedProductsByType = {
  beleza_estetica: ["Óleo finalizador", "Máscara facial", "Protetor solar"],
  barbearia: ["Pomada modeladora", "Óleo para barba", "Loção pós-barba"],
  manicure: ["Esmalte", "Fortalecedor de unhas", "Óleo de cutícula"],
  cabeleireiro: ["Shampoo", "Condicionador", "Máscara de hidratação"],
  clinica_estetica: ["Sérum facial", "Protetor solar", "Creme pós-procedimento"],
  academia: ["Whey protein", "Garrafa térmica", "Faixa elástica"],
  outro: ["Produto principal"],
  personalizada: ["Produto principal"]
};

export function getSuggestedProductNames(value) {
  const businessType = findBusinessType(value);
  return suggestedProductsByType[businessType.id] || suggestedProductsByType.outro;
}

export function findBusinessType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    businessTypes.find((type) => type.id === normalized || type.label.toLowerCase() === normalized) ||
    businessTypes.find((type) => type.id === "outro")
  );
}

export function getSuggestedServices(value) {
  const businessType = findBusinessType(value);
  const services = suggestedServicesByType[businessType.id] || suggestedServicesByType.outro;

  return services.map((service, index) => ({
    id: `${businessType.id}_${index}_${service.name.toLowerCase().replace(/\s+/g, "_")}`,
    name: service.name,
    priceDefault: service.priceDefault,
    durationMinutes: service.durationMinutes,
    isActive: true,
    selected: true
  }));
}

export function createBlankService() {
  return {
    id: `custom_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: "",
    priceDefault: 0,
    durationMinutes: 60,
    isActive: true,
    selected: true
  };
}
