/**
 * Os preços do site, os da cobrança e os produtos do AbacatePay precisam dizer a mesma coisa.
 * Os produtos ficam em scripts/produtos-abacatepay.mjs; aqui conferimos cada um contra o que o
 * servidor realmente cobra (planos.ts e gru.ts). Para conferir o que já está criado no AbacatePay,
 * rode scripts/conferir-produtos-abacatepay.mjs.
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error: o catálogo é um módulo .mjs sem tipos
import { PRODUTOS } from "../../scripts/produtos-abacatepay.mjs";
import { MONITORAMENTO_CENTAVOS, SETUP_CENTAVOS, fmtReais, fmtReaisCurto } from "./planos";
import { REGIMES, calcularGru } from "./gru";

interface Produto {
  externalId: string;
  name: string;
  description: string;
  price: number;
  cycle?: string;
}

const produtos = PRODUTOS as Produto[];
const porId = (id: string): Produto => {
  const p = produtos.find((x) => x.externalId === id);
  if (!p) throw new Error(`produto ${id} não existe no catálogo`);
  return p;
};

describe("catálogo do AbacatePay", () => {
  it("tem ids únicos e preços em centavos inteiros e positivos", () => {
    const ids = produtos.map((p) => p.externalId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of produtos) {
      expect(Number.isInteger(p.price) && p.price > 0, p.externalId).toBe(true);
    }
  });

  it("o serviço custa o que o servidor cobra (setup)", () => {
    expect(porId("marcasync-servico-registro").price).toBe(SETUP_CENTAVOS);
  });

  it("o monitoramento custa o que o servidor cobra e é mensal", () => {
    const m = porId("marcasync-monitoramento-mensal");
    expect(m.price).toBe(MONITORAMENTO_CENTAVOS);
    expect(m.cycle).toBe("MONTHLY");
  });

  const gruPorProduto = [
    ["inpi-gru-389-integral", "outra_empresa", false],
    ["inpi-gru-389-desconto", "mei", false],
    ["inpi-gru-394-integral", "outra_empresa", true],
    ["inpi-gru-394-desconto", "mei", true],
  ] as const;

  it.each(gruPorProduto)("a taxa %s é a que calcularGru devolve", (id, regime, livre) => {
    expect(porId(id).price).toBe(calcularGru(regime, false, livre).centavos);
  });

  const pacotes = [
    ["marcasync-registro-389-desconto", "inpi-gru-389-desconto"],
    ["marcasync-registro-389-integral", "inpi-gru-389-integral"],
    ["marcasync-registro-394-desconto", "inpi-gru-394-desconto"],
    ["marcasync-registro-394-integral", "inpi-gru-394-integral"],
  ] as const;

  it.each(pacotes)("o pacote %s é serviço + taxa (%s)", (pacote, taxa) => {
    expect(porId(pacote).price).toBe(SETUP_CENTAVOS + porId(taxa).price);
  });

  it.each(pacotes)("a descrição de %s cita os valores certos", (pacote, taxa) => {
    // O catálogo usa espaço comum; o formatador, o espaço sem quebra.
    const sp = (t: string) => t.replace(/ /g, " ");
    const d = porId(pacote).description;
    expect(d).toContain(sp(fmtReaisCurto(SETUP_CENTAVOS)));
    expect(d).toContain(sp(fmtReaisCurto(porId(taxa).price)));
  });

  it("todo cálculo de GRU possível cai em um dos quatro produtos de taxa", () => {
    const precosDeTaxa = new Set(gruPorProduto.map(([id]) => porId(id).price));
    for (const regime of REGIMES) {
      for (const participa of [false, true]) {
        for (const livre of [false, true]) {
          const { centavos } = calcularGru(regime, participa, livre);
          expect(precosDeTaxa.has(centavos), `${regime} participa=${participa} livre=${livre}`).toBe(
            true
          );
        }
      }
    }
  });

  it("o desconto é metade exata (nunca cobra a mais por arredondamento)", () => {
    expect(porId("inpi-gru-389-desconto").price * 2).toBe(porId("inpi-gru-389-integral").price);
    expect(porId("inpi-gru-394-desconto").price * 2).toBe(porId("inpi-gru-394-integral").price);
  });
});

describe("escrita dos preços", () => {
  it("fmtReais mostra os centavos e fmtReaisCurto só quando existem", () => {
    const nbsp = "\u00a0";
    expect(fmtReais(49_900)).toBe(`R$${nbsp}499,00`);
    expect(fmtReaisCurto(49_900)).toBe(`R$${nbsp}499`);
    expect(fmtReaisCurto(2_900)).toBe(`R$${nbsp}29`);
    expect(fmtReaisCurto(88_050)).toBe(`R$${nbsp}880,50`);
    expect(fmtReais(137_900)).toBe(`R$${nbsp}1.379,00`);
  });
});
