import { prisma } from "./db";
import { notificar } from "./notificar";
import { EMPRESA } from "./empresa";
import { avisoPendente, dataPorExtenso, type NivelAviso } from "./prazos";
import { fmtReais } from "./planos";
import { precisaContatar } from "./acompanhamento";

/**
 * Os avisos do ciclo do pedido: pagamento recebido, pedido protocolado e prazos. Os textos falam
 * com o cliente sem jargão e dizem o que ele precisa fazer. Cada função só monta a mensagem e
 * chama `notificar`, que nunca lança erro.
 */

const SITE = "https://www.marcasync.com.br";

function assinatura(): string {
  const contato = EMPRESA.emailContato ? `\nDúvidas: ${EMPRESA.emailContato}` : "";
  return `\n\n—\nMarcaSync${contato}\n${SITE}`;
}

/** O que precisa ir ao painel para você conferir um processo. */
function linhaOperador(marca: string): string {
  return `Marca: ${marca}\nPainel: ${SITE}/admin`;
}

/** Chamado quando um pagamento do AbacatePay é confirmado (uma vez por pagamento). */
export async function avisarPagamentoConfirmado(processoId: string): Promise<void> {
  const processo = await prisma.processo.findUnique({
    where: { id: processoId },
    include: { pagamentos: true, pedidoRegistro: { select: { email: true } } },
  });
  if (!processo) return;

  const pagos = processo.pagamentos.filter(
    (p) => ["pacote", "setup", "gru"].includes(p.tipo) && p.status === "confirmado"
  );
  const totalPago = pagos.reduce((s, p) => s + p.valorCentavos, 0);
  // Pagamento único (pacote) ou, no modelo antigo, os dois Pix.
  const completo =
    pagos.some((p) => p.tipo === "pacote") || ["setup", "gru"].every((t) => pagos.some((p) => p.tipo === t));

  await notificar({
    processoId,
    para: "operador",
    assunto: completo
      ? `Pedido pago por inteiro: ${processo.marca}`
      : `Pagamento parcial: ${processo.marca}`,
    texto: `${linhaOperador(processo.marca)}\nTotal pago até agora: ${fmtReais(totalPago)}\n${
      completo
        ? "O pagamento foi confirmado: o pedido está pronto para você conferir a checklist e protocolar."
        : "Falta o restante do pagamento."
    }`,
  });

  if (completo && processo.pedidoRegistro?.email) {
    await notificar({
      processoId,
      para: "cliente",
      email: processo.pedidoRegistro.email,
      assunto: `Recebemos o seu pagamento: ${processo.marca}`,
      texto:
        `Olá! Recebemos o pagamento de ${fmtReais(totalPago)} do pedido de registro da marca "${processo.marca}".\n\n` +
        `Próximos passos:\n` +
        `1. Você cria o seu cadastro no e-INPI (opção "Cliente"): https://meu.inpi.gov.br/pag/cliente/form\n` +
        `   Nunca nos passe a sua senha; não precisamos dela.\n` +
        `2. Enviamos a procuração para você assinar.\n` +
        `3. Protocolamos o pedido no INPI e avisamos você com o número do pedido.` +
        assinatura(),
    });
  }
}

/** Chamado quando você registra o protocolo no /admin. */
export async function avisarProtocolado(processoId: string): Promise<void> {
  const processo = await prisma.processo.findUnique({
    where: { id: processoId },
    include: { pedidoRegistro: { select: { email: true } }, prazos: true },
  });
  if (!processo?.pedidoRegistro?.email) return;

  const proc = processo.prazos.find((p) => p.tipo === "procuracao" && !p.concluidoEm);
  await notificar({
    processoId,
    para: "cliente",
    email: processo.pedidoRegistro.email,
    assunto: `Pedido protocolado no INPI: ${processo.marca}`,
    texto:
      `Boa notícia! O pedido de registro da marca "${processo.marca}" foi protocolado no INPI` +
      `${processo.numeroProcesso ? ` com o número ${processo.numeroProcesso}` : ""}.\n\n` +
      `A partir de agora o INPI faz o exame formal e publica o pedido para oposição. Avisamos você a cada novidade.` +
      (proc
        ? `\n\nAtenção: precisamos da sua procuração assinada até ${dataPorExtenso(proc.venceEm)}. Sem ela o INPI arquiva o pedido.`
        : "") +
      assinatura(),
  });
}

