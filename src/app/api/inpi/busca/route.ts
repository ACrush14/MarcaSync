import { NextResponse } from "next/server";
import { BuscaInpiError, buscarMarcas } from "@/lib/inpi/busca-client";

export const runtime = "nodejs";
// Nunca cachear estaticamente na borda: o cache de verdade é o in-memory
// keyed por termo dentro de busca-client.ts (24h, espelhando o Cache-Control
// do upstream). Aqui só controlamos que o Next não sirva uma resposta velha
// pra um termo novo.
export const dynamic = "force-dynamic";

/**
 * GET /api/inpi/busca?termo=Nubank&pagina=1
 *
 * Busca em tempo real na base de marcas do INPI (portal
 * servicos.busca.inpi.gov.br/marcas). API não documentada publicamente —
 * ver ressalvas completas em `src/lib/inpi/busca-client.ts`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const termo = searchParams.get("termo")?.trim() ?? "";
  const paginaParam = searchParams.get("pagina");
  const pagina = paginaParam ? Math.max(1, parseInt(paginaParam, 10) || 1) : 1;

  if (!termo) {
    return NextResponse.json(
      { error: "Informe o parâmetro ?termo=<nome, processo ou titular>." },
      { status: 400 }
    );
  }

  try {
    const resposta = await buscarMarcas(termo, pagina);
    return NextResponse.json(resposta);
  } catch (err) {
    const status = err instanceof BuscaInpiError ? 502 : 500;
    const message = err instanceof Error ? err.message : "Erro desconhecido ao buscar no INPI.";
    return NextResponse.json({ error: message }, { status });
  }
}
