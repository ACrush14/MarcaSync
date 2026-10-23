import { agruparPorArea } from "./classes";

/**
 * Risco de colisão olhando o ramo (a classe de Nice) das marcas parecidas.
 *
 * Por que não existe uma fórmula com "peso de outro ramo": qualquer número, como
 * "uma marca de outro ramo vale 60%", seria inventado, e o INPI também compara
 * classes relacionadas. Em vez disso, mostramos separado o que dá para afirmar:
 *   - `noRamo`: a mais parecida entre as marcas da MESMA classe que a do cliente;
 *   - `incerta`: a mais parecida entre as marcas sem classe informada (não dá para
 *     descartar que sejam do mesmo ramo, então entram no risco principal);
 *   - `outrosRamos`: a mais parecida entre as de OUTRA classe (informativo).
 *
 * `principal` é a que define o nível de colisão mostrado: a mais parecida entre
 * `noRamo` e `incerta`, ou seja, entre as que NÃO dá para descartar.
 *
 * `modo: "geral"` quer dizer que não havia como separar por ramo (descrição vaga,
 * sem sugestão confiável de classe): nesse caso `principal` é simplesmente a marca
 * mais parecida de todas, como antes da separação por ramo.
 */
export interface RiscoPorArea<T> {
  modo: "por-ramo" | "geral";
  principal: T | null;
  noRamo: T | null;
  incerta: T | null;
  outrosRamos: T | null;
}

/** A de maior semelhança da lista (em empate, a que veio primeiro). null se a lista é vazia. */
function maisParecida<T extends { pct: number }>(lista: T[]): T | null {
  let melhor: T | null = null;
  for (const m of lista) {
    if (melhor === null || m.pct > melhor.pct) melhor = m;
  }
  return melhor;
}

export function calcularRisco<T extends { pct: number; mesmaArea?: boolean | null }>(
  matches: T[]
): RiscoPorArea<T> {
  const grupos = agruparPorArea(matches);

  if (!grupos.separavel) {
    return {
      modo: "geral",
      principal: maisParecida(matches),
      noRamo: null,
      incerta: null,
      outrosRamos: null,
    };
  }

  const noRamo = maisParecida(grupos.mesmaArea);
  const incerta = maisParecida(grupos.semClasse);
  const outrosRamos = maisParecida(grupos.outrasAreas);
  // Em empate de porcentagem, vale a confirmada (noRamo), que vem primeiro na lista.
  const principal = maisParecida([noRamo, incerta].filter((m): m is T => m !== null));

  return { modo: "por-ramo", principal, noRamo, incerta, outrosRamos };
}

/**
 * Porcentagem de risco para guardar no pedido (Processo.riscoPct): a da marca
 * `principal`. Se separamos por ramo e não há nenhuma que não dê para descartar,
 * guarda 0, porque o risco no ramo do cliente é nulo pelo que a base mostra.
 */
export function pctDoRisco<T extends { pct: number }>(risco: RiscoPorArea<T>): number {
  return risco.principal?.pct ?? 0;
}
