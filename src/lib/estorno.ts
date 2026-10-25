/**
 * Regra de devolução do MarcaSync, confirmada em 23/10/2026:
 *  - antes de a GRU ser paga ao INPI: volta tudo (serviço e valor da GRU);
 *  - GRU já paga ao INPI e pedido ainda não protocolado: voltam só os R$ 499 do serviço, porque
 *    a taxa paga ao INPI em regra não é devolvida;
 *  - pedido já protocolado: o serviço está concluído e nada volta.
 *
 * O AbacatePay só estorna a cobrança inteira, então serviço e GRU são cobranças separadas e
 * cada uma tem a sua decisão aqui.
 */

export interface SituacaoDoPedido {
  /** A GRU já foi paga ao INPI? */
  gruPagaAoInpi: boolean;
  /** O pedido já foi protocolado no e-Marcas? */
  protocolado: boolean;
}

export interface PlanoDeEstorno {
  servico: boolean;
  gru: boolean;
  motivo: string;
}

export function planoDeEstorno(s: SituacaoDoPedido): PlanoDeEstorno {
  if (s.protocolado) {
    return {
      servico: false,
      gru: false,
      motivo: "O pedido já foi protocolado: o serviço está concluído.",
    };
  }
  if (s.gruPagaAoInpi) {
    return {
      servico: true,
      gru: false,
      motivo: "A GRU já foi paga ao INPI e em regra não volta; devolvemos só o serviço.",
    };
  }
  return { servico: true, gru: true, motivo: "A GRU ainda não foi paga ao INPI: devolvemos tudo." };
}

/** Pode estornar este tipo de pagamento nesta situação? (monitoramento é combinado à parte) */
export function podeEstornar(tipo: string, s: SituacaoDoPedido): boolean {
  const plano = planoDeEstorno(s);
  if (tipo === "setup") return plano.servico;
  if (tipo === "gru") return plano.gru;
  // O pacote (serviço + taxa) só volta inteiro pela API enquanto a taxa não foi paga ao INPI.
  if (tipo === "pacote") return plano.servico && plano.gru;
  return false;
}

/**
 * O que fazer com o pagamento único (serviço + taxa do INPI), que o AbacatePay só estorna inteiro:
 *  - "total": a taxa ainda não foi paga ao INPI, então tudo volta, pelo estorno do AbacatePay;
 *  - "parcial_manual": a taxa já foi paga e não volta; só o serviço volta, e isso o AbacatePay não
 *    faz sozinho: você devolve o valor do serviço por Pix e registra no painel;
 *  - "nenhuma": o pedido já foi protocolado, o serviço está concluído.
 */
export type AcaoDoPacote = "total" | "parcial_manual" | "nenhuma";

export interface PlanoDoPacote {
  acao: AcaoDoPacote;
  /** Quanto devolver ao cliente (0 quando não há devolução). */
  devolverCentavos: number;
  motivo: string;
}

export function planoDoPacote(
  s: SituacaoDoPedido,
  valorPagoCentavos: number,
  servicoCentavos: number
): PlanoDoPacote {
  if (s.protocolado) {
    return {
      acao: "nenhuma",
      devolverCentavos: 0,
      motivo: "O pedido já foi protocolado: o serviço está concluído.",
    };
  }
  if (s.gruPagaAoInpi) {
    return {
      acao: "parcial_manual",
      devolverCentavos: Math.min(servicoCentavos, valorPagoCentavos),
      motivo:
        "A taxa já foi paga ao INPI e em regra não volta; devolvemos só o serviço. O AbacatePay não estorna parte do valor: devolva por Pix e registre no painel.",
    };
  }
  return {
    acao: "total",
    devolverCentavos: valorPagoCentavos,
    motivo: "A taxa ainda não foi paga ao INPI: devolvemos tudo.",
  };
}
