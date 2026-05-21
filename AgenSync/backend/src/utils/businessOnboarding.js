export const businessTypes = [
  { id: "beleza_estetica", label: "Beleza e estética" },
  { id: "barbearia", label: "Barbearia" },
  { id: "manicure", label: "Manicure" },
  { id: "cabeleireiro", label: "Cabeleireiro" },
  { id: "clinica_estetica", label: "Clínica/Estética" },
  { id: "academia", label: "Academia" },
  { id: "outro", label: "Outro" },
  { id: "personalizada", label: "Personalizada" }
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

export function findBusinessType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    businessTypes.find((type) => type.id === normalized || type.label.toLowerCase() === normalized) ||
    businessTypes.find((type) => type.id === "outro")
  );
}

export function getSuggestedServices(businessType) {
  const type = findBusinessType(businessType);
  const services = suggestedServicesByType[type.id] || suggestedServicesByType.outro;
  return services.map((service) => ({ ...service, isActive: true }));
}
