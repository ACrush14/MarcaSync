import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validarAcompanhamento, type EntradaAcompanhamento } from "@/lib/acompanhamento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/processos/:id/acompanhamento
 *   { interesse?, proximoContatoEm?: "AAAA-MM-DD" | null, anotacoes?: string | null, contatei?: true }
 *
 * Guarda o seu acompanhamento do contato: se a pessoa tem interesse, quando falar de novo e as
 * suas anotações. Protegida por senha (src/proxy.ts); o cliente nunca vê nem altera isto.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let corpo: EntradaAcompanhamento;
  try {
    corpo = (await request.json()) as EntradaAcompanhamento;
  } catch {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }

  const r = validarAcompanhamento(corpo);
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 400 });

  try {
    const processo = await prisma.processo.update({
      where: { id },
      data: r.dados,
      select: {
        id: true,
        interesse: true,
        proximoContatoEm: true,
        ultimoContatoEm: true,
        anotacoes: true,
      },
    });
    return NextResponse.json({ processo });
  } catch {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }
}
