import type { RiskTier, Similaridade } from "./types";

/**
 * Redução fonética simplificada para nomes de marca em PT-BR.
 *
 * Não é um Soundex/Metaphone formal — é uma heurística deliberadamente
 * pequena que colapsa os pares de grafias mais comuns que soam igual em
 * português (ex.: "Kaza"/"Casa", "Ph"/"F", "Qu"/"K"), o suficiente para
 * demonstrar por que a busca de anterioridade não pode ser apenas
 * comparação de string exata. Um motor de produção substituiria isto por
 * um algoritmo revisado por um linguista e validado contra decisões reais
 * de indeferimento do INPI.
 */
export function foneticaBR(input: string): string {
  let s = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

  s = s
    .replace(/ph/g, "f")
    .replace(/lh/g, "L")
    .replace(/nh/g, "N")
    .replace(/ch/g, "X")
    .replace(/qu/g, "k")
    .replace(/gu(?=[ei])/g, "g")
    .replace(/c(?=[ei])/g, "s")
    .replace(/c/g, "k")
    .replace(/ç/g, "s")
    .replace(/z/g, "s")
    .replace(/x/g, "s")
    .replace(/y/g, "i")
    .replace(/w/g, "v")
    .replace(/h/g, "")
    .replace(/([a-z])\1+/g, "$1");

  return s;
}

/** Distância de Levenshtein clássica, O(m·n), suficiente para nomes curtos. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

/**
 * Similaridade fonética entre duas marcas, em percentual (0–100).
 *
 * A proporção crua `1 - distância/tamanho` trata uma marca que é prefixo
 * exata da outra com desconto proporcional só ao tamanho do que sobra —
 * "Ronaldo" vs. "Ronaldo Soluções" dava 47% (a palavra extra "Soluções"
 * "custava" só 8 dos 15 caracteres). Isso está errado: uma palavra inteira
 * a mais muda o nome como um todo, não é um desconto de alguns caracteres.
 * "Kazamarela" vs. "Casa Amarela", por outro lado, tem que continuar dando
 * quase 100% — é o mesmo conteúdo sonoro, só escrito com espaço diferente.
 *
 * Elevar a proporção ao quadrado resolve os dois casos com a mesma fórmula,
 * sem precisar de lista de palavras genéricas nem separar por espaço: uma
 * sobreposição quase total (0.9+) muda pouco ao quadrar, uma sobreposição
 * parcial (0.4–0.7, o caso típico de "nome + palavra extra") cai bem mais —
 * validado contra "Ronaldo"/"Ronaldo Soluções" (47%→22%, risco baixo, como
 * devia ser) e "Kazamarela"/"Casa Amarela" (100%→100%, inalterado).
 */
export function similaridade(a: string, b: string): Similaridade {
  const fa = foneticaBR(a);
  const fb = foneticaBR(b);
  const dist = levenshtein(fa, fb);
  const maxLen = Math.max(fa.length, fb.length, 1);
  const proporcao = Math.max(0, 1 - dist / maxLen);
  const pct = Math.round(proporcao * proporcao * 100);
  return { fa, fb, pct };
}

export function riskTier(pct: number): RiskTier {
  if (pct >= 60) return { tier: "alto", cls: "risk", label: "Risco alto" };
  if (pct >= 30) return { tier: "moderado", cls: "warm", label: "Risco moderado" };
  return { tier: "baixo", cls: "safe", label: "Risco baixo" };
}
