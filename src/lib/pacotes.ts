/**
 * O pagamento único: o serviço do MarcaSync e a taxa do INPI (GRU) numa cobrança só, paga por Pix
 * ou cartão na página do AbacatePay. Cada combinação de taxa (lista do INPI ou texto livre, com ou
 * sem desconto de 50%) é um produto já criado lá (scripts/produtos-abacatepay.mjs); aqui só se
 * escolhe qual cobrar. O preço sai do servidor, nunca do navegador.
 */
import { SETUP_CENTAVOS } from "./planos";

/** Até quantas parcelas o cartão aceita (a taxa do cartão por parcela fica com o MarcaSync). */
export const PARCELAS_MAX_CARTAO = 3;

export interface EscolhaPacote {
  /** Algum item da especificação não está na lista pré-aprovada (GRU 394). */
  especificacaoLivre: boolean;
  /** O titular tem o desconto de 50% na taxa do INPI. */
  comDesconto: boolean;
}

/** O `externalId` do produto do AbacatePay que cobra o serviço mais a taxa dessa combinação. */
export function produtoDoPacote(e: EscolhaPacote): string {
  const gru = e.especificacaoLivre ? "394" : "389";
  const faixa = e.comDesconto ? "desconto" : "integral";
  return `marcasync-registro-${gru}-${faixa}`;
}

/** O valor que o pacote deve ter: serviço mais a taxa do INPI. Usado para conferir o AbacatePay. */
export function valorDoPacote(gruCentavos: number): number {
  return SETUP_CENTAVOS + gruCentavos;
}

/** O endereço público do site, para o AbacatePay devolver o cliente depois de pagar. */
export function urlDoSite(): string {
  const u = process.env.SITE_URL?.trim();
  return (u && /^https?:\/\//.test(u) ? u : "https://www.marcasync.com.br").replace(/\/+$/, "");
}

/** A página para onde o cliente volta depois de pagar (e onde pode retomar o pagamento). */
export function urlDoPedido(processoId: string): string {
  return `${urlDoSite()}/pedido/${encodeURIComponent(processoId)}`;
}
