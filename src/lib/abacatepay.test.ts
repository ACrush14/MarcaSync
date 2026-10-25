/**
 * Testes de src/lib/abacatepay.ts e src/lib/estorno.ts. O `fetch` é trocado por um falso, então
 * nenhum teste fala com o AbacatePay de verdade nem usa dinheiro.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ErroAbacatePay,
  consultarCheckout,
  consultarCobranca,
  consultarPagamento,
  criarCheckout,
  criarCobrancaPix,
  criarPagador,
  ehCheckout,
  esquecerProdutos,
  estornarCheckout,
  estornarCobranca,
  estornarPorId,
  extrairIdCobranca,
  extrairIdsCobranca,
  segredoConfere,
  statusDoPagamento,
} from "./abacatepay";
import { planoDeEstorno, planoDoPacote, podeEstornar } from "./estorno";

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
  it("acha o id de um checkout (bill_...)", () => {
    expect(extrairIdCobranca('{"data":{"checkout":{"id":"bill_Abc123"}}}')).toBe("bill_Abc123");
  });
  it("devolve null se não houver id de cobrança", () => {
    expect(extrairIdCobranca('{"data":{"id":"cus_123"}}')).toBe(null);
    expect(extrairIdCobranca("")).toBe(null);
  });
  it("extrairIdsCobranca lista todos, sem repetir, na ordem do texto", () => {
    const corpo = '{"a":"bill_X1","b":{"id":"pix_char_Y2"},"c":"bill_X1"}';
    expect(extrairIdsCobranca(corpo)).toEqual(["bill_X1", "pix_char_Y2"]);
    expect(extrairIdsCobranca("nada")).toEqual([]);
  });
  it("ehCheckout separa checkout de Pix", () => {
    expect(ehCheckout("bill_abc")).toBe(true);
    expect(ehCheckout("pix_char_abc")).toBe(false);
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

describe("checkout (pagamento único)", () => {
  const original = process.env.ABACATEPAY_API_KEY;
  beforeEach(() => {
    process.env.ABACATEPAY_API_KEY = "abc_dev_chave_de_teste";
    esquecerProdutos();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (original === undefined) delete process.env.ABACATEPAY_API_KEY;
    else process.env.ABACATEPAY_API_KEY = original;
  });

  const produtos = {
    success: true,
    data: [
      { id: "prod_AAA", externalId: "marcasync-registro-389-desconto", status: "ACTIVE" },
      { id: "prod_BBB", externalId: "marcasync-registro-394-desconto", status: "ACTIVE" },
      { id: "prod_ZZZ", externalId: "marcasync-registro-389-integral", status: "ARCHIVED" },
    ],
  };
  const checkoutCriado = {
    success: true,
    data: { id: "bill_1", url: "https://app.abacatepay.com/pay/bill_1", amount: 93900, paidAmount: null, status: "PENDING" },
  };

  it("criarCheckout acha o produto pelo externalId e cobra só aquele item, por Pix e cartão", async () => {
    const falso = vi.fn().mockResolvedValueOnce(resposta(produtos)).mockResolvedValueOnce(resposta(checkoutCriado));
    vi.stubGlobal("fetch", falso);

    const c = await criarCheckout({
      produtoExternalId: "marcasync-registro-389-desconto",
      externalId: "pg_1",
      metadata: { processoId: "p1" },
      urlDeRetorno: "https://www.marcasync.com.br/pedido/p1",
      parcelasMax: 3,
    });

    expect(c).toEqual({
      id: "bill_1",
      status: "PENDING",
      valorCentavos: 93900,
      pagoCentavos: null,
      url: "https://app.abacatepay.com/pay/bill_1",
    });
    const [urlLista] = falso.mock.calls[0] as [string, RequestInit];
    expect(urlLista).toBe("https://api.abacatepay.com/v2/products/list");
    const [url, init] = falso.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://api.abacatepay.com/v2/checkouts/create");
    const corpo = JSON.parse(init.body as string);
    expect(corpo).toEqual({
      items: [{ id: "prod_AAA", quantity: 1 }],
      methods: ["PIX", "CARD"],
      card: { maxInstallments: 3, passFeesToCustomer: false },
      externalId: "pg_1",
      metadata: { processoId: "p1" },
      returnUrl: "https://www.marcasync.com.br/pedido/p1",
      completionUrl: "https://www.marcasync.com.br/pedido/p1",
    });
    // o valor nunca é enviado: ele vem do produto
    expect(JSON.stringify(corpo)).not.toContain("amount");
  });

  it("criarPagador manda os dados do pedido e devolve o id; o checkout usa esse id", async () => {
    const falso = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        resposta(
          url.endsWith("/customers/create")
            ? { success: true, data: { id: "cust_9" } }
            : url.endsWith("/products/list")
              ? produtos
              : checkoutCriado
        )
      )
    );
    vi.stubGlobal("fetch", falso);
    const id = await criarPagador({
      nome: "Doces Kaza LTDA",
      email: "k@x.com",
      documento: "69355003000144",
      celular: "(85) 99999-1234",
      cep: "60000000",
      logradouro: "Rua das Flores",
      numero: "100",
      complemento: "sala 2",
      bairro: "Centro",
      cidade: "Fortaleza",
      uf: "CE",
    });
    expect(id).toBe("cust_9");
    const corpoCliente = JSON.parse((falso.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(corpoCliente).toMatchObject({
      name: "Doces Kaza LTDA",
      taxId: "69355003000144",
      cellphone: "(85) 99999-1234",
      address: { street: "Rua das Flores", state: "CE", complement: "sala 2" },
    });
    await criarCheckout({
      produtoExternalId: "marcasync-registro-389-desconto",
      externalId: "x",
      urlDeRetorno: "https://x",
      parcelasMax: 1,
      pagadorId: id,
    });
    const corpoCheckout = JSON.parse((falso.mock.calls[2] as [string, RequestInit])[1].body as string);
    expect(corpoCheckout.customerId).toBe("cust_9");
  });

  it("checkout sem pagador não manda customerId", async () => {
    const falso = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(resposta(url.endsWith("/products/list") ? produtos : checkoutCriado))
    );
    vi.stubGlobal("fetch", falso);
    await criarCheckout({ produtoExternalId: "marcasync-registro-389-desconto", externalId: "x", urlDeRetorno: "https://x", parcelasMax: 1 });
    const corpo = JSON.parse((falso.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect("customerId" in corpo).toBe(false);
  });

  it("guarda a lista de produtos: o segundo checkout não consulta de novo", async () => {
    // cada chamada precisa de uma resposta nova (o corpo de uma Response só pode ser lido uma vez)
    const falso = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(resposta(url.endsWith("/products/list") ? produtos : checkoutCriado))
    );
    vi.stubGlobal("fetch", falso);
    const base = { externalId: "x", urlDeRetorno: "https://x", parcelasMax: 1 };
    await criarCheckout({ ...base, produtoExternalId: "marcasync-registro-389-desconto" });
    await criarCheckout({ ...base, produtoExternalId: "marcasync-registro-394-desconto" });
    const chamadas = falso.mock.calls.map((c) => (c as [string])[0]);
    expect(chamadas.filter((u) => u.endsWith("/products/list"))).toHaveLength(1);
  });

  it("produto que não existe no AbacatePay (ou está arquivado) dá erro claro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(produtos)));
    await expect(
      criarCheckout({ produtoExternalId: "marcasync-registro-389-integral", externalId: "x", urlDeRetorno: "https://x", parcelasMax: 1 })
    ).rejects.toThrow("não existe no AbacatePay");
    await expect(
      criarCheckout({ produtoExternalId: "nao-existe", externalId: "x", urlDeRetorno: "https://x", parcelasMax: 1 })
    ).rejects.toBeInstanceOf(ErroAbacatePay);
  });

  it("consultarCheckout lê status, valor e quanto foi pago", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        resposta({ success: true, data: { id: "bill_1", url: "u", amount: 93900, paidAmount: 93900, status: "PAID" } })
      )
    );
    expect(await consultarCheckout("bill_1")).toMatchObject({ status: "PAID", valorCentavos: 93900, pagoCentavos: 93900 });
  });

  it("consultarPagamento usa a rota certa para checkout e para Pix antigo", async () => {
    const falso = vi
      .fn()
      .mockResolvedValueOnce(resposta({ success: true, data: { id: "bill_1", url: "u", amount: 100, status: "PAID" } }))
      .mockResolvedValueOnce(resposta({ success: true, data: { id: "pix_char_1", status: "PAID" } }));
    vi.stubGlobal("fetch", falso);
    await consultarPagamento("bill_1");
    await consultarPagamento("pix_char_1");
    expect((falso.mock.calls[0] as [string])[0]).toContain("/checkouts/get?id=bill_1");
    expect((falso.mock.calls[1] as [string])[0]).toContain("/transparents/check?id=pix_char_1");
  });

  it("estornarCheckout manda só o id e o motivo, nunca um valor (a API não faz estorno parcial)", async () => {
    const falso = vi.fn().mockResolvedValue(resposta({ success: true, data: { id: "refund_1", status: "REFUNDED" } }));
    vi.stubGlobal("fetch", falso);
    await estornarCheckout("bill_1", "pedido cancelado");
    const [url, init] = falso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.abacatepay.com/v2/checkouts/refund");
    expect(JSON.parse(init.body as string)).toEqual({ id: "bill_1", reason: "pedido cancelado" });
  });

  it("estornarPorId escolhe checkout ou Pix pelo id", async () => {
    const falso = vi
      .fn()
      .mockImplementation(() => Promise.resolve(resposta({ success: true, data: { id: "r", status: "REFUNDED" } })));
    vi.stubGlobal("fetch", falso);
    await estornarPorId("bill_1");
    await estornarPorId("pix_char_1");
    expect((falso.mock.calls[0] as [string])[0]).toContain("/checkouts/refund");
    expect((falso.mock.calls[1] as [string])[0]).toContain("/transparents/refund");
  });
});

describe("regra de estorno do pagamento único", () => {
  it("antes de pagar a taxa ao INPI: tudo volta, pela API", () => {
    const p = planoDoPacote({ gruPagaAoInpi: false, protocolado: false }, 93900, 49900);
    expect(p).toMatchObject({ acao: "total", devolverCentavos: 93900 });
    expect(podeEstornar("pacote", { gruPagaAoInpi: false, protocolado: false })).toBe(true);
  });

  it("taxa já paga ao INPI: só o serviço volta, e à mão (a API não estorna parte)", () => {
    const p = planoDoPacote({ gruPagaAoInpi: true, protocolado: false }, 93900, 49900);
    expect(p).toMatchObject({ acao: "parcial_manual", devolverCentavos: 49900 });
    expect(podeEstornar("pacote", { gruPagaAoInpi: true, protocolado: false })).toBe(false);
  });

  it("nunca devolve mais do que o cliente pagou", () => {
    expect(planoDoPacote({ gruPagaAoInpi: true, protocolado: false }, 30000, 49900).devolverCentavos).toBe(30000);
  });

  it("depois do protocolo, nada volta", () => {
    for (const gru of [false, true]) {
      const p = planoDoPacote({ gruPagaAoInpi: gru, protocolado: true }, 93900, 49900);
      expect(p).toMatchObject({ acao: "nenhuma", devolverCentavos: 0 });
      expect(podeEstornar("pacote", { gruPagaAoInpi: gru, protocolado: true })).toBe(false);
    }
  });
});
