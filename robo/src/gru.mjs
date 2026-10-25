/**
 * O ensaio da GRU: abre a emissão, escolhe o serviço, confirma para ver a PRÉVIA, lê o valor e
 * sai. Não gera boleto, não paga, não aperta "Cancelar Serviço" (que abre uma janela de
 * confirmação): sai navegando para a página inicial, o que abandona a prévia sem deixar nada.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  PASTA_CAPTURAS,
  URL_GRU,
  URL_INICIO,
} from "./navegador.mjs";
import {
  botaoProibido,
  compararValor,
  estaLogado,
  extrairLinhaDoServico,
  extrairValorTotal,
  naTelaDeLogin,
  valorEsperado,
} from "./logica.mjs";

export class ErroSessao extends Error {
  constructor() {
    super("A sessão do e-INPI não está aberta. Rode `npm run login` e entre na sua conta.");
    this.name = "ErroSessao";
  }
}

const ESPERA_MS = 20_000;

async function textoDaPagina(page) {
  return page.locator("body").innerText({ timeout: ESPERA_MS });
}

/** Clica por NOME de botão, recusando os que gerariam o boleto ou levariam ao pagamento. */
export async function clicarSeguro(page, nome) {
  if (botaoProibido(nome)) {
    throw new Error(`Recusei clicar em "${nome}": o robô em ensaio nunca gera boleto nem paga.`);
  }
  await page.getByRole("button", { name: nome, exact: true }).click({ timeout: ESPERA_MS });
}

/**
 * Muda um <select> (inclusive os que o site esconde atrás de um componente bonito) e avisa a página,
 * como se a pessoa tivesse escolhido a opção.
 */
async function definirSelect(select, valor) {
  await select.evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    // O site usa jQuery/select2 em alguns campos: o evento dele precisa disparar também.
    if (typeof window.jQuery === "function") window.jQuery(el).trigger("change");
  }, valor);
}

export async function abrirEmissao(page) {
  await page.goto(URL_GRU, { waitUntil: "domcontentloaded", timeout: ESPERA_MS });
  const texto = await textoDaPagina(page);
  if (naTelaDeLogin(texto) || !estaLogado(texto)) throw new ErroSessao();
}

/**
 * Confere UM serviço (389 ou 394, com 1 classe). Devolve o que leu e se bate com o esperado.
 * @param {import("playwright").Page} page
 * @param {{ servico: "389" | "394", comDesconto: boolean, capturas?: boolean }} opcoes
 */
export async function conferirServico(page, { servico, comDesconto, capturas = true }) {
  const esperadoCentavos = valorEsperado(servico, comDesconto);
  const inicio = Date.now();
  await abrirEmissao(page);

  // 1) tipo de serviço: Marcas
  const tipo = page.locator("select").filter({ has: page.locator("option", { hasText: /^Marcas$/ }) }).first();
  await tipo.waitFor({ state: "attached", timeout: ESPERA_MS });
  await definirSelect(tipo, await tipo.locator("option", { hasText: /^Marcas$/ }).first().getAttribute("value"));

  // 2) o serviço (a lista é carregada depois de escolher o tipo)
  const select = page.locator("select").filter({ has: page.locator(`option[value="${servico}"]`) }).first();
  await select.waitFor({ state: "attached", timeout: ESPERA_MS });
  await definirSelect(select, servico);

  // 3) o campo "Total de classes" aparece; o padrão é 1 classe, que é o que o pedido usa
  await page.getByText("Total de classes", { exact: false }).first().waitFor({ state: "visible", timeout: ESPERA_MS });

  // 4) Confirmar leva à PRÉVIA (ainda não gera nada)
  await clicarSeguro(page, "Confirmar");
  await page.getByText("Valor total", { exact: false }).first().waitFor({ state: "visible", timeout: ESPERA_MS });

  // 5) leitura
  const texto = await textoDaPagina(page);
  const total = extrairValorTotal(texto);
  const linha = extrairLinhaDoServico(texto, servico);
  const lidoCentavos = total ?? linha?.valorCentavos ?? null;
  // Confere também que o serviço da prévia é o que pedimos (não outro por engano).
  const servicoCerto = linha !== null || new RegExp(`\\(${servico}\\)|\\b${servico}\\b`).test(texto);

  let captura = null;
  if (capturas) {
    mkdirSync(PASTA_CAPTURAS, { recursive: true });
    captura = join(PASTA_CAPTURAS, `${new Date().toISOString().replace(/[:.]/g, "-")}-gru-${servico}.png`);
    await page.screenshot({ path: captura, fullPage: true }).catch(() => {
      captura = null;
    });
  }

  // 6) sai da prévia sem gerar nada
  await page.goto(URL_INICIO, { waitUntil: "domcontentloaded", timeout: ESPERA_MS }).catch(() => undefined);

  const comparacao = compararValor({ lidoCentavos, esperadoCentavos });
  const ok = comparacao.ok && servicoCerto;
  return {
    servico,
    comDesconto,
    esperadoCentavos,
    lidoCentavos,
    ok,
    motivo: servicoCerto ? comparacao.motivo : "o serviço da prévia não é o pedido",
    captura,
    duracaoMs: Date.now() - inicio,
  };
}
