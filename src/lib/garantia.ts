/**
 * A garantia de devolução do MarcaSync, escrita uma vez para aparecer igual na página inicial,
 * no passo a passo, na tela de pagamento e nos Termos. A regra que o sistema aplica ao estornar
 * está em src/lib/estorno.ts; se uma mudar, a outra precisa mudar junto.
 */
export const GARANTIA_TITULO = "Garantia de devolução";

export const GARANTIA_CURTA =
  "Se não conseguirmos protocolar o seu pedido no INPI, o dinheiro volta por Pix.";

export const GARANTIA_REGRAS = [
  "Antes de pagarmos a taxa ao INPI: devolvemos tudo o que você pagou.",
  "Depois de pagarmos a taxa e antes do protocolo: devolvemos o valor do serviço. A taxa paga ao INPI, em regra, o próprio INPI não devolve.",
  "Depois do protocolo o serviço está concluído e não há devolução, mesmo que o INPI venha a indeferir o pedido: quem decide o registro é o INPI.",
] as const;
