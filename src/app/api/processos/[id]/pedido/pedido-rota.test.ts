/**
 * Rota do pedido: o preço vem sempre do servidor, mesmo que já exista uma cobrança pendente
 * com outro valor (dado antigo ou adulterado), e nada é aceito sem os aceites obrigatórios.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const m = {
    processo: { findUnique: vi.fn(), update: vi.fn() },
    pedidoRegistro: { upsert: vi.fn() },
    imagemMarca: { findUnique: vi.fn() },
    pagamento: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  };
  return m;
});
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/cobranca", () => ({ garantirCobrancasPix: vi.fn().mockResolvedValue(undefined) }));

import { zerarLimites } from "@/lib/limite-publico";
import { MONITORAMENTO_CENTAVOS, SETUP_CENTAVOS } from "@/lib/planos";
import { POST } from "./route";

const pedidoValido = {
  tipoRequerente: "pf",
  regime: "pessoa_natural",
  participaEmpresaDoRamo: false,
  nome: "Ana Maria Ramos",
  documento: "52998224725",
  email: "ana@exemplo.com.br",
  cep: "60000000",
  logradouro: "Rua das Flores",
  numero: "100",
  complemento: "",
  bairro: "Centro",
  cidade: "Fortaleza",
  uf: "CE",
  apresentacao: "nominativa",
  elementoNominativo: "Kaza Doce",
  classeNice: "30",
  especificacaoItens: ["Bolos"],
  palavraEstrangeira: false,
  atividade: "Confeitaria artesanal exercida de forma lícita e efetiva",
  declaracaoAtividade: true,
  declaracaoVeracidade: true,
  aceiteProcuracao: true,
  aceiteLgpd: true,
  aceiteTermos: true,
  cienciaDocumentosInpi: true,
  monitoramento: true,
};

const enviar = (corpo: unknown, bruto?: string) =>
  POST(
    new Request("http://x/api/processos/p1/pedido", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "3.3.3.3" },
      body: bruto ?? JSON.stringify(corpo),
    }),
    { params: Promise.resolve({ id: "p1" }) }
  );

/** Registra o que a transação recebeu: as operações são promessas já criadas pelas chamadas ao banco. */
beforeEach(() => {
  vi.clearAllMocks();
  zerarLimites();
  db.processo.findUnique.mockResolvedValue({ id: "p1", riscoPct: 10, pagamentos: [] });
  db.$transaction.mockResolvedValue([]);
  db.imagemMarca.findUnique.mockResolvedValue(null);
  for (const t of [db.pagamento.create, db.pagamento.update, db.pagamento.delete]) t.mockReturnValue({});
  db.pedidoRegistro.upsert.mockReturnValue({});
  db.processo.update.mockReturnValue({});
});

