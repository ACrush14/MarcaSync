import { checarProntidao } from "@/lib/prontidao";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { barrarSeExceder } from "@/lib/limite-publico";
import { limparTexto } from "@/lib/texto";
import { whatsappValido } from "@/lib/whatsapp";

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

/** Tamanhos máximos dos textos que o visitante manda (bem acima do uso normal). */
const LIMITES = {
  nome: 120,
  marca: 120,
  descricao: 2000,
  whatsapp: 30,
  email: 200,
  rotuloClasse: 80,
} as const;

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
  const barrado = barrarSeExceder(request, "criarProcesso");
  if (barrado) return barrado;

  let body: CriarProcessoBody;
  try {
    body = (await request.json()) as CriarProcessoBody;
  } catch {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }

  const texto = (v: unknown) => (typeof v === "string" ? limparTexto(v) : undefined);
  const nomeCliente = texto(body.nomeCliente);
  const whatsapp = texto(body.whatsapp);
  const marca = texto(body.marca);
  const descricao = texto(body.descricao) ?? "";
  const email = texto(body.email) || null;

  if (!nomeCliente || !whatsapp || !marca) {
    return NextResponse.json(
      { error: "nomeCliente, whatsapp e marca são obrigatórios." },
      { status: 400 }
    );
  }

  if (
    nomeCliente.length > LIMITES.nome ||
    marca.length > LIMITES.marca ||
    descricao.length > LIMITES.descricao ||
    whatsapp.length > LIMITES.whatsapp ||
    (email?.length ?? 0) > LIMITES.email
  ) {
    return NextResponse.json({ error: "Algum campo passou do tamanho permitido." }, { status: 400 });
  }

  if (!whatsappValido(whatsapp)) {
    return NextResponse.json(
      { error: "whatsapp inválido — informe DDD + número." },
      { status: 400 }
    );
  }

  // Quem já é cliente (mesmo WhatsApp) mantém o nome e o e-mail que tinha: a rota é pública e
  // qualquer pessoa pode digitar o número de outra, então não deixamos trocar os dados dela.
  const cliente = await prisma.cliente.upsert({
    where: { whatsapp },
    update: {},
    create: { nome: nomeCliente, whatsapp, email },
  });

  const processo = await prisma.processo.create({
    data: {
      clienteId: cliente.id,
      marca,
      descricao,
      nclCode: typeof body.nclCode === "string" && /^\d{1,2}$/.test(body.nclCode) ? body.nclCode : null,
      nclLabel: texto(body.nclLabel)?.slice(0, LIMITES.rotuloClasse) ?? null,
      riscoPct:
        typeof body.riscoPct === "number" && Number.isFinite(body.riscoPct)
          ? Math.min(100, Math.max(0, Math.round(body.riscoPct)))
          : null,
      riscoFonte: body.riscoFonte === "real" || body.riscoFonte === "demo" ? body.riscoFonte : null,
      status: "resultado",
    },
    select: { id: true, status: true },
  });

  // Só o id volta: quem cria o processo não precisa (nem deve) receber os dados do cliente.
  return NextResponse.json({ processo }, { status: 201 });
}
