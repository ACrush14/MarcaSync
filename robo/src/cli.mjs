/**
 * Comandos do robô:
 *   npm run login    abre o Chrome do robô para você entrar no e-INPI (uma vez; a sessão fica)
 *   npm run ensaio   confere na tela da GRU os valores do 389 e do 394 e sai, sem gerar nada
 *                    (--sem-desconto: o cadastro NÃO é MEI/ME/EPP, então o esperado é o valor cheio)
 */
import { ErroSessao, abrirEmissao, conferirServico } from "./gru.mjs";
import { URL_GRU, abrirChrome } from "./navegador.mjs";
import { estaLogado, resumirResultado } from "./logica.mjs";

const [comando, ...args] = process.argv.slice(2);

async function login() {
  const { contexto, pagina } = await abrirChrome({ visivel: true, bloquearBoleto: true });
  console.log("");
  console.log("Uma janela do Chrome abriu na página da GRU do e-INPI.");
  console.log("Entre na sua conta (GOV.BR ou login e senha) NA JANELA. Eu espero até 10 minutos.");
  console.log("A sua senha não passa por este programa: o Chrome guarda só a sessão.");
  await pagina.goto(URL_GRU, { waitUntil: "domcontentloaded" });
  const limite = Date.now() + 10 * 60_000;
  while (Date.now() < limite) {
    const texto = await pagina.locator("body").innerText().catch(() => "");
    if (estaLogado(texto)) {
      console.log("\nLogin feito e salvo no perfil do robô. Pode fechar esta janela (ou aguarde: ela fecha sozinha).");
      await new Promise((r) => setTimeout(r, 3000));
      await contexto.close();
      return 0;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("\nTempo esgotado sem login. Rode `npm run login` de novo.");
  await contexto.close();
  return 1;
}

async function ensaio() {
  const comDesconto = !args.includes("--sem-desconto");
  const { contexto, pagina } = await abrirChrome({ visivel: true, bloquearBoleto: true });
  try {
    await abrirEmissao(pagina);
    console.log(`\nEnsaio da GRU (cadastro ${comDesconto ? "COM" : "SEM"} desconto de 50%). Nada será gerado nem pago.\n`);
    const resultados = [];
    for (const servico of ["389", "394"]) {
      const r = await conferirServico(pagina, { servico, comDesconto });
      resultados.push(r);
      console.log(resumirResultado(r));
      if (r.captura) console.log(`   captura: ${r.captura}`);
    }
    const tudoOk = resultados.every((r) => r.ok);
    console.log(tudoOk ? "\nTudo certo: os valores da tela batem com o que o site cobra." : "\nATENÇÃO: há valor diferente do esperado. Confira antes de ligar o robô de verdade.");
    return tudoOk ? 0 : 1;
  } catch (e) {
    if (e instanceof ErroSessao) {
      console.log(`\n${e.message}`);
      return 2;
    }
    console.error("\nO ensaio falhou:", e instanceof Error ? e.message : e);
    return 3;
  } finally {
    await contexto.close().catch(() => undefined);
  }
}

const codigo =
  comando === "login" ? await login() : comando === "ensaio" ? await ensaio() : (console.log("Use: npm run login | npm run ensaio"), 64);
process.exit(codigo);
