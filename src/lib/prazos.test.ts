/**
 * Testes de src/lib/prazos.ts: quando um prazo vence e quando o sistema deve avisar.
 */
import { describe, expect, it } from "vitest";
import {
  avisoPendente,
  dataPorExtenso,
  diasRestantes,
  nivelAtual,
  numeroPedidoValido,
  prazosDoProtocolo,
  somarDias,
} from "./prazos";

const base = new Date("2026-11-01T15:00:00Z");
const emDias = (n: number) => somarDias(base, n);

describe("prazosDoProtocolo", () => {
  it("a procuração vence 60 dias depois do protocolo", () => {
    const p = prazosDoProtocolo(base);
    expect(p).toHaveLength(1);
    expect(p[0]?.tipo).toBe("procuracao");
    expect(p[0]?.venceEm.toISOString()).toBe("2026-12-31T15:00:00.000Z");
  });
});

describe("diasRestantes", () => {
  it("arredonda para cima", () => {
    expect(diasRestantes(emDias(10), base)).toBe(10);
    expect(diasRestantes(new Date(base.getTime() + 60 * 60 * 1000), base)).toBe(1);
  });
  it("zero ou negativo é vencido", () => {
    expect(diasRestantes(base, base)).toBe(0);
    expect(diasRestantes(emDias(-3), base)).toBe(-3);
  });
});

describe("nivelAtual", () => {
  it.each([
    [60, null],
    [31, null],
    [30, 30],
    [8, 30],
    [7, 7],
    [3, 7],
    [2, 2],
    [1, 2],
    [0, 0],
    [-5, 0],
  ])("faltando %i dias o nível é %s", (dias, nivel) => {
    expect(nivelAtual(emDias(dias as number), base)).toBe(nivel);
  });
});

describe("avisoPendente", () => {
  const prazo = (dias: number, ultimo: number | null, concluido = false) => ({
    venceEm: emDias(dias),
    concluidoEm: concluido ? base : null,
    ultimoAvisoDias: ultimo,
  });

  it("não avisa se ainda falta mais de 30 dias", () => {
    expect(avisoPendente(prazo(45, null), base)).toBe(null);
  });
  it("avisa o primeiro nível quando entra nos 30 dias", () => {
    expect(avisoPendente(prazo(29, null), base)).toBe(30);
  });
  it("não repete o mesmo nível no dia seguinte", () => {
    expect(avisoPendente(prazo(28, 30), base)).toBe(null);
  });
  it("avisa de novo só quando chega a um nível mais urgente", () => {
    expect(avisoPendente(prazo(7, 30), base)).toBe(7);
    expect(avisoPendente(prazo(6, 7), base)).toBe(null);
    expect(avisoPendente(prazo(2, 7), base)).toBe(2);
    expect(avisoPendente(prazo(-1, 2), base)).toBe(0);
  });
  it("pula níveis se a rotina ficou parada", () => {
    expect(avisoPendente(prazo(1, null), base)).toBe(2);
  });
  it("depois de vencido e avisado, não avisa mais", () => {
    expect(avisoPendente(prazo(-10, 0), base)).toBe(null);
  });
  it("prazo concluído nunca avisa", () => {
    expect(avisoPendente(prazo(1, null, true), base)).toBe(null);
  });
});

describe("numeroPedidoValido", () => {
  it("aceita 9 dígitos, com ou sem separadores", () => {
    expect(numeroPedidoValido("123456789")).toBe("123456789");
    expect(numeroPedidoValido("123.456.789")).toBe("123456789");
    expect(numeroPedidoValido(" 987 654 321 ")).toBe("987654321");
  });
  it("recusa tamanho errado ou letras", () => {
    expect(numeroPedidoValido("12345678")).toBe(null);
    expect(numeroPedidoValido("1234567890")).toBe(null);
    expect(numeroPedidoValido("")).toBe(null);
    expect(numeroPedidoValido("abcdefghi")).toBe(null);
  });
});

describe("dataPorExtenso", () => {
  it("escreve a data em português no fuso de Fortaleza", () => {
    expect(dataPorExtenso(new Date("2026-12-31T15:00:00Z"))).toBe("31 de dezembro de 2026");
  });
  it("não pula de dia por causa do fuso (meia-noite UTC ainda é o dia anterior em Fortaleza)", () => {
    expect(dataPorExtenso(new Date("2026-12-31T01:00:00Z"))).toBe("30 de dezembro de 2026");
  });
});
