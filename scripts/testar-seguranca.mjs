/**
 * Testes de segurança que atacam o servidor de verdade (como um visitante mal-intencionado faria).
 * Cria registros de teste, por isso SÓ roda contra localhost, a não ser que você passe
 * --permitir-remoto (não faça isso em produção).
 *
 * Uso:   node scripts/testar-seguranca.mjs [http://localhost:3002]
 * A senha do /admin vem de ADMIN_PASSWORD (.env). Sai com código 1 se algum teste falhar.
 */
import { readFileSync } from "node:fs";

const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3002";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE) && !process.argv.includes("--permitir-remoto")) {
  console.error(`Recusado: ${BASE} não é local. Estes testes criam e alteram dados.`);
  process.exit(2);
}

function lerEnv() {
  const env = {};
  for (const f of [".env", ".env.local"]) {
    let t = "";
    try {
      t = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const l of t.split(/\r?\n/)) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(l);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}
const env = lerEnv();
const basic = "Basic " + Buffer.from("admin:" + (env.ADMIN_PASSWORD ?? "")).toString("base64");

const linhas = [];
let falhas = 0;
function reg(ok, nome, detalhe = "") {
  if (!ok) falhas++;
  linhas.push(`${ok ? "ok    " : "FALHOU"} ${nome}${detalhe ? "  -> " + detalhe : ""}`);
}
async function req(path, { method = "GET", body, raw, auth = false, headers = {} } = {}) {
  const h = { ...headers };
  if (auth) h.Authorization = basic;
  let corpo = raw;
  if (body !== undefined) {
    h["Content-Type"] = "application/json";
    corpo = JSON.stringify(body);
  }
  const r = await fetch(BASE + path, { method, headers: h, body: corpo });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: r.status, text, json, headers: r.headers };
}

const unico = String(Date.now()).slice(-6);
const zap = (n) => `(85) 9${String(unico).slice(0, 4)}-${String(1000 + n)}`;
const ZAP_VITIMA = zap(1);

async function criarProcesso(nome, whatsapp, marca = "Marca Segura") {
  return req("/api/processos", {
    method: "POST",
    body: { nomeCliente: nome, whatsapp, marca, descricao: "bolos", nclCode: "30", nclLabel: "Padaria", riscoPct: 5, riscoFonte: "real" },
  });
}

const pedidoValido = (n) => ({
  tipoRequerente: "pf", regime: "pessoa_natural", participaEmpresaDoRamo: false,
  nome: "Ana Maria Ramos", documento: "52998224725", email: "ana@exemplo.com.br",
  cep: "60000000", logradouro: "Rua das Flores", numero: "100", complemento: "", bairro: "Centro",
  cidade: "Fortaleza", uf: "CE", apresentacao: "nominativa", elementoNominativo: "Marca Segura " + n,
  classeNice: "30", especificacaoItens: ["Bolos"], palavraEstrangeira: false,
  atividade: "Confeitaria artesanal exercida de forma lícita e efetiva",
  declaracaoAtividade: true, declaracaoVeracidade: true, aceiteProcuracao: true, aceiteLgpd: true,
  aceiteTermos: true, cienciaDocumentosInpi: true, monitoramento: false,
});

// ------------------------------------------------------------------ 1. adulterar o preço
{
  const p = await criarProcesso("Atacante", zap(2));
  const id = p.json?.processo?.id;
  const forjar = await req(`/api/processos/${id}/pagamentos`, {
    method: "POST",
    body: { tipo: "setup", valorCentavos: 100 },
  });
  reg(![200, 201].includes(forjar.status), "ninguém cria cobrança com valor escolhido (POST /pagamentos)", `status ${forjar.status}`);
  await req(`/api/processos/${id}/pedido`, { method: "POST", body: pedidoValido(1) });
  const cob = await req(`/api/processos/${id}/cobrancas`);
  const setup = (cob.json?.cobrancas ?? []).find((c) => c.tipo === "setup");
  reg(setup?.valorCentavos === 49900, "o serviço sempre sai pelo preço do servidor (R$ 499)", `valor cobrado: ${setup?.valorCentavos}`);
}

