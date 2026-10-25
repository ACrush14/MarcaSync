/**
 * Lista ou apaga clientes (e tudo o que depende deles) do banco apontado por DATABASE_URL.
 * Feito para limpar os dados de teste de produção, sem apagar visitantes de verdade.
 *
 *   node scripts/limpar-dados-teste.mjs listar
 *       Só leitura (transação READ ONLY). Mostra cada cliente com dados MASCARADOS (primeiro nome,
 *       final do WhatsApp, marca, etapa, pagamentos) para você decidir o que é teste.
 *
 *   APAGAR_CLIENTES=abc123,def456 node scripts/limpar-dados-teste.mjs apagar
 *       Apaga só os clientes cujo id TERMINA com um dos códigos (os 6 últimos caracteres que o
 *       "listar" mostra), com os processos, pagamentos, pedido, imagem, recibo, prazos, alertas,
 *       situações e avisos deles. Tudo numa transação: se algo falhar, nada é apagado.
 *       Antes de apagar, grava uma cópia em BACKUP_DIR (um arquivo JSON) para poder restaurar.
 *       Exige CONFIRMAR=SIM. Nunca mexe em Evento, TentativaAdmin nem nas tabelas do INPI.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const modo = process.argv[2];
if (!process.env.DATABASE_URL || !["listar", "apagar"].includes(modo ?? "")) {
  console.error("Uso: DATABASE_URL=... node scripts/limpar-dados-teste.mjs listar|apagar");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const c = await pool.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const fim = (id) => String(id).slice(-6);
const mascarar = (z) => {
  const d = String(z).replace(/\D/g, "");
  return d.length >= 4 ? `...${d.slice(-4)}` : "????";
};
const primeiroNome = (n) => String(n).trim().split(/\s+/)[0] ?? "?";

try {
  if (modo === "listar") {
    await c.query("BEGIN READ ONLY");
    const clientes = await q(
      `select c.id, c.nome, c.whatsapp, c."createdAt",
              (select count(*)::int from "Processo" p where p."clienteId" = c.id) as processos
         from "Cliente" c order by c."createdAt"`
    );
    console.log(`\n${clientes.length} clientes no banco (dados mascarados):\n`);
    for (const cl of clientes) {
      const procs = await q(
        `select p.id, p.marca, p.status, p."createdAt",
                (select count(*)::int from "Pagamento" g where g."processoId" = p.id) as pagamentos,
                (select count(*)::int from "Pagamento" g where g."processoId" = p.id and g.status = 'confirmado') as pagos,
                exists (select 1 from "PedidoRegistro" d where d."processoId" = p.id) as pedido
           from "Processo" p where p."clienteId" = $1 order by p."createdAt"`,
        [cl.id]
      );
      console.log(
        `[${fim(cl.id)}] ${primeiroNome(cl.nome)}  zap ${mascarar(cl.whatsapp)}  criado ${new Date(cl.createdAt).toISOString().slice(0, 10)}  (${cl.processos} processo${cl.processos === 1 ? "" : "s"})`
      );
      for (const p of procs) {
        console.log(
          `        marca "${String(p.marca).slice(0, 28)}"  etapa ${p.status}  pedido ${p.pedido ? "sim" : "não"}  pagamentos ${p.pagamentos} (pagos ${p.pagos})  ${new Date(p.createdAt).toISOString().slice(0, 10)}`
        );
      }
    }
    await c.query("ROLLBACK");
    console.log("\nSó leitura: nada foi alterado.");
  } else {
    if (process.env.CONFIRMAR !== "SIM") {
      console.error("Falta CONFIRMAR=SIM. Nada foi apagado.");
      process.exit(1);
    }
    const codigos = (process.env.APAGAR_CLIENTES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (codigos.length === 0 || codigos.some((s) => !/^[A-Za-z0-9_-]{6}$/i.test(s))) {
      console.error("APAGAR_CLIENTES precisa listar códigos de 6 caracteres, separados por vírgula.");
      process.exit(1);
    }
    await c.query("BEGIN");
    const clientes = await q(`select * from "Cliente" where right(id, 6) = any($1)`, [codigos]);
    const achados = new Set(clientes.map((x) => fim(x.id)));
    const naoAchados = codigos.filter((x) => !achados.has(x));
    if (naoAchados.length) throw new Error(`Códigos que não existem: ${naoAchados.join(", ")}. Nada foi apagado.`);
    const ids = clientes.map((x) => x.id);

    // Trava de segurança: nunca apaga processo com pagamento confirmado ou já protocolado.
    const protegidos = await q(
      `select p.id from "Processo" p where p."clienteId" = any($1)
          and (p.status = 'protocolado' or p."protocoladoEm" is not null
               or exists (select 1 from "Pagamento" g where g."processoId" = p.id and g.status in ('confirmado','estornado')))`,
      [ids]
    );
    if (protegidos.length && process.env.INCLUIR_PROTEGIDOS !== "SIM") {
      throw new Error(
        `${protegidos.length} processo(s) tem pagamento confirmado/estornado ou já foi protocolado (${protegidos.map((p) => fim(p.id)).join(", ")}). Nada foi apagado. Para apagar mesmo assim, use INCLUIR_PROTEGIDOS=SIM.`
      );
    }

    const procs = await q(`select * from "Processo" where "clienteId" = any($1)`, [ids]);
    const pids = procs.map((p) => p.id);
    const filhas = ["Pagamento", "Alerta", "SituacaoProcesso", "Prazo", "PedidoRegistro", "ImagemMarca", "ReciboProtocolo", "Notificacao"];

    // cópia de segurança (sem as colunas binárias grandes: imagem e PDF)
    const copia = { feitoEm: new Date().toISOString(), clientes, processos: procs };
    for (const t of filhas) {
      const colunas = t === "ImagemMarca" ? `id, "processoId", "mimeOriginal", "larguraOriginal", "alturaOriginal", largura, altura` : t === "ReciboProtocolo" ? `id, "processoId", "nomeArquivo", tamanho` : "*";
      copia[t] = await q(`select ${colunas} from "${t}" where "processoId" = any($1)`, [pids]);
    }
    const pasta = process.env.BACKUP_DIR ?? ".";
    mkdirSync(pasta, { recursive: true });
    const arquivo = join(pasta, `backup-apagados-${Date.now()}.json`);
    writeFileSync(arquivo, JSON.stringify(copia, null, 2));
    console.log(`Cópia de segurança gravada em ${arquivo}`);

    const contagem = {};
    for (const t of filhas) {
      const r = await c.query(`delete from "${t}" where "processoId" = any($1)`, [pids]);
      contagem[t] = r.rowCount;
    }
    contagem.Processo = (await c.query(`delete from "Processo" where id = any($1)`, [pids])).rowCount;
    contagem.Cliente = (await c.query(`delete from "Cliente" where id = any($1)`, [ids])).rowCount;
    await c.query("COMMIT");
    console.log("Apagado:", JSON.stringify(contagem));
    const [{ n: clientesRestantes }] = await q(`select count(*)::int as n from "Cliente"`);
    const [{ n: processosRestantes }] = await q(`select count(*)::int as n from "Processo"`);
    console.log(`Restam ${clientesRestantes} clientes e ${processosRestantes} processos.`);
  }
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
