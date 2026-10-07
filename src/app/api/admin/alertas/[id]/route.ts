import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/alertas/:id — marca o alerta como avisado ao cliente. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const alerta = await prisma.alerta.update({ where: { id }, data: { avisadoEm: new Date() } });
    return NextResponse.json({ alerta });
  } catch {
    return NextResponse.json({ error: "Alerta não encontrado." }, { status: 404 });
  }
}
