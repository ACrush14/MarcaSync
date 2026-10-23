/**
 * Testes de src/lib/risco-area.ts: o risco de colisão olhando o ramo das marcas.
 *
 * Como ler o arquivo: cada `Marca` abaixo é uma marca parecida encontrada. `pct` é a
 * semelhança de som (0 a 100) e `mesmaArea` diz se ela é da mesma classe que o cliente
 * quer (`true`), de outra (`false`) ou se não dá para saber (`null` ou ausente).
 */
import { describe, expect, it } from "vitest";
import { calcularRisco, pctDoRisco } from "./risco-area";

type Marca = { nome: string; pct: number; mesmaArea?: boolean | null };
const m = (nome: string, pct: number, mesmaArea?: boolean | null): Marca => ({
  nome,
  pct,
  mesmaArea,
});

describe("calcularRisco, quando dá para separar por ramo", () => {
  it("o risco principal é a mais parecida entre as do mesmo ramo", () => {
    const r = calcularRisco([m("A", 90, false), m("B", 70, true), m("C", 40, true)]);
    expect(r.modo).toBe("por-ramo");
    expect(r.principal?.nome).toBe("B");
    expect(r.noRamo?.nome).toBe("B");
    expect(r.outrosRamos?.nome).toBe("A");
  });

  // A marca de outro ramo, por mais parecida que seja, não puxa o risco principal.
  it("uma marca muito parecida de outro ramo não define o risco principal", () => {
    const r = calcularRisco([m("Famosa", 100, false), m("Pequena", 20, true)]);
    expect(r.principal?.nome).toBe("Pequena");
    expect(pctDoRisco(r)).toBe(20);
  });

  // Sem classe informada não dá para descartar: entra no risco principal, por segurança.
  it("marca sem classe e mais parecida que a do ramo vira o risco principal", () => {
    const r = calcularRisco([m("Sem classe", 95, null), m("No ramo", 50, true)]);
    expect(r.principal?.nome).toBe("Sem classe");
    expect(r.incerta?.nome).toBe("Sem classe");
    expect(r.noRamo?.nome).toBe("No ramo");
  });

  it("em empate, vale a confirmada no ramo", () => {
    const r = calcularRisco([m("Sem classe", 80, null), m("No ramo", 80, true)]);
    expect(r.principal?.nome).toBe("No ramo");
  });

  // Só há marcas de outros ramos: não há risco no ramo, e o pedido guarda 0.
  it("só marcas de outros ramos: não há risco principal", () => {
    const r = calcularRisco([m("X", 100, false), m("Y", 60, false)]);
    expect(r.modo).toBe("por-ramo");
    expect(r.principal).toBe(null);
    expect(r.outrosRamos?.nome).toBe("X");
    expect(pctDoRisco(r)).toBe(0);
  });
});

describe("calcularRisco, quando não dá para separar", () => {
  // Descrição vaga: todas vêm sem resposta, e o risco é o de antes (a mais parecida).
  it("usa a mais parecida de todas", () => {
    const r = calcularRisco([m("A", 30, null), m("B", 56, null), m("C", 10)]);
    expect(r.modo).toBe("geral");
    expect(r.principal?.nome).toBe("B");
    expect(pctDoRisco(r)).toBe(56);
    expect(r.noRamo).toBe(null);
    expect(r.outrosRamos).toBe(null);
  });

  it("lista vazia: sem principal e risco 0", () => {
    const r = calcularRisco<Marca>([]);
    expect(r.modo).toBe("geral");
    expect(r.principal).toBe(null);
    expect(pctDoRisco(r)).toBe(0);
  });
});
