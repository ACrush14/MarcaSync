/**
 * Preços do produto, em centavos: fonte única para o que é cobrado, o que aparece no site
 * (landing, Plano, Termos) e o que vai na mensagem de WhatsApp. Os produtos do AbacatePay
 * (scripts/produtos-abacatepay.mjs) repetem estes números, e src/lib/precos.test.ts falha se
 * eles se afastarem: ao mudar um preço, mude lá também e rode o script de conferência.
 */
export const SETUP_CENTAVOS = 49_900;
export const MONITORAMENTO_CENTAVOS = 2_900;

/** "R$ 499" (sem os centavos quando são ",00"), para os textos de venda. */
export function fmtReaisCurto(centavos: number): string {
  return fmtReais(centavos).replace(/,00$/, "");
}

export function fmtReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
