import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/notificacoes
 * Os últimos avisos gerados pelo sistema, enviados ou só guardados no painel. Protegida por senha
 * em src/proxy.ts (rotas /api/admin/).
 */
export async function GET() {
  const avisos = await prisma.notificacao.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      processoId: true,
      destino: true,
      canal: true,
      assunto: true,
      texto: true,
      enviadaEm: true,
      erro: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ avisos });
}
