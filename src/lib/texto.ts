/**
 * Limpa um texto digitado pelo visitante antes de validar e gravar.
 *
 *  - quebras de linha e tabulações viram espaço, e espaços repetidos viram um só;
 *  - caracteres de controle (inclusive o NUL, que o Postgres recusa e derrubaria a gravação) e
 *    caracteres invisíveis de formatação (largura zero, inversão de direção do texto) são removidos:
 *    com eles, "\u200b\u200b\u200b" passaria como um nome de três letras que não se vê;
 *  - o que não é texto vira "".
 */
export function limparTexto(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/\p{Cc}/gu, " ")
    .replace(/[\p{Cf}\p{Cs}\p{Co}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
