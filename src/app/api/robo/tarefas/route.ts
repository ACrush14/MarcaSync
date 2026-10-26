import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ESPERA_NOVA_TENTATIVA_MS, MAX_TAREFAS, tarefaDoPedido } from "@/lib/robo";
import { exigirRobo } from "../autorizar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/robo/tarefas   (Authorization: Bearer <ROBO_TOKEN>)
 *
 * Os pedidos que o robô deve conferir no e-INPI: já pagos pelo cliente, com os dados do pedido
 * preenchidos, sem a taxa paga ao INPI e sem protocolo, e que ainda não foram conferidos com
 * sucesso (nem tentados na última hora). Devolve só o necessário para a conferência: nada de CPF,
 * CNPJ ou endereço.
 */
export async function GET(request: Request) {
  const negado = exigirRobo(request);
  if (negado) return negado;

  const limite = new Date(Date.now() - ESPERA_NOVA_TENTATIVA_MS);
  const processos = await prisma.processo.findMany({
    where: {
      gruPagaInpiEm: null,
      protocoladoEm: null,
      pagamentos: { some: { tipo: "pacote", status: "confirmado" } },
      pedidoRegistro: { isNot: null },
      NOT: {
        conferenciasGru: { some: { OR: [{ resultado: "ok" }, { createdAt: { gte: limite } }] } },
      },
    },
    select: {
      id: true,
      marca: true,
      pedidoRegistro: {
        select: { especificacaoLivre: true, gruComDesconto: true, gruCentavos: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_TAREFAS,
  });

  return NextResponse.json({
    tarefas: processos
      .filter((p) => p.pedidoRegistro !== null)
      .map((p) => ({
        processoId: p.id,
        marca: p.marca,
        ...tarefaDoPedido(p.pedidoRegistro as NonNullable<typeof p.pedidoRegistro>),
      })),
  });
}
