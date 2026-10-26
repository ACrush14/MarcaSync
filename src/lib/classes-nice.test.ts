import { describe, expect, it } from "vitest";
import dados from "@/data/termos-preaprovados.json";
import {
  CLASSES_DE_PRODUTOS,
  CLASSES_DE_SERVICOS,
  CLASSES_NICE,
  rotuloDaClasse,
} from "./classes-nice";

describe("classes de Nice", () => {
  it("tem as 45 classes, de 1 a 45, cada uma com título", () => {
    const chaves = Object.keys(CLASSES_NICE).map(Number).sort((a, b) => a - b);
    expect(chaves).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
    for (const titulo of Object.values(CLASSES_NICE)) expect(titulo.trim().length).toBeGreaterThan(4);
  });

  it("não repete título", () => {
    const titulos = Object.values(CLASSES_NICE);
    expect(new Set(titulos).size).toBe(titulos.length);
  });

  it("as mesmas 45 classes existem na lista de produtos e serviços do INPI", () => {
    expect(Object.keys(dados.classes).sort()).toEqual(Object.keys(CLASSES_NICE).sort());
  });

  it("produtos são 1 a 34 e serviços 35 a 45, sem sobrar nem faltar", () => {
    expect(CLASSES_DE_PRODUTOS).toHaveLength(34);
    expect(CLASSES_DE_SERVICOS).toHaveLength(11);
    expect(CLASSES_DE_PRODUTOS[0]).toBe("1");
    expect(CLASSES_DE_PRODUTOS.at(-1)).toBe("34");
    expect(CLASSES_DE_SERVICOS[0]).toBe("35");
    expect(CLASSES_DE_SERVICOS.at(-1)).toBe("45");
  });

  it("rotuloDaClasse junta número e título, e não quebra com classe desconhecida", () => {
    expect(rotuloDaClasse("30")).toBe("30 — Café, padaria, confeitaria e condimentos");
    expect(rotuloDaClasse("1")).toBe("1 — Produtos químicos");
    expect(rotuloDaClasse("99")).toBe("99");
    expect(rotuloDaClasse("")).toBe("");
  });
});
