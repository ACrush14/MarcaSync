import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PAGINA = 200;
const MAX_ORIGEM = 100;
const MAX_POR_SESSAO = 20;
const MAX_GLOBAL = 300;
const MAX_CORPO_BYTES = 4096;
const JANELA_MS = 60_000;

const NOMES_VALIDOS = new Set([
  "landing_visita",
  "consulta_iniciada",
  "resultado_visto",
  "plano_visto",
  "whatsapp_clicado",
  "contato_visto",
  "consulta_enviada",
  "pedido_visto",
  "pedido_enviado",
  "pagamento_confirmado",
]);

interface EventoBody {
  sessaoId?: unknown;
  nome?: unknown;
  pagina?: unknown;
  origem?: unknown;
  dados?: unknown;
}

export async function POST(request: Request) {
  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (tamanho > MAX_CORPO_BYTES) {
    return NextResponse.json({ error: "Pedido grande demais" }, { status: 413 });
  }
  let body: EventoBody;
  try {
    body = (await request.json()) as EventoBody;
  } catch {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }

  const { sessaoId, nome, pagina, origem, dados } = body;

  if (typeof sessaoId !== "string" || sessaoId.trim() === "" || sessaoId.length > 64) {
    return NextResponse.json({ error: "sessaoId inválido." }, { status: 400 });
  }
  if (typeof nome !== "string" || !NOMES_VALIDOS.has(nome)) {
    return NextResponse.json({ error: "nome de evento inválido. " }, { status: 400 });
  }

  const inicioJanela = new Date(Date.now() - JANELA_MS);
  const daSessao = await prisma.evento.count({
    where: { sessaoId: sessaoId.trim(), createdAt: { gte: inicioJanela } },
  });
  const noTotal = await prisma.evento.count({
    where: { createdAt: { gte: inicioJanela } },
  });

  if (daSessao >= MAX_POR_SESSAO || noTotal >= MAX_GLOBAL) {
    return NextResponse.json(
      { error: "Muitos eventos. Tente de novo em instantes." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const dadosValidos =
    dados !== null &&
    typeof dados == "object" &&
    !Array.isArray(dados) &&
    JSON.stringify(dados).length <= 2000;

  try {
    await prisma.evento.create({
      data: {
        sessaoId: sessaoId.trim(),
        nome,
        pagina: typeof pagina === "string" ? pagina.slice(0, MAX_PAGINA) : null,
        origem: typeof origem === "string" ? origem.slice(0, MAX_ORIGEM) : null,
        dados: dadosValidos ? (dados as Prisma.InputJsonObject) : undefined,
      },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
