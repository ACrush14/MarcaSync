import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Senha do /admin. "2001" é o valor combinado com o usuário para uso local
// — 4 dígitos é trivial de força-bruta, aceitável só enquanto isto não sai
// do seu computador. Antes de qualquer deploy público, defina ADMIN_PASSWORD
// no ambiente com algo bem mais forte (não precisa mudar nenhum código).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "2001";

function pedirAutenticacao() {
  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="MarcaSync admin"' },
  });
}

/**
 * Protege só o "caderno de anotações" (/admin) e as duas rotas de API que
 * expõem dado de todos os clientes de uma vez ou permitem confirmar
 * pagamento — não o resto da API, que o próprio wizard público precisa
 * chamar sem senha (criar processo, avançar etapa, registrar cobrança
 * pendente). Usuário pode ser qualquer coisa; só a senha importa.
 *
 * Nomeado `proxy` (não `middleware`) — convenção do Next.js 16, ver
 * https://nextjs.org/docs/messages/middleware-to-proxy.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protegido =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin/") ||
    (pathname === "/api/processos" && request.method === "GET") ||
    (/^\/api\/pagamentos\/[^/]+\/confirmar$/.test(pathname) && request.method === "POST");

  if (!protegido) return NextResponse.next();

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return pedirAutenticacao();

  let senha: string;
  try {
    senha = atob(auth.slice(6)).split(":").slice(1).join(":");
  } catch {
    return pedirAutenticacao();
  }

  if (senha !== ADMIN_PASSWORD) return pedirAutenticacao();

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/processos", "/api/pagamentos/:path*"],
};
