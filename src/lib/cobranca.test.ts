/**
 * Lado servidor do pagamento único: criar o checkout certo, só confirmar o que o AbacatePay confirma
 * e seguir a regra de devolução. O banco e o AbacatePay são simulados.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  pagamento: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  pedidoRegistro: { findUnique: vi.fn() },
}));
const api = vi.hoisted(() => ({
  criarCheckout: vi.fn(),
  criarPagador: vi.fn(),
  consultarPagamento: vi.fn(),
  estornarPorId: vi.fn(),
}));
const avisos = vi.hoisted(() => ({ avisarPagamentoConfirmado: vi.fn() }));

vi.mock("./db", () => ({ prisma: db }));
vi.mock("./avisos", () => avisos);
vi.mock("./abacatepay", async () => {
  const real = await vi.importActual<typeof import("./abacatepay")>("./abacatepay");
  return { ...real, ...api };
});

import { ErroAbacatePay } from "./abacatepay";
import {
  ErroEstorno,
  confirmarPorProvedor,
  estornarPagamento,
  garantirCobrancas,
  registrarDevolucaoManual,
  sincronizarCobrancas,
} from "./cobranca";

const TOTAL = 93_900;
const pedido = {
  especificacaoLivre: false,
  gruComDesconto: true,
  nome: "Doces Kaza LTDA",
  documento: "69355003000144",
  email: "kaza@exemplo.com.br",
  cep: "60000000",
  logradouro: "Rua das Flores",
  numero: "100",
  complemento: null,
  bairro: "Centro",
  cidade: "Fortaleza",
  uf: "CE",
  processo: { cliente: { whatsapp: "(85) 99999-1234" } },
};
const pendente = (extra: Record<string, unknown> = {}) => ({
  id: "pg1",
  processoId: "p1",
  tipo: "pacote",
  status: "pendente",
  valorCentavos: TOTAL,
  provedorId: null,
  checkoutUrl: null,
  expiraEm: null,
  ...extra,
});
const checkout = (extra: Record<string, unknown> = {}) => ({
  id: "bill_1",
  url: "https://app.abacatepay.com/pay/bill_1",
  status: "PENDING",
  valorCentavos: TOTAL,
  pagoCentavos: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.pedidoRegistro.findUnique.mockResolvedValue(pedido);
  db.pagamento.updateMany.mockResolvedValue({ count: 1 });
  db.pagamento.update.mockResolvedValue({});
  api.criarCheckout.mockResolvedValue(checkout());
  api.criarPagador.mockResolvedValue("cust_1");
});

describe("garantirCobrancas", () => {
  it("cria o checkout do produto certo e guarda o endereço de pagamento", async () => {
    db.pagamento.findMany.mockResolvedValue([pendente()]);
    await garantirCobrancas("p1");
    const args = api.criarCheckout.mock.calls[0]?.[0];
    expect(args.produtoExternalId).toBe("marcasync-registro-389-desconto");
    expect(args.parcelasMax).toBeGreaterThanOrEqual(1);
    expect(args.urlDeRetorno).toContain("/pedido/p1");
    expect(args.metadata).toEqual({ pagamentoId: "pg1", processoId: "p1", tipo: "pacote" });
    expect(db.pagamento.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { provedorId: "bill_1", checkoutUrl: "https://app.abacatepay.com/pay/bill_1", expiraEm: null },
      })
    );
  });

  it("cadastra o pagador com os dados do pedido e passa o id ao checkout (ele não digita de novo)", async () => {
    db.pagamento.findMany.mockResolvedValue([pendente()]);
    await garantirCobrancas("p1");
    expect(api.criarPagador.mock.calls[0]?.[0]).toMatchObject({
      nome: "Doces Kaza LTDA",
      documento: "69355003000144",
      email: "kaza@exemplo.com.br",
      celular: "(85) 99999-1234",
      cep: "60000000",
      uf: "CE",
    });
    expect(api.criarCheckout.mock.calls[0]?.[0].pagadorId).toBe("cust_1");
  });

  it("se não conseguir cadastrar o pagador, o checkout sai mesmo assim", async () => {
    db.pagamento.findMany.mockResolvedValue([pendente()]);
    api.criarPagador.mockImplementation(async () => {
      throw new ErroAbacatePay("sem permissão");
    });
    await garantirCobrancas("p1");
    expect(api.criarCheckout).toHaveBeenCalledTimes(1);
    expect(api.criarCheckout.mock.calls[0]?.[0].pagadorId).toBeUndefined();
  });

  it.each([
    [{ especificacaoLivre: true, gruComDesconto: false }, "marcasync-registro-394-integral"],
    [{ especificacaoLivre: true, gruComDesconto: true }, "marcasync-registro-394-desconto"],
    [{ especificacaoLivre: false, gruComDesconto: false }, "marcasync-registro-389-integral"],
  ])("escolhe o produto de acordo com o pedido %j", async (extra, esperado) => {
    db.pedidoRegistro.findUnique.mockResolvedValue({ ...pedido, ...extra });
    db.pagamento.findMany.mockResolvedValue([pendente()]);
    await garantirCobrancas("p1");
    expect(api.criarCheckout.mock.calls[0]?.[0].produtoExternalId).toBe(esperado);
  });

  it("não cria outro checkout quando já existe um válido", async () => {
    db.pagamento.findMany.mockResolvedValue([pendente({ provedorId: "bill_1", checkoutUrl: "https://x" })]);
    await garantirCobrancas("p1");
    expect(api.criarCheckout).not.toHaveBeenCalled();
  });

  it("refaz o checkout vencido", async () => {
    db.pagamento.findMany.mockResolvedValue([
      pendente({ provedorId: "bill_velho", checkoutUrl: "https://x", expiraEm: new Date(Date.now() - 1000) }),
    ]);
    await garantirCobrancas("p1");
    expect(api.criarCheckout).toHaveBeenCalledTimes(1);
  });

  it("NÃO manda o cliente pagar se o produto do AbacatePay tem outro valor", async () => {
    db.pagamento.findMany.mockResolvedValue([pendente()]);
    api.criarCheckout.mockResolvedValue(checkout({ valorCentavos: 49_900 }));
    await garantirCobrancas("p1");
    expect(db.pagamento.updateMany).not.toHaveBeenCalled();
  });

  it("falha do AbacatePay não derruba o pedido", async () => {
    db.pagamento.findMany.mockResolvedValue([pendente()]);
    api.criarCheckout.mockRejectedValue(new ErroAbacatePay("fora do ar"));
    await expect(garantirCobrancas("p1")).resolves.toBeUndefined();
    expect(db.pagamento.updateMany).not.toHaveBeenCalled();
  });

  it("sem pedido preenchido ou sem pagamento pendente, não faz nada", async () => {
    db.pagamento.findMany.mockResolvedValue([]);
    await garantirCobrancas("p1");
    db.pagamento.findMany.mockResolvedValue([pendente()]);
    db.pedidoRegistro.findUnique.mockResolvedValue(null);
    await garantirCobrancas("p1");
    expect(api.criarCheckout).not.toHaveBeenCalled();
  });
});

describe("sincronizarCobrancas e webhook", () => {
  beforeEach(() => {
    db.pagamento.findMany.mockResolvedValue([pendente({ provedorId: "bill_1" })]);
    db.pagamento.findUnique.mockResolvedValue({ processoId: "p1" });
  });

  it("PAID confirma o pagamento e avisa uma vez", async () => {
    api.consultarPagamento.mockResolvedValue({ status: "PAID", valorCentavos: TOTAL, pagoCentavos: TOTAL });
    await sincronizarCobrancas("p1");
    expect(db.pagamento.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "confirmado", confirmadoVia: "abacatepay" }) })
    );
    expect(avisos.avisarPagamentoConfirmado).toHaveBeenCalledWith("p1");
  });

  it("se outro processo já confirmou (updateMany não mudou nada), não avisa de novo", async () => {
    api.consultarPagamento.mockResolvedValue({ status: "PAID", valorCentavos: TOTAL, pagoCentavos: TOTAL });
    db.pagamento.updateMany.mockResolvedValue({ count: 0 });
    await sincronizarCobrancas("p1");
    expect(avisos.avisarPagamentoConfirmado).not.toHaveBeenCalled();
  });

  it("pago a menos que o combinado não vale como pago", async () => {
    api.consultarPagamento.mockResolvedValue({ status: "PAID", valorCentavos: TOTAL, pagoCentavos: 100 });
    await sincronizarCobrancas("p1");
    expect(db.pagamento.updateMany).not.toHaveBeenCalled();
    expect(avisos.avisarPagamentoConfirmado).not.toHaveBeenCalled();
  });

  it.each(["PENDING", "UNDER_DISPUTE", "REFUNDED", "QUALQUER_COISA"])("%s não confirma", async (status) => {
    api.consultarPagamento.mockResolvedValue({ status, valorCentavos: TOTAL, pagoCentavos: null });
    await sincronizarCobrancas("p1");
    expect(avisos.avisarPagamentoConfirmado).not.toHaveBeenCalled();
    const confirmou = db.pagamento.updateMany.mock.calls.some((c) => c[0].data?.status === "confirmado");
    expect(confirmou).toBe(false);
  });

  it("checkout vencido marca o pagamento como vencido para gerar outro", async () => {
    api.consultarPagamento.mockResolvedValue({ status: "EXPIRED", valorCentavos: TOTAL, pagoCentavos: null });
    await sincronizarCobrancas("p1");
    const args = db.pagamento.updateMany.mock.calls[0]?.[0];
    expect(args.data.expiraEm).toBeInstanceOf(Date);
    expect(args.data.status).toBeUndefined();
  });

  it("erro ao consultar não derruba nem confirma", async () => {
    api.consultarPagamento.mockRejectedValue(new ErroAbacatePay("rede"));
    await expect(sincronizarCobrancas("p1")).resolves.toBeUndefined();
    expect(db.pagamento.updateMany).not.toHaveBeenCalled();
  });

  it("confirmarPorProvedor devolve false para cobrança que não é nossa", async () => {
    db.pagamento.findUnique.mockResolvedValue(null);
    expect(await confirmarPorProvedor("bill_estranho")).toBe(false);
    expect(api.consultarPagamento).not.toHaveBeenCalled();
  });
});

describe("estornarPagamento (pacote)", () => {
  const confirmado = (extra: Record<string, unknown> = {}, processo: Record<string, unknown> = {}) => ({
    ...pendente({ provedorId: "bill_1", checkoutUrl: "https://x" }),
    status: "confirmado",
    confirmadoVia: "abacatepay",
    devolvidoCentavos: 0,
    notas: null,
    processo: { gruPagaInpiEm: null, protocoladoEm: null, pedidoRegistro: { servicoCentavos: 49_900 }, ...processo },
    ...extra,
  });

  beforeEach(() => {
    api.estornarPorId.mockResolvedValue({ estornoId: "refund_1", status: "REFUNDED" });
  });

  it("antes de pagar a taxa ao INPI: estorna tudo pela API", async () => {
    db.pagamento.findUnique.mockResolvedValue(confirmado());
    expect(await estornarPagamento("pg1", { motivo: "desistiu" })).toEqual({ estornoId: "refund_1" });
    expect(api.estornarPorId).toHaveBeenCalledWith("bill_1", "desistiu");
    expect(db.pagamento.update.mock.calls[0]?.[0].data.status).toBe("estornado");
  });

  it("taxa já paga ao INPI: o estorno pela API é recusado e o valor do serviço é informado", async () => {
    db.pagamento.findUnique.mockResolvedValue(confirmado({}, { gruPagaInpiEm: new Date() }));
    const erro = await estornarPagamento("pg1").catch((e) => e);
    expect(erro).toBeInstanceOf(ErroEstorno);
    expect(erro.status).toBe(409);
    expect(erro.message).toContain("499,00");
    expect(erro.message).toContain("devolva por Pix");
    expect(api.estornarPorId).not.toHaveBeenCalled();
  });

  it("depois do protocolo: recusa", async () => {
    db.pagamento.findUnique.mockResolvedValue(confirmado({}, { protocoladoEm: new Date() }));
    await expect(estornarPagamento("pg1")).rejects.toThrow("já foi protocolado");
    expect(api.estornarPorId).not.toHaveBeenCalled();
  });

  it("'forçar' estorna tudo mesmo depois de pagar a taxa e deixa isso nas notas", async () => {
    db.pagamento.findUnique.mockResolvedValue(confirmado({}, { gruPagaInpiEm: new Date() }));
    await estornarPagamento("pg1", { forcar: true, motivo: "decisão minha" });
    expect(api.estornarPorId).toHaveBeenCalled();
    expect(db.pagamento.update.mock.calls[0]?.[0].data.notas).toContain("forçado");
  });

  it("se parte já foi devolvida à mão, o estorno inteiro é recusado (não devolver em dobro)", async () => {
    db.pagamento.findUnique.mockResolvedValue(confirmado({ devolvidoCentavos: 49_900 }));
    await expect(estornarPagamento("pg1", { forcar: true })).rejects.toThrow("já foi devolvida à mão");
    expect(api.estornarPorId).not.toHaveBeenCalled();
  });

  it.each([
    ["pagamento pendente", { status: "pendente" }, "Só dá para estornar um pagamento confirmado"],
    ["confirmado à mão", { confirmadoVia: "whatsapp" }, "não foi feito pelo AbacatePay"],
    ["sem id do AbacatePay", { provedorId: null }, "não foi feito pelo AbacatePay"],
  ])("recusa %s", async (_n, extra, msg) => {
    db.pagamento.findUnique.mockResolvedValue(confirmado(extra));
    await expect(estornarPagamento("pg1")).rejects.toThrow(msg);
  });

  it("pagamento que não existe: 404", async () => {
    db.pagamento.findUnique.mockResolvedValue(null);
    await expect(estornarPagamento("x")).rejects.toMatchObject({ status: 404 });
  });

  it("o AbacatePay recusando o estorno vira erro 502 e nada muda no banco", async () => {
    db.pagamento.findUnique.mockResolvedValue(confirmado());
    api.estornarPorId.mockImplementation(async () => {
      throw new ErroAbacatePay("saldo insuficiente");
    });
    const erro = await estornarPagamento("pg1").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroEstorno);
    expect((erro as ErroEstorno).status).toBe(502);
    expect(db.pagamento.update).not.toHaveBeenCalled();
  });
});

describe("registrarDevolucaoManual", () => {
  const pago = (extra: Record<string, unknown> = {}) => ({
    id: "pg1",
    status: "confirmado",
    valorCentavos: TOTAL,
    devolvidoCentavos: 0,
    notas: null,
    ...extra,
  });

  it("soma o que já voltou e anota", async () => {
    db.pagamento.findUnique.mockResolvedValue(pago());
    expect(await registrarDevolucaoManual("pg1", 49_900, "Pix feito")).toEqual({ devolvidoCentavos: 49_900 });
    const data = db.pagamento.update.mock.calls[0]?.[0].data;
    expect(data.devolvidoCentavos).toBe(49_900);
    expect(data.notas).toContain("499.00");
  });

  it("nunca deixa a soma passar do que o cliente pagou", async () => {
    db.pagamento.findUnique.mockResolvedValue(pago({ devolvidoCentavos: 50_000 }));
    await expect(registrarDevolucaoManual("pg1", 50_000)).rejects.toThrow("passa do valor pago");
    expect(db.pagamento.update).not.toHaveBeenCalled();
  });

  it.each([0, -5, 1.5, NaN])("recusa o valor %s", async (v) => {
    await expect(registrarDevolucaoManual("pg1", v)).rejects.toMatchObject({ status: 400 });
  });

  it("só vale para pagamento confirmado", async () => {
    db.pagamento.findUnique.mockResolvedValue(pago({ status: "pendente" }));
    await expect(registrarDevolucaoManual("pg1", 100)).rejects.toMatchObject({ status: 409 });
    db.pagamento.findUnique.mockResolvedValue(null);
    await expect(registrarDevolucaoManual("pg1", 100)).rejects.toMatchObject({ status: 404 });
  });
});
