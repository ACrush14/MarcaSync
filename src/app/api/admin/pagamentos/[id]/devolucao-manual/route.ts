import { NextResponse } from "next/server";
import { ErroEstorno, registrarDevolucaoManual } from "@/lib/cobranca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/pagamentos/:id/devolucao-manual   { centavos: number, nota?: string }
 *
 * Registra que você devolveu uma parte do pagamento por fora (um Pix seu para o cliente), porque o
 * AbacatePay não estorna parte do valor. Só anota; não move dinheiro. Protegida por senha em
 * src/proxy.ts (rotas /api/admin/).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let corpo: { centavos?: unknown; nota?: unknown };
  try {
    corpo = (await request.json()) as { centavos?: unknown; nota?: unknown };
  } catch {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }
  if (typeof corpo?.centavos !== "number") {
    return NextResponse.json({ error: "Informe centavos (um número inteiro)." }, { status: 400 });
  }
  const nota = typeof corpo.nota === "string" ? corpo.nota.trim().slice(0, 300) : undefined;

  try {
    const r = await registrarDevolucaoManual(id, corpo.centavos, nota || undefined);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof ErroEstorno) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Não consegui registrar a devolução." }, { status: 500 });
  }
}
