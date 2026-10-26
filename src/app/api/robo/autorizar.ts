import { NextResponse } from "next/server";
import { barrarSeExceder } from "@/lib/limite-publico";
import { autorizarRobo } from "@/lib/robo";

/**
 * A porta das rotas do robô: freia quem insiste e confere o token (`Authorization: Bearer
 * <ROBO_TOKEN>`). Devolve a resposta de erro, ou null quando o robô pode seguir. Sem o token
 * configurado no servidor, as rotas ficam desligadas (503), nunca abertas.
 */
export function exigirRobo(request: Request): Response | null {
  const barrado = barrarSeExceder(request, "robo");
  if (barrado) return barrado;
  const r = autorizarRobo(request.headers.get("authorization"));
  if (r === "desligado") {
    return NextResponse.json({ error: "O robô não está ligado neste servidor." }, { status: 503 });
  }
  if (r === "negado") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  return null;
}
