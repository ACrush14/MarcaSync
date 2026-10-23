/**
 * Deixa um termo comparável: sem acento, em minúsculas, sem o asterisco de nota do INPI e
 * com os espaços normalizados. Como ler: "Bolos*" e "bolos" viram a mesma chave, "bolos".
 * Fica num arquivo próprio e pequeno para o navegador usar sem baixar o catálogo inteiro.
 */
export function normalizarTermo(termo: string): string {
  return termo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
