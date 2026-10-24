import { prisma } from "./db";
import {
  ErroAbacatePay,
  consultarCobranca,
  criarCobrancaPix,
  estornarCobranca,
  statusDoPagamento,
} from "./abacatepay";
import { podeEstornar, planoDeEstorno } from "./estorno";
import { avisarPagamentoConfirmado } from "./avisos";

/**
 * Lado servidor da cobrança por Pix: cria as cobranças do pedido (serviço e GRU, separadas
 * porque o AbacatePay só estorna a cobrança inteira), confere se foram pagas e estorna.
 *
 * O AbacatePay é a fonte da verdade: nunca marcamos um pagamento como confirmado só porque
 * alguém avisou; sempre perguntamos o status à API antes (por isso o webhook é só um gatilho).
 */

const TIPOS_COM_PIX = ["setup", "gru"];

const DESCRICAO: Record<string, string> = {
  setup: "MarcaSync - serviço de registro de marca",
  gru: "MarcaSync - taxa do INPI (GRU) do registro",
};

/**
 * Cria a cobrança Pix de cada pagamento pendente que ainda não tem uma (ou cuja cobrança
 * venceu). Falha em uma não impede as outras: o cliente vê o que existe e a tela tenta de novo.
 */
export async function garantirCobrancasPix(processoId: string): Promise<void> {
  const pagamentos = await prisma.pagamento.findMany({
    where: { processoId, status: "pendente", tipo: { in: TIPOS_COM_PIX } },
  });
  const agora = new Date();

  for (const pg of pagamentos) {
    const vencida = pg.expiraEm !== null && pg.expiraEm <= agora;
    if (pg.provedorId && !vencida) continue;
    try {
      const c = await criarCobrancaPix({
        valorCentavos: pg.valorCentavos,
        descricao: DESCRICAO[pg.tipo] ?? "MarcaSync",
        // Um externalId novo a cada tentativa: cobrança vencida não pode ser reaproveitada.
        externalId: `${pg.id}-${Date.now().toString(36)}`,
        metadata: { pagamentoId: pg.id, processoId, tipo: pg.tipo },
      });
      // Só grava se ninguém trocou a cobrança enquanto isso (duas telas abertas ao mesmo tempo).
      await prisma.pagamento.updateMany({
        where: { id: pg.id, status: "pendente", provedorId: pg.provedorId },
        data: { provedorId: c.id, brCode: c.brCode, expiraEm: c.expiraEm },
      });
    } catch (e) {
      console.error(
        "[cobranca] não consegui criar o Pix",
        pg.id,
        e instanceof Error ? e.message : e
      );
    }
  }
}

/** Pergunta ao AbacatePay o status de cada cobrança pendente do processo e atualiza o banco. */
export async function sincronizarCobrancas(processoId: string): Promise<void> {
  const pendentes = await prisma.pagamento.findMany({
    where: { processoId, status: "pendente", provedorId: { not: null } },
  });
  for (const pg of pendentes) await sincronizarUm(pg.id, pg.provedorId as string);
}

async function sincronizarUm(pagamentoId: string, provedorId: string): Promise<void> {
  try {
    const c = await consultarCobranca(provedorId);
    const novo = statusDoPagamento(c.status);
    if (novo === "confirmado") {
      const r = await prisma.pagamento.updateMany({
        where: { id: pagamentoId, status: "pendente" },
        data: { status: "confirmado", confirmadoEm: new Date(), confirmadoVia: "abacatepay" },
      });
      // Só quem de fato mudou o status avisa (a tela e o webhook podem chegar juntos).
      if (r.count === 1) {
        const pg = await prisma.pagamento.findUnique({
          where: { id: pagamentoId },
          select: { processoId: true },
        });
        if (pg) await avisarPagamentoConfirmado(pg.processoId);
      }
    } else if (novo === "expirado") {
      // Marca como vencida para a próxima visita gerar um QR code novo.
      await prisma.pagamento.updateMany({
        where: { id: pagamentoId, status: "pendente" },
        data: { expiraEm: new Date() },
      });
    }
  } catch (e) {
    console.error(
      "[cobranca] não consegui consultar",
      provedorId,
      e instanceof Error ? e.message : e
    );
  }
}

/** Chamado pelo webhook: confere na API a cobrança citada e atualiza o pagamento dela. */
export async function confirmarPorProvedor(provedorId: string): Promise<boolean> {
  const pg = await prisma.pagamento.findUnique({ where: { provedorId } });
  if (!pg) {
    console.warn("[cobranca] webhook de cobrança desconhecida", provedorId);
    return false;
  }
  await sincronizarUm(pg.id, provedorId);
  return true;
}

export class ErroEstorno extends Error {
  constructor(
    mensagem: string,
    readonly status: number
  ) {
    super(mensagem);
    this.name = "ErroEstorno";
  }
}

/**
 * Estorna um pagamento já confirmado pelo AbacatePay, seguindo a regra de devolução. `forcar`
 * ignora a regra (por exemplo, para devolver a GRU por decisão sua) e fica registrado nas notas.
 */
export async function estornarPagamento(
  pagamentoId: string,
  opcoes: { motivo?: string; forcar?: boolean } = {}
): Promise<{ estornoId: string }> {
  const pg = await prisma.pagamento.findUnique({
    where: { id: pagamentoId },
    include: { processo: { select: { gruPagaInpiEm: true, protocoladoEm: true } } },
  });
  if (!pg) throw new ErroEstorno("Pagamento não encontrado.", 404);
  if (pg.status !== "confirmado") {
    throw new ErroEstorno("Só dá para estornar um pagamento confirmado.", 409);
  }
  if (pg.confirmadoVia !== "abacatepay" || !pg.provedorId) {
    throw new ErroEstorno(
      "Este pagamento não foi feito pelo AbacatePay; devolva por fora e anote nas notas.",
      409
    );
  }

  const situacao = {
    gruPagaAoInpi: pg.processo.gruPagaInpiEm !== null,
    protocolado: pg.processo.protocoladoEm !== null,
  };
  if (!opcoes.forcar && !podeEstornar(pg.tipo, situacao)) {
    throw new ErroEstorno(
      `A regra de devolução não permite: ${planoDeEstorno(situacao).motivo}`,
      409
    );
  }

  let estornoId: string;
  try {
    ({ estornoId } = await estornarCobranca(pg.provedorId, opcoes.motivo));
  } catch (e) {
    const msg = e instanceof ErroAbacatePay ? e.message : "Falha ao estornar.";
    throw new ErroEstorno(`O AbacatePay recusou o estorno: ${msg}`, 502);
  }

  await prisma.pagamento.update({
    where: { id: pg.id },
    data: {
      status: "estornado",
      estornadoEm: new Date(),
      estornoId,
      notas: [pg.notas, opcoes.forcar ? "estorno forçado (fora da regra)" : null, opcoes.motivo]
        .filter(Boolean)
        .join(" | "),
    },
  });
  return { estornoId };
}
