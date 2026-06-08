module.exports = function handler(req, res) {
  res.json({
    municipios: {
      "3301157": "Cabo Frio",
      "3300936": "Búzios",
      "3303302": "Niterói",
      "3304557": "Rio de Janeiro",
      "3303500": "Nova Iguaçu",
      "3304904": "São Gonçalo",
      "3303906": "Petrópolis",
      "3303203": "Macaé",
      "3304144": "Rio das Ostras",
      "3301702": "Campos dos Goytacazes",
      "3305109": "Teresópolis",
      "3305802": "Volta Redonda",
      "3300100": "Angra dos Reis",
      "3302270": "Itaboraí",
      "3300456": "Araruama"
    },
    segmentos: [
      { id: "saude",       label: "Saúde e Clínicas" },
      { id: "comercio",    label: "Comércio" },
      { id: "servicos",    label: "Serviços Gerais" },
      { id: "contabil",    label: "Contabilidade / Jurídico" },
      { id: "tech",        label: "Tecnologia" },
      { id: "educacao",    label: "Educação" },
      { id: "construcao",  label: "Construção" },
      { id: "alimentacao", label: "Alimentação" }
    ]
  });
};
