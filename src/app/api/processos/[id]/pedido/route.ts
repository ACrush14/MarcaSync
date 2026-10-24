import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { analisarEspecificacao } from "@/lib/catalogo";
import { garantirCobrancasPix } from "@/lib/cobranca";
import { calcularGru } from "@/lib/gru";
import { validarPedido, type PedidoEntrada } from "@/lib/pedido";
import { MONITORAMENTO_CENTAVOS, SETUP_CENTAVOS } from "@/lib/planos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** O formulário inteiro cabe com folga em 16 KB; acima disso não é o formulário. */
const MAX_CORPO_BYTES = 16 * 1024;

/**
 * POST /api/processos/:id/pedido
 *
 * Recebe os dados do requerente e da marca (o formulário "pedido de registro"), grava em
 * PedidoRegistro e cria as cobranças pendentes: o serviço, a taxa do INPI (GRU) e, se o
 * cliente quiser, o monitoramento. Os valores são calculados AQUI, no servidor: o navegador
 * só manda os dados, nunca o preço.
 *
 * Pode ser enviado de novo (o cliente corrigiu algo): o pedido é atualizado e as cobranças
 * pendentes são ajustadas. Se alguma cobrança já foi confirmada, recusa (409), porque aí
 * mudar o pedido mexeria em algo já pago e precisa ser conversado.
 *
 * Os dados pessoais (CPF/CNPJ, endereço) NÃO voltam na resposta; só o resumo de valores.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (Number(request.headers.get("content-length") ?? 0) > MAX_CORPO_BYTES) {
    return NextResponse.json({ error: "Pedido grande demais." }, { status: 413 });
  }
  let corpo: PedidoEntrada;
  try {
    corpo = (await request.json()) as PedidoEntrada;
  } catch {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }

  const validacao = validarPedido(corpo ?? {}, analisarEspecificacao);
  if (!validacao.ok) {
    return NextResponse.json(
      { error: "Confira os campos.", erros: validacao.erros },
      { status: 400 }
    );
  }
  const d = validacao.dados;

  const processo = await prisma.processo.findUnique({
    where: { id },
    include: { pagamentos: true },
  });
  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  const jaPago = processo.pagamentos.some(
    (p) => (p.tipo === "setup" || p.tipo === "gru") && p.status === "confirmado"
  );
  if (jaPago) {
    return NextResponse.json(
      { error: "Este pedido já tem pagamento confirmado. Fale comigo para alterar os dados." },
      { status: 409 }
    );
  }

  // Havia marca parecida e viva no ramo (risco alto na busca): o cliente precisa ter visto o aviso.
  if ((processo.riscoPct ?? 0) >= 60 && !d.cienteAnterioridade) {
    return NextResponse.json(
      {
        error: "Confira os campos.",
        erros: { cienteAnterioridade: "Confirme que leu o aviso de marca anterior." },
      },
      { status: 400 }
    );
  }

  // Marca figurativa ou mista precisa da imagem já enviada (ela fica guardada no banco).
  if (d.apresentacao !== "nominativa") {
    const imagem = await prisma.imagemMarca.findUnique({
      where: { processoId: id },
      select: { id: true },
    });
    if (!imagem) {
      return NextResponse.json(
        { error: "Confira os campos.", erros: { imagem: "Envie a imagem da marca." } },
        { status: 400 }
      );
    }
  }

  const gru = calcularGru(d.regime, d.participaEmpresaDoRamo, d.especificacaoLivre);
  const dadosPedido = {
    tipoRequerente: d.tipoRequerente,
    regime: d.regime,
    participaEmpresaDoRamo: d.participaEmpresaDoRamo,
    nome: d.nome,
    documento: d.documento,
    email: d.email,
    cep: d.cep,
    logradouro: d.logradouro,
    numero: d.numero,
    complemento: d.complemento,
    bairro: d.bairro,
    cidade: d.cidade,
    uf: d.uf,
    apresentacao: d.apresentacao,
    elementoNominativo: d.elementoNominativo,
    classeNice: d.classeNice,
    especificacao: d.especificacao,
    especificacaoItens: d.especificacaoItens,
    especificacaoLivre: d.especificacaoLivre,
    palavraEstrangeira: d.palavraEstrangeira,
    traducao: d.traducao,
    cienteAnterioridade: d.cienteAnterioridade,
    atividade: d.atividade,
    servicoCentavos: SETUP_CENTAVOS,
    gruCentavos: gru.centavos,
    gruComDesconto: gru.comDesconto,
    aceitoEm: new Date(),
  };

  const pendente = (tipo: string) =>
    processo.pagamentos.find((p) => p.tipo === tipo && p.status === "pendente");
  const existe = (tipo: string) => processo.pagamentos.some((p) => p.tipo === tipo);

  const operacoes: Prisma.PrismaPromise<unknown>[] = [
    prisma.pedidoRegistro.upsert({
      where: { processoId: id },
      create: { processoId: id, ...dadosPedido },
      update: dadosPedido,
    }),
    prisma.processo.update({
      where: { id },
      data: { status: "pedido", monitoramento: d.monitoramento },
    }),
  ];

  if (!existe("setup")) {
    operacoes.push(
      prisma.pagamento.create({
        data: { processoId: id, tipo: "setup", valorCentavos: SETUP_CENTAVOS },
      })
    );
  }
  const gruPendente = pendente("gru");
  if (gruPendente) {
    operacoes.push(
      prisma.pagamento.update({
        where: { id: gruPendente.id },
        // Valor mudou: o Pix antigo não vale mais, então a cobrança é refeita na próxima consulta.
        data:
          gruPendente.valorCentavos === gru.centavos
            ? { valorCentavos: gru.centavos }
            : { valorCentavos: gru.centavos, provedorId: null, brCode: null, expiraEm: null },
      })
    );
  } else if (!existe("gru")) {
    operacoes.push(
      prisma.pagamento.create({
        data: { processoId: id, tipo: "gru", valorCentavos: gru.centavos },
      })
    );
  }
  const monitoramentoPendente = pendente("monitoramento");
  if (d.monitoramento && !existe("monitoramento")) {
    operacoes.push(
      prisma.pagamento.create({
        data: { processoId: id, tipo: "monitoramento", valorCentavos: MONITORAMENTO_CENTAVOS },
      })
    );
  } else if (!d.monitoramento && monitoramentoPendente) {
    operacoes.push(prisma.pagamento.delete({ where: { id: monitoramentoPendente.id } }));
  }

  try {
    await prisma.$transaction(operacoes);
    // Cria os Pix agora para a tela de pagamento já abrir com o QR code. Se o AbacatePay estiver
    // fora, o pedido continua gravado e a tela tenta de novo (GET /api/processos/:id/cobrancas).
    await garantirCobrancasPix(id);
  } catch {
    return NextResponse.json(
      { error: "Não consegui salvar o pedido. Tente de novo." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      resumo: {
        servicoCentavos: SETUP_CENTAVOS,
        gruCentavos: gru.centavos,
        gruComDesconto: gru.comDesconto,
        especificacaoLivre: d.especificacaoLivre,
        totalCentavos: SETUP_CENTAVOS + gru.centavos,
        monitoramento: d.monitoramento,
        monitoramentoCentavos: d.monitoramento ? MONITORAMENTO_CENTAVOS : 0,
      },
    },
    { status: 201 }
  );
}
