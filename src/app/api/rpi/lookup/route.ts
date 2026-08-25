import { NextResponse } from "next/server";
import { buscarProcessosNaEdicao, descobrirEdicaoMaisRecente } from "@/lib/inpi/fetch-rpi";

export const runtime = "nodejs";
// Nunca cachear estaticamente: isto lê a RPI publicada nesta semana, que
// muda toda terça-feira.
export const dynamic = "force-dynamic";

const NUMERO_PROCESSO_RE = /^\d{6,10}$/;

/**
 * GET /api/rpi/lookup?numero=905922891&numero=905922892
 * GET /api/rpi/lookup?numero=905922891&edicao=2903   (edição específica, opcional)
 *
 * Consulta a RPI oficial (revistas.inpi.gov.br) por número(s) de processo e
 * devolve os despachos publicados naquela edição para cada um. Fonte oficial
 * de dados abertos — sem scraping do portal de busca, sem burlar login.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const numeros = [...new Set(searchParams.getAll("numero"))];
  const edicaoParam = searchParams.get("edicao");

  if (numeros.length === 0) {
    return NextResponse.json(
      { error: "Informe ao menos um parâmetro ?numero=<número do processo>." },
      { status: 400 }
    );
  }

  const invalidos = numeros.filter((n) => !NUMERO_PROCESSO_RE.test(n));
  if (invalidos.length > 0) {
    return NextResponse.json(
      { error: `Número(s) de processo inválido(s): ${invalidos.join(", ")}. Use apenas dígitos.` },
      { status: 400 }
    );
  }

  try {
    const edicao = edicaoParam
      ? { numero: parseInt(edicaoParam, 10), data: null as string | null }
      : await descobrirEdicaoMaisRecente();

    const resultado = await buscarProcessosNaEdicao(edicao.numero, numeros);

    return NextResponse.json({
      edicao: edicao.numero,
      dataEdicao: edicao.data,
      fonte: `https://revistas.inpi.gov.br/txt/RM${edicao.numero}.zip`,
      encontrados: resultado.encontrados,
      naoEncontrados: resultado.naoEncontrados,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao consultar a RPI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
