import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ processo: { findUnique: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { POST } from "./route";

const chamar = (corpo: unknown, bruto?: string) =>
  POST(
    new Request("http://x/api/admin/processos/p1/cadencia", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: bruto ?? JSON.stringify(corpo),
    }),
    { params: Promise.resolve({ id: "p1" }) }
  );

const protocolado = { protocoladoEm: new Date("2026-10-20T12:00:00Z"), numeroProcesso: "905922891", monitoramento: true };

beforeEach(() => {
  vi.clearAllMocks();
  db.processo.findUnique.mockResolvedValue(protocolado);
  db.processo.update.mockResolvedValue({ id: "p1", monitoramentoMensalDesde: new Date() });
});

describe("POST /api/admin/processos/:id/cadencia", () => {
  it("passa para mensal depois de protocolado e com o número do INPI", async () => {
    const r = await chamar({ modo: "mensal" });
    expect(r.status).toBe(200);
    expect(db.processo.update.mock.calls[0]?.[0].data.monitoramentoMensalDesde).toBeInstanceOf(Date);
  });

  it("volta para semanal limpando a data", async () => {
    const r = await chamar({ modo: "semanal" });
    expect(r.status).toBe(200);
    expect(db.processo.update.mock.calls[0]?.[0].data).toEqual({ monitoramentoMensalDesde: null });
  });

  it("mensal exige protocolo feito e número do INPI (409)", async () => {
    db.processo.findUnique.mockResolvedValue({ ...protocolado, protocoladoEm: null });
    expect((await chamar({ modo: "mensal" })).status).toBe(409);
    db.processo.findUnique.mockResolvedValue({ ...protocolado, numeroProcesso: null });
    expect((await chamar({ modo: "mensal" })).status).toBe(409);
    expect(db.processo.update).not.toHaveBeenCalled();
  });

  it("recusa quem não contratou monitoramento (409)", async () => {
    db.processo.findUnique.mockResolvedValue({ ...protocolado, monitoramento: false });
    expect((await chamar({ modo: "semanal" })).status).toBe(409);
  });

  it.each([
    ["modo inventado", { modo: "diario" }, undefined],
    ["sem modo", {}, undefined],
    ["modo de outro tipo", { modo: 1 }, undefined],
    ["JSON quebrado", null, "{ruim"],
    ["corpo nulo", null, "null"],
  ])("recusa %s com 400", async (_n, corpo, bruto) => {
    expect((await chamar(corpo, bruto)).status).toBe(400);
    expect(db.processo.update).not.toHaveBeenCalled();
  });

  it("processo que não existe: 404", async () => {
    db.processo.findUnique.mockResolvedValue(null);
    expect((await chamar({ modo: "semanal" })).status).toBe(404);
  });
});
