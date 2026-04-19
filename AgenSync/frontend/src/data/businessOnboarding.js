export const businessTypes = [
  {
    id: "manicure",
    label: "Manicure",
    icon: "manicure",
    description: "Unhas, alongamento e manutencao."
  },
  {
    id: "barbeiro",
    label: "Barbeiro",
    icon: "barber",
    description: "Corte, barba e combos rapidos."
  },
  {
    id: "estetica",
    label: "Estética",
    icon: "aesthetics",
    description: "Cuidados faciais e corporais."
  },
  {
    id: "cabeleireiro",
    label: "Cabeleireiro",
    icon: "hairdresser",
    description: "Corte, escova e tratamentos."
  },
  {
    id: "outro",
    label: "Outro",
    icon: "settings",
    description: "Comece com uma base flexivel."
  }
];

const suggestedServicesByType = {
  manicure: [
    { name: "Mão", priceDefault: 35, durationMinutes: 45 },
    { name: "Pé", priceDefault: 35, durationMinutes: 45 },
    { name: "Mão + Pé", priceDefault: 60, durationMinutes: 75 },
    { name: "Alongamento", priceDefault: 120, durationMinutes: 120 },
    { name: "Manutenção", priceDefault: 80, durationMinutes: 90 }
  ],
  barbeiro: [
    { name: "Corte", priceDefault: 50, durationMinutes: 45 },
    { name: "Barba", priceDefault: 35, durationMinutes: 30 },
    { name: "Corte + barba", priceDefault: 75, durationMinutes: 60 }
  ],
  estetica: [
    { name: "Limpeza de pele", priceDefault: 120, durationMinutes: 75 },
    { name: "Peeling", priceDefault: 150, durationMinutes: 60 },
    { name: "Hidratação", priceDefault: 110, durationMinutes: 60 }
  ],
  cabeleireiro: [
    { name: "Corte", priceDefault: 70, durationMinutes: 60 },
    { name: "Escova", priceDefault: 60, durationMinutes: 45 },
    { name: "Hidratação", priceDefault: 120, durationMinutes: 60 },
    { name: "Coloração", priceDefault: 180, durationMinutes: 120 }
  ],
  outro: [
    { name: "Serviço principal", priceDefault: 0, durationMinutes: 60 },
    { name: "Avaliação", priceDefault: 0, durationMinutes: 30 }
  ]
};

export function findBusinessType(value) {
  return businessTypes.find((type) => type.id === value || type.label === value) || businessTypes[0];
}

export function getSuggestedServices(value) {
  const businessType = findBusinessType(value);
  const services = suggestedServicesByType[businessType.id] || suggestedServicesByType.outro;

  return services.map((service, index) => ({
    id: `${businessType.id}_${index}_${service.name.toLowerCase().replace(/\s+/g, "_")}`,
    name: service.name,
    priceDefault: service.priceDefault,
    durationMinutes: service.durationMinutes,
    isActive: true
  }));
}

export function createBlankService() {
  return {
    id: `custom_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: "",
    priceDefault: 0,
    durationMinutes: 60,
    isActive: true
  };
}
