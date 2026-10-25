import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { garantirCobrancas, sincronizarCobrancas } from "@/lib/cobranca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/processos/:id/cobrancas
 *
 * A tela de pagamento chama esta rota a cada poucos segundos. Ela cria o checkout que faltar,
 * confere no AbacatePay o que já foi pago e devolve o estado do pagamento, com o endereço da
 * página onde o cliente paga (Pix ou cartão). Não devolve nenhum dado pessoal.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const existe = await prisma.processo.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

  // Sem a chave do AbacatePay (ainda não configurada neste ambiente) não há como pagar no site: a
  // tela volta ao fluxo de combinar o pagamento pelo WhatsApp.
  const pagamentoAtivo = Boolean(process.env.ABACATEPAY_API_KEY);
  if (pagamentoAtivo) {
    await sincronizarCobrancas(id);
    await garantirCobrancas(id);
  }

  const pagamentos = await prisma.pagamento.findMany({
    where: { processoId: id, tipo: { in: ["pacote", "setup", "gru"] } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    pagamentoAtivo,
    // Mantido com o nome antigo para a tela já aberta de quem estava pagando durante a troca.
    pixAtivo: pagamentoAtivo,
    cobrancas: pagamentos.map((p) => ({
      tipo: p.tipo,
      valorCentavos: p.valorCentavos,
      status: p.status,
      checkoutUrl: p.status === "pendente" ? p.checkoutUrl : null,
      brCode: p.status === "pendente" ? p.brCode : null,
      expiraEm: p.expiraEm,
    })),
    tudoPago: pagamentos.length > 0 && pagamentos.every((p) => p.status === "confirmado"),
  });
}
