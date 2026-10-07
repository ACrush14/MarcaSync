import { NextResponse } from "next/server";
import { rodarMonitoramento } from "@/lib/monitor-rpi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST /api/admin/monitor — "Verificar RPI agora": relê a edição mais recente. */
export async function POST() {
  try {
    return NextResponse.json(await rodarMonitoramento({ forcar: true }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao ler a RPI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
