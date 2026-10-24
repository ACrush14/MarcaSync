/**
 * Relatório SÓ DE LEITURA do banco: quantas linhas cada tabela tem, quais migrations foram
 * aplicadas e se há algo estranho nos pagamentos e nos processos.
 *
 * Garantias:
 *  - tudo roda numa transação READ ONLY: o próprio Postgres recusa qualquer escrita;
 *  - nenhum dado pessoal sai (sem nome, WhatsApp, e-mail, CPF/CNPJ, endereço, marca): só
 *    contagens, valores, status e as 6 últimas letras de cada id.
 *
 * Uso:   DATABASE_URL=... node scripts/relatorio-producao.mjs
 * (o script de apoio em scratchpad pega a URL de produção pelo Neon CLI e não a mostra.)
 */
import { readdirSync } from "node:fs";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const cliente = await pool.connect();
const reais = (c) => `R$ ${(Number(c) / 100).toFixed(2).replace(".", ",")}`;
const fim = (id) => String(id).slice(-6);
const titulo = (t) => console.log(`\n=== ${t} ===`);
async function q(sql, params = []) {
  return (await cliente.query(sql, params)).rows;
}

let problemas = 0;
function achado(ok, texto) {
  if (!ok) problemas++;
  console.log(`${ok ? "ok       " : "ATENÇÃO  "}${texto}`);
}

