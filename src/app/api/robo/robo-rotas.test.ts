import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  processo: { findMany: vi.fn(), findUnique: vi.fn() },
  conferenciaGru: { create: vi.fn() },
  roboEstado: { findUnique: vi.fn(), upsert: vi.fn() },
}));
const notificar = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/notificar", () => ({ notificar }));

import { zerarLimites } from "@/lib/limite-publico";
import { GET as tarefas } from "./tarefas/route";
import { POST as conferencia } from "./tarefas/[id]/conferencia/route";
import { POST as estado } from "./estado/route";
import { GET as estadoNoAdmin } from "../admin/robo/route";

const TOKEN = "segredo-do-robo";
const com = (corpo?: unknown, token: string | null = TOKEN, ip = "1.1.1.1"): Request =>
  new Request("http://x/api/robo", {
    method: corpo === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: corpo === undefined ? undefined : typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
const ctx = (id = "p1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  zerarLimites();
  vi.stubEnv("ROBO_TOKEN", TOKEN);
});

describe("porta das rotas do robô", () => {
  it.each([
    ["tarefas", () => tarefas(com(undefined, null))],
    ["tarefas (token errado)", () => tarefas(com(undefined, "errado"))],
    ["conferência", () => conferencia(com({}, "errado"), ctx())],
    ["estado", () => estado(com({ sessao: "ok" }, null))],
  ])("%s sem o token certo: 401 e nada acontece", async (_n, chamar) => {
    const r = await chamar();
    expect(r.status).toBe(401);
    expect(db.processo.findMany).not.toHaveBeenCalled();
    expect(db.conferenciaGru.create).not.toHaveBeenCalled();
    expect(db.roboEstado.upsert).not.toHaveBeenCalled();
  });

  it("sem ROBO_TOKEN no servidor, as rotas ficam desligadas (503), mesmo com cabeçalho", async () => {
    vi.stubEnv("ROBO_TOKEN", "");
    expect((await tarefas(com(undefined, "qualquer"))).status).toBe(503);
    expect((await estado(com({ sessao: "ok" }, ""))).status).toBe(503);
  });

  it("quem insiste com o token errado é freado (429)", async () => {
    const codigos: number[] = [];
    for (let i = 0; i < 130; i++) codigos.push((await tarefas(com(undefined, "errado", "9.9.9.9"))).status);
    expect(codigos).toContain(429);
    expect(codigos[0]).toBe(401);
  });
});

describe("GET /api/robo/tarefas", () => {
  it("devolve só o necessário para conferir, sem dado pessoal", async () => {
    db.processo.findMany.mockResolvedValue([
      {
        id: "p1",
        marca: "Kaza Doce",
        pedidoRegistro: { especificacaoLivre: false, gruComDesconto: true, gruCentavos: 44_000 },
      },
      {
        id: "p2",
        marca: "Outra",
        pedidoRegistro: { especificacaoLivre: true, gruComDesconto: false, gruCentavos: 172_000 },
      },
    ]);
    const corpo = await (await tarefas(com())).json();
    expect(corpo.tarefas).toEqual([
      { processoId: "p1", marca: "Kaza Doce", servico: "389", classes: 1, comDesconto: true, esperadoCentavos: 44_000 },
      { processoId: "p2", marca: "Outra", servico: "394", classes: 1, comDesconto: false, esperadoCentavos: 172_000 },
    ]);
    expect(JSON.stringify(corpo)).not.toMatch(/documento|cpf|cnpj|email|logradouro|whatsapp/i);
  });

  it("só pede pedidos pagos, com dados, sem taxa paga, sem protocolo e ainda não conferidos", async () => {
    db.processo.findMany.mockResolvedValue([]);
    await tarefas(com());
    const args = db.processo.findMany.mock.calls[0]?.[0];
    expect(args.where.gruPagaInpiEm).toBeNull();
    expect(args.where.protocoladoEm).toBeNull();
    expect(args.where.pagamentos).toEqual({ some: { tipo: "pacote", status: "confirmado" } });
    expect(args.where.pedidoRegistro).toEqual({ isNot: null });
    const regra = JSON.stringify(args.where.NOT);
    expect(regra).toContain('"resultado":"ok"');
    expect(args.take).toBeLessThanOrEqual(10);
    // a escolha dos campos não traz documento nem endereço
    expect(JSON.stringify(args.select)).not.toMatch(/documento|logradouro|email/);
  });

  it("ignora processo sem pedido preenchido", async () => {
    db.processo.findMany.mockResolvedValue([{ id: "p1", marca: "X", pedidoRegistro: null }]);
    expect((await (await tarefas(com())).json()).tarefas).toEqual([]);
  });
});

describe("POST /api/robo/tarefas/:id/conferencia", () => {
  const ok = { resultado: "ok", servico: "389", esperadoCentavos: 44_000, lidoCentavos: 44_000 };
  beforeEach(() => {
    db.processo.findUnique.mockResolvedValue({
      marca: "Kaza Doce",
      protocoladoEm: null,
      pagamentos: [{ tipo: "pacote", status: "confirmado" }],
    });
    db.conferenciaGru.create.mockResolvedValue({ id: "c1", resultado: "ok", createdAt: new Date() });
  });

  it("grava a conferência e avisa o operador", async () => {
    const r = await conferencia(com(ok), ctx());
    expect(r.status).toBe(201);
    expect(db.conferenciaGru.create.mock.calls[0]?.[0].data).toMatchObject({ processoId: "p1", resultado: "ok", servico: "389" });
    expect(notificar).toHaveBeenCalledTimes(1);
    expect(notificar.mock.calls[0]?.[0]).toMatchObject({ para: "operador", processoId: "p1" });
  });

  it("divergência vira aviso de ATENÇÃO", async () => {
    await conferencia(com({ ...ok, resultado: "divergente", lidoCentavos: 88_000 }), ctx());
    expect(notificar.mock.calls[0]?.[0].assunto).toMatch(/^ATENÇÃO/);
  });

  it.each([
    ["pedido não pago", { pagamentos: [{ tipo: "pacote", status: "pendente" }] }],
    ["sem pagamento", { pagamentos: [] }],
    ["só o modelo antigo", { pagamentos: [{ tipo: "setup", status: "confirmado" }] }],
    ["já protocolado", { protocoladoEm: new Date() }],
  ])("recusa (409) %s", async (_n, extra) => {
    db.processo.findUnique.mockResolvedValue({
      marca: "X",
      protocoladoEm: null,
      pagamentos: [{ tipo: "pacote", status: "confirmado" }],
      ...extra,
    });
    expect((await conferencia(com(ok), ctx())).status).toBe(409);
    expect(db.conferenciaGru.create).not.toHaveBeenCalled();
    expect(notificar).not.toHaveBeenCalled();
  });

  it("recusa corpo inválido, 'ok' sem valor igual, JSON quebrado e processo inexistente", async () => {
    expect((await conferencia(com({ ...ok, lidoCentavos: 88_000 }), ctx())).status).toBe(400);
    expect((await conferencia(com({}), ctx())).status).toBe(400);
    expect((await conferencia(com("{ruim"), ctx())).status).toBe(400);
    db.processo.findUnique.mockResolvedValue(null);
    expect((await conferencia(com(ok), ctx("x"))).status).toBe(404);
    expect(db.conferenciaGru.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/robo/estado", () => {
  beforeEach(() => {
    db.roboEstado.findUnique.mockResolvedValue(null);
    db.roboEstado.upsert.mockResolvedValue({});
  });

  it("grava o sinal de vida", async () => {
    const r = await estado(com({ sessao: "ok" }));
    expect(r.status).toBe(200);
    const args = db.roboEstado.upsert.mock.calls[0]?.[0];
    expect(args.where).toEqual({ id: "principal" });
    expect(args.update.vistoEm).toBeInstanceOf(Date);
  });

  it("só avisa quando o estado muda (não a cada sinal)", async () => {
    db.roboEstado.findUnique.mockResolvedValue({ sessao: "expirada" });
    await estado(com({ sessao: "expirada" }));
    expect(notificar).not.toHaveBeenCalled();
    db.roboEstado.findUnique.mockResolvedValue({ sessao: "ok" });
    await estado(com({ sessao: "expirada" }));
    expect(notificar).toHaveBeenCalledTimes(1);
    expect(notificar.mock.calls[0]?.[0].assunto).toContain("entre no e-INPI");
  });

  it("avisa também quando volta ao normal", async () => {
    db.roboEstado.findUnique.mockResolvedValue({ sessao: "expirada" });
    await estado(com({ sessao: "ok" }));
    expect(notificar.mock.calls[0]?.[0].assunto).toContain("voltou ao normal");
  });

  it("a primeira vez em 'ok' não manda aviso nenhum", async () => {
    await estado(com({ sessao: "ok" }));
    expect(notificar).not.toHaveBeenCalled();
  });

  it("recusa estado inventado e JSON quebrado", async () => {
    expect((await estado(com({ sessao: "dormindo" }))).status).toBe(400);
    expect((await estado(com("{ruim"))).status).toBe(400);
    expect(db.roboEstado.upsert).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/robo", () => {
  it("diz se o robô foi visto, a sessão e se está sem sinal", async () => {
    db.roboEstado.findUnique.mockResolvedValue({ vistoEm: new Date(), sessao: "ok", detalhe: null });
    const corpo = await (await estadoNoAdmin()).json();
    expect(corpo).toMatchObject({ visto: true, sessao: "ok", semSinal: false, ligado: true });
  });
  it("nunca visto: sem sinal", async () => {
    db.roboEstado.findUnique.mockResolvedValue(null);
    const corpo = await (await estadoNoAdmin()).json();
    expect(corpo).toMatchObject({ visto: false, semSinal: true });
  });
});
