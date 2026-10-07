import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/processos/:id  { numeroProcesso: "905922891" | "" }
 *
 * Registra o número real do INPI depois que você protocola. É esse número
 * que o monitoramento procura na RPI. Fica aqui (e não na rota pública do
 * wizard) porque só você sabe o número verdadeiro.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { numeroProcesso?: unknown };
  const numero = typeof body.numeroProcesso === "string" ? body.numeroProcesso.replace(/\D/g, "") : null;

  if (numero === null || (numero !== "" && !/^\d{6,10}$/.test(numero))) {
    return NextResponse.json({ error: "Número inválido — use de 6 a 10 dígitos." }, { status: 400 });
  }

  try {
    const processo = await prisma.processo.update({
      where: { id },
      data: { numeroProcesso: numero || null, ...(numero && { status: "protocolado" }) },
    });
    return NextResponse.json({ processo });
  } catch {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }
}