// ------------------------------------------------------------------ 2. vazamento de dados de outro cliente
{
  const vit = await criarProcesso("Vitima Real", ZAP_VITIMA);
  const outro = await criarProcesso("Nome do Atacante", ZAP_VITIMA);
  const corpo = JSON.stringify(outro.json ?? {});
  reg(!corpo.includes("Vitima Real") && !corpo.includes(ZAP_VITIMA), "criar processo não devolve nome nem WhatsApp do cliente", corpo.slice(0, 120));
  const lista = await req("/api/processos", { auth: true });
  const cliente = (lista.json?.processos ?? []).find((x) => x.id === vit.json?.processo?.id)?.cliente;
  reg(cliente?.nome === "Vitima Real", "quem digita o WhatsApp de outro cliente não troca o nome dele", `nome no banco: ${cliente?.nome}`);
}

// ------------------------------------------------------------------ 3. PATCH público
{
  const p = await criarProcesso("Cliente Patch", zap(3));
  const id = p.json?.processo?.id;
  const patch = await req(`/api/processos/${id}`, { method: "PATCH", body: { status: "plano", protocolo: "FORJADO-123" } });
  const t = JSON.stringify(patch.json ?? {});
  reg(!t.includes("Cliente Patch") && !t.includes("whatsapp"), "PATCH não devolve dados do cliente", t.slice(0, 100));
  const lista = await req("/api/processos", { auth: true });
  const proc = (lista.json?.processos ?? []).find((x) => x.id === id);
  reg(proc?.protocolo !== "FORJADO-123", "o visitante não consegue gravar um número de protocolo", `protocolo: ${proc?.protocolo}`);
  const ruim = await req(`/api/processos/${id}`, { method: "PATCH", raw: "{nao é json" });
  reg(ruim.status === 400, "PATCH com JSON quebrado dá 400 (não 500)", String(ruim.status));
  const statusFalso = await req(`/api/processos/${id}`, { method: "PATCH", body: { status: "protocolado" } });
  reg(statusFalso.status === 400, "o visitante não consegue marcar o processo como protocolado", String(statusFalso.status));
}

// ------------------------------------------------------------------ 4. entradas malformadas / enormes
{
  const ruim = await req("/api/processos", { method: "POST", raw: "isto não é json", headers: { "Content-Type": "application/json" } });
  reg(ruim.status === 400, "POST /api/processos com JSON quebrado dá 400", String(ruim.status));
  const grande = await req("/api/processos", {
    method: "POST",
    body: { nomeCliente: "x".repeat(5000), whatsapp: zap(4), marca: "m".repeat(5000), descricao: "d".repeat(200000) },
  });
  reg(grande.status === 400 || grande.status === 413, "textos gigantes são recusados", String(grande.status));
  const hack = await criarProcesso("'; DROP TABLE \"Cliente\"; --", zap(5), "<script>alert(1)</script>");
  reg(hack.status === 201, "texto com aspas e HTML é gravado como texto, sem quebrar nada", String(hack.status));
  const depois = await req("/api/processos", { auth: true });
  reg(depois.status === 200, "a tabela continua de pé depois do texto malicioso", String(depois.status));
  const colGrande = await req(`/api/colidencia?marca=${"a".repeat(3000)}&descricao=x`);
  reg(colGrande.status === 400 || colGrande.status === 414, "marca gigante na busca é recusada", String(colGrande.status));
  const idMau = await req("/api/processos/nao-existe/cobrancas");
  reg(idMau.status === 404, "processo inexistente dá 404", String(idMau.status));
  const injecao = await req("/api/processos/" + encodeURIComponent("' OR '1'='1") + "/cobrancas");
  reg(injecao.status === 404, "id com tentativa de injeção SQL dá 404", String(injecao.status));
}

// ------------------------------------------------------------------ 5. upload
{
  const p = await criarProcesso("Cliente Upload", zap(6));
  const id = p.json?.processo?.id;
  const form = new FormData();
  form.append("imagem", new Blob(["<?php echo 'oi'; ?>"], { type: "image/png" }), "x.png");
  const falso = await fetch(`${BASE}/api/processos/${id}/imagem`, { method: "POST", body: form });
  reg(falso.status === 400, "arquivo que não é imagem (com extensão .png) é recusado", String(falso.status));
  const pdf = new FormData();
  pdf.append("recibo", new Blob(["<html>oi</html>"], { type: "application/pdf" }), "r.pdf");
  const recibo = await fetch(`${BASE}/api/admin/processos/${id}/recibo`, { method: "POST", body: pdf, headers: { Authorization: basic } });
  reg(recibo.status === 400 || recibo.status === 409, "recibo que não é PDF de verdade é recusado", String(recibo.status));
}

