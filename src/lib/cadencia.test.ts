import { describe, expect, it } from "vitest";
import { INTERVALO_DIAS, estaDevido, modoDoMonitoramento, podeIrParaMensal } from "./cadencia";

const agora = new Date("2026-10-25T12:00:00Z");
const dias = (n: number) => new Date(agora.getTime() - n * 86_400_000);

describe("modoDoMonitoramento", () => {
  it("é semanal por padrão e mensal quando há data de início do modo mensal", () => {
    expect(modoDoMonitoramento({ monitoramentoMensalDesde: null })).toBe("semanal");
    expect(modoDoMonitoramento({ monitoramentoMensalDesde: dias(3) })).toBe("mensal");
    expect(modoDoMonitoramento({ monitoramentoMensalDesde: "2026-10-01T00:00:00Z" })).toBe("mensal");
  });
});

describe("estaDevido", () => {
  it("nunca verificado: sempre devido", () => {
    expect(estaDevido("semanal", null, agora)).toBe(true);
    expect(estaDevido("mensal", undefined, agora)).toBe(true);
    expect(estaDevido("mensal", "lixo", agora)).toBe(true);
  });

  it("semanal: devido a partir de 6 dias (a rotina diária não pula a semana)", () => {
    expect(estaDevido("semanal", dias(5), agora)).toBe(false);
    expect(estaDevido("semanal", dias(INTERVALO_DIAS.semanal), agora)).toBe(true);
    expect(estaDevido("semanal", dias(7), agora)).toBe(true);
  });

  it("mensal: devido a partir de 27 dias, e não antes", () => {
    expect(estaDevido("mensal", dias(7), agora)).toBe(false);
    expect(estaDevido("mensal", dias(26), agora)).toBe(false);
    expect(estaDevido("mensal", dias(INTERVALO_DIAS.mensal), agora)).toBe(true);
    expect(estaDevido("mensal", dias(40), agora)).toBe(true);
  });

  it("aceita a data como texto", () => {
    expect(estaDevido("semanal", dias(10).toISOString(), agora)).toBe(true);
    expect(estaDevido("semanal", dias(1).toISOString(), agora)).toBe(false);
  });

  it("o mensal é bem mais espaçado que o semanal", () => {
    expect(INTERVALO_DIAS.mensal).toBeGreaterThan(INTERVALO_DIAS.semanal * 3);
  });
});

describe("podeIrParaMensal", () => {
  it("exige o número do INPI e o protocolo feito", () => {
    expect(podeIrParaMensal({ numeroProcesso: "905922891", protocoladoEm: dias(10) })).toEqual({ ok: true });
    expect(podeIrParaMensal({ numeroProcesso: null, protocoladoEm: dias(10) })).toMatchObject({ ok: false });
    expect(podeIrParaMensal({ numeroProcesso: "905922891", protocoladoEm: null })).toMatchObject({ ok: false });
    expect(podeIrParaMensal({ numeroProcesso: "", protocoladoEm: dias(1) })).toMatchObject({ ok: false });
  });
});
