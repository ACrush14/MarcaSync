import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { avisarProtocolado } from "@/lib/avisos";
import { numeroPedidoValido, prazosDoProtocolo } from "@/lib/prazos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/processos/:id/protocolo   { numeroPedido: "123456789", protocoladoEm: "2026-11-01T14:30" }
 *
 * Registra que o pedido foi protocolado no e-Marcas: guarda o número do pedido e a data e hora do
 * envio (a data de prioridade), muda o status, cria o prazo da procuração (60 dias) e avisa o
 * cliente. A partir daqui a regra de devolução considera o serviço concluído. Protegida por
 * senha em src/proxy.ts. Registrar de novo corrige o número e a data, sem repetir prazos nem avisos.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const corpo = (await request.json().catch(() => ({}))) as {
    numeroPedido?: unknown;
    protocoladoEm?: unknown;
  };

  const numero =
    typeof corpo.numeroPedido === "string" ? numeroPedidoValido(corpo.numeroPedido) : null;
  if (!numero) {
    return NextResponse.json({ error: "O número do pedido tem 9 dígitos." }, { status: 400 });
  }
  const quando = typeof corpo.protocoladoEm === "string" ? new Date(corpo.protocoladoEm) : null;
  if (!quando || Number.isNaN(quando.getTime()) || quando.getTime() > Date.now() + 5 * 60_000) {
    return NextResponse.json(
      { error: "Informe a data e hora do protocolo (não pode ser futura)." },
      { status: 400 }
    );
  }

  const processo = await prisma.processo.findUnique({
    where: { id },
    include: {
      prazos: { select: { tipo: true } },
      pagamentos: { select: { tipo: true, status: true } },
    },
  });
  if (!processo) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

  // Só se protocola o que está pago: serviço e taxa do INPI confirmados.
  const pago = (tipo: string) =>
    processo.pagamentos.some((p) => p.tipo === tipo && p.status === "confirmado");
  if (!pago("pacote") && !(pago("setup") && pago("gru"))) {
    return NextResponse.json(
      { error: "O pagamento do serviço e da taxa do INPI precisa estar confirmado." },
      { status: 409 }
    );
  }

  const jaProtocolado = processo.protocoladoEm !== null;
  await prisma.processo.update({
    where: { id },
    data: { numeroProcesso: numero, protocoladoEm: quando, status: "protocolado" },
  });

  if (!jaProtocolado) {
    for (const p of prazosDoProtocolo(quando)) {
      if (processo.prazos.some((x) => x.tipo === p.tipo)) continue;
      await prisma.prazo.create({ data: { processoId: id, ...p } });
    }
    await avisarProtocolado(id);
  }
  return NextResponse.json({ ok: true, avisouCliente: !jaProtocolado });
}
