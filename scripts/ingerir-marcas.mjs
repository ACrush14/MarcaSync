// Ingestão da base oficial de dados abertos do INPI (marcas) para a tabela
// MarcaInpi. Roda no SEU computador (o arquivo tem 1,9 GB + 3,8 GB), não na
// Vercel:
//
//   npm run ingerir:marcas -- --dry          só conta e estima o tamanho, não grava
//   npm run ingerir:marcas                   grava (troca a base local inteira)
//   npm run ingerir:marcas -- --limite=50000 teste rápido com poucas linhas
//
// O que entra: marcas VIVAS (em vigor ou ainda em andamento, sem as já
// indeferidas aguardando recurso) que têm
// elemento nominativo — figurativas puras não têm texto para comparar. Fonte:
// https://dadosabertos.inpi.gov.br/index/marcas/
import "dotenv/config";
import { Readable } from "node:stream";
import { neon } from "@neondatabase/serverless";
import { parse } from "csv-parse";
import { foneticaBR } from "../src/lib/fonetica.ts";

const BASE = "https://dadosabertos.inpi.gov.br/download/marcas";
const BIBLIO = `${BASE}/MARCAS_DADOS_BIBLIOGRAFICOS.csv`;
const NICE = `${BASE}/MARCAS_CLASSIFICACOES_NICE.csv`;

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const LIMITE = Number(args.find((a) => a.startsWith("--limite="))?.split("=")[1] ?? 0) || Infinity;
const MORTAS = /recurso contra o indeferimento|extint|arquivad|indeferid|inexist|nul[oa]\b|cancelad|caduc|anulad|desist|renunci/i;

function leitor(url) {
  return fetch(url).then((res) => {
    if (!res.ok || !res.body) throw new Error(`${url} -> HTTP ${res.status}`);
    const lastModified = res.headers.get("last-modified");
    const parser = Readable.fromWeb(res.body).pipe(
      parse({ columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_records_with_error: true })
    );
    return { parser, lastModified };
  });
}

function progresso(msg) {
  process.stdout.write(`\r${msg}`.padEnd(100));
}

// ---------- Passagem 1: dados bibliográficos ----------
console.log("1/3 Lendo dados bibliográficos…");
const marcas = new Map(); // numero -> [nome, chave, situacao, deposito, classes]
const porSituacao = new Map();
let lidas = 0;
const { parser: p1, lastModified } = await leitor(BIBLIO);
for await (const r of p1) {
  if (++lidas > LIMITE) break;
  if (lidas % 250_000 === 0) progresso(`  ${lidas.toLocaleString("pt-BR")} linhas, ${marcas.size.toLocaleString("pt-BR")} marcas vivas`);
  const numero = (r.numero_inpi ?? "").trim();
  const nome = (r.elemento_nominativo ?? "").replace(/\s+/g, " ").trim();
  const cod = (r.codigo_situacao ?? "").trim();
  const desc = (r.descricao_situacao ?? "").trim();
  if (!numero || !nome || !cod || !desc || MORTAS.test(desc)) continue;
  const chave = foneticaBR(nome);
  if (chave.length < 2) continue;
  if (!marcas.has(numero)) porSituacao.set(`${cod} ${desc}`, (porSituacao.get(`${cod} ${desc}`) ?? 0) + 1);
  marcas.set(numero, [nome, chave, cod, (r.data_deposito ?? "").trim() || null, null]);
}
console.log(`\n  ${lidas.toLocaleString("pt-BR")} linhas lidas → ${marcas.size.toLocaleString("pt-BR")} marcas vivas com nome.`);

// ---------- Passagem 2: classes de Nice ----------
console.log("2/3 Lendo classes de Nice (arquivo grande, alguns minutos)…");
const { parser: p2 } = await leitor(NICE);
let linhasNice = 0;
let comClasse = 0;
for await (const r of p2) {
  if (++linhasNice % 1_000_000 === 0) progresso(`  ${linhasNice.toLocaleString("pt-BR")} linhas`);
  const m = marcas.get((r.numero_inpi ?? "").trim());
  const classe = (r.classe_nice ?? "").trim();
  if (!m || !/^\d{1,2}$/.test(classe)) continue;
  const atual = m[4] ? m[4].split(",") : [];
  if (!atual.includes(classe)) {
    if (atual.length === 0) comClasse++;
    atual.push(classe);
    m[4] = atual.join(",");
  }
}
console.log(`\n  ${linhasNice.toLocaleString("pt-BR")} linhas → ${comClasse.toLocaleString("pt-BR")} marcas com classe.`);

