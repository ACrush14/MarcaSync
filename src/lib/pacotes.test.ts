// @ts-expect-error: o catálogo é um módulo .mjs sem tipos
import { PRODUTOS } from "../../scripts/produtos-abacatepay.mjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { calcularGru, REGIMES } from "./gru";
import { PARCELAS_MAX_CARTAO, produtoDoPacote, urlDoPedido, urlDoSite, valorDoPacote } from "./pacotes";
import { SETUP_CENTAVOS } from "./planos";

const produtos = PRODUTOS as Array<{ externalId: string; price: number }>;
const preco = (id: string) => produtos.find((p) => p.externalId === id)?.price;

afterEach(() => vi.unstubAllEnvs());

describe("produtoDoPacote", () => {
  it.each([
    [{ especificacaoLivre: false, comDesconto: true }, "marcasync-registro-389-desconto"],
    [{ especificacaoLivre: false, comDesconto: false }, "marcasync-registro-389-integral"],
    [{ especificacaoLivre: true, comDesconto: true }, "marcasync-registro-394-desconto"],
    [{ especificacaoLivre: true, comDesconto: false }, "marcasync-registro-394-integral"],
  ])("%j -> %s", (escolha, esperado) => {
    expect(produtoDoPacote(escolha)).toBe(esperado);
  });

  it("todo produto escolhido existe no catálogo do AbacatePay", () => {
    for (const livre of [false, true]) {
      for (const desc of [false, true]) {
        expect(preco(produtoDoPacote({ especificacaoLivre: livre, comDesconto: desc }))).toBeDefined();
      }
    }
  });

  it("para cada regime e especificação, o preço do produto é o valor do pacote calculado no servidor", () => {
    for (const regime of REGIMES) {
      for (const participa of [false, true]) {
        for (const livre of [false, true]) {
          const gru = calcularGru(regime, participa, livre);
          const id = produtoDoPacote({ especificacaoLivre: livre, comDesconto: gru.comDesconto });
          expect(preco(id), `${regime} participa=${participa} livre=${livre}`).toBe(valorDoPacote(gru.centavos));
        }
      }
    }
  });
});

describe("valorDoPacote e parcelas", () => {
  it("é o serviço mais a taxa", () => {
    expect(valorDoPacote(44_000)).toBe(SETUP_CENTAVOS + 44_000);
  });
  it("o número de parcelas do cartão é um inteiro de 1 a 12", () => {
    expect(Number.isInteger(PARCELAS_MAX_CARTAO) && PARCELAS_MAX_CARTAO >= 1 && PARCELAS_MAX_CARTAO <= 12).toBe(true);
  });
});

describe("endereço do site", () => {
  it("usa SITE_URL quando é um endereço http(s) válido, sem barra no fim", () => {
    vi.stubEnv("SITE_URL", "https://staging.marcasync.com.br///");
    expect(urlDoSite()).toBe("https://staging.marcasync.com.br");
    expect(urlDoPedido("abc")).toBe("https://staging.marcasync.com.br/pedido/abc");
  });
  it("cai no endereço de produção quando falta ou é inválido", () => {
    vi.stubEnv("SITE_URL", "");
    expect(urlDoSite()).toBe("https://www.marcasync.com.br");
    vi.stubEnv("SITE_URL", "javascript:alert(1)");
    expect(urlDoSite()).toBe("https://www.marcasync.com.br");
  });
  it("o id do processo é codificado na URL", () => {
    vi.stubEnv("SITE_URL", "");
    expect(urlDoPedido("a/b?c")).toBe("https://www.marcasync.com.br/pedido/a%2Fb%3Fc");
  });
});
