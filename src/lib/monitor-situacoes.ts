import { prisma } from "@/lib/db";
import { verificarSituacao, type ResultadoSituacao } from "./monitor-situacao";
import { estaDevido, modoDoMonitoramento } from "./cadencia";

export interface ResumoSituacoes {
  /** Processos monitorados que ainda não estavam na vez (semanal ou mensal) e ficaram para depois. */
  adiados: number;
  verificados: number;
  primeiraVez: number;
  iguais: number;
  mudaram: number;
  naoAchados: number;
  erros: number;
}

const PAUSA_MS = 1500;

function pausar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verificarComRetentativa(processo: {
  id: string;
  numeroProcesso: string;
  situacaoInpi: string | null;
}): Promise<ResultadoSituacao | "erro"> {
  try {
    return await verificarSituacao(processo);
  } catch {}
  try {
    return await verificarSituacao(processo);
  } catch {
    return "erro";
  }
}

/**
 * Consulta a situação de cada processo monitorado que está na vez: a cada semana no modo semanal e
 * a cada mês no modo mensal (ver src/lib/cadencia.ts). A rotina roda todo dia, mas só mexe em quem
 * já completou o intervalo desde a última consulta.
 */
export async function verificarSituacoes(agora: Date = new Date()): Promise<ResumoSituacoes> {
  const todos = await prisma.processo.findMany({
    where: { monitoramento: true, numeroProcesso: { not: null } },
    select: {
      id: true,
      numeroProcesso: true,
      situacaoInpi: true,
      situacaoVerificadaEm: true,
      monitoramentoMensalDesde: true,
    },
  });
  const monitorados = todos.filter((p) =>
    estaDevido(modoDoMonitoramento(p), p.situacaoVerificadaEm, agora)
  );

  const resumo: ResumoSituacoes = {
    adiados: todos.length - monitorados.length,
    verificados: 0,
    primeiraVez: 0,
    iguais: 0,
    mudaram: 0,
    naoAchados: 0,
    erros: 0,
  };

  for (const p of monitorados) {
    if (!p.numeroProcesso) continue;

    const resultado = await verificarComRetentativa({
      id: p.id,
      numeroProcesso: p.numeroProcesso,
      situacaoInpi: p.situacaoInpi,
    });

    resumo.verificados++;
    switch (resultado) {
      case "primeira_vez":
        resumo.primeiraVez++;
        break;
      case "igual":
        resumo.iguais++;
        break;
      case "mudou":
        resumo.mudaram++;
        break;
      case "nao_achou":
        resumo.naoAchados++;
        break;
      case "erro":
        resumo.erros++;
        break;
    }

    await pausar(PAUSA_MS);
  }
  return resumo;
}
