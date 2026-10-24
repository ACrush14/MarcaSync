import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processos: vi.fn(),
  jaAvisou: vi.fn(),
  notificar: vi.fn(),
}));
vi.mock("./db", () => ({
  prisma: { processo: { findMany: mocks.processos }, notificacao: { findFirst: mocks.jaAvisou } },
}));
vi.mock("./notificar", () => ({ notificar: mocks.notificar }));

import { avisarContatos } from "./avisos";

// 24/10/2026, 15:00 em Fortaleza
const agora = new Date("2026-10-24T18:00:00Z");
const lead = (extra: Record<string, unknown>) => ({
  marca: "Kaza Doce",
  interesse: "interessado",
  proximoContatoEm: new Date("2026-10-24T12:00:00Z"),
  ultimoContatoEm: null,
  anotacoes: null,
  cliente: { nome: "Ana Maria Ramos" },
  pagamentos: [],
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.jaAvisou.mockResolvedValue(null);
});

describe("avisarContatos", () => {
  it("manda um aviso com os contatos de hoje e os atrasados", async () => {
    mocks.processos.mockResolvedValue([
      lead({}),
      lead({ marca: "Nubank", proximoContatoEm: new Date("2026-10-20T12:00:00Z"), interesse: "acompanhar" }),
      lead({ marca: "Futuro", proximoContatoEm: new Date("2026-11-30T12:00:00Z") }),
    ]);
    const r = await avisarContatos(agora);
    expect(r).toEqual({ contatos: 2, avisou: true });
    expect(mocks.notificar).toHaveBeenCalledTimes(1);
    const aviso = mocks.notificar.mock.calls[0]?.[0];
    expect(aviso.para).toBe("operador");
    expect(aviso.assunto).toBe("Contatos para fazer hoje: 2");
    expect(aviso.texto).toContain("Ana: Kaza Doce");
    expect(aviso.texto).toContain("Ana: Nubank");
    expect(aviso.texto).not.toContain("Futuro");
    expect(aviso.texto).not.toContain("Maria"); // só o primeiro nome
  });

  it("não avisa de quem já pagou o serviço", async () => {
    mocks.processos.mockResolvedValue([
      lead({ pagamentos: [{ tipo: "setup", status: "confirmado" }] }),
    ]);
    expect(await avisarContatos(agora)).toEqual({ contatos: 0, avisou: false });
    expect(mocks.notificar).not.toHaveBeenCalled();
  });

  it("não avisa quando não há ninguém para contatar", async () => {
    mocks.processos.mockResolvedValue([lead({ proximoContatoEm: new Date("2026-12-01T12:00:00Z") })]);
    expect(await avisarContatos(agora)).toEqual({ contatos: 0, avisou: false });
  });

  it("não repete o aviso no mesmo dia", async () => {
    mocks.processos.mockResolvedValue([lead({})]);
    mocks.jaAvisou.mockResolvedValue({ id: "n1" });
    expect(await avisarContatos(agora)).toEqual({ contatos: 1, avisou: false });
    expect(mocks.notificar).not.toHaveBeenCalled();
  });

  it("procura aviso anterior só nas últimas 20 horas", async () => {
    mocks.processos.mockResolvedValue([lead({})]);
    await avisarContatos(agora);
    const filtro = mocks.jaAvisou.mock.calls[0]?.[0].where;
    expect(filtro.assunto.startsWith).toBe("Contatos para fazer");
    expect(filtro.createdAt.gte.getTime()).toBe(agora.getTime() - 20 * 3600_000);
  });

  it("lista no máximo 15 pessoas e diz quantas ficaram de fora", async () => {
    mocks.processos.mockResolvedValue(Array.from({ length: 18 }, (_, i) => lead({ marca: `Marca ${i}` })));
    await avisarContatos(agora);
    const texto = mocks.notificar.mock.calls[0]?.[0].texto as string;
    expect(texto.split("\n").filter((l) => l.startsWith("•"))).toHaveLength(15);
    expect(texto).toContain("e mais 3");
  });
});
