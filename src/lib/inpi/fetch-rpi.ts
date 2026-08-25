import { unzipSync } from "fflate";
import { parseProcessoBlock } from "./parse-rpi";
import type { RpiProcesso } from "./types";

/**
 * Cliente para a Revista da Propriedade Industrial (RPI) — Seção V (Marcas),
 * publicada oficialmente pelo INPI em revistas.inpi.gov.br/rpi. O próprio
 * índice descreve o XML como destinado a "uso através de aplicativos" — é o
 * canal correto para consumo automatizado, ao contrário do portal de busca.
 *
 * Validado em 25/08/2026 contra a edição real 2903: raiz `<revista numero=
 * "..." data="DD/MM/AAAA">`, processos como `<processo numero="...">` com
 * `<despachos><despacho codigo="IPASxxx" name="..."/></despachos>` e
 * `<titulares><titular nome-razao-social="..." pais=".." uf=".."/></titulares>`.
 * Encoding é UTF-8 mesmo (a declaração do XML não mente).
 */

export const RPI_INDEX_URL = "https://revistas.inpi.gov.br/rpi/";
const rpiZipUrl = (edicao: number): string => `https://revistas.inpi.gov.br/txt/RM${edicao}.zip`;

export interface RpiEdicaoRef {
  numero: number;
  data: string | null;
}

/** Descobre a edição mais recente publicada, lendo o índice público da RPI. */
export async function descobrirEdicaoMaisRecente(): Promise<RpiEdicaoRef> {
  const res = await fetch(RPI_INDEX_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Falha ao ler o índice da RPI (status ${res.status}).`);
  }
  const html = await res.text();

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let melhor: RpiEdicaoRef | null = null;
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(html))) {
    const row = match[1] ?? "";
    const rm = row.match(/RM(\d+)\.zip/);
    const edicaoStr = rm?.[1];
    if (!edicaoStr) continue;

    const numero = parseInt(edicaoStr, 10);
    const dataMatch = row.match(/(\d{2}\/\d{2}\/\d{4})/);
    const data = dataMatch?.[1] ?? null;

    if (!melhor || numero > melhor.numero) {
      melhor = { numero, data };
    }
  }

  if (!melhor) {
    throw new Error("Não foi possível localizar nenhuma edição da RPI no índice.");
  }
  return melhor;
}

// Cache em memória do processo -> XML decodificado, por edição. Só ajuda
// dentro de uma instância "quente" do servidor — não é uma estratégia de
// cache para produção (não sobrevive a cold start em serverless, não é
// compartilhado entre instâncias). Para produção: Redis/S3 com TTL de 1
// semana, chaveado pelo número da edição.
const xmlCache = new Map<number, string>();

async function obterXmlDaEdicao(edicao: number): Promise<string> {
  const cached = xmlCache.get(edicao);
  if (cached) return cached;

  const res = await fetch(rpiZipUrl(edicao), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Falha ao baixar a edição ${edicao} da RPI (status ${res.status}).`);
  }
  const zipBytes = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(zipBytes);

  const xmlEntryName = Object.keys(files).find((name) => name.toLowerCase().endsWith(".xml"));
  if (!xmlEntryName) {
    throw new Error(`O .zip da edição ${edicao} não contém nenhum arquivo .xml.`);
  }
  const xmlBytes = files[xmlEntryName];
  if (!xmlBytes) {
    throw new Error(`Entrada .xml vazia na edição ${edicao}.`);
  }

  const xml = new TextDecoder("utf-8").decode(xmlBytes);
  xmlCache.set(edicao, xml);
  return xml;
}

export interface BuscaRpiResultado {
  edicao: number;
  encontrados: RpiProcesso[];
  naoEncontrados: string[];
}

/**
 * Busca processos específicos dentro de uma edição da RPI.
 *
 * Decisão de performance deliberada: a edição descompactada tem ~65 MB e
 * dezenas de milhares de processos. Em vez de parsear o XML inteiro numa
 * árvore só para extrair meia dúzia de registros, localizamos cada bloco
 * `<processo numero="...">` por busca de substring e parseamos só esses
 * fragmentos pequenos — muito mais leve em memória.
 */
export async function buscarProcessosNaEdicao(
  edicao: number,
  numerosDesejados: string[]
): Promise<BuscaRpiResultado> {
  const xml = await obterXmlDaEdicao(edicao);

  const encontrados: RpiProcesso[] = [];
  const naoEncontrados: string[] = [];

  for (const numero of numerosDesejados) {
    const openTag = `<processo numero="${numero}">`;
    const start = xml.indexOf(openTag);
    if (start === -1) {
      naoEncontrados.push(numero);
      continue;
    }
    const closeTag = "</processo>";
    const end = xml.indexOf(closeTag, start);
    if (end === -1) {
      naoEncontrados.push(numero);
      continue;
    }

    const fragment = xml.slice(start, end + closeTag.length);
    const processo = parseProcessoBlock(fragment);
    if (processo) {
      encontrados.push(processo);
    } else {
      naoEncontrados.push(numero);
    }
  }

  return { edicao, encontrados, naoEncontrados };
}
