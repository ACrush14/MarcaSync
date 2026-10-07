import { NextResponse } from "next/server";
import { rodarMonitoramento } from "@/lib/monitor-rpi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Baixa e descompacta a edição inteira da RPI (~65 MB) — precisa de folga.
export const maxDuration = 300;

/**
 * GET /api/cron/rpi — chamado todo dia pelo Vercel Cron (vercel.json). A RPI
 * sai às terças, mas rodar todo dia pega publicação atrasada; edição já lida
 * é pulada sem baixar nada.
 *
 * A Vercel envia `Authorization: Bearer $CRON_SECRET`. Sem a variável
 * configurada a rota se recusa a rodar, em vez de ficar aberta.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    return NextResponse.json(await rodarMonitoramento());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao ler a RPI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
