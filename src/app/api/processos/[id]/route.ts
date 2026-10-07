import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AtualizarProcessoBody {
  status?: "consulta" | "resultado" | "plano" | "contato";
  monitoramento?: boolean;
  protocolo?: string;
}

const STATUS_VALIDOS = new Set(["consulta", "resultado", "plano", "contato"]);

/**
 * PATCH /api/processos/:id
 *
 * Atualiza o processo conforme o cliente avança no wizard (ex.: ao entrar
 * no passo "Plano" ou confirmar o protocolo).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as AtualizarProcessoBody;

  if (body.status && !STATUS_VALIDOS.has(body.status)) {
    return NextResponse.json(
      { error: `status inválido: ${body.status}` },
      { status: 400 }
    );
  }

  try {
    const processo = await prisma.processo.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.monitoramento !== undefined && { monitoramento: body.monitoramento }),
        ...(body.protocolo !== undefined && { protocolo: body.protocolo }),
      },
      include: { cliente: true, pagamentos: true },
    });
    return NextResponse.json({ processo });
  } catch {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }
}
