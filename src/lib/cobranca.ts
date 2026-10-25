import { prisma } from "./db";
import {
  ErroAbacatePay,
  consultarPagamento,
  criarCheckout,
  criarPagador,
  estornarPorId,
  statusDoPagamento,
} from "./abacatepay";
import { planoDeEstorno, planoDoPacote, podeEstornar } from "./estorno";
import { avisarPagamentoConfirmado } from "./avisos";
import { PARCELAS_MAX_CARTAO, produtoDoPacote, urlDoPedido } from "./pacotes";

/**
 * Lado servidor do pagamento: cria o checkout do pedido (serviço e taxa do INPI num pagamento só,
 * por Pix ou cartão), confere se foi pago e estorna.
 *
 * O AbacatePay é a fonte da verdade: nunca marcamos um pagamento como confirmado só porque
 * alguém avisou; sempre perguntamos o status à API antes (por isso o webhook é só um gatilho).
 */

/**
 * Cria o checkout de cada pagamento "pacote" pendente que ainda não tem um (ou cujo checkout
 * venceu). Falha aqui não derruba o pedido: o cliente vê "gerando o pagamento" e a tela tenta de
 * novo na próxima consulta.
 */
export async function garantirCobrancas(processoId: string): Promise<void> {
  const pagamentos = await prisma.pagamento.findMany({
    where: { processoId, status: "pendente", tipo: "pacote" },
  });
  if (pagamentos.length === 0) return;

  const pedido = await prisma.pedidoRegistro.findUnique({
    where: { processoId },
    select: {
      especificacaoLivre: true,
      gruComDesconto: true,
      nome: true,
      documento: true,
      email: true,
      cep: true,
      logradouro: true,
      numero: true,
      complemento: true,
      bairro: true,
      cidade: true,
      uf: true,
      processo: { select: { cliente: { select: { whatsapp: true } } } },
    },
  });
  if (!pedido) return;

  // Cadastra o pagador no AbacatePay com o que ele já preencheu, para não digitar tudo de novo na
  // página de pagamento. Se falhar, o checkout sai mesmo assim e ele preenche lá.
  let pagadorId: string | undefined;
  try {
    pagadorId = await criarPagador(
      {
        nome: pedido.nome,
        email: pedido.email,
        documento: pedido.documento,
        celular: pedido.processo.cliente.whatsapp,
        cep: pedido.cep,
        logradouro: pedido.logradouro,
        numero: pedido.numero,
        complemento: pedido.complemento,
        bairro: pedido.bairro,
        cidade: pedido.cidade,
        uf: pedido.uf,
      },
      { processoId }
    );
  } catch (e) {
    console.warn(
      "[cobranca] não consegui cadastrar o pagador; ele preenche na página de pagamento",
      e instanceof Error ? e.message : e
    );
  }
  const agora = new Date();

  for (const pg of pagamentos) {
    const vencida = pg.expiraEm !== null && pg.expiraEm <= agora;
    if (pg.provedorId && pg.checkoutUrl && !vencida) continue;
    try {
      const c = await criarCheckout({
        produtoExternalId: produtoDoPacote({
          especificacaoLivre: pedido.especificacaoLivre,
          comDesconto: pedido.gruComDesconto,
        }),
        // Um externalId novo a cada tentativa: checkout vencido não pode ser reaproveitado.
        externalId: `${pg.id}-${Date.now().toString(36)}`,
        metadata: { pagamentoId: pg.id, processoId, tipo: pg.tipo },
        urlDeRetorno: urlDoPedido(processoId),
        parcelasMax: PARCELAS_MAX_CARTAO,
        pagadorId,
      });
      // O valor do produto no AbacatePay tem de ser o que o servidor calculou. Se não for (produto
      // desatualizado), o cliente NÃO é mandado para pagar um valor diferente do combinado.
      if (c.valorCentavos !== pg.valorCentavos) {
        console.error(
          "[cobranca] o produto do AbacatePay tem valor diferente do pedido; checkout descartado",
          pg.id,
          c.valorCentavos,
          pg.valorCentavos
        );
        continue;
      }
      // Só grava se ninguém trocou a cobrança enquanto isso (duas telas abertas ao mesmo tempo).
      await prisma.pagamento.updateMany({
        where: { id: pg.id, status: "pendente", provedorId: pg.provedorId },
        data: { provedorId: c.id, checkoutUrl: c.url, expiraEm: null },
      });
    } catch (e) {
      console.error(
        "[cobranca] não consegui criar o checkout",
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
  for (const pg of pendentes) await sincronizarUm(pg.id, pg.provedorId as string, pg.valorCentavos);
}

async function sincronizarUm(
  pagamentoId: string,
  provedorId: string,
  valorEsperadoCentavos: number
): Promise<void> {
  try {
    const c = await consultarPagamento(provedorId);
    const novo = statusDoPagamento(c.status);
    if (novo === "confirmado") {
      // Pago a menos (cupom, ajuste manual no painel): não conta como pago por inteiro.
      if (c.pagoCentavos !== null && c.pagoCentavos < valorEsperadoCentavos) {
        console.error("[cobranca] pago a menos que o combinado", provedorId, c.pagoCentavos);
        return;
      }
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
      // Marca como vencida para a próxima visita gerar um checkout novo.
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
  await sincronizarUm(pg.id, provedorId, pg.valorCentavos);
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
 * ignora a regra (por exemplo, para devolver tudo mesmo depois de pagar a taxa, por decisão sua)
 * e fica registrado nas notas.
 *
 * No pagamento único, o estorno pela API é sempre do valor inteiro. Se a taxa já foi paga ao INPI,
 * só o serviço volta, e isso é feito à mão: use `registrarDevolucaoManual`.
 */
export async function estornarPagamento(
  pagamentoId: string,
  opcoes: { motivo?: string; forcar?: boolean } = {}
): Promise<{ estornoId: string }> {
  const pg = await prisma.pagamento.findUnique({
    where: { id: pagamentoId },
    include: {
      processo: {
        select: { gruPagaInpiEm: true, protocoladoEm: true, pedidoRegistro: { select: { servicoCentavos: true } } },
      },
    },
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
  if (pg.devolvidoCentavos > 0) {
    throw new ErroEstorno(
      "Parte deste pagamento já foi devolvida à mão; o estorno inteiro pelo AbacatePay deixaria o cliente com mais do que pagou. Fale com o suporte do AbacatePay.",
      409
    );
  }

  const situacao = {
    gruPagaAoInpi: pg.processo.gruPagaInpiEm !== null,
    protocolado: pg.processo.protocoladoEm !== null,
  };
  if (!opcoes.forcar) {
    if (pg.tipo === "pacote") {
      const plano = planoDoPacote(situacao, pg.valorCentavos, pg.processo.pedidoRegistro?.servicoCentavos ?? 0);
      if (plano.acao !== "total") {
        throw new ErroEstorno(
          plano.acao === "parcial_manual"
            ? `${plano.motivo} Valor a devolver: ${(plano.devolverCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
            : `A regra de devolução não permite: ${plano.motivo}`,
          409
        );
      }
    } else if (!podeEstornar(pg.tipo, situacao)) {
      throw new ErroEstorno(
        `A regra de devolução não permite: ${planoDeEstorno(situacao).motivo}`,
        409
      );
    }
  }

  let estornoId: string;
  try {
    ({ estornoId } = await estornarPorId(pg.provedorId, opcoes.motivo));
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

/**
 * Registra uma devolução parcial feita por fora (um Pix seu para o cliente), porque o AbacatePay
 * não estorna parte do valor. Não move dinheiro: só anota quanto já voltou, para ninguém devolver
 * duas vezes. Só vale para pagamento confirmado e nunca passa do que o cliente pagou.
 */
export async function registrarDevolucaoManual(
  pagamentoId: string,
  centavos: number,
  nota?: string
): Promise<{ devolvidoCentavos: number }> {
  if (!Number.isInteger(centavos) || centavos <= 0) {
    throw new ErroEstorno("Informe um valor positivo, em centavos.", 400);
  }
  const pg = await prisma.pagamento.findUnique({ where: { id: pagamentoId } });
  if (!pg) throw new ErroEstorno("Pagamento não encontrado.", 404);
  if (pg.status !== "confirmado") {
    throw new ErroEstorno("Só dá para registrar devolução de um pagamento confirmado.", 409);
  }
  const total = pg.devolvidoCentavos + centavos;
  if (total > pg.valorCentavos) {
    throw new ErroEstorno("A soma das devoluções passa do valor pago.", 409);
  }
  await prisma.pagamento.update({
    where: { id: pg.id },
    data: {
      devolvidoCentavos: total,
      notas: [pg.notas, `devolução manual de ${(centavos / 100).toFixed(2)}`, nota?.slice(0, 300)]
        .filter(Boolean)
        .join(" | "),
    },
  });
  return { devolvidoCentavos: total };
}
