/**
 * O guarda da área administrativa: quais caminhos pedem senha, o que acontece com senha certa,
 * errada, ausente, e depois de muitas tentativas. A senha de verdade nunca aparece aqui.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const limite = vi.hoisted(() => ({
  estaBloqueado: vi.fn(),
  registrarFalha: vi.fn(),
}));
vi.mock("@/lib/limite-admin", async () => {
  const real = await vi.importActual<typeof import("@/lib/limite-admin")>("@/lib/limite-admin");
  return { ...real, ...limite };
});

import { proxy } from "./proxy";

const SENHA = "senha-de-teste-123";
const basic = (senha: string, usuario = "qualquer") =>
  "Basic " + Buffer.from(`${usuario}:${senha}`).toString("base64");

const pedido = (path: string, method = "GET", auth?: string) =>
  new NextRequest(`http://localhost${path}`, {
    method,
    headers: { ...(auth ? { authorization: auth } : {}), "x-forwarded-for": "7.7.7.7" },
  });

const passou = (r: Response) => r.headers.get("x-middleware-next") === "1";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_PASSWORD", SENHA);
  limite.estaBloqueado.mockResolvedValue(false);
  limite.registrarFalha.mockResolvedValue(undefined);
});

const PROTEGIDAS: [string, string][] = [
  ["GET", "/admin"],
  ["GET", "/admin/qualquer-coisa"],
  ["GET", "/api/admin/alertas"],
  ["POST", "/api/admin/notificacoes/teste"],
  ["POST", "/api/admin/pagamentos/abc/estornar"],
  ["POST", "/api/admin/processos/abc/protocolo"],
  ["POST", "/api/admin/processos/abc/recibo"],
  ["POST", "/api/admin/prazos/abc/concluir"],
  ["PATCH", "/api/admin/processos/abc/acompanhamento"],
  ["POST", "/api/admin/processos/abc/cadencia"],
  ["POST", "/api/admin/processos/abc/gru-paga"],
  ["POST", "/api/admin/pagamentos/abc/devolucao-manual"],
  ["GET", "/api/admin/robo"],
  ["GET", "/api/rpi/lookup"],
  ["GET", "/rpi-teste"],
  ["GET", "/api/processos"],
  ["GET", "/api/processos/abc/imagem"],
  ["POST", "/api/pagamentos/abc/confirmar"],
];

const PUBLICAS: [string, string][] = [
  ["GET", "/"],
  ["GET", "/consulta"],
  ["GET", "/termos"],
  ["GET", "/privacidade"],
  ["POST", "/api/processos"],
  ["PATCH", "/api/processos/abc"],
  ["POST", "/api/processos/abc/pedido"],
  ["POST", "/api/processos/abc/imagem"],
  ["GET", "/api/processos/abc/logo-ia"],
  ["POST", "/api/processos/abc/logo-ia"],
  ["GET", "/api/processos/abc/cobrancas"],
  ["GET", "/api/colidencia"],
  ["GET", "/api/catalogo"],
  ["POST", "/api/eventos"],
  ["GET", "/api/health"],
  // o robô não usa a senha do painel: tem o próprio token (Bearer) conferido dentro das rotas
  ["GET", "/api/robo/tarefas"],
  ["POST", "/api/robo/tarefas/abc/conferencia"],
  ["POST", "/api/robo/estado"],
];

describe("proxy: o que pede senha", () => {
  it.each(PROTEGIDAS)("%s %s pede senha", async (metodo, caminho) => {
    const r = await proxy(pedido(caminho, metodo));
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toContain("Basic");
  });

  it.each(PROTEGIDAS)("%s %s abre com a senha certa", async (metodo, caminho) => {
    expect(passou(await proxy(pedido(caminho, metodo, basic(SENHA))))).toBe(true);
  });

  it.each(PUBLICAS)("%s %s fica aberta (o passo a passo precisa dela)", async (metodo, caminho) => {
    expect(passou(await proxy(pedido(caminho, metodo)))).toBe(true);
  });

  it("o usuário pode ser qualquer um; só a senha importa", async () => {
    expect(passou(await proxy(pedido("/admin", "GET", basic(SENHA, "outro-nome"))))).toBe(true);
  });

  it("senha com dois-pontos dentro funciona", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "a:b:c");
    expect(passou(await proxy(pedido("/admin", "GET", basic("a:b:c"))))).toBe(true);
  });
});

describe("proxy: credenciais ruins", () => {
  it.each([
    ["senha errada", basic("errada")],
    ["senha parecida (um caractere a menos)", basic(SENHA.slice(0, -1))],
    ["senha parecida (um caractere a mais)", basic(SENHA + "x")],
    ["senha vazia", basic("")],
    ["esquema Bearer com a senha", `Bearer ${SENHA}`],
    ["Basic sem nada", "Basic "],
    ["base64 inválido", "Basic ???nao-e-base64???"],
    ["sem os dois-pontos", "Basic " + Buffer.from(SENHA).toString("base64")],
  ])("%s é recusada", async (_nome, auth) => {
    const r = await proxy(pedido("/admin", "GET", auth));
    expect(r.status).toBe(401);
  });

  it("senha errada conta uma falha para o IP", async () => {
    await proxy(pedido("/admin", "GET", basic("errada")));
    expect(limite.registrarFalha).toHaveBeenCalledWith("7.7.7.7");
  });

  it("pedido sem credencial não conta falha (é só o navegador pedindo a senha)", async () => {
    await proxy(pedido("/admin"));
    expect(limite.registrarFalha).not.toHaveBeenCalled();
  });

  it("IP bloqueado leva 429 mesmo com a senha certa", async () => {
    limite.estaBloqueado.mockResolvedValue(true);
    const r = await proxy(pedido("/admin", "GET", basic(SENHA)));
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBeTruthy();
  });

  it("sem ADMIN_PASSWORD configurada a área fica fechada (500), nunca aberta", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    const r = await proxy(pedido("/admin", "GET", basic("")));
    expect(r.status).toBe(500);
  });

  it("se o banco do limitador cair, a área fecha (503) em vez de abrir", async () => {
    limite.estaBloqueado.mockRejectedValue(new Error("banco fora"));
    const r = await proxy(pedido("/admin", "GET", basic(SENHA)));
    expect(r.status).toBe(503);
  });
});

/** Varre o código das rotas: guardas contra regressões que os testes de comportamento não pegam. */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}

