/**
 * O laço do robô: de tempos em tempos, pergunta ao site quais pedidos pagos precisam ter a GRU
 * conferida, confere cada um na prévia do e-INPI (só leitura) e conta o resultado ao site, que avisa
 * você. Também dá sinal de vida a cada rodada, para o painel saber que o robô está ligado.
 *
 * Nunca gera boleto e nunca paga: usa o mesmo `conferirServico` do ensaio, com as mesmas travas.
 * O token do robô fica só em robo/.env (fora do git) e só vai no cabeçalho Authorization.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ErroSessao, abrirEmissao, conferirServico } from "./gru.mjs";
import { abrirChrome } from "./navegador.mjs";
import { conferenciaComErro, enderecoDoSite, montarConferencia, tarefaValida } from "./logica.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const INTERVALO_MS = 5 * 60_000;
const ESPERA_LOGIN_MS = 5_000;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const hora = () => new Date().toLocaleTimeString("pt-BR");
const log = (msg) => console.log(`[${hora()}] ${msg}`);

export function carregarConfig() {
  const arquivo = join(RAIZ, ".env");
  if (existsSync(arquivo)) process.loadEnvFile(arquivo);
  const token = process.env.ROBO_TOKEN;
  if (!token) {
    throw new Error("Falta o ROBO_TOKEN. Crie o arquivo robo/.env com a linha ROBO_TOKEN=... (veja o README).");
  }
  const site = enderecoDoSite(process.env.MARCASYNC_URL ?? "https://www.marcasync.com.br");
  return { token, site };
}

/** Fala com o site. Sem redirecionamento (o token não pode seguir para outro endereço) e sem esperar para sempre. */
async function chamar(cfg, caminho, corpo) {
  const r = await fetch(`${cfg.site}${caminho}`, {
    method: corpo === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) {
    const dica = r.status === 401 ? " (token recusado: confira o ROBO_TOKEN)" : r.status === 503 ? " (o site ainda não tem o ROBO_TOKEN)" : "";
    throw new Error(`${caminho}: HTTP ${r.status}${dica}`);
  }
  return r.json();
}

async function darSinal(cfg, sessao, detalhe) {
  try {
    await chamar(cfg, "/api/robo/estado", { sessao, ...(detalhe ? { detalhe } : {}) });
  } catch (e) {
    log(`Não consegui dar sinal ao site: ${e instanceof Error ? e.message : e}`);
  }
}

/** Espera você entrar no e-INPI (na janela). Continua dando sinal de "sessão expirada" ao site. */
async function esperarLogin(cfg, pagina) {
  log("A sessão do e-INPI não está aberta. ENTRE NA JANELA DO CHROME DO ROBÔ (GOV.BR ou login e senha).");
  let ultimoSinal = 0;
  for (;;) {
    if (Date.now() - ultimoSinal > INTERVALO_MS || ultimoSinal === 0) {
      await darSinal(cfg, "expirada");
      ultimoSinal = Date.now();
    }
    await dormir(ESPERA_LOGIN_MS);
    try {
      await abrirEmissao(pagina);
      log("Login detectado. Voltando ao trabalho.");
      return;
    } catch (e) {
      if (!(e instanceof ErroSessao)) throw e;
    }
  }
}

/** Uma rodada: confere o que o site pediu. Devolve quantas tarefas fez. */
export async function rodada(cfg, pagina) {
  try {
    await abrirEmissao(pagina);
  } catch (e) {
    if (!(e instanceof ErroSessao)) throw e;
    await esperarLogin(cfg, pagina);
  }
  await darSinal(cfg, "ok");

  const { tarefas } = await chamar(cfg, "/api/robo/tarefas");
  const lista = Array.isArray(tarefas) ? tarefas.filter(tarefaValida) : [];
  if (lista.length === 0) {
    log("Nada para conferir.");
    return 0;
  }
  log(`${lista.length} pedido(s) para conferir.`);

  let feitas = 0;
  for (const tarefa of lista) {
    let conferencia;
    try {
      const r = await conferirServico(pagina, {
        servico: tarefa.servico,
        comDesconto: tarefa.comDesconto,
        esperadoCentavos: tarefa.esperadoCentavos,
        capturas: false,
      });
      conferencia = montarConferencia(tarefa, r);
    } catch (e) {
      if (e instanceof ErroSessao) {
        await esperarLogin(cfg, pagina);
        break; // a próxima rodada pega o que faltou
      }
      conferencia = conferenciaComErro(tarefa, e);
    }
    try {
      await chamar(cfg, `/api/robo/tarefas/${encodeURIComponent(tarefa.processoId)}/conferencia`, conferencia);
      log(`Pedido ${tarefa.processoId.slice(0, 8)}…: ${conferencia.resultado}`);
      feitas++;
    } catch (e) {
      log(`Não consegui contar o resultado ao site: ${e instanceof Error ? e.message : e}`);
    }
  }
  return feitas;
}

/** O programa: abre o Chrome visível e repete as rodadas até você fechar (Ctrl+C). */
export async function iniciar() {
  const cfg = carregarConfig();
  log(`Robô ligado. Site: ${cfg.site}. Ele só LÊ a GRU: não gera boleto e não paga.`);
  const { contexto, pagina } = await abrirChrome({ visivel: true, bloquearBoleto: true });
  let fechado = false;
  contexto.on("close", () => {
    fechado = true;
  });
  process.once("SIGINT", async () => {
    fechado = true;
    await contexto.close().catch(() => undefined);
    process.exit(0);
  });

  let falhasSeguidas = 0;
  while (!fechado) {
    try {
      await rodada(cfg, pagina);
      falhasSeguidas = 0;
    } catch (e) {
      if (fechado) break;
      falhasSeguidas++;
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
      log(`Erro na rodada: ${msg}`);
      await darSinal(cfg, "erro", msg.slice(0, 200));
    }
    // Depois de erros seguidos, espera mais (até 30 min) para não insistir à toa.
    await dormir(Math.min(INTERVALO_MS * (1 + falhasSeguidas), 30 * 60_000));
  }
  log("A janela do Chrome foi fechada: robô parado. Rode `npm run iniciar` para ligar de novo.");
  await darSinal(cfg, "erro", "A janela do Chrome do robô foi fechada.");
  return 1;
}
