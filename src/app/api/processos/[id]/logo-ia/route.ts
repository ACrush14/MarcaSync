import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { barrarSeExceder } from "@/lib/limite-publico";
import { gerarImagemGemini } from "@/lib/gemini-imagem";
import {
  MAX_GERACOES_POR_PEDIDO,
  estiloDaVariacao,
  limiteDoDia,
  montarPrompt,
  validarEntradaLogo,
} from "@/lib/logo-ia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Gerar uma imagem leva de 5 a 30 segundos.
export const maxDuration = 60;

const MENSAGEM_DO_MOTIVO = {
  limite: "O serviço de criação de logos está muito usado agora. Tente de novo em um minuto.",
  recusou: "A IA não aceitou criar esta logo. Ajuste a descrição da atividade e tente de novo.",
  "sem-imagem": "A IA não devolveu uma imagem desta vez. Tente de novo.",
  demorou: "A IA demorou demais. Tente de novo.",
  erro: "Não consegui criar a logo agora. Tente de novo em instantes.",
  "sem-chave": "A criação de logos com IA ainda não está ligada.",
} as const;

/**
 * GET /api/processos/:id/logo-ia
 *
 * Diz se a criação de logos com IA está ligada (existe GEMINI_API_KEY) e quantas o pedido ainda
 * pode gerar. A tela usa isso para mostrar ou esconder o painel.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const disponivel = Boolean(process.env.GEMINI_API_KEY);
  if (!disponivel) return NextResponse.json({ disponivel: false, restantes: 0 });
  const usadas = await prisma.geracaoLogo.count({ where: { processoId: id } });
  return NextResponse.json({
    disponivel: true,
    restantes: Math.max(0, MAX_GERACOES_POR_PEDIDO - usadas),
  });
}

/**
 * POST /api/processos/:id/logo-ia
 *   { marca, atividade, apresentacao: "figurativa" | "mista", variacao: 0..3, cienteIa: true }
 *
 * Cria UMA logo com o Gemini (a tela chama 4 vezes, uma por estilo) e devolve uma prévia em JPG.
 * Nada é guardado: o cliente escolhe uma e ela entra pelo envio normal da imagem da marca.
 *
 * Custo sob controle: limite por pedido (MAX_GERACOES_POR_PEDIDO), limite do site por dia
 * (LOGO_IA_LIMITE_DIA) e freio por IP. A tentativa é registrada antes de chamar o Gemini e
 * desfeita se ele falhar, para a falha não gastar a cota do cliente. Quem faz várias chamadas ao
 * mesmo tempo pode passar do limite por pouco: o freio por IP segura o resto.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const barrado = barrarSeExceder(request, "logoIa");
  if (barrado) return barrado;

  const { id } = await params;
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: MENSAGEM_DO_MOTIVO["sem-chave"] }, { status: 503 });
  }

  if (Number(request.headers.get("content-length") ?? 0) > 8 * 1024) {
    return NextResponse.json({ error: "Pedido grande demais." }, { status: 413 });
  }
  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo || typeof corpo !== "object") {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }
  if (corpo.cienteIa !== true) {
    return NextResponse.json(
      { error: "Marque que entendeu o aviso sobre logos criadas por IA." },
      { status: 400 }
    );
  }
  const estilo = estiloDaVariacao(corpo.variacao);
  if (!estilo) return NextResponse.json({ error: "Variação inválida." }, { status: 400 });
  const entrada = validarEntradaLogo(corpo);
  if (!entrada.ok) return NextResponse.json({ error: entrada.erro }, { status: 400 });

  const processo = await prisma.processo.findUnique({ where: { id }, select: { id: true } });
  if (!processo) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

  const usadas = await prisma.geracaoLogo.count({ where: { processoId: id } });
  if (usadas >= MAX_GERACOES_POR_PEDIDO) {
    return NextResponse.json(
      { error: "Você já usou todas as logos que a IA pode criar para este pedido.", restantes: 0 },
      { status: 429 }
    );
  }
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const hoje = await prisma.geracaoLogo.count({ where: { createdAt: { gte: desde } } });
  if (hoje >= limiteDoDia()) {
    return NextResponse.json(
      { error: "A criação de logos com IA chegou ao limite de hoje. Tente amanhã ou envie a sua imagem." },
      { status: 503 }
    );
  }

  const reserva = await prisma.geracaoLogo.create({
    data: { processoId: id, estilo: estilo.id },
    select: { id: true },
  });

  const resultado = await gerarImagemGemini({
    prompt: montarPrompt(entrada.dados, estilo),
    apiKey: process.env.GEMINI_API_KEY,
    modelo: process.env.GEMINI_IMAGE_MODEL || undefined,
  });
  if (!resultado.ok) {
    await prisma.geracaoLogo.delete({ where: { id: reserva.id } }).catch(() => undefined);
    const status = resultado.motivo === "limite" ? 503 : resultado.motivo === "recusou" ? 422 : 502;
    return NextResponse.json({ error: MENSAGEM_DO_MOTIVO[resultado.motivo] }, { status });
  }

  // Prévia leve (JPG, até 1024 px, fundo branco): a versão final é refeita no envio da imagem da marca.
  let jpg: Buffer;
  try {
    jpg = await sharp(Buffer.from(resultado.base64, "base64"), { failOn: "error" })
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    await prisma.geracaoLogo.delete({ where: { id: reserva.id } }).catch(() => undefined);
    return NextResponse.json({ error: MENSAGEM_DO_MOTIVO["sem-imagem"] }, { status: 502 });
  }

  return NextResponse.json({
    imagem: `data:image/jpeg;base64,${jpg.toString("base64")}`,
    estilo: estilo.id,
    restantes: Math.max(0, MAX_GERACOES_POR_PEDIDO - usadas - 1),
  });
}
