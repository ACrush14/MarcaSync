/**
 * Testes de src/lib/abacatepay.ts e src/lib/estorno.ts. O `fetch` é trocado por um falso, então
 * nenhum teste fala com o AbacatePay de verdade nem usa dinheiro.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ErroAbacatePay,
  consultarCobranca,
  criarCobrancaPix,
  estornarCobranca,
  extrairIdCobranca,
  segredoConfere,
  statusDoPagamento,
} from "./abacatepay";
import { planoDeEstorno, podeEstornar } from "./estorno";

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("statusDoPagamento", () => {
  it.each([
    ["PAID", "confirmado"],
    ["REFUNDED", "estornado"],
    ["EXPIRED", "expirado"],
    ["CANCELLED", "expirado"],
    ["FAILED", "expirado"],
    ["PENDING", "pendente"],
    ["UNDER_DISPUTE", "pendente"],
    ["QUALQUER_COISA_NOVA", "pendente"],
  ])("%s vira %s", (de, para) => {
    expect(statusDoPagamento(de)).toBe(para);
  });
});

describe("extrairIdCobranca", () => {
  it("acha o id em qualquer lugar do corpo", () => {
    const corpo = JSON.stringify({
      event: "transparent.completed",
      data: { transparent: { id: "pix_char_AbC123xyz" } },
    });
    expect(extrairIdCobranca(corpo)).toBe("pix_char_AbC123xyz");
  });
  it("devolve null se não houver id de Pix", () => {
    expect(extrairIdCobranca('{"data":{"id":"bill_123"}}')).toBe(null);
    expect(extrairIdCobranca("")).toBe(null);
  });
});

describe("segredoConfere", () => {
  it("só aceita o segredo exato", () => {
    expect(segredoConfere("abc123", "abc123")).toBe(true);
    expect(segredoConfere("abc124", "abc123")).toBe(false);
    expect(segredoConfere("", "abc123")).toBe(false);
    expect(segredoConfere(null, "abc123")).toBe(false);
    expect(segredoConfere("abc123", "")).toBe(false);
  });
});

describe("chamadas à API", () => {
  const original = process.env.ABACATEPAY_API_KEY;
  beforeEach(() => {
    process.env.ABACATEPAY_API_KEY = "abc_dev_chave_de_teste";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (original === undefined) delete process.env.ABACATEPAY_API_KEY;
    else process.env.ABACATEPAY_API_KEY = original;
  });

  it("criarCobrancaPix manda o valor em centavos com a chave no cabeçalho", async () => {
    const falso = vi.fn().mockResolvedValue(
      resposta({
        success: true,
        error: null,
        data: {
          id: "pix_char_1",
          amount: 49900,
          status: "PENDING",
          brCode: "000201...",
          expiresAt: "2026-10-25T12:00:00.000Z",
        },
      })
    );
    vi.stubGlobal("fetch", falso);

    const c = await criarCobrancaPix({
      valorCentavos: 49900,
      descricao: "Serviço",
      externalId: "pg_1",
    });

    expect(c).toMatchObject({
      id: "pix_char_1",
      valorCentavos: 49900,
      status: "PENDING",
      brCode: "000201...",
    });
    expect(c.expiraEm?.toISOString()).toBe("2026-10-25T12:00:00.000Z");
    const [url, init] = falso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.abacatepay.com/v2/transparents/create");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer abc_dev_chave_de_teste"
    );
    const corpo = JSON.parse(init.body as string);
    expect(corpo).toMatchObject({ method: "PIX", data: { amount: 49900, externalId: "pg_1" } });
  });

  it("consultarCobranca lê o status", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(resposta({ success: true, data: { id: "pix_char_1", status: "PAID" } }))
    );
    expect(await consultarCobranca("pix_char_1")).toMatchObject({
      id: "pix_char_1",
      status: "PAID",
    });
  });

  it("estornarCobranca manda só o id e o motivo, nunca um valor", async () => {
    const falso = vi
      .fn()
      .mockResolvedValue(resposta({ success: true, data: { id: "refund_9", status: "REFUNDED" } }));
    vi.stubGlobal("fetch", falso);
    const r = await estornarCobranca("pix_char_1", "pedido cancelado");
    expect(r).toEqual({ estornoId: "refund_9", status: "REFUNDED" });
    const corpo = JSON.parse((falso.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(corpo).toEqual({ id: "pix_char_1", reason: "pedido cancelado" });
  });

  it("erro da API vira ErroAbacatePay com a mensagem e o status", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(resposta({ success: false, error: "TRANSACTION_NOT_REFUNDABLE" }, 400))
    );
    await expect(estornarCobranca("pix_char_1")).rejects.toMatchObject({
      name: "ErroAbacatePay",
      message: "TRANSACTION_NOT_REFUNDABLE",
      status: 400,
    });
  });

  it("falha de rede vira ErroAbacatePay", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede caiu")));
    await expect(consultarCobranca("pix_char_1")).rejects.toBeInstanceOf(ErroAbacatePay);
  });

  it("sem chave configurada, recusa antes de chamar a rede", async () => {
    delete process.env.ABACATEPAY_API_KEY;
    const falso = vi.fn();
    vi.stubGlobal("fetch", falso);
    await expect(consultarCobranca("pix_char_1")).rejects.toThrow("ABACATEPAY_API_KEY");
    expect(falso).not.toHaveBeenCalled();
  });
});

describe("regra de estorno", () => {
  it("antes de pagar a GRU ao INPI, volta tudo", () => {
    const s = { gruPagaAoInpi: false, protocolado: false };
    expect(planoDeEstorno(s)).toMatchObject({ servico: true, gru: true });
    expect(podeEstornar("setup", s)).toBe(true);
    expect(podeEstornar("gru", s)).toBe(true);
  });

  it("GRU paga ao INPI e sem protocolo: volta só o serviço", () => {
    const s = { gruPagaAoInpi: true, protocolado: false };
    expect(planoDeEstorno(s)).toMatchObject({ servico: true, gru: false });
    expect(podeEstornar("setup", s)).toBe(true);
    expect(podeEstornar("gru", s)).toBe(false);
  });

  it("depois do protocolo, nada volta", () => {
    const s = { gruPagaAoInpi: true, protocolado: true };
    expect(podeEstornar("setup", s)).toBe(false);
    expect(podeEstornar("gru", s)).toBe(false);
    // mesmo que a GRU conste como não paga, protocolado vale mais
    expect(podeEstornar("setup", { gruPagaAoInpi: false, protocolado: true })).toBe(false);
  });

  it("monitoramento nunca é estornado por esta regra", () => {
    expect(podeEstornar("monitoramento", { gruPagaAoInpi: false, protocolado: false })).toBe(false);
  });
});
