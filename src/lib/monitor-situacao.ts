import { prisma } from "@/lib/db";
import { consultarSituacao } from "./inpi/busca-client";

export type ResultadoSituacao = "nao_achou" | "primeira_vez" | "igual" | "mudou";

export async function verificarSituacao(processo: {
  id: string;
  numeroProcesso: string;
  situacaoInpi: string | null;
}): Promise<ResultadoSituacao> {
  const situacao = await consultarSituacao(processo.numeroProcesso);

  if (situacao === null) return "nao_achou";

  const agora = new Date();

  if (processo.situacaoInpi === null) {
    await prisma.$transaction([
      prisma.situacaoProcesso.create({
        data: { processoId: processo.id, situacao, origem: "consulta", vistaEm: agora },
      }),
      prisma.processo.update({
        where: { id: processo.id },
        data: { situacaoInpi: situacao, situacaoVerificadaEm: agora },
      }),
    ]);
    return "primeira_vez";
  }

  if (situacao === processo.situacaoInpi) {
    await prisma.processo.update({
      where: { id: processo.id },
      data: { situacaoVerificadaEm: agora },
    });
    return "igual";
  }

  await prisma.$transaction([
    prisma.situacaoProcesso.create({
      data: { processoId: processo.id, situacao, origem: "consulta", vistaEm: agora },
    }),
    prisma.alerta.create({
      data: {
        processoId: processo.id,
        tipo: "situacao",
        origem: "consulta",
        situacaoNova: situacao,
      },
    }),
    prisma.processo.update({
      where: { id: processo.id },
      data: { situacaoInpi: situacao, situacaoVerificadaEm: agora },
    }),
  ]);
  return "mudou";
}
