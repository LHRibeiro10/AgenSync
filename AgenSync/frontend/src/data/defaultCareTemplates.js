const beautyTemplate = {
  name: "Ficha de beleza",
  description: "Modelo sugerido para salões, barbearias e manicures.",
  fields: [
    { label: "Tipo de cabelo", type: "singleSelect", required: false, options: ["Liso", "Ondulado", "Cacheado", "Crespo"] },
    { label: "Colorações anteriores", type: "longText", required: false, options: [] },
    { label: "Alergias a produtos químicos", type: "longText", required: false, options: [] }
  ]
};

const clinicTemplate = {
  name: "Ficha clínica",
  description: "Modelo sugerido para clínicas de estética.",
  fields: [
    { label: "Histórico médico relevante", type: "longText", required: false, options: [] },
    { label: "Medicamentos em uso", type: "longText", required: false, options: [] },
    { label: "Contraindicações", type: "longText", required: false, options: [] }
  ]
};

const templatesByBusinessType = {
  beleza_estetica: beautyTemplate,
  barbearia: beautyTemplate,
  manicure: beautyTemplate,
  cabeleireiro: beautyTemplate,
  clinica_estetica: clinicTemplate
};

export function getDefaultCareTemplate(businessType) {
  return templatesByBusinessType[businessType] || null;
}