describe("POST /api/processos/:id/pedido", () => {
  it("cria o serviço e a GRU com o preço do servidor e devolve só o resumo de valores", async () => {
    const r = await enviar(pedidoValido);
    expect(r.status).toBe(201);
    const corpo = await r.json();
    expect(corpo.resumo.servicoCentavos).toBe(SETUP_CENTAVOS);
    expect(corpo.resumo.gruCentavos).toBe(44_000);
    expect(JSON.stringify(corpo)).not.toContain("52998224725");
    const criados = db.pagamento.create.mock.calls.map((c) => c[0].data);
    expect(criados).toContainEqual(expect.objectContaining({ tipo: "setup", valorCentavos: SETUP_CENTAVOS }));
    expect(criados).toContainEqual(expect.objectContaining({ tipo: "gru", valorCentavos: 44_000 }));
    expect(criados).toContainEqual(
      expect.objectContaining({ tipo: "monitoramento", valorCentavos: MONITORAMENTO_CENTAVOS })
    );
  });

  it("corrige uma cobrança do serviço pendente com valor adulterado e refaz o Pix", async () => {
    db.processo.findUnique.mockResolvedValue({
      id: "p1",
      riscoPct: 10,
      pagamentos: [{ id: "pg1", tipo: "setup", status: "pendente", valorCentavos: 100, provedorId: "pix_char_x" }],
    });
    await enviar(pedidoValido);
    expect(db.pagamento.update).toHaveBeenCalledWith({
      where: { id: "pg1" },
      data: { valorCentavos: SETUP_CENTAVOS, provedorId: null, brCode: null, expiraEm: null },
    });
    // e não cria um segundo "setup"
    expect(db.pagamento.create.mock.calls.some((c) => c[0].data.tipo === "setup")).toBe(false);
  });

  it("corrige o monitoramento pendente com valor errado", async () => {
    db.processo.findUnique.mockResolvedValue({
      id: "p1",
      riscoPct: 10,
      pagamentos: [{ id: "pg2", tipo: "monitoramento", status: "pendente", valorCentavos: 1 }],
    });
    await enviar(pedidoValido);
    expect(db.pagamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pg2" }, data: expect.objectContaining({ valorCentavos: MONITORAMENTO_CENTAVOS }) })
    );
  });

  it("não mexe numa cobrança do serviço que já está certa", async () => {
    db.processo.findUnique.mockResolvedValue({
      id: "p1",
      riscoPct: 10,
      pagamentos: [{ id: "pg1", tipo: "setup", status: "pendente", valorCentavos: SETUP_CENTAVOS, provedorId: "pix_char_x" }],
    });
    await enviar(pedidoValido);
    expect(db.pagamento.update.mock.calls.some((c) => c[0].where.id === "pg1")).toBe(false);
  });

  it("recusa (409) quando já há pagamento confirmado", async () => {
    db.processo.findUnique.mockResolvedValue({
      id: "p1",
      riscoPct: 10,
      pagamentos: [{ id: "pg1", tipo: "setup", status: "confirmado", valorCentavos: SETUP_CENTAVOS }],
    });
    expect((await enviar(pedidoValido)).status).toBe(409);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each(["aceiteTermos", "cienciaDocumentosInpi", "aceiteLgpd", "aceiteProcuracao", "declaracaoVeracidade", "declaracaoAtividade"])(
    "recusa o pedido sem o aceite %s",
    async (campo) => {
      const r = await enviar({ ...pedidoValido, [campo]: false });
      expect(r.status).toBe(400);
      expect((await r.json()).erros[campo]).toBeTruthy();
      expect(db.$transaction).not.toHaveBeenCalled();
    }
  );

  it("o preço enviado pelo navegador é ignorado", async () => {
    const r = await enviar({ ...pedidoValido, servicoCentavos: 1, gruCentavos: 1, totalCentavos: 2 });
    const corpo = await r.json();
    expect(corpo.resumo.servicoCentavos).toBe(SETUP_CENTAVOS);
    expect(corpo.resumo.gruCentavos).toBe(44_000);
  });

  it("marca de pessoa sócia de empresa do ramo paga a GRU cheia", async () => {
    const r = await enviar({ ...pedidoValido, participaEmpresaDoRamo: true });
    expect((await r.json()).resumo.gruCentavos).toBe(88_000);
  });

  it("recusa JSON quebrado, corpo grande e processo inexistente", async () => {
    expect((await enviar(null, "{ruim")).status).toBe(400);
    const grande = await POST(
      new Request("http://x/p", {
        method: "POST",
        headers: { "content-length": String(20_000), "x-forwarded-for": "3.3.3.3" },
        body: "{}",
      }),
      { params: Promise.resolve({ id: "p1" }) }
    );
    expect(grande.status).toBe(413);
    db.processo.findUnique.mockResolvedValue(null);
    expect((await enviar(pedidoValido)).status).toBe(404);
  });

  it("freia o excesso de envios do mesmo IP (429)", async () => {
    const codigos: number[] = [];
    for (let i = 0; i < 25; i++) codigos.push((await enviar(pedidoValido)).status);
    expect(codigos).toContain(429);
  });
});