try {
  await cliente.query("BEGIN READ ONLY");

  const [{ host }] = await q("select inet_server_addr()::text as host");
  const [{ banco }] = await q("select current_database() as banco");
  console.log(`Banco: ${banco} (somente leitura)`);
  void host;

  // ------------------------------------------------------------------ tabelas
  titulo("TABELAS (linhas em cada uma)");
  const tabelas = [
    "Cliente", "Processo", "Pagamento", "PedidoRegistro", "ImagemMarca", "ReciboProtocolo",
    "Prazo", "Notificacao", "Alerta", "SituacaoProcesso", "LeituraRpi", "MarcaInpi",
    "IngestaoMarcas", "Evento", "TentativaAdmin",
  ];
  const existentes = new Set((await q("select tablename from pg_tables where schemaname='public'")).map((r) => r.tablename));
  for (const t of tabelas) {
    if (!existentes.has(t)) {
      achado(false, `${t.padEnd(18)} NÃO EXISTE no banco (migration pendente?)`);
      continue;
    }
    const [{ n }] = await q(`select count(*)::int as n from "${t}"`);
    console.log(`           ${t.padEnd(18)} ${String(n).padStart(8)}`);
  }
  const extras = [...existentes].filter((t) => !tabelas.includes(t) && t !== "_prisma_migrations");
  if (extras.length) console.log(`           (outras tabelas: ${extras.join(", ")})`);

  // ------------------------------------------------------------------ migrations
  titulo("MIGRATIONS");
  const noRepo = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const aplicadas = await q(
    "select migration_name, finished_at, rolled_back_at from _prisma_migrations order by migration_name"
  );
  const feitas = new Set(aplicadas.filter((m) => m.finished_at && !m.rolled_back_at).map((m) => m.migration_name));
  for (const m of noRepo) achado(feitas.has(m), `${m}${feitas.has(m) ? "" : "  <- NÃO aplicada"}`);
  for (const m of aplicadas) {
    if (!noRepo.includes(m.migration_name)) achado(false, `${m.migration_name}  <- está no banco mas não no código`);
    if (m.rolled_back_at || !m.finished_at) achado(false, `${m.migration_name}  <- não terminou ou foi desfeita`);
  }

  // ------------------------------------------------------------------ pagamentos
  titulo("PAGAMENTOS");
  const porTipoStatus = await q(
    `select tipo, status, valorCentavos as v, count(*)::int as n, coalesce(sum(valorCentavos),0)::int as soma
       from (select tipo, status, "valorCentavos" as valorCentavos from "Pagamento") p
      group by 1,2,3 order by 1,2,3`
  );
  if (porTipoStatus.length === 0) console.log("           (nenhum pagamento)");
  for (const r of porTipoStatus) {
    console.log(`           ${r.tipo.padEnd(14)} ${r.status.padEnd(11)} ${reais(r.v).padStart(12)} x ${r.n}`);
  }

  const PRECO = { setup: [49900], monitoramento: [2900], gru: [44000, 86000, 88000, 172000] };
  const todos = await q(
    `select id, tipo, status, "valorCentavos" as v, "provedorId", "confirmadoEm", "confirmadoVia", "estornadoEm", "estornoId", "expiraEm", "createdAt" from "Pagamento"`
  );
  const fora = todos.filter((p) => !(PRECO[p.tipo] ?? []).includes(p.v));
  achado(fora.length === 0, `valor diferente do catálogo: ${fora.length}${fora.length ? " -> " + fora.map((p) => `${fim(p.id)} ${p.tipo} ${reais(p.v)} (${p.status})`).join("; ") : ""}`);
  const tiposDesconhecidos = todos.filter((p) => !PRECO[p.tipo]);
  achado(tiposDesconhecidos.length === 0, `tipo de pagamento desconhecido: ${tiposDesconhecidos.length}`);
  const statusDesconhecido = todos.filter((p) => !["pendente", "confirmado", "estornado", "expirado"].includes(p.status));
  achado(statusDesconhecido.length === 0, `status desconhecido: ${statusDesconhecido.length}`);
  const confSemData = todos.filter((p) => p.status === "confirmado" && !p.confirmadoEm);
  achado(confSemData.length === 0, `confirmado sem data de confirmação: ${confSemData.length}`);
  const confManual = todos.filter((p) => p.status === "confirmado" && p.confirmadoVia && p.confirmadoVia !== "abacatepay");
  achado(confManual.length === 0, `confirmado à mão (não pelo AbacatePay): ${confManual.length}${confManual.length ? " -> " + confManual.map((p) => fim(p.id)).join(", ") : ""}`);
  const estSemId = todos.filter((p) => p.status === "estornado" && !p.estornoId);
  achado(estSemId.length === 0, `estornado sem id de estorno: ${estSemId.length}`);
  const velhos = todos.filter((p) => p.status === "pendente" && Date.now() - new Date(p.createdAt).getTime() > 7 * 86400_000);
  console.log(`           pendentes há mais de 7 dias: ${velhos.length}`);
  const repetidos = await q(`select "provedorId" from "Pagamento" where "provedorId" is not null group by 1 having count(*) > 1`);
  achado(repetidos.length === 0, `mesma cobrança do AbacatePay em dois pagamentos: ${repetidos.length}`);
  const duplicados = await q(
    `select "processoId", tipo, count(*)::int as n from "Pagamento" group by 1,2 having count(*) > 1`
  );
  achado(duplicados.length === 0, `processo com dois pagamentos do mesmo tipo: ${duplicados.length}`);
  const semProcesso = await q(`select p.id from "Pagamento" p left join "Processo" r on r.id = p."processoId" where r.id is null`);
  achado(semProcesso.length === 0, `pagamento sem processo: ${semProcesso.length}`);

  // ------------------------------------------------------------------ processos
  titulo("PROCESSOS");
  for (const r of await q(`select status, count(*)::int as n from "Processo" group by 1 order by 2 desc`)) {
    console.log(`           ${r.status.padEnd(14)} ${r.n}`);
  }
  const [{ n: comPedido }] = await q(`select count(*)::int as n from "PedidoRegistro"`);
  const [{ n: semPedidoMasPago }] = await q(
    `select count(distinct p."processoId")::int as n from "Pagamento" p
      left join "PedidoRegistro" d on d."processoId" = p."processoId"
      where p.status = 'confirmado' and d.id is null`
  );
  achado(semPedidoMasPago === 0, `processo pago sem os dados do pedido: ${semPedidoMasPago}`);
  console.log(`           processos com o formulário do pedido preenchido: ${comPedido}`);
  const [{ n: protSemData }] = await q(`select count(*)::int as n from "Processo" where status='protocolado' and "protocoladoEm" is null`);
  achado(protSemData === 0, `protocolado sem data de protocolo: ${protSemData}`);
  const [{ n: protSemPago }] = await q(
    `select count(*)::int as n from "Processo" pr where pr.status='protocolado'
       and not exists (select 1 from "Pagamento" g where g."processoId"=pr.id and g.tipo='setup' and g.status='confirmado')`
  );
  achado(protSemPago === 0, `protocolado sem o serviço pago: ${protSemPago}`);
  const [{ n: protocoloForjado }] = await q(`select count(*)::int as n from "Processo" where protocolo is not null`);
  console.log(`           processo com o campo antigo "protocolo" preenchido (o fluxo antigo gerava um número interno): ${protocoloForjado}`);
  const [{ n: gruSemProt }] = await q(`select count(*)::int as n from "Processo" where "gruPagaInpiEm" is not null and "protocoladoEm" is null`);
  console.log(`           GRU paga ao INPI e ainda sem protocolo: ${gruSemProt}`);

  titulo("PEDIDOS (preços gravados)");
  const diferePreco = await q(
    `select d."processoId", d."servicoCentavos" as s, d."gruCentavos" as g from "PedidoRegistro" d
      where d."servicoCentavos" <> 49900 or d."gruCentavos" not in (44000, 86000, 88000, 172000)`
  );
  achado(diferePreco.length === 0, `pedido com preço fora do catálogo: ${diferePreco.length}`);
  const [{ n: semAceite }] = await q(`select count(*)::int as n from "PedidoRegistro" where "aceitoEm" is null`);
  achado(semAceite === 0, `pedido sem data de aceite: ${semAceite}`);
  const [{ n: gruErrada }] = await q(
    `select count(*)::int as n from "PedidoRegistro" d
       join "Pagamento" g on g."processoId"=d."processoId" and g.tipo='gru' and g.status='pendente'
      where g."valorCentavos" <> d."gruCentavos"`
  );
  achado(gruErrada === 0, `GRU pendente com valor diferente do pedido: ${gruErrada}`);

  // ------------------------------------------------------------------ outros
  titulo("PRAZOS E AVISOS");
  const [{ abertos, vencidos }] = await q(
    `select count(*) filter (where "concluidoEm" is null)::int as abertos,
            count(*) filter (where "concluidoEm" is null and "venceEm" < now())::int as vencidos from "Prazo"`
  );
  console.log(`           prazos em aberto: ${abertos}  (vencidos: ${vencidos})`);
  for (const r of await q(`select canal, destino, count(*)::int as n, count(*) filter (where "enviadaEm" is not null)::int as enviadas, count(*) filter (where erro is not null)::int as com_erro from "Notificacao" group by 1,2 order by 1,2`)) {
    console.log(`           aviso ${r.canal}/${r.destino}: ${r.n} (enviados ${r.enviadas}, com erro ${r.com_erro})`);
  }

  titulo("SEGURANÇA: TENTATIVAS ERRADAS NO /admin");
  const tent = await q(
    `select count(*)::int as n, count(distinct ip)::int as ips,
            count(*) filter (where "createdAt" > now() - interval '24 hours')::int as dia from "TentativaAdmin"`
  );
  console.log(`           tentativas erradas registradas: ${tent[0].n} (de ${tent[0].ips} IPs; últimas 24 h: ${tent[0].dia})`);
  achado(tent[0].dia < 20, `menos de 20 tentativas erradas nas últimas 24 h`);

  titulo("USO DO SITE (eventos, últimos 7 dias)");
  for (const r of await q(`select nome, count(*)::int as n, count(distinct "sessaoId")::int as sessoes from "Evento" where "createdAt" > now() - interval '7 days' group by 1 order by 2 desc`)) {
    console.log(`           ${r.nome.padEnd(22)} ${String(r.n).padStart(6)} eventos, ${r.sessoes} visitantes`);
  }

  titulo("DADOS DA BASE DE MARCAS DO INPI");
  const ing = await q(`select lote, total, "concluidaEm", "fonteAtualizada" from "IngestaoMarcas" order by lote desc limit 1`);
  if (ing[0]) console.log(`           última carga: lote ${ing[0].lote}, ${ing[0].total} marcas, em ${new Date(ing[0].concluidaEm).toISOString().slice(0, 10)}`);
  const rpi = await q(`select edicao, "lidaEm" from "LeituraRpi" order by edicao desc limit 1`);
  if (rpi[0]) console.log(`           última RPI lida: ${rpi[0].edicao}, em ${new Date(rpi[0].lidaEm).toISOString().slice(0, 10)}`);

  await cliente.query("ROLLBACK");
  console.log(problemas ? `\n${problemas} ponto(s) de atenção.` : "\nNada estranho encontrado.");
} finally {
  cliente.release();
  await pool.end();
}
