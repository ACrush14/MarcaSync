import { similaridade } from "./fonetica";
import { computeAnalysis } from "./analysis";
import { buscarMarcas } from "./inpi/busca-client";
import { inferNCL } from "./ncl";
import { buscarMarcasLocais, infoBaseLocal } from "./marcas-locais";
import type { InferenciaNCL } from "./types";

/**
 * Junta a busca de anterioridade real (base real do INPI) com a
 * demonstração fonética de exemplo (BASE_MARCAS) num único resultado —
 * antes eram dois blocos desconectados no passo "Resultado": um score de
 * "risco" calculado só contra 14 marcas fictícias, e uma busca real ao lado
 * que não alimentava nada.
 *
 * Regra de decisão, e por que ela não é "cai pro demo sempre que a busca
 * real não achar nada":
 *
 *   - Busca real respondeu (mesmo com zero resultados) → usa ela. Zero
 *     resultados reais é uma informação boa e verdadeira (nenhuma marca
 *     parecida registrada), não uma falha — trocar isso por dados
 *     fictícios seria mentir pro usuário bem na hora que ele mais precisa
 *     de um "sim" confiável.
 *   - Busca real falhou de verdade (rede, timeout, schema mudou) → só aí
 *     cai pro demo, com aviso explícito de que o número mostrado não é
 *     risco real. Ver `src/lib/inpi/busca-client.ts` para os motivos pelos
 *     quais essa API pode falhar (não documentada, sem SLA).
 */

export type FonteColidencia = "real" | "demo";

export interface ColidenciaMatch {
  nome: string;
  classe: string | null;
  pct: number;
  fa: string;
  fb: string;
  fonte: FonteColidencia;
  /** De onde veio o registro: busca ao vivo do INPI ou cópia local dos dados abertos. */
  origem?: "inpi-busca" | "base-local";
  numeroProcesso?: string;
  status?: string;
  titular?: string;
}

export interface ColidenciaResultado {
  fonte: FonteColidencia;
  termo: string;
  matches: ColidenciaMatch[];
  top: ColidenciaMatch | null;
  ncl: InferenciaNCL;
  /** Presente quando a cópia local dos dados abertos do INPI participou da análise. */
  baseLocal?: { atualizadaEm: string | null; usadaSozinha: boolean };
  /** Só presente quando fonte === "demo" — explica por que caiu pro fallback. */
  avisoFonteReal?: string;
}

export async function calcularColidencia(
  marca: string,
  descricao: string
): Promise<ColidenciaResultado> {
  const ncl = inferNCL(descricao);

  const [ao_vivo, local, info] = await Promise.allSettled([
    buscarMarcas(marca, 1, 10),
    buscarMarcasLocais(marca),
    infoBaseLocal(),
  ]);

  const matchesVivos: ColidenciaMatch[] =
    ao_vivo.status === "fulfilled"
      ? ao_vivo.value.resultados.map((r) => {
          const sim = similaridade(marca, r.marca);
          return {
            nome: r.marca,
            classe: r.classificacao,
            pct: sim.pct,
            fa: sim.fa,
            fb: sim.fb,
            fonte: "real" as const,
            origem: "inpi-busca" as const,
            numeroProcesso: r.numeroProcesso,
            status: r.status,
            titular: r.titulares[0]?.nome,
          };
        })
      : [];

  const baseLocal = info.status === "fulfilled" ? info.value : null;
  const matchesLocais = local.status === "fulfilled" && baseLocal ? local.value : [];

  if (ao_vivo.status === "fulfilled" || (baseLocal && local.status === "fulfilled")) {
    // Mesmo processo nas duas fontes: vale o registro ao vivo (status mais fresco).
    const porProcesso = new Map<string, ColidenciaMatch>();
    for (const m of [...matchesLocais, ...matchesVivos]) {
      porProcesso.set(m.numeroProcesso ?? `${m.nome}-${porProcesso.size}`, m);
    }
    const matches = [...porProcesso.values()].sort((a, b) => b.pct - a.pct).slice(0, 10);

    return {
      fonte: "real",
      termo: marca,
      matches,
      top: matches[0] ?? null,
      ncl,
      ...(baseLocal && local.status === "fulfilled"
        ? {
            baseLocal: {
              atualizadaEm: baseLocal.atualizadaEm,
              usadaSozinha: ao_vivo.status !== "fulfilled",
            },
          }
        : {}),
    };
  }

  const err = ao_vivo.status === "rejected" ? ao_vivo.reason : null;
  const demo = computeAnalysis(marca, descricao);
  const matches: ColidenciaMatch[] = demo.matches.map((m) => ({
    nome: m.name,
    classe: m.cls,
    pct: m.pct,
    fa: m.fa,
    fb: m.fb,
    fonte: "demo" as const,
  }));

  return {
    fonte: "demo",
    termo: marca,
    matches,
    top: matches[0] ?? null,
    ncl,
    avisoFonteReal: `A busca real no INPI não respondeu agora (${
      err instanceof Error ? err.message : "erro desconhecido"
    }). O resultado abaixo é uma demonstração com dados de exemplo — não reflete risco real. Tente de novo em instantes.`,
  };
}
