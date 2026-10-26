import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notificar } from "@/lib/notificar";
import { mensagemDaConferencia, validarConferencia, type EntradaConferencia } from "@/lib/robo";
import { exigirRobo } from "../../../autorizar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CORPO_BYTES = 4096;

/**
 * POST /api/robo/tarefas/:id/conferencia   (Authorization: Bearer <ROBO_TOKEN>)
 *   { resultado: "ok" | "divergente" | "erro", servico: "389" | "394", esperadoCentavos, lidoCentavos?, detalhe? }
 *
 * O robô conta o que viu na prévia da GRU. Fica guardado (e aparece no /admin) e você recebe um aviso.
 * Só vale para pedido já pago pelo cliente e ainda não protocolado.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const negado = exigirRobo(request);
  if (negado) return negado;
  const { id } = await params;

  if (Number(request.headers.get("content-length") ?? 0) > MAX_CORPO_BYTES) {
    return NextResponse.json({ error: "Corpo grande demais." }, { status: 413 });
  }
  let corpo: EntradaConferencia;
  try {
    corpo = (await request.json()) as EntradaConferencia;
  } catch {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }
  const v = validarConferencia(corpo ?? {});
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });

  const processo = await prisma.processo.findUnique({
    where: { id },
    select: {
      marca: true,
      protocoladoEm: true,
      pagamentos: { select: { tipo: true, status: true } },
    },
  });
  if (!processo) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  const pago = processo.pagamentos.some((p) => p.tipo === "pacote" && p.status === "confirmado");
  if (!pago || processo.protocoladoEm) {
    return NextResponse.json(
      { error: "Só se confere a GRU de pedido já pago e ainda não protocolado." },
      { status: 409 }
    );
  }

  const registro = await prisma.conferenciaGru.create({
    data: { processoId: id, ...v.dados },
    select: { id: true, resultado: true, createdAt: true },
  });
  const aviso = mensagemDaConferencia(processo.marca, v.dados);
  await notificar({ processoId: id, para: "operador", ...aviso });

  return NextResponse.json({ ok: true, conferencia: registro }, { status: 201 });
}
