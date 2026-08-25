import { NextResponse } from "next/server";
import { verificarBusca, verificarRpi } from "@/lib/inpi/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Verifica as duas integrações reais com o INPI (RPI oficial + busca em
 * tempo real) e devolve 200 se ambas estiverem saudáveis, 503 se qualquer
 * uma falhar (por status HTTP ou por resposta fora do formato esperado).
 *
 * Pensado pra ser chamado por um monitor externo (UptimeRobot, Better
 * Uptime, cron-job.org...) a cada poucos minutos: o status HTTP não-200 já
 * é o gatilho de alerta padrão da maioria desses serviços — não precisa
 * parsear o corpo pra saber que algo quebrou.
 */
export async function GET() {
  const [rpi, busca] = await Promise.all([verificarRpi(), verificarBusca()]);
  const ok = rpi.ok && busca.ok;

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      checkedAt: new Date().toISOString(),
      checks: { rpi, busca },
    },
    { status: ok ? 200 : 503 }
  );
}
