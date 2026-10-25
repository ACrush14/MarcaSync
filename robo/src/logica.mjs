/**
 * Regras do robô que não dependem do navegador: ler valores da tela, comparar com o esperado e
 * decidir o que o robô NUNCA pode clicar. Ficam à parte para serem testadas sem abrir o Chrome.
 */

/** "1.720,00" -> 172000 (centavos). Devolve null se não for um valor em reais. */
export function parseValorReais(texto) {
  const m = /^\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})\s*$/.exec(String(texto ?? ""));
  if (!m) return null;
  return Number(m[1].replace(/\./g, "")) * 100 + Number(m[2]);
}

export function formatarReais(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** O "Valor total" da prévia da GRU, em centavos. */
export function extrairValorTotal(textoDaPagina) {
  const m = /Valor\s+total:?\s*([\d.]+,\d{2})/i.exec(String(textoDaPagina ?? ""));
  return m ? parseValorReais(m[1]) : null;
}

/** Acha, na prévia, a linha do serviço pedido: o código e o valor dela. */
export function extrairLinhaDoServico(textoDaPagina, servico) {
  const texto = String(textoDaPagina ?? "");
  const i = texto.search(new RegExp(`(^|\\n)\\s*${servico}\\s*(\\n|$)`));
  if (i < 0) return null;
  const trecho = texto.slice(i, i + 600);
  const valores = trecho.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g);
  if (!valores) return null;
  return { codigo: String(servico), valorCentavos: parseValorReais(valores[0]) };
}

/** O valor lido bate com o esperado? Qualquer diferença, para menos ou para mais, é problema. */
export function compararValor({ lidoCentavos, esperadoCentavos }) {
  if (lidoCentavos == null) return { ok: false, motivo: "não consegui ler o valor na tela" };
  if (lidoCentavos === esperadoCentavos) return { ok: true, motivo: "bate com o esperado" };
  const dif = lidoCentavos - esperadoCentavos;
  return {
    ok: false,
    motivo: `valor diferente do esperado (${dif > 0 ? "+" : "-"}${formatarReais(Math.abs(dif))})`,
  };
}

/** A página mostra o formulário de login do e-INPI? */
export function naTelaDeLogin(textoDaPagina) {
  return /Formulário de login/i.test(String(textoDaPagina ?? ""));
}

/** A sessão está aberta (há o link "Sair do Sistema")? */
export function estaLogado(textoDaPagina) {
  return /Sair do Sistema/i.test(String(textoDaPagina ?? "")) && !naTelaDeLogin(textoDaPagina);
}

/**
 * Botões que o robô NUNCA aperta em modo ensaio: criam a guia ou levam ao pagamento. A trava vale
 * para o texto do botão; `urlProibida` é a segunda trava, na rede.
 */
const BOTAO_PROIBIDO = /gerar\s*boleto|pagamento\s*online|\bpagar\b|emitir|imprimir/i;
export function botaoProibido(nome) {
  return BOTAO_PROIBIDO.test(String(nome ?? ""));
}

/** Pedidos de rede que o robô derruba em modo ensaio (geração de boleto e pagamento online). */
const URL_PROIBIDA = /boleto|pagamento-?online|pagamentoonline/i;
export function urlProibida(url) {
  return URL_PROIBIDA.test(String(url ?? ""));
}

/** O que o robô espera ler na prévia da GRU para cada serviço, com o desconto de 50% (MEI) ou sem. */
export const GRU_CENTAVOS = {
  "389": { integral: 88_000, desconto: 44_000 },
  "394": { integral: 172_000, desconto: 86_000 },
};

export function valorEsperado(servico, comDesconto) {
  const linha = GRU_CENTAVOS[String(servico)];
  if (!linha) throw new Error(`Serviço desconhecido: ${servico}. Use 389 ou 394.`);
  return comDesconto ? linha.desconto : linha.integral;
}

/** Uma linha por serviço, para o resumo no terminal e no aviso. */
export function resumirResultado(r) {
  const lido = r.lidoCentavos == null ? "—" : formatarReais(r.lidoCentavos);
  return `GRU ${r.servico}: lido ${lido}, esperado ${formatarReais(r.esperadoCentavos)} → ${r.ok ? "OK" : `PROBLEMA (${r.motivo})`}`;
}
