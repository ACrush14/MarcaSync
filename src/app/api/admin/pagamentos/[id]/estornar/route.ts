import { NextResponse } from "next/server";
import { ErroEstorno, estornarPagamento } from "@/lib/cobranca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/pagamentos/:id/estornar   { motivo?: string, forcar?: boolean }
 *
 * Estorna um pagamento confirmado pelo AbacatePay seguindo a regra de devolução (ver
 * src/lib/estorno.ts). Protegida por senha em src/proxy.ts (rotas /api/admin/).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const corpo = (await request.json().catch(() => ({}))) as { motivo?: unknown; forcar?: unknown };
  const motivo = typeof corpo.motivo === "string" ? corpo.motivo.trim().slice(0, 500) : undefined;

  try {
    const r = await estornarPagamento(id, {
      motivo: motivo || undefined,
      forcar: corpo.forcar === true,
    });
    return NextResponse.json({ ok: true, estornoId: r.estornoId });
  } catch (e) {
    if (e instanceof ErroEstorno) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Não consegui estornar." }, { status: 500 });
  }
}
