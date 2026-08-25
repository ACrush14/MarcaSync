import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CriarPagamentoBody {
  tipo?: "setup" | "monitoramento";
  valorCentavos?: number;
}

/**
 * POST /api/processos/:id/pagamentos
 *
 * Registra uma cobrança pendente (setup ou monitoramento) pro processo.
 * Não cobra nada de verdade — hoje o pagamento em si é feito por PIX fora
 * do sistema; isto só cria o registro "aguardando confirmação".
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as CriarPagamentoBody;

  if (body.tipo !== "setup" && body.tipo !== "monitoramento") {
    return NextResponse.json(
      { error: 'tipo deve ser "setup" ou "monitoramento".' },
      { status: 400 }
    );
  }
  if (!Number.isInteger(body.valorCentavos) || (body.valorCentavos as number) <= 0) {
    return NextResponse.json(
      { error: "valorCentavos deve ser um inteiro positivo." },
      { status: 400 }
    );
  }

  const processo = await prisma.processo.findUnique({ where: { id } });
  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  const pagamento = await prisma.pagamento.create({
    data: {
      processoId: id,
      tipo: body.tipo,
      valorCentavos: body.valorCentavos as number,
    },
  });

  return NextResponse.json({ pagamento }, { status: 201 });
}
