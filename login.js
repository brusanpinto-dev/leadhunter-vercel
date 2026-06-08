const SENHA = process.env.SENHA_PAINEL || "leadhunter2024";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { senha } = req.body;
  if (senha === SENHA) return res.json({ ok: true, token: SENHA });
  res.status(401).json({ erro: "Senha incorreta" });
}
