import { BASE_MARCAS } from "./data";
import { similaridade } from "./fonetica";
import { inferNCL } from "./ncl";
import type { Analise, MarcaMatch } from "./types";

export function computeAnalysis(marca: string, descricao: string): Analise {
  const matches: MarcaMatch[] = BASE_MARCAS.map((m) => ({
    ...m,
    ...similaridade(marca, m.name),
  })).sort((a, b) => b.pct - a.pct);

  const ncl = inferNCL(descricao);
  const top = matches[0];

  if (!top) {
    throw new Error("Base de marcas vazia — impossível calcular colidência.");
  }

  return { matches, ncl, top };
}
