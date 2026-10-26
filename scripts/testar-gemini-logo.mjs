/**
 * Testa a chave do Gemini e o formato da resposta da criação de imagem, SEM passar pelo site.
 * Gera UMA logo de exemplo (custa centavos), salva em scripts/logo-teste.png e mostra a forma da
 * resposta (nomes dos campos, nunca a chave nem a imagem em texto).
 *
 *   GEMINI_API_KEY=... node scripts/testar-gemini-logo.mjs [modelo]
 *
 * A chave vem só da variável de ambiente (use scripts/testar-gemini-logo.ps1, que pede a chave sem
 * mostrá-la e não a grava em arquivo).
 */
import { writeFileSync } from "node:fs";

const chave = process.env.GEMINI_API_KEY;
if (!chave) {
  console.error("Falta a variável GEMINI_API_KEY.");
  process.exit(2);
}
const modelo = process.argv[2] || process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1";
const pedido =
  'Design a professional trademark logo. Brand name: "Kaza Doce". What the business does: "artisan bakery, cakes made to order". ' +
  "Style: minimalist flat geometric symbol, two or three solid colors. Symbol only: absolutely no letters, words or numbers anywhere in the image. " +
  "Show a single centered logo on a plain pure white background, square image, flat vector look. No mockups, no photos, no watermark.";

function forma(valor, profundidade = 0) {
  if (typeof valor === "string") return valor.length > 200 ? `<texto de ${valor.length} caracteres>` : valor;
  if (valor === null || typeof valor !== "object") return valor;
  if (profundidade > 6) return "…";
  if (Array.isArray(valor)) return valor.slice(0, 3).map((v) => forma(v, profundidade + 1));
  return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, forma(v, profundidade + 1)]));
}

function achar(valor, p = 0) {
  if (valor === null || typeof valor !== "object" || p > 8) return null;
  if (!Array.isArray(valor) && valor.type === "image" && typeof valor.data === "string") return valor;
  for (const filho of Array.isArray(valor) ? valor : Object.values(valor)) {
    const r = achar(filho, p + 1);
    if (r) return r;
  }
  for (const k of ["inlineData", "inline_data"]) {
    if (valor[k]?.data) return { data: valor[k].data, mime_type: valor[k].mimeType ?? valor[k].mime_type };
  }
  return null;
}

console.log(`Modelo: ${modelo}`);
const inicio = Date.now();
const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
  method: "POST",
  headers: { "x-goog-api-key": chave, "content-type": "application/json" },
  body: JSON.stringify({ model: modelo, input: [{ type: "text", text: pedido }] }),
  redirect: "error",
  signal: AbortSignal.timeout(90_000),
});
const corpo = await r.json().catch(() => null);
console.log(`HTTP ${r.status} em ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
console.log("Forma da resposta:");
console.log(JSON.stringify(forma(corpo), null, 2));

const imagem = achar(corpo);
if (!imagem) {
  console.error("\nNÃO achei imagem na resposta. Mande a 'forma da resposta' acima (sem a chave) para ajustar.");
  process.exit(1);
}
const arquivo = new URL("./logo-teste.png", import.meta.url);
writeFileSync(arquivo, Buffer.from(imagem.data, "base64"));
console.log(`\nOK: imagem (${imagem.mime_type ?? "?"}) salva em scripts/logo-teste.png`);