const FRASE: Record<NivelAviso, string> = {
  30: "faltam até 30 dias",
  7: "faltam até 7 dias",
  2: "faltam até 2 dias",
  0: "o prazo VENCEU",
};

/**
 * Rotina diária: para cada prazo aberto que chegou a um nível novo, avisa você (e o cliente, no
 * caso da procuração) e registra o nível para não repetir.
 */
export async function avisarPrazos(agora: Date = new Date()): Promise<{ avisados: number }> {
  const prazos = await prisma.prazo.findMany({
    where: { concluidoEm: null },
    include: { processo: { include: { pedidoRegistro: { select: { email: true } } } } },
  });

  let avisados = 0;
  for (const prazo of prazos) {
    const nivel = avisoPendente(prazo, agora);
    if (nivel === null) continue;

    // Marca antes de enviar: se o envio falhar, o aviso fica no histórico com o erro, mas não
    // se repete a cada execução.
    const marcou = await prisma.prazo.updateMany({
      where: { id: prazo.id, concluidoEm: null, ultimoAvisoDias: prazo.ultimoAvisoDias },
      data: { ultimoAvisoDias: nivel },
    });
    if (marcou.count !== 1) continue;
    avisados++;

    const marca = prazo.processo.marca;
    await notificar({
      processoId: prazo.processoId,
      para: "operador",
      assunto: `Prazo: ${FRASE[nivel]} (${marca})`,
      texto: `${linhaOperador(marca)}\n${prazo.descricao}\nVence em ${dataPorExtenso(prazo.venceEm)}.`,
    });

    const email = prazo.processo.pedidoRegistro?.email;
    if (prazo.tipo === "procuracao" && email) {
      await notificar({
        processoId: prazo.processoId,
        para: "cliente",
        email,
        assunto:
          nivel === 0
            ? `Urgente: a procuração do pedido "${marca}" venceu`
            : `Falta a sua procuração assinada (${marca})`,
        texto:
          `Para manter o pedido de registro da marca "${marca}" ativo, o INPI precisa da procuração assinada` +
          ` até ${dataPorExtenso(prazo.venceEm)} (${FRASE[nivel]}).\n` +
          `Sem ela o pedido é arquivado.\n\nFale conosco para receber ou reenviar o documento.` +
          assinatura(),
      });
    }
  }
  return { avisados };
}

/**
 * Rotina diária: se há contatos que você marcou para hoje (ou atrasados), manda UM aviso com a
 * lista. Não repete no mesmo dia: se já existe um aviso desta rotina nas últimas 20 horas, não
 * manda outro.
 */
export async function avisarContatos(agora: Date = new Date()): Promise<{ contatos: number; avisou: boolean }> {
  const processos = await prisma.processo.findMany({
    where: { interesse: { not: "sem_interesse" }, proximoContatoEm: { not: null } },
    select: {
      marca: true,
      interesse: true,
      proximoContatoEm: true,
      ultimoContatoEm: true,
      anotacoes: true,
      cliente: { select: { nome: true } },
      pagamentos: { select: { tipo: true, status: true } },
    },
    orderBy: { proximoContatoEm: "asc" },
  });
  const devidos = processos.filter((p) => {
    const jaPagou = p.pagamentos.some((g) => g.tipo === "setup" && g.status === "confirmado");
    return precisaContatar(p, agora, jaPagou);
  });
  if (devidos.length === 0) return { contatos: 0, avisou: false };

  const recente = await prisma.notificacao.findFirst({
    where: {
      destino: "operador",
      assunto: { startsWith: "Contatos para fazer" },
      createdAt: { gte: new Date(agora.getTime() - 20 * 3600_000) },
    },
    select: { id: true },
  });
  if (recente) return { contatos: devidos.length, avisou: false };

  const linhas = devidos.slice(0, 15).map((p) => {
    const nome = p.cliente.nome.split(" ")[0];
    return `• ${nome}: ${p.marca} (${p.interesse === "interessado" ? "interessado" : "acompanhar"}, ${dataPorExtenso(p.proximoContatoEm as Date)})`;
  });
  const mais = devidos.length > 15 ? `\n… e mais ${devidos.length - 15}.` : "";
  await notificar({
    para: "operador",
    assunto: `Contatos para fazer hoje: ${devidos.length}`,
    texto: `${linhas.join("\n")}${mais}\n\nPainel: ${SITE}/admin`,
  });
  return { contatos: devidos.length, avisou: true };
}
