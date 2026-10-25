/**
 * Abre o Chrome do robô: visível, com um perfil só dele (robo/.perfil), onde o seu login do e-INPI
 * fica guardado. Assim você entra UMA vez e o robô reaproveita a sessão. A senha nunca passa por
 * aqui: quem digita é você, na janela do Chrome.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { urlProibida } from "./logica.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PERFIL = join(RAIZ, ".perfil");
export const PASTA_CAPTURAS = join(RAIZ, "ensaios");

// ROBO_SITE só existe para o teste local contra um site falso; em uso normal é sempre o do INPI.
export const SITE = process.env.ROBO_SITE ?? "https://meu.inpi.gov.br";
export const URL_GRU = `${SITE}/pag/gru/gerar`;
export const URL_INICIO = `${SITE}/pag/`;

/**
 * @param {{ visivel?: boolean, bloquearBoleto?: boolean, perfil?: string }} opcoes
 *   `bloquearBoleto`: derruba na rede qualquer pedido que gere boleto ou leve ao pagamento online
 *   (segunda trava, além de o robô nunca clicar nesses botões).
 */
export async function abrirChrome({ visivel = true, bloquearBoleto = true, perfil = PERFIL } = {}) {
  mkdirSync(perfil, { recursive: true });
  const contexto = await chromium.launchPersistentContext(perfil, {
    channel: "chrome", // o Chrome instalado no computador (nada de baixar outro navegador)
    headless: !visivel,
    viewport: null,
    args: ["--start-maximized"],
  });
  if (bloquearBoleto) {
    await contexto.route("**/*", (rota) =>
      urlProibida(rota.request().url()) ? rota.abort("blockedbyclient") : rota.continue()
    );
  }
  const pagina = contexto.pages()[0] ?? (await contexto.newPage());
  // Janelas de confirmação do site: nunca aceitamos nada por conta própria.
  pagina.on("dialog", (d) => d.dismiss().catch(() => undefined));
  return { contexto, pagina };
}
