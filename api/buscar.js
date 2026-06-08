const https = require("https");

function httpGet(url, options = {}) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 15000, ...options }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

function httpPost(hostname, path, body, headers = {}) {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname, path, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr), ...headers },
      timeout: 15000,
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.write(bodyStr);
    req.end();
  });
}

function limparTelefone(tel) {
  if (!tel) return "";
  const d = tel.replace(/\D/g, "");
  if (d.length < 10) return "";
  return d.startsWith("55") ? d : `55${d}`;
}

function formatarNome(nome) {
  if (!nome) return "Empresa";
  const excluir = ["LTDA","ME","EPP","SA","EIRELI","SS","SLU"];
  return nome.split(" ")
    .filter(p => !excluir.includes(p.toUpperCase()))
    .slice(0, 4)
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

const SEGMENTOS_LABEL = {
  saude: "Saúde e Clínicas", comercio: "Comércio", servicos: "Serviços Gerais",
  contabil: "Contabilidade / Jurídico", tech: "Tecnologia", educacao: "Educação",
  construcao: "Construção", alimentacao: "Alimentação"
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { municipios = [], segmentos = [], limite = 100 } = req.body;
  if (!municipios.length || !segmentos.length) {
    return res.status(400).json({ erro: "Selecione municípios e segmentos" });
  }

  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (!APIFY_TOKEN) {
    return res.status(500).json({ erro: "APIFY_TOKEN não configurado nas variáveis de ambiente da Vercel" });
  }

  const leads = [];
  const maxPorBusca = Math.ceil(limite / (municipios.length * segmentos.length));

  for (const munId of municipios) {
    const munNome = MUNICIPIOS[munId] || munId;
    for (const segId of segmentos) {
      if (leads.length >= limite) break;
      const segLabel = SEGMENTOS_LABEL[segId] || segId;
      const query = `${segLabel} em ${munNome} RJ`;

      // 1. Inicia o Actor do Google Maps
      const runResp = await httpPost(
        "api.apify.com",
        `/v2/acts/apify~google-maps-scraper/runs?token=${APIFY_TOKEN}`,
        {
          searchStringsArray: [query],
          maxCrawledPlacesPerSearch: maxPorBusca,
          language: "pt",
          includeHistogram: false,
          includeOpeningHours: false,
        }
      );

      if (!runResp?.data?.id) continue;

      const runId = runResp.data.id;
      const datasetId = runResp.data.defaultDatasetId;

      // 2. Aguarda conclusão (máx 50s)
      let concluido = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const statusResp = await httpGet(
          `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
        );
        if (statusResp?.data?.status === "SUCCEEDED") { concluido = true; break; }
        if (["FAILED","ABORTED"].includes(statusResp?.data?.status)) break;
      }

      if (!concluido) continue;

      // 3. Busca resultados
      const items = await httpGet(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json&limit=${maxPorBusca}`
      );

      if (!Array.isArray(items)) continue;

      for (const item of items) {
        if (leads.length >= limite) break;
        const tel = limparTelefone(item.phone || item.phoneUnformatted || "");
        if (!tel) continue;
        leads.push({
          nome: formatarNome(item.title || item.name || "Empresa"),
          razao_social: item.title || "",
          telefone: tel,
          cnpj: "",
          municipio: munNome,
          segmento: segLabel,
          email: item.email || "",
          porte: "ME",
          avaliacao: item.totalScore || "",
          endereco: item.address || "",
        });
      }
    }
  }

  const header = "nome,telefone,razao_social,municipio,segmento,email,avaliacao,endereco\n";
  const rows = leads.map(l =>
    `"${l.nome}","${l.telefone}","${l.razao_social}","${l.municipio}","${l.segmento}","${l.email}","${l.avaliacao}","${l.endereco}"`
  ).join("\n");

  res.json({ total: leads.length, leads, csv: header + rows });
};
