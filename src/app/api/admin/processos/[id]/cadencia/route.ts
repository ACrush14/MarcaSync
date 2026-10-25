import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { podeIrParaMensal } from "@/lib/cadencia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/processos/:id/cadencia   { modo: "mensal" | "semanal" }
 *
 * "mensal": você confirma que está tudo certo com o protocolo, e o monitoramento passa a olhar o INPI
 * uma vez por mês. Só vale depois de protocolado e com o número do INPI preenchido.
 * "semanal": volta ao modo de todas as semanas (também acontece sozinho se o INPI mudar a situação).
 * Protegida por senha em src/proxy.ts (rotas /api/admin/).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let corpo: { modo?: unknown };
  try {
    corpo = (await request.json()) as { modo?: unknown };
  } catch {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }
  if (corpo?.modo !== "mensal" && corpo?.modo !== "semanal") {
    return NextResponse.json({ error: 'modo deve ser "mensal" ou "semanal".' }, { status: 400 });
  }

  const processo = await prisma.processo.findUnique({
    where: { id },
    select: { protocoladoEm: true, numeroProcesso: true, monitoramento: true },
  });
  if (!processo) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  if (!processo.monitoramento) {
    return NextResponse.json({ error: "Este processo não tem monitoramento contratado." }, { status: 409 });
  }

  if (corpo.modo === "mensal") {
    const pode = podeIrParaMensal(processo);
    if (!pode.ok) return NextResponse.json({ error: pode.motivo }, { status: 409 });
  }

  const atualizado = await prisma.processo.update({
    where: { id },
    data: { monitoramentoMensalDesde: corpo.modo === "mensal" ? new Date() : null },
    select: { id: true, monitoramentoMensalDesde: true },
  });
  return NextResponse.json({ ok: true, modo: corpo.modo, processo: atualizado });
}
