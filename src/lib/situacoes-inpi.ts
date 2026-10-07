/** Descrição das situações (códigos IPAS) que a base local guarda — vem da lista oficial do INPI. */
const SITUACOES: Record<string, string> = {
  IPAS023: "Registro de marca em vigor",
  IPAS506: "Registro de marca em vigor (Madri)",
  IPAS006: "Aguardando prazo de apresentação de oposição",
  IPAS089: "Aguardando manifestação sobre oposição",
  IPAS019: "Aguardando apresentação ou exame de recurso contra o indeferimento",
  IPAS513: "Aguardando exame de recurso contra o indeferimento de designação (Madri)",
  IPAS016: "Aguardando cumprimento de exigência de mérito",
  IPAS697: "Aguardando processamento da concessão do registro de marca",
  IPAS102: "Aguardando fim de sobrestamento",
  IPAS209: "Para liberar para exame de mérito (sem oposição)",
  IPAS210: "Para liberar para exame de mérito (com oposição)",
  IPAS278: "Aguardando recurso contra cancelamento de ofício de registro",
  "60": "Registro",
  "21": "Pedido em prazo de recurso",
};

export function descreverSituacao(codigo: string): string {
  return SITUACOES[codigo] ?? `Situação ${codigo}`;
}
