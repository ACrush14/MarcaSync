import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/prazos/:id/concluir
 * Marca o prazo como cumprido (ex.: a procuração chegou assinada); ele deixa de gerar avisos.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.prazo.updateMany({
    where: { id, concluidoEm: null },
    data: { concluidoEm: new Date() },
  });
  if (r.count !== 1) {
    return NextResponse.json({ error: "Prazo não encontrado ou já concluído." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
