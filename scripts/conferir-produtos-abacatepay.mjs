/**
 * Confere se os produtos que existem no AbacatePay batem com o catálogo do repositório
 * (scripts/produtos-abacatepay.mjs): mesmo preço, mesmo ciclo, nenhum faltando, nenhum a mais.
 * Só lê; não cria nem altera nada.
 *
 * Uso:   node --env-file=.env.local scripts/conferir-produtos-abacatepay.mjs
 * A chave decide o ambiente (abc_dev_… confere o modo de teste; a de produção confere o real).
 * Sai com código 1 se algo não bater.
 */
import { PRODUTOS } from "./produtos-abacatepay.mjs";

const chave = process.env.ABACATEPAY_API_KEY;
if (!chave) {
  console.error("Defina ABACATEPAY_API_KEY (por exemplo com --env-file=.env.local).");
  process.exit(1);
}

const res = await fetch("https://api.abacatepay.com/v2/products/list", {
  headers: { Authorization: `Bearer ${chave}` },
});
const corpo = await res.json().catch(() => ({}));
if (!res.ok || corpo.success === false || !Array.isArray(corpo.data)) {
  console.error(`Não consegui listar os produtos [${res.status}] ${corpo.error ?? ""}`);
  process.exit(1);
}

const reais = (c) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
const noAbacate = new Map(corpo.data.map((p) => [p.externalId, p]));
let problemas = 0;

for (const esperado of PRODUTOS) {
  const real = noAbacate.get(esperado.externalId);
  if (!real) {
    problemas++;
    console.log(`FALTA    ${esperado.externalId}  (esperado ${reais(esperado.price)})`);
    continue;
  }
  const erros = [];
  if (real.price !== esperado.price)
    erros.push(`preço ${reais(real.price)} no AbacatePay, ${reais(esperado.price)} no catálogo`);
  if ((real.cycle ?? null) !== (esperado.cycle ?? null))
    erros.push(`ciclo ${real.cycle ?? "único"} no AbacatePay, ${esperado.cycle ?? "único"} no catálogo`);
  if (real.status !== "ACTIVE") erros.push(`status ${real.status}`);
  if (erros.length) {
    problemas++;
    console.log(`DIFERE   ${esperado.externalId}: ${erros.join("; ")}`);
  } else {
    console.log(`ok       ${esperado.externalId}  ${reais(real.price)}${real.cycle ? " / mês" : ""}`);
  }
}
const nossos = new Set(PRODUTOS.map((p) => p.externalId));
for (const [id, p] of noAbacate) {
  if (!nossos.has(id)) console.log(`A MAIS   ${id}  ${reais(p.price)} (existe no AbacatePay, não no catálogo)`);
}
console.log(problemas ? `\n${problemas} problema(s).` : "\nTudo bate.");
process.exit(problemas ? 1 : 0);
