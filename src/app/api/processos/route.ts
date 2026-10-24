import { checarProntidao } from "@/lib/prontidao";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/processos
 *
 * Lista todos os processos (o "caderno de anotações"), mais recentes
 * primeiro, com cliente, pagamentos e os dados do pedido de registro (CPF/CNPJ e endereço,
 * por isso esta rota é protegida por senha em src/proxy.ts) — o que alimenta a página /admin.
 */
export async function GET() {
  const processos = await prisma.processo.findMany({
    include: {
      cliente: true,
      pagamentos: true,
      pedidoRegistro: true,
      prazos: { where: { concluidoEm: null }, orderBy: { venceEm: "asc" } },
      reciboProtocolo: { select: { nomeArquivo: true, tamanho: true } },
      // Só os números da imagem: os bytes saem pela rota /imagem, nunca nesta lista.
      imagemMarca: {
        select: {
          largura: true,
          altura: true,
          ampliada: true,
          larguraOriginal: true,
          alturaOriginal: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  // A checklist "pronto para protocolar" é calculada aqui, no servidor, porque usa o catálogo
  // de termos do INPI (grande demais para mandar ao navegador).
  return NextResponse.json({
    processos: processos.map((p) => ({
      ...p,
      prontidao: p.pedidoRegistro
        ? checarProntidao(p.pedidoRegistro, p.pagamentos, {
            marca: p.marca,
            riscoPct: p.riscoPct,
            imagem: p.imagemMarca,
          })
        : null,
    })),
  });
}

interface CriarProcessoBody {
  nomeCliente?: string;
  whatsapp?: string;
  email?: string;
  marca?: string;
  descricao?: string;
  nclCode?: string;
  nclLabel?: string;
  riscoPct?: number;
  riscoFonte?: "real" | "demo";
}

/**
 * POST /api/processos
 *
 * Cria (ou reaproveita, por WhatsApp) o cliente e grava um novo processo.
 * Chamado depois que a análise do passo "Resultado" termina — é o primeiro
 * ponto em que o wizard passa a persistir alguma coisa de verdade.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as CriarProcessoBody;

  const nomeCliente = body.nomeCliente?.trim();
  const whatsapp = body.whatsapp?.trim();
  const marca = body.marca?.trim();
  const descricao = body.descricao?.trim() ?? "";

  if (!nomeCliente || !whatsapp || !marca) {
    return NextResponse.json(
      { error: "nomeCliente, whatsapp e marca são obrigatórios." },
      { status: 400 }
    );
  }

  const digitos = whatsapp.replace(/\D/g, "");
  if (!/^(55)?\d{10,11}$/.test(digitos)) {
    return NextResponse.json(
      { error: "whatsapp inválido — informe DDD + número." },
      { status: 400 }
    );
  }

  const cliente = await prisma.cliente.upsert({
    where: { whatsapp },
    update: { nome: nomeCliente, email: body.email?.trim() || undefined },
    create: { nome: nomeCliente, whatsapp, email: body.email?.trim() || null },
  });

  const processo = await prisma.processo.create({
    data: {
      clienteId: cliente.id,
      marca,
      descricao,
      nclCode: body.nclCode ?? null,
      nclLabel: body.nclLabel ?? null,
      riscoPct: typeof body.riscoPct === "number" ? Math.round(body.riscoPct) : null,
      riscoFonte: body.riscoFonte ?? null,
      status: "resultado",
    },
    include: { cliente: true },
  });

  return NextResponse.json({ processo }, { status: 201 });
}
