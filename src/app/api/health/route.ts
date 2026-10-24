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
/** A rota é pública e cada checagem vai até o INPI: guardamos o resultado por 60 segundos. */
const VALIDADE_MS = 60_000;
let guardado: { em: number; corpo: Record<string, unknown>; status: number } | null = null;

export async function GET() {
  if (guardado && Date.now() - guardado.em < VALIDADE_MS) {
    return NextResponse.json(guardado.corpo, { status: guardado.status });
  }

  const [rpi, busca] = await Promise.all([verificarRpi(), verificarBusca()]);
  const ok = rpi.ok && busca.ok;
  const corpo = {
    status: ok ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
    checks: { rpi, busca },
  };
  const status = ok ? 200 : 503;
  guardado = { em: Date.now(), corpo, status };

  return NextResponse.json(corpo, { status });
}
