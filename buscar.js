const https = require("https");

function httpGet(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 8000 }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on("error", () => resolve(null));
  });
}

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

const MUNICIPIOS = {
  "3301157": "Cabo Frio", "3300936": "Búzios", "3303302": "Niterói",
  "3304557": "Rio de Janeiro", "3303500": "Nova Iguaçu", "3304904": "São Gonçalo",
  "3303906": "Petrópolis", "3303203": "Macaé", "3304144": "Rio das Ostras",
  "3301702": "Campos dos Goytacazes", "3305109": "Teresópolis", "3305802": "Volta Redonda",
  "3300100": "Angra dos Reis", "3302270": "Itaboraí", "3300456": "Araruama"
};

const CNAES = {
  saude: ["8630503","8630504"], comercio: ["4711301","4712100"],
  servicos: ["9602501","9609204"], contabil: ["6920601","6911701"],
  tech: ["6201501","6202300"], educacao: ["8511200","8512100"],
  construcao: ["4321500","4330404"], alimentacao: ["5611201","5611203"]
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { municipios = [], segmentos = [], limite = 100 } = req.body;
  if (!municipios.length || !segmentos.length) {
    return res.status(400).json({ erro: "Selecione municípios e segmentos" });
  }

  const leads = [];
  const vistos = new Set();

  for (const segId of segmentos) {
    const cnaes = CNAES[segId] || [];
    for (const munId of municipios) {
      const munNome = MUNICIPIOS[munId] || munId;
      for (const cnae of cnaes) {
        if (leads.length >= limite) break;
        const data = await httpGet(`https://brasilapi.com.br/api/cnpj/v1/search?municipio=${munId}&cnae=${cnae}&porte=ME,EPP&situacao=ATIVA`);
        const empresas = Array.isArray(data) ? data : (data?.data || []);
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
            telefone: tel, cnpj, municipio: munNome,
            segmento: segId, email: emp.email || "", porte: emp.porte || "ME"
          });
        }
      }
    }
  }

  const header = "nome,telefone,razao_social,cnpj,municipio,segmento,porte,email\n";
  const rows = leads.map(l =>
    `"${l.nome}","${l.telefone}","${l.razao_social}","${l.cnpj}","${l.municipio}","${l.segmento}","${l.porte}","${l.email}"`
  ).join("\n");

  res.json({ total: leads.length, leads, csv: header + rows });
};
