/**
 * O lado do site no trabalho do robô do e-INPI (que roda no computador do operador): quais pedidos
 * ele deve conferir, o que ele pode contar de volta e o que isso vira de aviso.
 *
 * O robô só LÊ a emissão da GRU (valor da prévia). Gerar o boleto e pagar ficam para depois e
 * sempre com a autorização do operador.
 */
import { segredoConfere } from "./segredo";

/** O resultado de uma conferência da GRU. */
export const RESULTADOS = ["ok", "divergente", "erro"] as const;
export type Resultado = (typeof RESULTADOS)[number];

export const SERVICOS = ["389", "394"] as const;
export type ServicoGru = (typeof SERVICOS)[number];

export const SESSOES = ["ok", "expirada", "erro"] as const;
export type SessaoRobo = (typeof SESSOES)[number];

/** Depois de uma conferência com problema, o robô só tenta de novo desse pedido passada esta espera. */
export const ESPERA_NOVA_TENTATIVA_MS = 60 * 60 * 1000;

/** Quantos pedidos o robô recebe por rodada. */
export const MAX_TAREFAS = 10;

/** O robô está "desligado" (sem sinal) depois de tanto tempo sem avisar. */
export const ROBO_SEM_SINAL_MS = 15 * 60 * 1000;

/**
 * O pedido vem com `Authorization: Bearer <ROBO_TOKEN>`? Sem a variável configurada, a resposta é
 * "desligado" (nunca "aberto").
 */
export function autorizarRobo(
  cabecalho: string | null,
  env: Record<string, string | undefined> = process.env
): "ok" | "negado" | "desligado" {
  const esperado = env.ROBO_TOKEN;
  if (!esperado) return "desligado";
  const enviado = cabecalho?.startsWith("Bearer ") ? cabecalho.slice(7) : null;
  return segredoConfere(enviado, esperado) ? "ok" : "negado";
}

export interface PedidoParaConferir {
  especificacaoLivre: boolean;
  gruComDesconto: boolean;
  gruCentavos: number;
}

/** O que o robô deve conferir para este pedido: o serviço da GRU e o valor que o site cobrou. */
export function tarefaDoPedido(p: PedidoParaConferir): {
  servico: ServicoGru;
  classes: 1;
  comDesconto: boolean;
  esperadoCentavos: number;
} {
  return {
    servico: p.especificacaoLivre ? "394" : "389",
    classes: 1,
    comDesconto: p.gruComDesconto,
    esperadoCentavos: p.gruCentavos,
  };
}

export interface EntradaConferencia {
  resultado?: unknown;
  servico?: unknown;
  esperadoCentavos?: unknown;
  lidoCentavos?: unknown;
  detalhe?: unknown;
}

export type ConferenciaValidada =
  | {
      ok: true;
      dados: {
        resultado: Resultado;
        servico: ServicoGru;
        esperadoCentavos: number;
        lidoCentavos: number | null;
        detalhe: string | null;
      };
    }
  | { ok: false; erro: string };

const centavos = (v: unknown) =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100_000_000;

/** Confere o que o robô mandou. Resultado "ok" só vale com o valor lido igual ao esperado. */
export function validarConferencia(e: EntradaConferencia): ConferenciaValidada {
  const resultado = RESULTADOS.find((r) => r === e.resultado);
  if (!resultado) return { ok: false, erro: "resultado inválido." };
  const servico = SERVICOS.find((s) => s === e.servico);
  if (!servico) return { ok: false, erro: "servico deve ser 389 ou 394." };
  if (!centavos(e.esperadoCentavos)) return { ok: false, erro: "esperadoCentavos inválido." };
  let lido: number | null = null;
  if (e.lidoCentavos !== undefined && e.lidoCentavos !== null) {
    if (!centavos(e.lidoCentavos)) return { ok: false, erro: "lidoCentavos inválido." };
    lido = e.lidoCentavos as number;
  }
  if (resultado === "ok" && lido !== e.esperadoCentavos) {
    return { ok: false, erro: 'resultado "ok" exige o valor lido igual ao esperado.' };
  }
  if (resultado === "divergente" && lido === null) {
    return { ok: false, erro: 'resultado "divergente" exige o valor lido.' };
  }
  let detalhe: string | null = null;
  if (e.detalhe !== undefined && e.detalhe !== null) {
    if (typeof e.detalhe !== "string") return { ok: false, erro: "detalhe inválido." };
    detalhe = e.detalhe.replace(/\p{Cc}/gu, " ").trim().slice(0, 500) || null;
  }
  return {
    ok: true,
    dados: { resultado, servico, esperadoCentavos: e.esperadoCentavos as number, lidoCentavos: lido, detalhe },
  };
}

