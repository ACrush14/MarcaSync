/**
 * Rotas do pagamento único: o que o cliente vê, o aviso do AbacatePay (webhook), a marcação de "taxa
 * paga ao INPI" e a devolução parcial feita à mão. Banco e AbacatePay são simulados.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  processo: { findUnique: vi.fn(), updateMany: vi.fn() },
  pagamento: { findMany: vi.fn() },
}));
const cobranca = vi.hoisted(() => ({
  garantirCobrancas: vi.fn(),
  sincronizarCobrancas: vi.fn(),
  confirmarPorProvedor: vi.fn(),
  registrarDevolucaoManual: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/cobranca", async () => {
  const real = await vi.importActual<typeof import("@/lib/cobranca")>("@/lib/cobranca");
  return { ...real, ...cobranca };
});

import { ErroEstorno } from "@/lib/cobranca";
import { GET as cobrancas } from "./processos/[id]/cobrancas/route";
import { POST as webhook } from "./webhooks/abacatepay/route";
import { POST as gruPaga } from "./admin/processos/[id]/gru-paga/route";
import { POST as devolucao } from "./admin/pagamentos/[id]/devolucao-manual/route";

const ctx = (id = "p1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ABACATEPAY_API_KEY", "abc_dev_chave");
  vi.stubEnv("ABACATEPAY_WEBHOOK_SECRET", "segredo");
  db.processo.findUnique.mockResolvedValue({ id: "p1" });
  db.pagamento.findMany.mockResolvedValue([]);
});

describe("GET /api/processos/:id/cobrancas", () => {
  const pacote = (extra: Record<string, unknown> = {}) => ({
    tipo: "pacote",
    valorCentavos: 93_900,
    status: "pendente",
    checkoutUrl: "https://app.abacatepay.com/pay/bill_1",
    brCode: null,
    expiraEm: null,
    // campos internos que NUNCA devem sair:
    id: "pg1",
    provedorId: "bill_1",
    notas: "segredo interno",
    confirmadoVia: "abacatepay",
    processoId: "p1",
    ...extra,
  });

  it("devolve o endereço do pagamento e só os campos públicos", async () => {
    db.pagamento.findMany.mockResolvedValue([pacote()]);
    const r = await cobrancas(new Request("http://x"), ctx());
    const corpo = await r.json();
    expect(r.status).toBe(200);
    expect(corpo.pagamentoAtivo).toBe(true);
    expect(corpo.cobrancas).toEqual([
      {
        tipo: "pacote",
        valorCentavos: 93_900,
        status: "pendente",
        checkoutUrl: "https://app.abacatepay.com/pay/bill_1",
        brCode: null,
        expiraEm: null,
      },
    ]);
    const texto = JSON.stringify(corpo);
    for (const interno of ["provedorId", "notas", "confirmadoVia", "pg1", "segredo interno"]) {
      expect(texto).not.toContain(interno);
    }
    expect(corpo.tudoPago).toBe(false);
  });

  it("depois de pago, não devolve mais o endereço de pagamento", async () => {
    db.pagamento.findMany.mockResolvedValue([pacote({ status: "confirmado" })]);
    const corpo = await (await cobrancas(new Request("http://x"), ctx())).json();
    expect(corpo.tudoPago).toBe(true);
    expect(corpo.cobrancas[0].checkoutUrl).toBeNull();
  });

  it("consulta o AbacatePay e cria o checkout que faltar, nessa ordem", async () => {
    const ordem: string[] = [];
    cobranca.sincronizarCobrancas.mockImplementation(async () => void ordem.push("sincronizar"));
    cobranca.garantirCobrancas.mockImplementation(async () => void ordem.push("garantir"));
    await cobrancas(new Request("http://x"), ctx());
    expect(ordem).toEqual(["sincronizar", "garantir"]);
  });

  it("sem chave do AbacatePay, não chama a API e avisa que o pagamento pelo site está desligado", async () => {
    vi.stubEnv("ABACATEPAY_API_KEY", "");
    const corpo = await (await cobrancas(new Request("http://x"), ctx())).json();
    expect(corpo.pagamentoAtivo).toBe(false);
    expect(cobranca.garantirCobrancas).not.toHaveBeenCalled();
    expect(cobranca.sincronizarCobrancas).not.toHaveBeenCalled();
  });

  it("processo que não existe dá 404", async () => {
    db.processo.findUnique.mockResolvedValue(null);
    expect((await cobrancas(new Request("http://x"), ctx("nao"))).status).toBe(404);
  });
});

describe("webhook do AbacatePay (checkout)", () => {
  const chamar = (corpo: string, segredo = "segredo") =>
    webhook(
      new Request(`http://x/api/webhooks/abacatepay?webhookSecret=${segredo}`, { method: "POST", body: corpo })
    );

  it("confere o checkout citado no aviso", async () => {
    cobranca.confirmarPorProvedor.mockResolvedValue(true);
    const r = await chamar(JSON.stringify({ event: "checkout.completed", data: { checkout: { id: "bill_Abc1" } } }));
    expect(r.status).toBe(200);
    expect(cobranca.confirmarPorProvedor).toHaveBeenCalledWith("bill_Abc1");
  });

  it("tenta cada id do corpo até achar o pagamento nosso", async () => {
    cobranca.confirmarPorProvedor.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await chamar('{"transparent":{"id":"pix_char_X9"},"checkout":{"id":"bill_Y8"},"extra":"bill_Z7"}');
    expect(cobranca.confirmarPorProvedor.mock.calls.map((c) => c[0])).toEqual(["pix_char_X9", "bill_Y8"]);
  });

  it("segredo errado não confere nada", async () => {
    const r = await chamar('{"id":"bill_1"}', "errado");
    expect(r.status).toBe(401);
    expect(cobranca.confirmarPorProvedor).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/processos/:id/gru-paga", () => {
  const processo = (extra: Record<string, unknown> = {}) => ({
    gruPagaInpiEm: null,
    protocoladoEm: null,
    pagamentos: [{ tipo: "pacote", status: "confirmado" }],
    ...extra,
  });

  it("marca a taxa como paga ao INPI quando o cliente já pagou", async () => {
    db.processo.findUnique.mockResolvedValue(processo());
    db.processo.updateMany.mockResolvedValue({ count: 1 });
    const r = await gruPaga(new Request("http://x", { method: "POST" }), ctx());
    expect(r.status).toBe(200);
    const args = db.processo.updateMany.mock.calls[0]?.[0];
    expect(args.where).toEqual({ id: "p1", gruPagaInpiEm: null });
    expect(args.data.gruPagaInpiEm).toBeInstanceOf(Date);
  });

  it("aceita também o modelo antigo (serviço e taxa pagos separados)", async () => {
    db.processo.findUnique.mockResolvedValue(
      processo({ pagamentos: [{ tipo: "setup", status: "confirmado" }, { tipo: "gru", status: "confirmado" }] })
    );
    db.processo.updateMany.mockResolvedValue({ count: 1 });
    expect((await gruPaga(new Request("http://x", { method: "POST" }), ctx())).status).toBe(200);
  });

  it("recusa (409) se o cliente ainda não pagou, ou pagou só metade do modelo antigo", async () => {
    for (const pagamentos of [[], [{ tipo: "pacote", status: "pendente" }], [{ tipo: "setup", status: "confirmado" }]]) {
      db.processo.findUnique.mockResolvedValue(processo({ pagamentos }));
      expect((await gruPaga(new Request("http://x", { method: "POST" }), ctx())).status).toBe(409);
    }
    expect(db.processo.updateMany).not.toHaveBeenCalled();
  });

  it("marcar de novo não troca a data original", async () => {
    const antes = new Date("2026-10-20T10:00:00Z");
    db.processo.findUnique.mockResolvedValue(processo({ gruPagaInpiEm: antes }));
    const r = await gruPaga(new Request("http://x", { method: "POST" }), ctx());
    expect(r.status).toBe(200);
    expect(db.processo.updateMany).not.toHaveBeenCalled();
    expect(new Date((await r.json()).gruPagaInpiEm)).toEqual(antes);
  });

  it("processo inexistente: 404", async () => {
    db.processo.findUnique.mockResolvedValue(null);
    expect((await gruPaga(new Request("http://x", { method: "POST" }), ctx("x"))).status).toBe(404);
  });
});

describe("POST /api/admin/pagamentos/:id/devolucao-manual", () => {
  const chamar = (corpo: unknown, bruto?: string) =>
    devolucao(
      new Request("http://x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: bruto ?? JSON.stringify(corpo),
      }),
      ctx("pg1")
    );

  it("registra a devolução e devolve o total já devolvido", async () => {
    cobranca.registrarDevolucaoManual.mockResolvedValue({ devolvidoCentavos: 49_900 });
    const r = await chamar({ centavos: 49_900, nota: "  Pix feito  " });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, devolvidoCentavos: 49_900 });
    expect(cobranca.registrarDevolucaoManual).toHaveBeenCalledWith("pg1", 49_900, "Pix feito");
  });

  it.each([
    ["JSON quebrado", null, "{ruim"],
    ["sem valor", {}, undefined],
    ["valor em texto", { centavos: "499" }, undefined],
  ])("recusa %s com 400", async (_n, corpo, bruto) => {
    expect((await chamar(corpo, bruto)).status).toBe(400);
    expect(cobranca.registrarDevolucaoManual).not.toHaveBeenCalled();
  });

  it("repassa o erro de regra (por exemplo, passar do valor pago)", async () => {
    cobranca.registrarDevolucaoManual.mockRejectedValue(new ErroEstorno("A soma passa do valor pago.", 409));
    const r = await chamar({ centavos: 10 });
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("passa do valor pago");
  });
});
