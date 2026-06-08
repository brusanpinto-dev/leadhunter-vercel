const SENHA = process.env.SENHA_PAINEL || "leadhunter2024";

const CNAES_POR_SEGMENTO = {
  saude:       ["86303","86305","86501"],
  comercio:    ["47113","47121","47216"],
  servicos:    ["96025","96092","81214"],
  contabil:    ["69206","69117","69125"],
  tech:        ["62015","62023","63119"],
  educacao:    ["85112","85121","85996"],
  construcao:  ["43215","43304","43991"],
  alimentacao: ["56112","56113","56121"],
};

const MUNICIPIOS = {
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
  "3300456": "Araruama",
};

function limparTelefone(tel) {
  if (!tel) return "";
  const d = tel.replace(/\D/g, "");
  if (d.length < 10) return "";
  return d.startsWith("55") ? d : `55${d}`;
}

function formatarNome(razao) {
  if (!razao) return "Empresa";
  const excluir = ["LTDA","ME","EPP","SA","EIRELI","SS","SLU"];
  return razao.split(" ")
    .filter(p => !excluir.includes(p.toUpperCase()))
    .slice(0, 3)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const token = req.headers["x-token"];
  if (token !== SENHA) return res.status(401).json({ erro: "Não autorizado" });

  const { municipios = [], segmentos = [], limite = 200 } = req.body;

  if (!municipios.length || !segmentos.length) {
    return res.status(400).json({ erro: "Selecione municípios e segmentos" });
  }

  const leads = [];
  const vistos = new Set();

  for (const segId of segmentos) {
    const cnaes = CNAES_POR_SEGMENTO[segId] || [];
    for (const munId of municipios) {
      const munNome = MUNICIPIOS[munId] || munId;
      for (const cnae of cnaes) {
        if (leads.length >= limite) break;
        try {
          // Busca na Brasil API por CNPJ público
          const url = `https://brasilapi.com.br/api/cnpj/v1/search?municipio=${munId}&cnae=${cnae}&porte=ME,EPP`;
          const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (!resp.ok) continue;
          const data = await resp.json();
          const empresas = Array.isArray(data) ? data : (data.data || []);

          for (const emp of empresas) {
            if (leads.length >= limite) break;
            const cnpj = (emp.cnpj || "").replace(/\D/g, "");
            if (vistos.has(cnpj)) continue;
            const tel = limparTelefone(emp.ddd_telefone_1 || emp.telefone || "");
            if (!tel) continue;
            vistos.add(cnpj);
            leads.push({
              nome: formatarNome(emp.razao_social),
              razao_social: emp.razao_social || "",
              telefone: tel,
              cnpj,
              municipio: munNome,
              segmento: segId,
              email: emp.email || "",
              porte: emp.porte || "ME",
            });
          }
        } catch { continue; }
      }
    }
  }

  // Gera CSV em memória
  const header = "nome,telefone,razao_social,cnpj,municipio,segmento,porte,email\n";
  const rows = leads.map(l =>
    `"${l.nome}","${l.telefone}","${l.razao_social}","${l.cnpj}","${l.municipio}","${l.segmento}","${l.porte}","${l.email}"`
  ).join("\n");

  res.json({ total: leads.length, leads, csv: header + rows });
}
