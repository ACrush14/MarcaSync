/**
 * Comandos do robô:
 *   npm run ensaio   abre o Chrome do robô, espera você entrar no e-INPI (se ainda não estiver), e na
 *                    MESMA janela confere os valores do 389 e do 394 na prévia da GRU, sem gerar nada
 *   npm run login    só abre a janela para você entrar (o e-INPI usa um cookie de sessão: ao fechar a
 *                    janela o login se perde, por isso o ensaio faz o login e a conferência juntos)
 *                    (--sem-desconto: o cadastro NÃO é MEI/ME/EPP, então o esperado é o valor cheio)
 */
import { ErroSessao, conferirServico } from "./gru.mjs";
import { URL_GRU, abrirChrome } from "./navegador.mjs";
import { estaLogado, resumirResultado } from "./logica.mjs";

const [comando, ...args] = process.argv.slice(2);

/** Espera você entrar na conta (na janela). Devolve true se entrou, false se o tempo acabou. */
async function aguardarLogin(pagina, minutos = 10) {
  await pagina.goto(URL_GRU, { waitUntil: "domcontentloaded" });
  const limite = Date.now() + minutos * 60_000;
  let avisou = false;
  while (Date.now() < limite) {
    const texto = await pagina.locator("body").innerText().catch(() => "");
    if (estaLogado(texto)) return true;
    if (!avisou) {
      console.log("\nA conta do e-INPI ainda não está aberta. ENTRE NA JANELA DO CHROME que abriu (GOV.BR ou login e senha).");
      console.log(`Eu espero até ${minutos} minutos. A sua senha não passa por este programa.`);
      avisou = true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

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
    if (!(await aguardarLogin(pagina))) {
      console.log("\nTempo esgotado sem login. Rode `npm run ensaio` de novo.");
      return 2;
    }
    console.log("\nLogin detectado.");
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
