import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PAGINA = 200;

const NOMES_VALIDOS = new Set([
  "landing_visita",
  "consulta_iniciada",
  "resultado_visto",
  "plano_visto",
  "whatsapp_clicado",
]);

interface EventoBody {
  sessaoId?: unknown;
  nome?: unknown;
  pagina?: unknown;
  origem?: unknown;
  dados?: unknown;
}

export async function POST(request: Request) {
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
        pagina: typeof pagina === "string" ? pagina.slice(0, 200) : null,
        origem: typeof origem === "string" ? origem.slice(0, 100) : null,
        dados: dadosValidos ? (dados as Prisma.InputJsonObject) : undefined,
      },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
