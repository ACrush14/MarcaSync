/**
 * Prazos que correm contra um pedido de marca e a regra de quando avisar. Tudo aqui é função
 * pura (não toca no banco nem em relógio): quem chama passa a data de "agora".
 *
 * Fontes: Manual de Marcas do INPI (28/11/2025): a procuração entra no primeiro ato ou em até 60
 * dias do protocolo, senão o pedido é arquivado (art. 216, § 2º, da LPI); resumo em
 * docs/inpi-processo-de-registro.md.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

export interface PrazoNovo {
  tipo: "procuracao" | "exigencia_formal" | "manifestacao" | "outro";
  descricao: string;
  venceEm: Date;
}

export function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * DIA_MS);
}

/** Os prazos que nascem quando o pedido é protocolado. Hoje só a procuração (60 dias). */
export function prazosDoProtocolo(protocoladoEm: Date): PrazoNovo[] {
  return [
    {
      tipo: "procuracao",
      descricao:
        "Procuração assinada pelo cliente (até 60 dias do protocolo, senão o pedido é arquivado)",
      venceEm: somarDias(protocoladoEm, 60),
    },
  ];
}

/**
 * Dias que faltam, arredondando para cima: um prazo que vence daqui a 1 hora ainda tem "1 dia".
 * Negativo ou zero significa vencido.
 */
export function diasRestantes(venceEm: Date, agora: Date): number {
  return Math.ceil((venceEm.getTime() - agora.getTime()) / DIA_MS);
}

/** Os níveis de aviso, do mais distante ao vencido (0). */
export const NIVEIS_AVISO = [30, 7, 2, 0] as const;
export type NivelAviso = (typeof NIVEIS_AVISO)[number];

/**
 * Em que nível de aviso o prazo está agora: 30 (faltam até 30 dias), 7, 2 ou 0 (vencido);
 * null se ainda falta mais de 30 dias.
 */
export function nivelAtual(venceEm: Date, agora: Date): NivelAviso | null {
  const d = diasRestantes(venceEm, agora);
  if (d <= 0) return 0;
  if (d <= 2) return 2;
  if (d <= 7) return 7;
  if (d <= 30) return 30;
  return null;
}

/**
 * Precisa avisar agora? Só quando o prazo chegou a um nível MAIS URGENTE que o último avisado
 * (assim, cada nível sai uma vez, mesmo que a rotina rode todo dia). Prazo concluído não avisa.
 * Devolve o nível a avisar, ou null.
 */
export function avisoPendente(
  prazo: { venceEm: Date; concluidoEm: Date | null; ultimoAvisoDias: number | null },
  agora: Date
): NivelAviso | null {
  if (prazo.concluidoEm) return null;
  const nivel = nivelAtual(prazo.venceEm, agora);
  if (nivel === null) return null;
  if (prazo.ultimoAvisoDias === null || nivel < prazo.ultimoAvisoDias) return nivel;
  return null;
}

/** "5 de novembro de 2026", no fuso de Fortaleza, para os textos dos avisos. */
export function dataPorExtenso(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Fortaleza",
  });
}

/** O número do pedido que o e-Marcas devolve tem 9 dígitos. Aceita com pontos ou espaços. */
export function numeroPedidoValido(valor: string): string | null {
  const d = valor.replace(/\D/g, "");
  return /^\d{9}$/.test(d) ? d : null;
}