describe("guardas no código das rotas", () => {
  const raiz = join(process.cwd(), "src", "app", "api");
  const rotas = arquivos(raiz).filter((f) => f.endsWith("route.ts"));

  it("a rota pública que deixava o cliente escolher o valor da cobrança não existe", () => {
    expect(existsSync(join(raiz, "processos", "[id]", "pagamentos", "route.ts"))).toBe(false);
  });

  it("nenhuma rota lê um valor de cobrança vindo do navegador", () => {
    for (const f of rotas) {
      const codigo = readFileSync(f, "utf8");
      expect(codigo, f).not.toMatch(/(body|corpo|dados)\??\.valorCentavos/);
    }
  });

  it("nenhuma rota devolve o cliente inteiro (nome, WhatsApp, e-mail) numa rota aberta", () => {
    const abertas = rotas.filter((f) => !f.includes(`${join("api", "admin")}`));
    for (const f of abertas) {
      const codigo = readFileSync(f, "utf8");
      if (f.endsWith(join("api", "processos", "route.ts"))) {
        // GET /api/processos é do admin (protegida no proxy): só ela inclui o cliente.
        expect(codigo.split("export async function POST")[1] ?? "", f).not.toMatch(/include:\s*\{\s*cliente/);
        continue;
      }
      expect(codigo, f).not.toMatch(/include:\s*\{[^}]*cliente:\s*true/);
    }
  });

  it("nenhum componente usa dangerouslySetInnerHTML (risco de XSS)", () => {
    const comps = arquivos(join(process.cwd(), "src")).filter((f) => /\.(tsx|ts)$/.test(f) && !f.endsWith(".test.ts"));
    for (const f of comps) expect(readFileSync(f, "utf8"), f).not.toContain("dangerouslySetInnerHTML");
  });

  it("nenhuma variável pública (NEXT_PUBLIC_) carrega segredo", () => {
    const todos = arquivos(join(process.cwd(), "src")).filter((f) => /\.(tsx|ts)$/.test(f));
    const publicas = new Set<string>();
    for (const f of todos) {
      for (const m of readFileSync(f, "utf8").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) publicas.add(m[0]);
    }
    for (const nome of publicas) expect(nome, nome).not.toMatch(/KEY|SECRET|TOKEN|PASSWORD|SENHA|DATABASE/);
  });
});
