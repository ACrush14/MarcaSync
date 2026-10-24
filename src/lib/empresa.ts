/**
 * Dados públicos da empresa que aparecem no rodapé e nas páginas legais. Vêm de variáveis de
 * ambiente NEXT_PUBLIC_* (são dados públicos, não segredos), para você preencher no Vercel sem
 * mexer no código. Enquanto uma variável estiver vazia, a linha correspondente não aparece.
 *
 *   NEXT_PUBLIC_EMPRESA_RAZAO_SOCIAL   ex.: "Fulano de Tal 12345678900"
 *   NEXT_PUBLIC_EMPRESA_CNPJ           ex.: "12.345.678/0001-90"
 *   NEXT_PUBLIC_EMAIL_CONTATO          ex.: "contato@marcasync.com.br"
 */
export const EMPRESA = {
  nomeFantasia: "MarcaSync",
  razaoSocial: (process.env.NEXT_PUBLIC_EMPRESA_RAZAO_SOCIAL ?? "").trim(),
  cnpj: (process.env.NEXT_PUBLIC_EMPRESA_CNPJ ?? "").trim(),
  emailContato: (process.env.NEXT_PUBLIC_EMAIL_CONTATO ?? "").trim(),
};

/** "MarcaSync, CNPJ 12.345.678/0001-90" (ou só o que estiver preenchido). */
export function linhaEmpresa(): string {
  const partes = [EMPRESA.razaoSocial || EMPRESA.nomeFantasia];
  if (EMPRESA.cnpj) partes.push(`CNPJ ${EMPRESA.cnpj}`);
  return partes.join(", ");
}
