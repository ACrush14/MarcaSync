import { NextResponse } from "next/server";
import { calcularColidencia } from "@/lib/colidencia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/colidencia?marca=...&descricao=...
 *
 * Busca de anterioridade unificada: tenta a base real do INPI primeiro,
 * cai pra demonstração de exemplo só se a busca real falhar de verdade —
 * ver `src/lib/colidencia.ts` para a regra completa. Sempre devolve 200
 * com um resultado válido (a própria função interna já trata os dois
 * caminhos), nunca propaga o erro cru da busca real pro cliente.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const marca = searchParams.get("marca")?.trim();
  const descricao = searchParams.get("descricao")?.trim() ?? "";

  if (!marca) {
    return NextResponse.json({ error: "Informe ?marca=<nome da marca>." }, { status: 400 });
  }

  const resultado = await calcularColidencia(marca, descricao);
  return NextResponse.json(resultado);
}
