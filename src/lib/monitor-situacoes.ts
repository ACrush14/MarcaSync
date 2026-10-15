import { prisma } from "@/lib/db";
import { verificarSituacao, type ResultadoSituacao } from "./monitor-situacao";

export interface ResumoSituacoes {
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

export async function verificarSituacoes(): Promise<ResumoSituacoes> {
  const monitorados = await prisma.processo.findMany({
    where: { monitoramento: true, numeroProcesso: { not: null } },
    select: { id: true, numeroProcesso: true, situacaoInpi: true },
  });

  const resumo: ResumoSituacoes = {
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