// ------------------------------------------------------------------ 6. autenticação
{
  const errada = await req("/admin", { headers: { Authorization: "Basic " + Buffer.from("x:senha-errada-" + unico).toString("base64") } });
  reg(errada.status === 401 || errada.status === 429, "senha errada não entra", String(errada.status));
  const vazia = await req("/api/processos", { headers: { Authorization: "Basic " } });
  reg(vazia.status === 401 || vazia.status === 429, "credencial vazia não entra", String(vazia.status));
  const lixo = await req("/api/processos", { headers: { Authorization: "Basic ???nao-e-base64???" } });
  reg(lixo.status === 401 || lixo.status === 429, "credencial em formato inválido não entra", String(lixo.status));
  const bearer = await req("/api/processos", { headers: { Authorization: "Bearer " + (env.ADMIN_PASSWORD ?? "x") } });
  reg(bearer.status === 401 || bearer.status === 429, "a senha em outro esquema (Bearer) não vale", String(bearer.status));
  // contornos de rota: maiúsculas, barra dupla, ponto-e-vírgula
  for (const p of ["/ADMIN", "/admin/", "//admin", "/admin%2f", "/api/admin//alertas", "/api/ADMIN/alertas", "/api/processos/x/imagem/"]) {
    const r = await req(p);
    reg([401, 404, 308, 307, 400].includes(r.status) && r.status !== 200, `sem senha, ${p} não abre`, String(r.status));
  }
  const cron = await req("/api/cron/rpi", { headers: { Authorization: "Bearer errado" } });
  reg(cron.status === 401 || cron.status === 500, "cron com segredo errado é recusado", String(cron.status));
  const wh = await req("/api/webhooks/abacatepay?webhookSecret=errado", { method: "POST", body: { data: { id: "x" } } });
  reg(wh.status === 401, "webhook com segredo errado é recusado", String(wh.status));
  const wh2 = await req("/api/webhooks/abacatepay", { method: "POST", body: { data: { id: "x" } } });
  reg(wh2.status === 401, "webhook sem segredo é recusado", String(wh2.status));
}

// ------------------------------------------------------------------ 7. cabeçalhos de segurança
{
  const r = await req("/");
  const h = r.headers;
  reg(h.get("x-content-type-options") === "nosniff", "cabeçalho X-Content-Type-Options: nosniff", String(h.get("x-content-type-options")));
  reg(["DENY", "SAMEORIGIN"].includes(h.get("x-frame-options") ?? ""), "cabeçalho X-Frame-Options (anti clickjacking)", String(h.get("x-frame-options")));
  reg(!!h.get("referrer-policy"), "cabeçalho Referrer-Policy", String(h.get("referrer-policy")));
  reg(!!h.get("permissions-policy"), "cabeçalho Permissions-Policy", String(h.get("permissions-policy")));
  reg(!h.get("x-powered-by"), "não anuncia a tecnologia (X-Powered-By)", String(h.get("x-powered-by")));
  const api = await req("/api/health");
  reg(!/stack|at .*\.ts|prisma|postgres/i.test(api.text), "a resposta de /api/health não vaza detalhe interno", api.text.slice(0, 80));
}

// ------------------------------------------------------------------ 8. limite de abusos
{
  const codigos = [];
  for (let i = 0; i < 40; i++) {
    const r = await req("/api/processos", { method: "POST", body: { nomeCliente: "Spam", whatsapp: zap(100 + i), marca: "Spam " + i } });
    codigos.push(r.status);
  }
  reg(codigos.includes(429), "rajada de cadastros é freada com 429", `códigos: ${[...new Set(codigos)].join(",")}`);
}

console.log(linhas.join("\n"));
console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo OK.");
process.exit(falhas ? 1 : 0);
