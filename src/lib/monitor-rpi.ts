import { prisma } from "@/lib/db";
import { buscarProcessosNaEdicao, descobrirEdicaoMaisRecente } from "@/lib/inpi/fetch-rpi";

/** Prazo legal de oposição / manifestação: 60 dias da publicação (Lei 9.279/96, art. 158). */
const PRAZO_OPOSICAO_DIAS = 60;

export interface ResultadoMonitoramento {
  edicao: number;
  /** "ja-lida": nada a fazer · "sem-processos": ninguém monitorado ainda · "lida": edição lida agora. */
  situacao: "ja-lida" | "sem-processos" | "lida";
  verificados: number;
  encontrados: number;
  alertasNovos: number;
}

function parseDataBr(s: string | null): Date | null {
  const m = s?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  // Meio-dia UTC: evita virar o dia anterior ao exibir em fuso do Brasil.
  return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12));
}

function somarDias(d: Date, dias: number): Date {
  return new Date(d.getTime() + dias * 86_400_000);
}

/**
 * Lê a edição mais recente da RPI e grava um Alerta para cada despacho de
 * processo monitorado (monitoramento ligado + número real do INPI já
 * preenchido pelo /admin). Idempotente: edição já lida é pulada, e a chave
 * única do Alerta impede duplicata mesmo com `forcar`.
 *
 * Só baixa o .zip de ~65 MB quando existe ao menos um processo a verificar.
 */
export async function rodarMonitoramento(opts: { forcar?: boolean } = {}): Promise<ResultadoMonitoramento> {
  const edicao = await descobrirEdicaoMaisRecente();

  if (!opts.forcar && (await prisma.leituraRpi.findUnique({ where: { edicao: edicao.numero } }))) {
    return { edicao: edicao.numero, situacao: "ja-lida", verificados: 0, encontrados: 0, alertasNovos: 0 };
  }

  const monitorados = await prisma.processo.findMany({
    where: { monitoramento: true, numeroProcesso: { not: null } },
    select: { id: true, numeroProcesso: true },
  });
  const porNumero = new Map<string, string[]>();
  for (const p of monitorados) {
    const numero = p.numeroProcesso?.replace(/\D/g, "");
    if (!numero) continue;
    porNumero.set(numero, [...(porNumero.get(numero) ?? []), p.id]);
  }

  if (porNumero.size === 0) {
    return { edicao: edicao.numero, situacao: "sem-processos", verificados: 0, encontrados: 0, alertasNovos: 0 };
  }

  const { encontrados } = await buscarProcessosNaEdicao(edicao.numero, [...porNumero.keys()]);
  const dataEdicao = parseDataBr(edicao.data);

  const linhas = encontrados.flatMap((rp) =>
    (porNumero.get(rp.numero) ?? []).flatMap((processoId) =>
      rp.despachos.map((d) => {
        const oposicao = /oposi/i.test(d.nome);
        return {
          processoId,
          edicao: edicao.numero,
          dataEdicao,
          despachoCodigo: d.codigo,
          despachoNome: d.nome,
          tipo: oposicao ? "oposicao" : "despacho",
          prazoAte: oposicao && dataEdicao ? somarDias(dataEdicao, PRAZO_OPOSICAO_DIAS) : null,
        };
      })
    )
  );

  const criados = linhas.length ? await prisma.alerta.createMany({ data: linhas, skipDuplicates: true }) : { count: 0 };

  await prisma.leituraRpi.upsert({
    where: { edicao: edicao.numero },
    create: { edicao: edicao.numero, verificados: porNumero.size, encontrados: encontrados.length },
    update: { lidaEm: new Date(), verificados: porNumero.size, encontrados: encontrados.length },
  });

  return {
    edicao: edicao.numero,
    situacao: "lida",
    verificados: porNumero.size,
    encontrados: encontrados.length,
    alertasNovos: criados.count,
  };
}
