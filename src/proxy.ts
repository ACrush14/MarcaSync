import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  JANELA_SENHA_COOLDOWN,
  estaBloqueado,
  ipDoPedido,
  registrarFalha,
} from "@/lib/limite-admin";

function pedirAutenticacao() {
  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="MarcaSync admin"' },
  });
}

function tentativasEsgotadas() {
  return new NextResponse("Várias tentativas erradas. Tente novamente em 15 minutos", {
    status: 429,
    headers: { "Retry-After": String(JANELA_SENHA_COOLDOWN / 1000) },
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
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protegido =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/rpi") ||
    pathname.startsWith("/rpi-teste") ||
    (pathname === "/api/processos" && request.method === "GET") ||
    (/^\/api\/pagamentos\/[^/]+\/confirmar$/.test(pathname) && request.method === "POST");

  if (!protegido) return NextResponse.next();

  const senhaAdmin = process.env.ADMIN_PASSWORD;
  if (!senhaAdmin) {
    return new NextResponse("ADMIN_PASSWORD não configurado.", { status: 500 });
  }

  const ip = ipDoPedido(request);

  try {
    if (await estaBloqueado(ip)) return tentativasEsgotadas();

    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Basic ")) return pedirAutenticacao();

    let senha: string;
    try {
      senha = atob(auth.slice(6)).split(":").slice(1).join(":");
    } catch {
      return pedirAutenticacao();
    }

    if (senha !== senhaAdmin) {
      await registrarFalha(ip);
      return pedirAutenticacao();
    }
  } catch {
    return new NextResponse("Serviço indisponível. Tente de novo em instantes.", {
      status: 503,
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/processos",
    "/api/pagamentos/:path*",
    "/api/rpi/:path*",
    "/rpi-teste",
  ],
};
