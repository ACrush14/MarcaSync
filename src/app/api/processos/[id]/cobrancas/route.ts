import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { garantirCobrancasPix, sincronizarCobrancas } from "@/lib/cobranca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/processos/:id/cobrancas
 *
 * A tela de pagamento chama esta rota a cada poucos segundos. Ela cria o Pix que faltar, confere
 * no AbacatePay o que já foi pago e devolve o estado de cada cobrança, com o Pix copia e cola
 * para o cliente pagar. Não devolve nenhum dado pessoal.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const existe = await prisma.processo.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

  await sincronizarCobrancas(id);
  await garantirCobrancasPix(id);

  const pagamentos = await prisma.pagamento.findMany({
    where: { processoId: id, tipo: { in: ["setup", "gru"] } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    cobrancas: pagamentos.map((p) => ({
      tipo: p.tipo,
      valorCentavos: p.valorCentavos,
      status: p.status,
      brCode: p.status === "pendente" ? p.brCode : null,
      expiraEm: p.expiraEm,
    })),
    tudoPago: pagamentos.length > 0 && pagamentos.every((p) => p.status === "confirmado"),
  });
}
