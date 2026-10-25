import { NextResponse } from "next/server";
import { extrairIdsCobranca, segredoConfere } from "@/lib/abacatepay";
import { confirmarPorProvedor } from "@/lib/cobranca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Um aviso do AbacatePay é pequeno; acima disso não é um aviso. */
const MAX_CORPO_BYTES = 64 * 1024;

/**
 * POST /api/webhooks/abacatepay?webhookSecret=...
 *
 * O AbacatePay chama esta rota quando uma cobrança é paga ou estornada. Ela só serve de
 * gatilho: confere o segredo da URL, acha o id da cobrança no corpo e PERGUNTA o status à API
 * (`confirmarPorProvedor`). Assim, um aviso falso ou um corpo em formato novo não consegue
 * marcar nada como pago.
 *
 * Devolve 200 para qualquer aviso autêntico, mesmo de cobrança que não conhecemos, porque o
 * AbacatePay repete avisos que não recebem 2xx.
 */
export async function POST(request: Request) {
  const esperado = process.env.ABACATEPAY_WEBHOOK_SECRET ?? "";
  const recebido = new URL(request.url).searchParams.get("webhookSecret");
  if (!segredoConfere(recebido, esperado)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_CORPO_BYTES) {
    return NextResponse.json({ error: "Corpo grande demais." }, { status: 413 });
  }
  const corpo = await request.text();
  // O corpo pode citar mais de um id (o checkout e o Pix por baixo dele): tenta cada um até
  // achar o pagamento nosso. Cada um é conferido na API antes de qualquer mudança.
  for (const id of extrairIdsCobranca(corpo)) {
    if (await confirmarPorProvedor(id)) break;
  }

  return NextResponse.json({ ok: true });
}
