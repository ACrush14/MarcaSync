/**
 * Teste do fluxo do cliente, de ponta a ponta, no navegador (Chrome do Playwright que já está em
 * robo/node_modules): consulta → resultado → plano → pedido → pagamento, mais os bloqueios
 * (WhatsApp inválido, CPF errado, confirmações faltando) e o visual (ordem do plano, campos iguais,
 * lista de classes, tela de celular sem rolagem lateral).
 *
 * Cria registros de teste, por isso SÓ roda contra localhost.
 *
 * Uso:   node scripts/testar-fluxo.mjs [http://localhost:3002]
 * Precisa do site rodando e de `cd robo && npm install`. Sai com código 1 se algum teste falhar.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3002";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error(`Recusado: ${BASE} não é local. Este teste cria pedidos de teste.`);
  process.exit(2);
}
const { chromium } = await import(pathToFileURL(resolve("robo/node_modules/playwright/index.mjs")).href);

const linhas = [];
let falhas = 0;
const reg = (ok, nome, detalhe = "") => {
  if (!ok) falhas++;
  linhas.push(`${ok ? "ok    " : "FALHOU"} ${nome}${detalhe ? "  -> " + detalhe : ""}`);
};

const navegador = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
const p = await ctx.newPage();
const errosDePagina = [];
p.on("pageerror", (e) => errosDePagina.push(e.message));

const topo = async (seletor) => (await p.locator(seletor).first().boundingBox())?.y ?? Infinity;
const estilo = (seletor, propriedade) =>
  p.locator(seletor).first().evaluate((el, prop) => getComputedStyle(el)[prop], propriedade);

try {
  // ---------------------------------------------------------------- 1. consulta e resultado
  await p.goto(`${BASE}/consulta`, { waitUntil: "networkidle" });
  reg(await p.locator("#in-marca").isVisible(), "a consulta abre sem pedir cadastro");
  const vazio = p.getByRole("button", { name: /Ver o resultado/ });
  reg(await vazio.isDisabled(), "sem o nome da marca o botão da consulta fica desligado");
  await p.fill("#in-marca", "Kaza Doce");
  await p.fill("#in-desc", "Confeitaria artesanal: bolos, doces e salgados sob encomenda.");
  await vazio.click();
  await p.getByRole("button", { name: /Ver preço do registro/ }).first().waitFor({ timeout: 60000 });
  reg(true, "a busca devolve o resultado da análise");
  reg((await p.getByText(/Nível de colisão/i).count()) > 0, "o resultado mostra o nível de colisão");
  await p.getByRole("button", { name: /Ver preço do registro/ }).first().click();

  // ---------------------------------------------------------------- 2. plano: ordem e texto
  await p.waitForSelector("#in-nome");
  const yContato = await topo("text=Para onde mandamos o andamento?");
  const yBotao = await topo("button:has-text('Quero registrar')");
  const yPlanos = await topo(".plans");
  const yGarantia = await topo("text=Garantia de devolução");
  reg(yContato < yBotao && yBotao < yPlanos && yPlanos < yGarantia, "plano: contato, depois o botão, depois os cartões, depois a garantia", `y: ${[yContato, yBotao, yPlanos, yGarantia].map(Math.round)}`);
  const larguraIntro = (await p.locator(".panel-head .help").boundingBox())?.width ?? 0;
  reg(larguraIntro > 900, "o texto de abertura do plano ocupa a largura toda", `${Math.round(larguraIntro)} px`);
  const intro = await p.locator(".panel-head .help").innerText();
  reg(!/fale com um consultor/i.test(intro) && /mesmo pagamento/.test(intro), "o texto de abertura explica o pagamento único");
  reg(/toda semana/.test(await p.locator(".plan-card").nth(1).innerText()), "o cartão do monitoramento fala da leitura semanal e depois mensal");

  // ---------------------------------------------------------------- 3. WhatsApp
  await p.fill("#in-nome", "Ana Ramos");
  const quero = p.getByRole("button", { name: /Quero registrar/ });
  for (const [nome, numero] of [
    ["fixo", "8531234567"],
    ["inventado", "85999999999"],
    ["DDD que não existe", "20912345678"],
    ["curto", "859123"],
    ["vazio", ""],
  ]) {
    await p.fill("#in-whatsapp", "");
    if (numero) await p.type("#in-whatsapp", numero);
    await quero.click();
    await p.waitForTimeout(300);
    reg((await p.locator("#in-nome").count()) === 1 && (await p.locator("#campo-nome").count()) === 0, `WhatsApp ${nome} não deixa passar para o pedido`);
  }
  await p.fill("#in-whatsapp", "");
  await p.fill("#in-whatsapp", "zap 85 abc 91234-5678 xyz");
  reg((await p.inputValue("#in-whatsapp")) === "(85) 91234-5678", "a máscara tira letras e formata o celular", await p.inputValue("#in-whatsapp"));
  await p.fill("#in-whatsapp", "");
  await p.type("#in-whatsapp", "85900001234");
  await quero.click();
  await p.waitForSelector("#campo-nome", { timeout: 30000 });
  reg(true, "WhatsApp válido passa para o pedido");

  // ---------------------------------------------------------------- 4. pedido: visual e classes
  const opcoes = await p.locator("#campo-classeNice option").allInnerTexts();
  reg(opcoes.length === 46 && opcoes[1] === "1 — Produtos químicos" && opcoes.at(-1) === "45 — Serviços jurídicos e de segurança", "a lista de classes tem as 45, com título", `${opcoes.length - 1} classes`);
  reg((await p.locator("#campo-classeNice optgroup").count()) === 2, "a lista de classes separa produtos e serviços");
  const semTitulo = opcoes.slice(1).filter((o) => !/^\d+ — .{5,}/.test(o));
  reg(semTitulo.length === 0, "nenhuma classe aparece só como número", semTitulo.join(","));
  for (const [id, nome] of [["#campo-email", "e-mail"], ["#campo-uf", "estado"], ["#campo-classeNice", "classe"], ["#campo-apresentacao", "apresentação"]]) {
    const [borda, fundo, raio] = await Promise.all([estilo(id, "borderTopWidth"), estilo(id, "backgroundColor"), estilo(id, "borderTopLeftRadius")]);
    const [bordaRef, fundoRef, raioRef] = await Promise.all([estilo("#campo-nome", "borderTopWidth"), estilo("#campo-nome", "backgroundColor"), estilo("#campo-nome", "borderTopLeftRadius")]);
    reg(borda === bordaRef && fundo === fundoRef && raio === raioRef, `o campo ${nome} tem o mesmo visual do campo de texto`, `${borda}/${fundo}/${raio}`);
  }

  // ---------------------------------------------------------------- 5. pedido: bloqueios
  await p.getByRole("button", { name: /Confirmar e continuar/ }).click();
  await p.waitForTimeout(500);
  reg((await p.locator("[role=alert]").count()) >= 5, "formulário vazio mostra os erros e não avança");
  reg((await p.getByRole("heading", { name: /Falta só o pagamento/ }).count()) === 0, "formulário vazio não chega ao pagamento");

  await p.fill("#campo-nome", "Ana Ramos Confeitaria");
  await p.fill("#campo-documento", "111.111.111-11");
  await p.fill("#campo-email", "isso-nao-e-email");
  await p.fill("#campo-cep", "60150-160");
  await p.fill("#campo-logradouro", "Rua das Flores");
  await p.fill("#campo-numero", "123");
  await p.fill("#campo-bairro", "Centro");
  await p.fill("#campo-cidade", "Fortaleza");
  await p.selectOption("#campo-uf", "CE");
  await p.fill("#campo-elementoNominativo", "Kaza Doce");
  await p.selectOption("#campo-classeNice", "30");
  await p.fill("#campo-especificacao", "bolo");
  await p.waitForTimeout(2500);
  const item = p.locator("ul button", { hasText: /^\+ / }).first();
  if (await item.count()) await item.click();
  await p.fill("#campo-atividade", "Confeitaria artesanal, vendendo bolos sob encomenda desde 2023.");
  await p.locator("input[name=palavraEstrangeira]").nth(1).check();
  await p.getByRole("button", { name: /Confirmar e continuar/ }).click();
  await p.waitForTimeout(500);
  const erros = await p.locator("[role=alert]").allInnerTexts();
  reg(erros.some((e) => /CPF/i.test(e)), "CPF inválido é apontado", erros.join(" | ").slice(0, 100));
  reg(erros.some((e) => /e-mail/i.test(e)), "e-mail inválido é apontado");
  reg((await p.getByRole("heading", { name: /Falta só o pagamento/ }).count()) === 0, "com CPF e e-mail errados, não avança");

  await p.fill("#campo-documento", "529.982.247-25");
  await p.fill("#campo-email", "ana@exemplo.com.br");
  await p.getByRole("button", { name: /Confirmar e continuar/ }).click();
  await p.waitForTimeout(500);
  reg((await p.getByRole("heading", { name: /Falta só o pagamento/ }).count()) === 0, "sem marcar as confirmações e declarações, não avança");
  for (const c of ["aceiteTermos", "cienciaDocumentosInpi", "declaracaoAtividade", "declaracaoVeracidade", "aceiteProcuracao", "aceiteLgpd"]) {
    await p.locator(`#campo-${c}`).check();
  }
  const ciente = p.locator("#campo-cienteAnterioridade");
  if (await ciente.count()) await ciente.check();

  // ---------------------------------------------------------------- 6. pagamento
  await p.getByRole("button", { name: /Confirmar e continuar/ }).click();
  await p.getByRole("heading", { name: /Falta só o pagamento/ }).waitFor({ timeout: 60000 });
  reg(true, "com tudo certo, o pedido segue para o pagamento");
  const textoPagamento = await p.locator("main, .panel").first().innerText();
  reg(/R\$\s*939,00/.test(textoPagamento), "o total mostrado é R$ 939,00 (R$ 499 + taxa com 50%)");
  const pagar = p.getByRole("link", { name: /Pagar com Pix ou cartão/ }).or(p.getByRole("button", { name: /Pagar com Pix ou cartão/ }));
  await pagar.first().waitFor({ timeout: 60000 });
  reg(true, "aparece o botão de pagar com Pix ou cartão");
  const href = await p.getByRole("link", { name: /Pagar com Pix ou cartão/ }).first().getAttribute("href").catch(() => null);
  reg(!href || /^https:\/\/(app\.)?abacatepay\.com\//.test(href), "o botão de pagar leva ao AbacatePay (https)", String(href).slice(0, 60));

  // ---------------------------------------------------------------- 7. celular
  const cel = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "pt-BR" });
  const m = await cel.newPage();
  for (const caminho of ["/", "/consulta", "/termos", "/privacidade"]) {
    await m.goto(`${BASE}${caminho}`, { waitUntil: "networkidle" });
    const extra = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    reg(extra <= 1, `no celular, ${caminho} não rola para o lado`, `sobra ${extra}px`);
  }
  await m.goto(`${BASE}/consulta`, { waitUntil: "networkidle" });
  await m.fill("#in-marca", "Kaza Doce");
  await m.fill("#in-desc", "Confeitaria artesanal e bolos.");
  await m.getByRole("button", { name: /Ver o resultado/ }).click();
  await m.getByRole("button", { name: /Ver preço do registro/ }).first().waitFor({ timeout: 60000 });
  await m.getByRole("button", { name: /Ver preço do registro/ }).first().click();
  await m.waitForSelector("#in-nome");
  const extraPlano = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  reg(extraPlano <= 1, "no celular, o passo do plano não rola para o lado", `sobra ${extraPlano}px`);
  await cel.close();

  reg(errosDePagina.length === 0, "nenhum erro de JavaScript na página durante o fluxo", errosDePagina.join(" | ").slice(0, 120));
} catch (e) {
  reg(false, "o teste do fluxo terminou sem travar", e instanceof Error ? e.message.split("\n")[0] : String(e));
} finally {
  await navegador.close();
}

console.log(linhas.join("\n"));
console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo OK.");
process.exit(falhas ? 1 : 0);
