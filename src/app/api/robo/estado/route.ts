import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notificar } from "@/lib/notificar";
import { mensagemDoEstado, validarEstado, type EntradaEstado } from "@/lib/robo";
import { exigirRobo } from "../autorizar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/robo/estado   (Authorization: Bearer <ROBO_TOKEN>)   { sessao: "ok" | "expirada" | "erro", detalhe? }
 *
 * O sinal de vida do robô, a cada rodada. Grava quando foi visto e como está a sessão do e-INPI.
 * Você só é avisado quando o estado MUDA (a sessão expirou, deu erro, voltou ao normal), não a cada sinal.
 */
export async function POST(request: Request) {
  const negado = exigirRobo(request);
  if (negado) return negado;

  let corpo: EntradaEstado;
  try {
    corpo = (await request.json()) as EntradaEstado;
  } catch {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }
  const v = validarEstado(corpo ?? {});
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });

  const antes = await prisma.roboEstado.findUnique({ where: { id: "principal" } });
  await prisma.roboEstado.upsert({
    where: { id: "principal" },
    create: { id: "principal", vistoEm: new Date(), sessao: v.sessao, detalhe: v.detalhe },
    update: { vistoEm: new Date(), sessao: v.sessao, detalhe: v.detalhe },
  });

  if (antes?.sessao !== v.sessao) {
    const aviso = mensagemDoEstado(v.sessao, v.detalhe);
    if (aviso) {
      await notificar({ para: "operador", ...aviso });
    } else if (antes && antes.sessao !== "ok") {
      await notificar({
        para: "operador",
        assunto: "Robô: voltou ao normal",
        texto: "A sessão do e-INPI do robô está aberta de novo. Ele voltou a conferir os pedidos.",
      });
    }
  }
  return NextResponse.json({ ok: true });
}
