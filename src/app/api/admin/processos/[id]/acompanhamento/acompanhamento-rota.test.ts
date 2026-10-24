import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ processo: { update: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { PATCH } from "./route";

const chamar = (corpo: unknown, bruto?: string) =>
  PATCH(
    new Request("http://x/api/admin/processos/p1/acompanhamento", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: bruto ?? JSON.stringify(corpo),
    }),
    { params: Promise.resolve({ id: "p1" }) }
  );

beforeEach(() => {
  vi.clearAllMocks();
  db.processo.update.mockResolvedValue({
    id: "p1",
    interesse: "interessado",
    proximoContatoEm: new Date("2026-11-03T12:00:00Z"),
    ultimoContatoEm: null,
    anotacoes: "ok",
  });
});

describe("PATCH /api/admin/processos/:id/acompanhamento", () => {
  it("grava só o que foi enviado e devolve os campos do acompanhamento", async () => {
    const r = await chamar({ interesse: "interessado", proximoContatoEm: "2026-11-03", anotacoes: " ok " });
    expect(r.status).toBe(200);
    const args = db.processo.update.mock.calls[0]?.[0];
    expect(args.where).toEqual({ id: "p1" });
    expect(Object.keys(args.data).sort()).toEqual(["anotacoes", "interesse", "proximoContatoEm"]);
    expect(args.data.anotacoes).toBe("ok");
    expect(Object.keys((await r.json()).processo).sort()).toEqual(
      ["anotacoes", "id", "interesse", "proximoContatoEm", "ultimoContatoEm"]
    );
  });

  it("'falei com a pessoa agora' grava a data do último contato", async () => {
    await chamar({ contatei: true });
    expect(db.processo.update.mock.calls[0]?.[0].data.ultimoContatoEm).toBeInstanceOf(Date);
  });

  it("não deixa mexer em campos que não são do acompanhamento", async () => {
    await chamar({ interesse: "novo", status: "protocolado", numeroProcesso: "123456789", marca: "Outra" });
    const data = db.processo.update.mock.calls[0]?.[0].data;
    expect(Object.keys(data)).toEqual(["interesse"]);
  });

  it.each([
    ["interesse inventado", { interesse: "quente" }],
    ["data impossível", { proximoContatoEm: "2026-02-30" }],
    ["anotação de outro tipo", { anotacoes: ["x"] }],
    ["nada para salvar", {}],
    ["só campos alheios", { status: "protocolado" }],
  ])("recusa %s com 400", async (_n, corpo) => {
    expect((await chamar(corpo)).status).toBe(400);
    expect(db.processo.update).not.toHaveBeenCalled();
  });

  it("recusa JSON quebrado e corpo que não é objeto", async () => {
    expect((await chamar(null, "{ruim")).status).toBe(400);
    expect((await chamar(null, "null")).status).toBe(400);
    expect((await chamar(null, "[1,2]")).status).toBe(400);
  });

  it("404 quando o processo não existe", async () => {
    db.processo.update.mockRejectedValue(new Error("not found"));
    expect((await chamar({ interesse: "novo" })).status).toBe(404);
  });
});
