import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ processo: { findMany: vi.fn() } }));
const unico = vi.hoisted(() => ({ verificarSituacao: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("./monitor-situacao", () => ({ verificarSituacao: unico.verificarSituacao }));

import { verificarSituacoes } from "./monitor-situacoes";

const agora = new Date("2026-10-25T12:00:00Z");
const dias = (n: number) => new Date(agora.getTime() - n * 86_400_000);
const proc = (id: string, ultima: Date | null, mensalDesde: Date | null = null) => ({
  id,
  numeroProcesso: `9000000${id.length}`,
  situacaoInpi: "IPAS006",
  situacaoVerificadaEm: ultima,
  monitoramentoMensalDesde: mensalDesde,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(agora);
  unico.verificarSituacao.mockResolvedValue("igual");
});
afterEach(() => vi.useRealTimers());

async function rodar() {
  const promessa = verificarSituacoes(agora);
  await vi.runAllTimersAsync();
  return promessa;
}

describe("verificarSituacoes", () => {
  it("só consulta quem já está na vez: semanal a cada 6+ dias, mensal a cada 27+ dias", async () => {
    db.processo.findMany.mockResolvedValue([
      proc("a", dias(2)), // semanal, ainda cedo
      proc("bb", dias(7)), // semanal, na vez
      proc("ccc", dias(10), dias(90)), // mensal, ainda cedo
      proc("dddd", dias(30), dias(90)), // mensal, na vez
      proc("eeeee", null), // nunca verificado
    ]);
    const r = await rodar();
    const ids = unico.verificarSituacao.mock.calls.map((c) => c[0].id).sort();
    expect(ids).toEqual(["bb", "dddd", "eeeee"]);
    expect(r.verificados).toBe(3);
    expect(r.adiados).toBe(2);
  });

  it("sem ninguém monitorado, não faz nada", async () => {
    db.processo.findMany.mockResolvedValue([]);
    const r = await rodar();
    expect(r).toMatchObject({ verificados: 0, adiados: 0 });
    expect(unico.verificarSituacao).not.toHaveBeenCalled();
  });

  it("só olha processos com monitoramento ligado e número do INPI", async () => {
    db.processo.findMany.mockResolvedValue([]);
    await rodar();
    expect(db.processo.findMany.mock.calls[0]?.[0].where).toEqual({
      monitoramento: true,
      numeroProcesso: { not: null },
    });
  });

  it("a falha de um processo não impede os outros e entra na contagem de erros", async () => {
    db.processo.findMany.mockResolvedValue([proc("bb", dias(8)), proc("ccc", dias(8))]);
    unico.verificarSituacao.mockImplementationOnce(async () => {
      throw new Error("INPI fora");
    });
    unico.verificarSituacao.mockImplementationOnce(async () => {
      throw new Error("INPI fora");
    });
    const r = await rodar();
    expect(r.erros).toBe(1);
    expect(r.verificados).toBe(2);
  });
});
