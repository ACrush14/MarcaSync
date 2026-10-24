import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AtualizarProcessoBody {
  status?: unknown;
  monitoramento?: unknown;
}

/** Etapas do passo a passo que o próprio cliente pode marcar. "protocolado" é só do admin. */
const STATUS_DO_CLIENTE = new Set(["consulta", "resultado", "plano", "pedido", "contato"]);

/**
 * PATCH /api/processos/:id
 *
 * Atualiza o processo conforme o cliente avança no passo a passo (etapa e escolha do
 * monitoramento). É pública, então só mexe nesses dois campos: o número do protocolo, a taxa
 * paga e tudo o que vem do INPI só mudam pelas rotas do /admin. Depois que o pedido é
 * protocolado o cliente não altera mais nada por aqui. Não devolve dados do cliente.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: AtualizarProcessoBody;
  try {
    body = (await request.json()) as AtualizarProcessoBody;
  } catch {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }

  if (body.status !== undefined && !(typeof body.status === "string" && STATUS_DO_CLIENTE.has(body.status))) {
    return NextResponse.json({ error: "status inválido." }, { status: 400 });
  }
  if (body.monitoramento !== undefined && typeof body.monitoramento !== "boolean") {
    return NextResponse.json({ error: "monitoramento deve ser verdadeiro ou falso." }, { status: 400 });
  }

  const atual = await prisma.processo.findUnique({ where: { id }, select: { status: true } });
  if (!atual) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  if (!STATUS_DO_CLIENTE.has(atual.status)) {
    return NextResponse.json(
      { error: "Este pedido já está em andamento no INPI. Fale comigo para alterar." },
      { status: 409 }
    );
  }

  const processo = await prisma.processo.update({
    where: { id },
    data: {
      ...(body.status !== undefined && { status: body.status as string }),
      ...(body.monitoramento !== undefined && { monitoramento: body.monitoramento as boolean }),
    },
    select: { id: true, status: true, monitoramento: true },
  });
  return NextResponse.json({ processo });
}
