import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notificar } from "@/lib/notificar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/notificacoes/teste
 *
 * Manda um aviso de teste para você pelos canais ligados (Telegram e/ou e-mail) e devolve o que
 * aconteceu em cada um, para conferir em produção se as variáveis estão certas sem esperar um
 * pedido de verdade. Protegida por senha em src/proxy.ts (rotas /api/admin/).
 */
export async function POST() {
  const inicio = new Date();
  await notificar({
    para: "operador",
    assunto: "Teste de aviso do MarcaSync",
    texto: "Se você recebeu isto, os avisos do sistema estão funcionando.",
  });
  const registros = await prisma.notificacao.findMany({
    where: { createdAt: { gte: inicio }, assunto: "Teste de aviso do MarcaSync" },
    select: { canal: true, enviadaEm: true, erro: true },
  });
  return NextResponse.json({
    resultados: registros.map((r) => ({
      canal: r.canal,
      enviado: r.enviadaEm !== null,
      erro: r.erro,
    })),
  });
}
