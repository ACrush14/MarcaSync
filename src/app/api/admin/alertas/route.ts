import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/alertas — protegido por Basic Auth em src/proxy.ts. Não avisados primeiro. */
export async function GET() {
  const [alertas, ultimaLeitura] = await Promise.all([
    prisma.alerta.findMany({
      orderBy: [{ avisadoEm: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
      take: 100,
      include: { processo: { include: { cliente: true } } },
    }),
    prisma.leituraRpi.findFirst({ orderBy: { edicao: "desc" } }),
  ]);
  return NextResponse.json({ alertas, ultimaLeitura });
}
