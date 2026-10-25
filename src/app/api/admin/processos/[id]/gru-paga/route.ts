import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/processos/:id/gru-paga
 *
 * Marca que a taxa do INPI (GRU) deste pedido já foi paga ao INPI. A partir daí a taxa não volta
 * mais e, se o pedido não for protocolado, só o valor do serviço é devolvido ao cliente (ver
 * src/lib/estorno.ts). Só faz sentido depois de o cliente ter pago; protegida por senha em
 * src/proxy.ts (rotas /api/admin/). Marcar de novo não muda a data original.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const processo = await prisma.processo.findUnique({
    where: { id },
    select: {
      gruPagaInpiEm: true,
      protocoladoEm: true,
      pagamentos: { select: { tipo: true, status: true } },
    },
  });
  if (!processo) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

  const pago = (tipo: string) =>
    processo.pagamentos.some((p) => p.tipo === tipo && p.status === "confirmado");
  if (!pago("pacote") && !(pago("setup") && pago("gru"))) {
    return NextResponse.json(
      { error: "Só dá para marcar a taxa como paga depois que o cliente pagou o pedido." },
      { status: 409 }
    );
  }
  if (processo.gruPagaInpiEm) {
    return NextResponse.json({ ok: true, gruPagaInpiEm: processo.gruPagaInpiEm });
  }

  const quando = new Date();
  const r = await prisma.processo.updateMany({
    where: { id, gruPagaInpiEm: null },
    data: { gruPagaInpiEm: quando },
  });
  return NextResponse.json({ ok: true, gruPagaInpiEm: quando, alterou: r.count === 1 });
}
