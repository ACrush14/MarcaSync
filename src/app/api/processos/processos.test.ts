/**
 * Testes das rotas públicas de processo: o que elas aceitam, o que devolvem e o que recusam.
 * O banco é simulado; o que se testa é a regra da rota (validação, o que sai na resposta, o que
 * é gravado), não o Prisma.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  cliente: { upsert: vi.fn() },
  processo: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const avisos = vi.hoisted(() => ({ avisarNovoInteresse: vi.fn() }));
vi.mock("@/lib/avisos", () => avisos);
// `after` só existe dentro de um pedido real; no teste ele roda na hora.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (fn: () => unknown) => void fn(),
}));

import { zerarLimites } from "@/lib/limite-publico";
import { POST } from "./route";
import { PATCH } from "./[id]/route";

const post = (corpo: unknown, ip = "1.1.1.1") =>
  new Request("http://x/api/processos", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });

const valido = {
  nomeCliente: "Ana Ramos",
  whatsapp: "(85) 91234-5678",
  marca: "Kaza Doce",
  descricao: "bolos",
  nclCode: "30",
  nclLabel: "Padaria",
  riscoPct: 12.4,
  riscoFonte: "real",
};

beforeEach(() => {
  vi.clearAllMocks();
  zerarLimites();
  db.cliente.upsert.mockResolvedValue({ id: "cli1", nome: "Nome Antigo", whatsapp: "x" });
  db.processo.create.mockResolvedValue({ id: "proc1", status: "resultado" });
  avisos.avisarNovoInteresse.mockResolvedValue({ avisou: true });
});

describe("POST /api/processos", () => {
  it("cria o processo e devolve só o id e a etapa", async () => {
    const r = await POST(post(valido));
    expect(r.status).toBe(201);
    const corpo = await r.json();
    expect(corpo).toEqual({ processo: { id: "proc1", status: "resultado" } });
    expect(JSON.stringify(corpo)).not.toContain("Ana");
  });

  it("avisa você do novo interesse, e uma falha no aviso não derruba o cadastro", async () => {
    const r = await POST(post(valido));
    expect(r.status).toBe(201);
    expect(avisos.avisarNovoInteresse).toHaveBeenCalledWith("proc1");
    avisos.avisarNovoInteresse.mockRejectedValue(new Error("canal fora"));
    expect((await POST(post(valido, "2.2.2.2"))).status).toBe(201);
  });

  it("cadastro recusado não gera aviso", async () => {
    await POST(post({ ...valido, whatsapp: "123" }));
    expect(avisos.avisarNovoInteresse).not.toHaveBeenCalled();
  });

  it("não troca o nome nem o e-mail de quem já é cliente (mesmo WhatsApp)", async () => {
    await POST(post({ ...valido, nomeCliente: "Outra Pessoa", email: "outra@x.com" }));
    const args = db.cliente.upsert.mock.calls[0]?.[0];
    expect(args.update).toEqual({});
    expect(args.create.nome).toBe("Outra Pessoa");
  });

  it("arredonda o risco, limita a 0-100 e descarta classe e fonte inválidas", async () => {
    await POST(post({ ...valido, riscoPct: 250.7, nclCode: "DROP", riscoFonte: "hack" }));
    const dados = db.processo.create.mock.calls[0]?.[0].data;
    expect(dados.riscoPct).toBe(100);
    expect(dados.nclCode).toBeNull();
    expect(dados.riscoFonte).toBeNull();
  });

  it("recusa JSON quebrado com 400", async () => {
    expect((await POST(post("{isto não é json"))).status).toBe(400);
  });

  it("recusa corpo que não é objeto", async () => {
    expect((await POST(post("null"))).status).toBe(400);
  });

  it.each([
    ["sem nome", { ...valido, nomeCliente: "" }],
    ["sem marca", { ...valido, marca: "  " }],
    ["sem WhatsApp", { ...valido, whatsapp: "" }],
    ["WhatsApp curto", { ...valido, whatsapp: "123" }],
    ["tipos errados", { nomeCliente: 1, whatsapp: 2, marca: 3 }],
  ])("recusa %s", async (_nome, corpo) => {
    const r = await POST(post(corpo));
    expect(r.status).toBe(400);
    expect(db.processo.create).not.toHaveBeenCalled();
  });

  it.each([
    ["nome", { nomeCliente: "x".repeat(121) }],
    ["marca", { marca: "m".repeat(121) }],
    ["descrição", { descricao: "d".repeat(2001) }],
    ["e-mail", { email: "e".repeat(201) }],
  ])("recusa %s grande demais", async (_nome, extra) => {
    const r = await POST(post({ ...valido, ...extra }));
    expect(r.status).toBe(400);
    expect(db.processo.create).not.toHaveBeenCalled();
  });

  it("grava texto com aspas e HTML como texto (o Prisma parametriza)", async () => {
    const r = await POST(post({ ...valido, marca: "<script>alert(1)</script>'; DROP TABLE x;--" }));
    expect(r.status).toBe(201);
    expect(db.processo.create.mock.calls[0]?.[0].data.marca).toContain("<script>");
  });

  it("limpa caracteres de controle e invisíveis antes de gravar", async () => {
    await POST(post({ ...valido, marca: "Kaza\u0000 \u200bDoce", nomeCliente: "Ana\nRamos" }));
    const dados = db.processo.create.mock.calls[0]?.[0].data;
    expect(dados.marca).toBe("Kaza Doce");
    expect(db.cliente.upsert.mock.calls[0]?.[0].create.nome).toBe("Ana Ramos");
  });

  it("nome ou marca só com caracteres invisíveis é recusado", async () => {
    expect((await POST(post({ ...valido, marca: "\u200b\u200b" }))).status).toBe(400);
    expect((await POST(post({ ...valido, nomeCliente: "\u0000" }))).status).toBe(400);
  });

  it("recusa WhatsApp de outro país", async () => {
    expect((await POST(post({ ...valido, whatsapp: "+1 555 123 4567" }))).status).toBe(400);
  });

  it.each([
    ["telefone fixo", "(85) 3123-4567"],
    ["DDD que não existe", "(20) 91234-5678"],
    ["número inventado", "(85) 99999-9999"],
    ["dois números", "(85) 91234-5678 / (85) 98888-7777"],
  ])("recusa WhatsApp que não é um celular válido: %s", async (_nome, whatsapp) => {
    const r = await POST(post({ ...valido, whatsapp }));
    expect(r.status).toBe(400);
    expect(db.cliente.upsert).not.toHaveBeenCalled();
  });

  it("freia a rajada: depois de 12 cadastros do mesmo IP responde 429", async () => {
    const codigos: number[] = [];
    for (let i = 0; i < 20; i++) codigos.push((await POST(post(valido, "9.9.9.9"))).status);
    expect(codigos.slice(0, 12).every((c) => c === 201)).toBe(true);
    expect(codigos.slice(12).every((c) => c === 429)).toBe(true);
  });

  it("o freio é por IP: outro IP continua passando", async () => {
    for (let i = 0; i < 20; i++) await POST(post(valido, "9.9.9.9"));
    expect((await POST(post(valido, "8.8.8.8"))).status).toBe(201);
  });
});

const patch = (corpo: unknown) =>
  new Request("http://x/api/processos/p1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
const ctx = { params: Promise.resolve({ id: "p1" }) };

describe("PATCH /api/processos/:id", () => {
  beforeEach(() => {
    db.processo.findUnique.mockResolvedValue({ status: "resultado" });
    db.processo.update.mockResolvedValue({ id: "p1", status: "plano", monitoramento: true });
  });

  it("muda a etapa e o monitoramento e devolve só isso", async () => {
    const r = await PATCH(patch({ status: "plano", monitoramento: true }), ctx);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ processo: { id: "p1", status: "plano", monitoramento: true } });
  });

  it("ignora campos que o cliente não pode mexer (protocolo, número do processo)", async () => {
    await PATCH(
      patch({ status: "plano", protocolo: "FORJADO", numeroProcesso: "123", protocoladoEm: "2026-01-01" }),
      ctx
    );
    const data = db.processo.update.mock.calls[0]?.[0].data;
    expect(Object.keys(data)).toEqual(["status"]);
  });

  it.each(["protocolado", "qualquer coisa", 5, null])("recusa status %j", async (status) => {
    expect((await PATCH(patch({ status }), ctx)).status).toBe(400);
    expect(db.processo.update).not.toHaveBeenCalled();
  });

  it("recusa monitoramento que não é verdadeiro/falso", async () => {
    expect((await PATCH(patch({ monitoramento: "sim" }), ctx)).status).toBe(400);
  });

  it("recusa JSON quebrado com 400", async () => {
    expect((await PATCH(patch("{ruim"), ctx)).status).toBe(400);
  });

  it("404 para processo que não existe", async () => {
    db.processo.findUnique.mockResolvedValue(null);
    expect((await PATCH(patch({ status: "plano" }), ctx)).status).toBe(404);
  });

  it("depois de protocolado o cliente não altera mais nada (409)", async () => {
    db.processo.findUnique.mockResolvedValue({ status: "protocolado" });
    const r = await PATCH(patch({ status: "consulta" }), ctx);
    expect(r.status).toBe(409);
    expect(db.processo.update).not.toHaveBeenCalled();
  });
});
