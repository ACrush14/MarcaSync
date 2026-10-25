/**
 * Teste do robô contra um site FALSO, local, que imita a emissão da GRU do e-INPI (formulário,
 * prévia com o valor, botão "Gerar boleto"). Serve para provar a mecânica do robô sem tocar no INPI:
 * acha os campos, lê o valor, detecta valor errado e sessão fechada, e NUNCA gera boleto.
 *
 *   npm run teste-local        (precisa do Chrome instalado; roda sem janela)
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

const { abrirChrome } = await import("../src/navegador.mjs");
const { ErroSessao, clicarSeguro, conferirServico } = await import("../src/gru.mjs");

const perfil = mkdtempSync(join(tmpdir(), "robo-teste-"));
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
  // 1) sem sessão
  await caso("sem login, o robô para e pede o login (ErroSessao)", async () => {
    await assert.rejects(conferirServico(pagina, { servico: "389", comDesconto: true, capturas: false }), ErroSessao);
  });

  await contexto.addCookies([{ name: "sessao", value: "1", url: process.env.ROBO_SITE }]);

  // 2) valores certos (cadastro MEI: com desconto)
  await caso("389 com desconto: lê R$ 440,00 e bate", async () => {
    const r = await conferirServico(pagina, { servico: "389", comDesconto: true, capturas: false });
    assert.equal(r.lidoCentavos, 44_000);
    assert.equal(r.ok, true);
  });
  await caso("394 com desconto: lê R$ 860,00 e bate", async () => {
    const r = await conferirServico(pagina, { servico: "394", comDesconto: true, capturas: false });
    assert.equal(r.lidoCentavos, 86_000);
    assert.equal(r.ok, true);
  });

  // 3) valor errado é apontado
  await caso("se o INPI mostrar outro valor, o robô acusa o problema", async () => {
    estado.valores["389"] = "880,00";
    const r = await conferirServico(pagina, { servico: "389", comDesconto: true, capturas: false });
    estado.valores["389"] = "440,00";
    assert.equal(r.lidoCentavos, 88_000);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /diferente/);
  });
  await caso("cadastro sem desconto: espera R$ 880,00", async () => {
    estado.valores["389"] = "880,00";
    const r = await conferirServico(pagina, { servico: "389", comDesconto: false, capturas: false });
    estado.valores["389"] = "440,00";
    assert.equal(r.ok, true);
  });

  // 4) travas: nunca gerar boleto
  await caso("o robô se recusa a clicar em 'Gerar boleto' e em 'Pagamento online'", async () => {
    await assert.rejects(clicarSeguro(pagina, "Gerar boleto"), /nunca gera boleto/);
    await assert.rejects(clicarSeguro(pagina, "Pagamento online"), /nunca gera boleto/);
  });
  await caso("mesmo que alguém clique à força, a rede derruba o pedido do boleto", async () => {
    await pagina.goto(`${process.env.ROBO_SITE}/pag/gru/gerar`);
    await pagina.evaluate(() => fetch("/pag/gru/boleto", { method: "POST" }).catch(() => "bloqueado"));
    assert.equal(estado.hitsBoleto, 0);
  });
  await caso("depois de todo o ensaio, nenhum pedido de boleto chegou ao site", async () => {
    assert.equal(estado.hitsBoleto, 0);
  });
} finally {
  await contexto.close().catch(() => undefined);
  servidor.close();
  rmSync(perfil, { recursive: true, force: true });
}

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo OK: o robô funciona no site falso e nunca gerou boleto.");
process.exit(falhas ? 1 : 0);
