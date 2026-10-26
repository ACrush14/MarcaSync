import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { roboSemSinal } from "@/lib/robo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/robo
 *
 * Como está o robô: quando deu o último sinal e se a sessão do e-INPI dele está aberta. Protegida
 * por senha em src/proxy.ts (rotas /api/admin/).
 */
export async function GET() {
  const estado = await prisma.roboEstado.findUnique({ where: { id: "principal" } });
  return NextResponse.json({
    visto: estado !== null,
    vistoEm: estado?.vistoEm ?? null,
    sessao: estado?.sessao ?? null,
    detalhe: estado?.detalhe ?? null,
    semSinal: roboSemSinal(estado?.vistoEm ?? null),
    ligado: Boolean(process.env.ROBO_TOKEN),
  });
}