// ---------- Estimativa de tamanho ----------
// ~175 bytes por marca (dados + chave primária + índice fonético), medido numa
// ingestão real de amostra no Neon.
const estimativaMB = Math.round((marcas.size * 175) / 1e6);
console.log(`Estimativa em disco (dados + índices): ~${estimativaMB} MB`);
console.log("Situações:", [...porSituacao].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}=${v}`).join("; "));
if (DRY) {
  console.log("Amostra:", [...marcas].slice(0, 3));
  process.exit(0);
}

// ---------- Gravação ----------
const sql = neon(process.env.DATABASE_URL);
const [{ mb }] = await sql`SELECT (pg_database_size(current_database()) / 1000000)::int AS mb`;
const [{ limite }] = await sql`SELECT current_setting('neon.max_cluster_size') AS limite`;
const limiteMB = /gb/i.test(limite) ? parseFloat(limite) * 1000 : parseFloat(limite);
console.log(`Banco hoje: ${mb} MB. Depois da ingestão: ~${mb + estimativaMB} MB. Limite do plano: ${limite}.`);
if (!args.includes("--forcar") && mb + estimativaMB > limiteMB * 0.85) {
  console.error("Passaria de 85% do limite do plano do Neon — abortado pra não travar o app. Use --forcar se tiver certeza.");
  process.exit(1);
}

const lote = Math.floor(Date.now() / 1000);
const entradas = [...marcas];
const TAM = 4000;
let gravadas = 0;
async function gravar(fatia) {
  await sql.query(
    `INSERT INTO "MarcaInpi" (numero, nome, chave, situacao, deposito, classes, lote)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::date[], $6::text[], $7::int[])
     ON CONFLICT (numero) DO UPDATE SET nome = EXCLUDED.nome, chave = EXCLUDED.chave,
       situacao = EXCLUDED.situacao, deposito = EXCLUDED.deposito, classes = EXCLUDED.classes, lote = EXCLUDED.lote`,
    [
      fatia.map(([n]) => n),
      fatia.map(([, m]) => m[0]),
      fatia.map(([, m]) => m[1]),
      fatia.map(([, m]) => m[2]),
      fatia.map(([, m]) => m[3]),
      fatia.map(([, m]) => m[4]),
      fatia.map(() => lote),
    ]
  );
  gravadas += fatia.length;
  progresso(`3/3 Gravando… ${gravadas.toLocaleString("pt-BR")} / ${entradas.length.toLocaleString("pt-BR")}`);
}
const fila = [];
for (let i = 0; i < entradas.length; i += TAM) fila.push(entradas.slice(i, i + TAM));
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let f; (f = fila.shift()); ) {
      for (let tentativa = 1; ; tentativa++) {
        try { await gravar(f); break; } catch (e) { if (tentativa === 4) throw e; await new Promise((r) => setTimeout(r, 1500 * tentativa)); }
      }
    }
  })
);

// Remove o que não está mais vivo (lote antigo), em fatias pra não estourar timeout.
let removidas = 0;
for (;;) {
  const r = await sql.query(`DELETE FROM "MarcaInpi" WHERE ctid IN (SELECT ctid FROM "MarcaInpi" WHERE lote <> $1 LIMIT 20000) RETURNING 1`, [lote]);
  removidas += r.length;
  if (r.length < 20000) break;
}
await sql`INSERT INTO "IngestaoMarcas" (lote, total, "fonteAtualizada") VALUES (${lote}, ${entradas.length}, ${lastModified})`;
console.log(`\nPronto: ${entradas.length.toLocaleString("pt-BR")} marcas gravadas, ${removidas.toLocaleString("pt-BR")} antigas removidas. Fonte do INPI: ${lastModified}.`);
