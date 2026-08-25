import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ConfirmarPagamentoBody {
  via?: string;
  notas?: string;
}

/**
 * POST /api/pagamentos/:id/confirmar
 *
 * Marca um pagamento como confirmado — hoje é sempre você clicando depois
 * que o cliente avisa por WhatsApp, não uma confirmação automática de
 * banco. `via` fica registrado pra auditoria (ex.: "whatsapp").
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as ConfirmarPagamentoBody;

  try {
    const pagamento = await prisma.pagamento.update({
      where: { id },
      data: {
        status: "confirmado",
        confirmadoEm: new Date(),
        confirmadoVia: body.via?.trim() || "whatsapp",
        notas: body.notas?.trim() || undefined,
      },
    });
    return NextResponse.json({ pagamento });
  } catch {
    return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
  }
}
