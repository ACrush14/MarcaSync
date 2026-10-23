/**
 * Testes de src/lib/catalogo.ts: a lista pré-aprovada do INPI (Nice 13 + listas auxiliares).
 */
import { describe, expect, it } from "vitest";
import { analisarEspecificacao, buscarTermos, normalizarTermo, termoOficial } from "./catalogo";
import dados from "../data/termos-preaprovados.json";

describe("normalizarTermo", () => {
  it("ignora acento, caixa, asterisco e espaços repetidos", () => {
    expect(normalizarTermo("  Pão   de  Queijo* ")).toBe("pao de queijo");
    expect(normalizarTermo("BOLOS")).toBe("bolos");
  });
});

describe("dados do catálogo", () => {
  it("tem as 45 classes, e cada uma tem termos", () => {
    const classes = dados.classes as Record<string, string[]>;
    expect(Object.keys(classes)).toHaveLength(45);
    for (let c = 1; c <= 45; c++) {
      expect(classes[String(c)]?.length).toBeGreaterThan(20);
    }
  });

  it("nenhum termo é curto demais nem termina com asterisco", () => {
    for (const termos of Object.values(dados.classes as Record<string, string[]>)) {
      for (const t of termos) {
        expect(t.trim().length).toBeGreaterThanOrEqual(3);
        expect(t.endsWith("*")).toBe(false);
      }
    }
  });
});

describe("termoOficial", () => {
  it("acha o termo na classe certa, com a grafia do INPI", () => {
    expect(termoOficial("30", "bolos")).toBe("Bolos");
    expect(termoOficial("30", "PAO DE QUEIJO")).toBe("Pão de queijo");
  });

  it("não acha um termo em classe errada nem um termo inventado", () => {
    expect(termoOficial("25", "bolos")).toBe(null);
    expect(termoOficial("30", "bolo vegano sem glúten sob medida")).toBe(null);
    expect(termoOficial("99", "bolos")).toBe(null);
  });
});

describe("buscarTermos", () => {
  it("acha por palavras em qualquer ordem e põe quem começa pela busca primeiro", () => {
    const r = buscarTermos("30", "bolo");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]).toBe("Bolos");
    for (const t of r) expect(normalizarTermo(t)).toContain("bolo");
  });

  it("respeita o limite e devolve vazio sem busca ou classe errada", () => {
    expect(buscarTermos("30", "a", 3).length).toBeLessThanOrEqual(3);
    expect(buscarTermos("30", "   ")).toEqual([]);
    expect(buscarTermos("99", "bolo")).toEqual([]);
  });
});

describe("analisarEspecificacao", () => {
  it("separa itens da lista dos livres e usa a grafia oficial", () => {
    const a = analisarEspecificacao("30", ["bolos", "bolo vegano sem glúten sob medida"]);
    expect(a.preAprovados).toEqual(["Bolos"]);
    expect(a.livres).toEqual(["bolo vegano sem glúten sob medida"]);
    expect(a.todosPreAprovados).toBe(false);
  });

  it("só itens da lista: todosPreAprovados verdadeiro", () => {
    expect(analisarEspecificacao("30", ["Bolos", "Pão de queijo"]).todosPreAprovados).toBe(true);
  });

  it("descarta vazios e repetidos (mesmo com acento ou caixa diferentes)", () => {
    const a = analisarEspecificacao("30", ["Bolos", "bolos", "  ", "BOLOS*"]);
    expect(a.preAprovados).toEqual(["Bolos"]);
    expect(a.livres).toEqual([]);
  });
});