export type EntradaEstado = { sessao?: unknown; detalhe?: unknown };

export function validarEstado(
  e: EntradaEstado
): { ok: true; sessao: SessaoRobo; detalhe: string | null } | { ok: false; erro: string } {
  const sessao = SESSOES.find((s) => s === e.sessao);
  if (!sessao) return { ok: false, erro: 'sessao deve ser "ok", "expirada" ou "erro".' };
  let detalhe: string | null = null;
  if (e.detalhe !== undefined && e.detalhe !== null) {
    if (typeof e.detalhe !== "string") return { ok: false, erro: "detalhe inválido." };
    detalhe = e.detalhe.replace(/\p{Cc}/gu, " ").trim().slice(0, 300) || null;
  }
  return { ok: true, sessao, detalhe };
}

function reais(c: number): string {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** A mensagem que você recebe depois de cada conferência. */
export function mensagemDaConferencia(
  marca: string,
  d: { resultado: Resultado; servico: ServicoGru; esperadoCentavos: number; lidoCentavos: number | null; detalhe: string | null }
): { assunto: string; texto: string } {
  if (d.resultado === "ok") {
    return {
      assunto: `Robô: GRU conferida (${marca})`,
      texto: `A GRU ${d.servico} do pedido de "${marca}" foi conferida no e-INPI: ${reais(d.lidoCentavos ?? 0)}, igual ao que o cliente pagou.\nNada foi gerado nem pago: o próximo passo é seu.`,
    };
  }
  if (d.resultado === "divergente") {
    return {
      assunto: `ATENÇÃO: GRU diferente do esperado (${marca})`,
      texto:
        `O e-INPI mostrou ${reais(d.lidoCentavos ?? 0)} para a GRU ${d.servico} de "${marca}", mas o cliente pagou ${reais(d.esperadoCentavos)}.\n` +
        `Provável causa: a natureza jurídica do cadastro do e-INPI que o robô usa não é a do titular (muda o desconto de 50%). Confira antes de emitir.`,
    };
  }
  return {
    assunto: `Robô: não consegui conferir a GRU (${marca})`,
    texto: `O robô não conseguiu conferir a GRU ${d.servico} de "${marca}"${d.detalhe ? `: ${d.detalhe}` : "."}\nEle tenta de novo em 1 hora.`,
  };
}

/** O que acontece quando a sessão do e-INPI do robô muda. */
export function mensagemDoEstado(sessao: SessaoRobo, detalhe: string | null): { assunto: string; texto: string } | null {
  if (sessao === "expirada") {
    return {
      assunto: "Robô: preciso que você entre no e-INPI",
      texto: "A sessão do e-INPI do robô expirou. Abra a janela do Chrome do robô, no seu computador, e entre na sua conta. Enquanto isso o robô não confere nada.",
    };
  }
  if (sessao === "erro") {
    return {
      assunto: "Robô: deu erro",
      texto: `O robô teve um erro${detalhe ? `: ${detalhe}` : "."}\nConfira o computador onde ele roda.`,
    };
  }
  return null;
}

/** Há quanto tempo o robô não dá sinal? */
export function roboSemSinal(vistoEm: Date | string | null, agora: Date = new Date()): boolean {
  if (!vistoEm) return true;
  const t = (vistoEm instanceof Date ? vistoEm : new Date(vistoEm)).getTime();
  return Number.isNaN(t) || agora.getTime() - t > ROBO_SEM_SINAL_MS;
}
