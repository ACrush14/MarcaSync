/**
 * Preços do produto, em centavos — fonte única para o que é gravado em
 * Pagamento (MarcaSyncApp) e o que vai escrito na mensagem de WhatsApp
 * (whatsapp.ts). Os textos de marketing (landing, PlanoStep) ainda repetem
 * "R$ 499" / "R$ 29" na mão: ao mudar o preço, mude lá também.
 */
export const SETUP_CENTAVOS = 49_900;
export const MONITORAMENTO_CENTAVOS = 2_900;

export function fmtReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
