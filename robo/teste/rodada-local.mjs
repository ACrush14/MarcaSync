/**
 * Teste da RODADA do robô contra dois sites falsos e locais: um imitando o e-INPI (como em
 * ensaio-local.mjs) e outro imitando a API do MarcaSync (/api/robo/*). Prova o caminho completo:
 * pede tarefas → confere na prévia → conta o resultado, com o token, sem nunca gerar boleto.
 *
 *   npm run teste-rodada       (precisa do Chrome instalado; roda sem janela)
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.ROBO_SITE = "http://127.0.0.1:0"; // ajustado abaixo, antes de importar o robô

const estado = { hitsBoleto: 0, valores: { 389: "440,00", 394: "860,00" } };

const paginaDeLogin = `<!doctype html><title>Pag</title><h1>Formulário de login</h1><input name="usuario.login">`;
const paginaDaGru = `<!doctype html><title>Pag</title><body>
<a href="/pag/sairSessao">Sair do Sistema</a>
<h2>Dados do Serviço</h2>
<label>Tipo de Serviço:</label>
<select id="tipo"><option value="">--Selecione--</option><option value="800">Administração Geral</option><option value="300">Marcas</option></select>
<div id="svc" style="display:none"><label>Serviço:</label>
  <select id="servico" style="display:none"><option value="">--Selecione--</option></select>
  <span class="select2">escolha…</span></div>
<div id="classes" style="display:none"><label>Total de classes:</label><input id="n" value="1" readonly></div>
<button id="confirmar" type="button" style="display:none">Confirmar</button>
<div id="previa" style="display:none">
  <p>Cod. Servico Valor</p><p id="cod"></p><p id="nome"></p><p id="valor"></p>
  <p>Valor total:</p><p id="total"></p>
  <button type="button" id="gerar">Gerar boleto</button>
  <button type="button">Pagamento online</button>
  <button type="button">Cancelar Serviço</button>
</div>
<script>
  const $ = (id) => document.getElementById(id);
  $("tipo").addEventListener("change", () => {
    if ($("tipo").value !== "300") return;
    $("servico").innerHTML = '<option value="">--Selecione--</option><option value="389">Pedido de registro de marca (com especificação pré-aprovada) - valor por classe (389)</option><option value="394">Pedido de registro de marca (com especificação de livre preenchimento) - valor por classe (394)</option>';
    $("svc").style.display = "block";
  });
  $("servico").addEventListener("change", () => {
    if (!$("servico").value) return;
    $("classes").style.display = "block"; $("confirmar").style.display = "inline-block";
  });
  $("confirmar").addEventListener("click", async () => {
    const cod = $("servico").value;
    const r = await fetch("/valor?servico=" + cod).then((x) => x.text());
    $("cod").textContent = cod; $("nome").textContent = "Pedido de registro de marca - valor por classe";
    $("valor").textContent = r; $("total").textContent = r; $("previa").style.display = "block";
  });
  $("gerar").addEventListener("click", () => fetch("/pag/gru/boleto", { method: "POST" }));
</script></body>`;

const servidor = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const logado = (req.headers.cookie ?? "").includes("sessao=1");
  if (url.pathname === "/pag/gru/boleto") {
    estado.hitsBoleto++;
    res.end("boleto gerado");
  } else if (url.pathname === "/valor") {
    res.end(estado.valores[url.searchParams.get("servico")] ?? "0,00");
  } else if (url.pathname === "/pag/gru/gerar" || url.pathname === "/pag/") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(logado ? (url.pathname === "/pag/" ? "<a>Sair do Sistema</a>" : paginaDaGru) : paginaDeLogin);
  } else {
    res.statusCode = 404;
    res.end("nada");
  }
});
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const porta = servidor.address().port;
process.env.ROBO_SITE = `http://127.0.0.1:${porta}`;

const TOKEN = "token-de-teste";
const api = { estados: [], conferencias: [], tarefas: [], semToken: 0 };
const apiServidor = createServer((req, res) => {
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    res.setHeader("content-type", "application/json");
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      api.semToken++;
      res.statusCode = 401;
      return res.end("{}");
    }
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/api/robo/tarefas") return res.end(JSON.stringify({ tarefas: api.tarefas }));
    if (url.pathname === "/api/robo/estado") {
      api.estados.push(JSON.parse(corpo));
      return res.end("{}");
    }
    const m = url.pathname.match(/^\/api\/robo\/tarefas\/([^/]+)\/conferencia$/);
    if (m) {
      api.conferencias.push({ id: m[1], ...JSON.parse(corpo) });
      res.statusCode = 201;
      return res.end("{}");
    }
    res.statusCode = 404;
    res.end("{}");
  });
});
await new Promise((r) => apiServidor.listen(0, "127.0.0.1", r));
const cfg = { token: TOKEN, site: `http://127.0.0.1:${apiServidor.address().port}` };

const { abrirChrome } = await import("../src/navegador.mjs");
const { rodada } = await import("../src/rodada.mjs");

const perfil = mkdtempSync(join(tmpdir(), "robo-rodada-"));
let falhas = 0;
async function caso(nome, fn) {
  try {
    await fn();
    console.log(`ok      ${nome}`);
  } catch (e) {
    falhas++;
    console.log(`FALHOU  ${nome}\n        ${e instanceof Error ? e.message : e}`);
  }
}

const { contexto, pagina } = await abrirChrome({ visivel: false, perfil });
try {
  await contexto.addCookies([{ name: "sessao", value: "1", url: process.env.ROBO_SITE }]);

  await caso("sem tarefas: só dá sinal de vida", async () => {
    api.tarefas = [];
    assert.equal(await rodada(cfg, pagina), 0);
    assert.deepEqual(api.estados.at(-1), { sessao: "ok" });
    assert.equal(api.conferencias.length, 0);
  });

  await caso("pedido com o valor certo: conta 'ok' com o valor lido", async () => {
    api.tarefas = [{ processoId: "p1", marca: "X", servico: "389", classes: 1, comDesconto: true, esperadoCentavos: 44_000 }];
    assert.equal(await rodada(cfg, pagina), 1);
    assert.deepEqual(api.conferencias.at(-1), {
      id: "p1", resultado: "ok", servico: "389", esperadoCentavos: 44_000, lidoCentavos: 44_000, detalhe: null,
    });
  });

  await caso("o INPI mostra outro valor: conta 'divergente'", async () => {
    estado.valores["394"] = "1720,00";
    api.tarefas = [{ processoId: "p2", marca: "Y", servico: "394", classes: 1, comDesconto: true, esperadoCentavos: 86_000 }];
    await rodada(cfg, pagina);
    estado.valores["394"] = "860,00";
    assert.equal(api.conferencias.at(-1).resultado, "divergente");
    assert.equal(api.conferencias.at(-1).lidoCentavos, 172_000);
  });

  await caso("usa o valor que o SITE cobrou, não a tabela do robô", async () => {
    estado.valores["389"] = "500,00";
    api.tarefas = [{ processoId: "p3", marca: "Z", servico: "389", classes: 1, comDesconto: true, esperadoCentavos: 50_000 }];
    await rodada(cfg, pagina);
    estado.valores["389"] = "440,00";
    assert.equal(api.conferencias.at(-1).resultado, "ok");
  });

  await caso("tarefa com forma estranha é ignorada", async () => {
    const antes = api.conferencias.length;
    api.tarefas = [{ processoId: "p4", servico: "999", comDesconto: true, esperadoCentavos: 1 }, null, "lixo"];
    assert.equal(await rodada(cfg, pagina), 0);
    assert.equal(api.conferencias.length, antes);
  });

  await caso("o token foi em todas as chamadas e nenhum boleto foi gerado", async () => {
    assert.equal(api.semToken, 0);
    assert.equal(estado.hitsBoleto, 0);
  });
} finally {
  await contexto.close().catch(() => undefined);
  servidor.close();
  apiServidor.close();
  rmSync(perfil, { recursive: true, force: true });
}

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo OK: a rodada do robô funciona e nunca gerou boleto.");
process.exit(falhas ? 1 : 0);
