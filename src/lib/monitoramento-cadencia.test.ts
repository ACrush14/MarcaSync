/**
 * O monitoramento olha cada processo toda semana até você marcar "protocolo OK"; depois, uma vez por
 * mês, e volta a ser semanal sozinho quando o INPI muda algo. O banco e o INPI são simulados.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  processo: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  situacaoProcesso: { create: vi.fn() },
  alerta: { create: vi.fn(), createMany: vi.fn() },
  leituraRpi: { findUnique: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
}));
const inpi = vi.hoisted(() => ({
  consultarSituacao: vi.fn(),
  buscarProcessosNaEdicao: vi.fn(),
  descobrirEdicaoMaisRecente: vi.fn(),
  verificarSituacao: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("./inpi/busca-client", () => ({ consultarSituacao: inpi.consultarSituacao }));
vi.mock("@/lib/inpi/fetch-rpi", () => ({
  buscarProcessosNaEdicao: inpi.buscarProcessosNaEdicao,
  descobrirEdicaoMaisRecente: inpi.descobrirEdicaoMaisRecente,
}));

import { verificarSituacao } from "./monitor-situacao";
import { rodarMonitoramento } from "./monitor-rpi";

const agora = new Date("2026-10-25T12:00:00Z");
const dias = (n: number) => new Date(agora.getTime() - n * 86_400_000);

describe("verificarSituacao: mudança no INPI volta o processo para semanal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockResolvedValue([]);
    db.processo.update.mockReturnValue({});
    db.situacaoProcesso.create.mockReturnValue({});
    db.alerta.create.mockReturnValue({});
  });

  it("situação diferente: grava o alerta e zera o modo mensal", async () => {
    inpi.consultarSituacao.mockResolvedValue("IPAS016");
    const r = await verificarSituacao({ id: "p1", numeroProcesso: "905922891", situacaoInpi: "IPAS006" });
    expect(r).toBe("mudou");
    const data = db.processo.update.mock.calls[0]?.[0].data;
    expect(data.situacaoInpi).toBe("IPAS016");
    expect(data.monitoramentoMensalDesde).toBeNull();
  });

  it("situação igual: só anota a data da verificação e NÃO mexe no modo", async () => {
    inpi.consultarSituacao.mockResolvedValue("IPAS006");
    const r = await verificarSituacao({ id: "p1", numeroProcesso: "905922891", situacaoInpi: "IPAS006" });
    expect(r).toBe("igual");
    const data = db.processo.update.mock.calls[0]?.[0].data;
    expect("monitoramentoMensalDesde" in data).toBe(false);
    expect(data.situacaoVerificadaEm).toBeInstanceOf(Date);
  });
});

describe("rodarMonitoramento (RPI) respeita a frequência", () => {
  const proc = (id: string, numero: string, extra: Record<string, unknown> = {}) => ({
    id,
    numeroProcesso: numero,
    monitoramentoMensalDesde: null,
    rpiVerificadaEm: null,
    ...extra,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(agora);
    db.leituraRpi.findUnique.mockResolvedValue(null);
    db.leituraRpi.upsert.mockResolvedValue({});
    db.alerta.createMany.mockResolvedValue({ count: 1 });
    db.processo.updateMany.mockResolvedValue({ count: 1 });
    inpi.descobrirEdicaoMaisRecente.mockResolvedValue({ numero: 2900, data: "21/10/2026" });
    inpi.buscarProcessosNaEdicao.mockResolvedValue({ encontrados: [] });
  });
  afterEach(() => vi.useRealTimers());

  it("lê todo processo semanal e só o mensal que já completou o mês", async () => {
    db.processo.findMany.mockResolvedValue([
      proc("sem", "111111111"),
      proc("men-velho", "222222222", { monitoramentoMensalDesde: dias(60), rpiVerificadaEm: dias(30) }),
      proc("men-novo", "333333333", { monitoramentoMensalDesde: dias(60), rpiVerificadaEm: dias(7) }),
      proc("men-nunca", "444444444", { monitoramentoMensalDesde: dias(60), rpiVerificadaEm: null }),
    ]);
    await rodarMonitoramento();
    const numeros = inpi.buscarProcessosNaEdicao.mock.calls[0]?.[1] as string[];
    expect(numeros.sort()).toEqual(["111111111", "222222222", "444444444"]);
    const marcados = db.processo.updateMany.mock.calls.find((c) => c[0].data.rpiVerificadaEm)?.[0];
    expect((marcados.where.id.in as string[]).sort()).toEqual(["men-nunca", "men-velho", "sem"]);
  });

  it("quem teve despacho nesta edição volta para semanal", async () => {
    db.processo.findMany.mockResolvedValue([
      proc("men", "222222222", { monitoramentoMensalDesde: dias(60), rpiVerificadaEm: dias(30) }),
    ]);
    inpi.buscarProcessosNaEdicao.mockResolvedValue({
      encontrados: [{ numero: "222222222", despachos: [{ codigo: "IPAS009", nome: "Oposição apresentada" }] }],
    });
    await rodarMonitoramento();
    const volta = db.processo.updateMany.mock.calls.find((c) => "monitoramentoMensalDesde" in c[0].data)?.[0];
    expect(volta.where.id.in).toEqual(["men"]);
    expect(volta.data.monitoramentoMensalDesde).toBeNull();
  });

  it("sem despacho, o modo mensal fica como está", async () => {
    db.processo.findMany.mockResolvedValue([
      proc("men", "222222222", { monitoramentoMensalDesde: dias(60), rpiVerificadaEm: dias(30) }),
    ]);
    await rodarMonitoramento();
    expect(db.processo.updateMany.mock.calls.some((c) => "monitoramentoMensalDesde" in c[0].data)).toBe(false);
  });

  it("se só há processos mensais fora da vez, não baixa a edição inteira", async () => {
    db.processo.findMany.mockResolvedValue([
      proc("men", "222222222", { monitoramentoMensalDesde: dias(60), rpiVerificadaEm: dias(3) }),
    ]);
    const r = await rodarMonitoramento();
    expect(r.situacao).toBe("sem-processos");
    expect(inpi.buscarProcessosNaEdicao).not.toHaveBeenCalled();
  });
});
