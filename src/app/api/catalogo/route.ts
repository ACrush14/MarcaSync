import { NextResponse } from "next/server";
import { analisarEspecificacao, buscarTermos, VERSAO_CATALOGO } from "@/lib/catalogo";

export const runtime = "nodejs";

const MAX_CORPO_BYTES = 16 * 1024;

function classeValida(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{1,2}$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= 45 ? String(n) : null;
}

/**
 * GET /api/catalogo?classe=30&q=bolo
 *
 * Busca de termos pré-aprovados do INPI numa classe de Nice (para o cliente montar a
 * especificação do pedido). Só devolve texto público da lista oficial, nenhum dado de cliente.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const classe = classeValida(url.searchParams.get("classe"));
  const q = (url.searchParams.get("q") ?? "").slice(0, 80);
  if (!classe) {
    return NextResponse.json({ error: "Informe a classe (1 a 45)." }, { status: 400 });
  }
  return NextResponse.json({ termos: buscarTermos(classe, q, 15), fonte: VERSAO_CATALOGO });
}

/**
 * POST /api/catalogo   { classe: "30", itens: ["Bolos", "bolo de pote"] }
 *
 * Diz quais itens estão na lista pré-aprovada da classe e quais são texto livre. O formulário
 * usa isto para mostrar, antes do envio, se o pedido vai pela GRU 389 (lista) ou 394 (livre).
 */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_CORPO_BYTES) {
    return NextResponse.json({ error: "Pedido grande demais." }, { status: 413 });
  }
  let corpo: { classe?: unknown; itens?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido: envie um JSON." }, { status: 400 });
  }
  const classe = classeValida(corpo?.classe);
  const itens = Array.isArray(corpo?.itens)
    ? corpo.itens.filter((i): i is string => typeof i === "string")
    : null;
  if (!classe || !itens || itens.length > 50 || itens.some((i) => i.length > 300)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  return NextResponse.json({ ...analisarEspecificacao(classe, itens), fonte: VERSAO_CATALOGO });
}
