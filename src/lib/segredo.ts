import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compara um segredo recebido (senha, token de webhook, token do cron) com o esperado em tempo
 * constante: o tempo da resposta não revela quantos caracteres estavam certos. Os dois lados
 * passam por SHA-256 para terem o mesmo tamanho antes da comparação. Vazio nunca confere.
 */
export function segredoConfere(recebido: string | null | undefined, esperado: string): boolean {
  if (!recebido || !esperado) return false;
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}
