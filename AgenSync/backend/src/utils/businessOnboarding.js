const suggestedServicesByType = {
  Manicure: [
    { name: "Mão", priceDefault: 35, durationMinutes: 45 },
    { name: "Pé", priceDefault: 35, durationMinutes: 45 },
    { name: "Mão + Pé", priceDefault: 60, durationMinutes: 75 },
    { name: "Alongamento", priceDefault: 120, durationMinutes: 120 },
    { name: "Manutenção", priceDefault: 80, durationMinutes: 90 }
  ],
  Barbeiro: [
    { name: "Corte", priceDefault: 50, durationMinutes: 45 },
    { name: "Barba", priceDefault: 35, durationMinutes: 30 },
    { name: "Corte + barba", priceDefault: 75, durationMinutes: 60 }
  ],
  Estética: [
    { name: "Limpeza de pele", priceDefault: 120, durationMinutes: 75 },
    { name: "Peeling", priceDefault: 150, durationMinutes: 60 },
    { name: "Hidratação", priceDefault: 110, durationMinutes: 60 }
  ],
  Cabeleireiro: [
    { name: "Corte", priceDefault: 70, durationMinutes: 60 },
    { name: "Escova", priceDefault: 60, durationMinutes: 45 },
    { name: "Hidratação", priceDefault: 120, durationMinutes: 60 },
    { name: "Coloração", priceDefault: 180, durationMinutes: 120 }
  ],
  Outro: [
    { name: "Serviço principal", priceDefault: 0, durationMinutes: 60 },
    { name: "Avaliação", priceDefault: 0, durationMinutes: 30 }
  ]
};

export function getSuggestedServices(businessType) {
  const normalized = String(businessType || "").trim();
  const services = suggestedServicesByType[normalized] || suggestedServicesByType.Outro;
  return services.map((service) => ({ ...service, isActive: true }));
}
