/**
 * Cria no AbacatePay os produtos do catálogo de marcas do MarcaSync (serviço, taxas do INPI e
 * monitoramento). Não é usado pelo site: o pedido cobra por valor, via /transparents/create.
 * Os produtos servem para links de pagamento e para a assinatura do monitoramento.
 *
 * Uso:   node --env-file=.env.local scripts/criar-produtos-abacatepay.mjs
 * A chave (ABACATEPAY_API_KEY) decide o ambiente: "abc_dev_..." cria no modo de teste; a de produção
 * cria de verdade. Rodar de novo é seguro: um produto cujo externalId já existe é só avisado (a API devolve 400 "already exists").
 * Precisa da permissão PRODUCT:CREATE na chave.
 */
const chave = process.env.ABACATEPAY_API_KEY;
if (!chave) {
  console.error("Defina ABACATEPAY_API_KEY (por exemplo com --env-file=.env.local).");
  process.exit(1);
}

import { PRODUTOS } from "./produtos-abacatepay.mjs";

let falhas = 0;
for (const p of PRODUTOS) {
  const res = await fetch("https://api.abacatepay.com/v2/products/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...p, currency: "BRL" }),
  });
  const corpo = await res.json().catch(() => ({}));
  if (res.ok && corpo.success !== false) {
    console.log(
      `criado   ${p.externalId}  R$ ${(p.price / 100).toFixed(2)}${corpo.data?.devMode ? "  (teste)" : ""}`
    );
  } else if (typeof corpo.error === "string" && corpo.error.includes("already exists")) {
    console.log(`já existe ${p.externalId}`);
  } else {
    falhas++;
    console.log(
      `falhou   ${p.externalId}  [${res.status}] ${typeof corpo.error === "string" ? corpo.error : ""}`
    );
  }
}
process.exit(falhas ? 1 : 0);
