import { XMLParser } from "fast-xml-parser";
import type { RpiDespacho, RpiProcesso, RpiTitular } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (name) => name === "despacho" || name === "titular",
});

interface RawDespacho {
  codigo?: unknown;
  name?: unknown;
}

interface RawTitular {
  "nome-razao-social"?: unknown;
  pais?: unknown;
  uf?: unknown;
}

interface RawProcesso {
  numero?: unknown;
  despachos?: { despacho?: RawDespacho[] };
  titulares?: { titular?: RawTitular[] };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asStringOrNull(value: unknown): string | null {
  const s = asString(value);
  return s.length > 0 ? s : null;
}

/**
 * Parseia um único fragmento `<processo numero="...">...</processo>`.
 *
 * Deliberadamente não parseia o documento inteiro — ver `fetch-rpi.ts` para
 * o motivo (arquivo de ~65 MB, dezenas de milhares de registros).
 */
export function parseProcessoBlock(xmlFragment: string): RpiProcesso | null {
  let parsed: { processo?: RawProcesso };
  try {
    parsed = parser.parse(xmlFragment) as { processo?: RawProcesso };
  } catch {
    return null;
  }

  const p = parsed.processo;
  if (!p) return null;

  const despachos: RpiDespacho[] = (p.despachos?.despacho ?? [])
    .filter((d): d is RawDespacho => Boolean(d))
    .map((d) => ({ codigo: asString(d.codigo), nome: asString(d.name) }));

  const titulares: RpiTitular[] = (p.titulares?.titular ?? [])
    .filter((t): t is RawTitular => Boolean(t))
    .map((t) => ({
      nomeRazaoSocial: asString(t["nome-razao-social"]),
      pais: asStringOrNull(t.pais),
      uf: asStringOrNull(t.uf),
    }));

  return { numero: asString(p.numero), despachos, titulares };
}
