import { prisma } from "@/lib/db";
import { foneticaBR, similaridade } from "./fonetica";
import { descreverSituacao } from "./situacoes-inpi";
import type { ColidenciaMatch } from "./colidencia";

/**
 * Busca por som na cópia local da base de dados abertos do INPI (tabela
 * MarcaInpi, ver scripts/ingerir-marcas.mjs).
 *
 * A busca textual do INPI devolve os resultados que ELA acha mais relevantes;
 * uma grafia diferente ("Nubanc" para "Nubank") pode ficar de fora do top 10.
 * Aqui os candidatos são escolhidos pela chave fonética (foneticaBR), só com
 * índice de banco, sem varrer a tabela:
 *   1. mesma chave, ou a 1 edição de distância (troca, falta ou sobra de letra);
 *   2. chave de uma marca existente que seja começo da nossa ("Nubank" já
 *      registrada vs. "Nubank Pay" que o cliente quer);
 *   3. chaves que COMEÇAM com a nossa (o cliente quer "Nubank", existe "Nubank Pay").
 * Marcas a 2+ edições de distância não entram como candidatas — limite
 * conhecido; a busca ao vivo do INPI continua cobrindo parte desse caso.
 */

const ALFABETO = "abcdefghijklmnopqrstuvwxyzLNX"; // alfabeto da saída de foneticaBR
const MAX_VARIANTES = 2500;

function candidatasPorChave(k: string): string[] {
  const set = new Set<string>([k]);

  // prefixos de pelo menos 4 letras (marca existente mais curta, contida na nossa)
  for (let i = 4; i < k.length; i++) set.add(k.slice(0, i));

  // 1 edição: remoção, troca, inserção
  if (k.length <= 18) {
    for (let i = 0; i < k.length; i++) {
      set.add(k.slice(0, i) + k.slice(i + 1));
      for (const c of ALFABETO) if (c !== k[i]) set.add(k.slice(0, i) + c + k.slice(i + 1));
    }
    for (let i = 0; i <= k.length; i++) {
      for (const c of ALFABETO) set.add(k.slice(0, i) + c + k.slice(i));
    }
  }
  return [...set].filter((s) => s.length >= 2).slice(0, MAX_VARIANTES);
}

export interface InfoBaseLocal {
  total: number;
  /** Data (ISO) em que o INPI atualizou o arquivo; null se desconhecida. */
  atualizadaEm: string | null;
}

/** null = base local ainda não foi carregada (nenhuma ingestão concluída). */
export async function infoBaseLocal(): Promise<InfoBaseLocal | null> {
  const ult = await prisma.ingestaoMarcas.findFirst({ orderBy: { lote: "desc" } });
  if (!ult) return null;
  const data = ult.fonteAtualizada ? new Date(ult.fonteAtualizada) : null;
  return {
    total: ult.total,
    atualizadaEm: data && !Number.isNaN(data.getTime()) ? data.toISOString() : null,
  };
}

export async function buscarMarcasLocais(marca: string): Promise<ColidenciaMatch[]> {
  const k = foneticaBR(marca);
  if (k.length < 3) return [];

  const [parecidas, comecaCom] = await Promise.all([
    prisma.marcaInpi.findMany({ where: { chave: { in: candidatasPorChave(k) } }, take: 500 }),
    k.length >= 4
      ? prisma.marcaInpi.findMany({ where: { chave: { startsWith: k } }, take: 200 })
      : Promise.resolve([]),
  ]);

  const porNumero = new Map([...parecidas, ...comecaCom].map((r) => [r.numero, r]));

  return [...porNumero.values()].map((r) => {
    const sim = similaridade(marca, r.nome);
    return {
      nome: r.nome,
      classe: r.classes ? r.classes.replaceAll(",", ", ") : null,
      pct: sim.pct,
      fa: sim.fa,
      fb: sim.fb,
      fonte: "real" as const,
      origem: "base-local" as const,
      numeroProcesso: r.numero,
      status: descreverSituacao(r.situacao),
    };
  });
}
