/**
 * Testes de src/lib/prontidao.ts: o pedido guardado tem tudo que o e-Marcas pede, e a
 * checklist diz o que falta. CPF e CNPJ aqui são números de teste válidos.
 */
import { describe, expect, it } from "vitest";
import { camposEmarcas, checarProntidao, type PedidoSalvo } from "./prontidao";

const base: PedidoSalvo = {
  tipoRequerente: "pf",
  regime: "pessoa_natural",
  participaEmpresaDoRamo: false,
  nome: "Ana Maria Ramos",
  documento: "52998224725",
  email: "ana@exemplo.com.br",
  cep: "60000000",
  logradouro: "Rua das Flores",
  numero: "100",
  complemento: null,
  bairro: "Centro",
  cidade: "Fortaleza",
  uf: "CE",
  apresentacao: "nominativa",
  elementoNominativo: "Kaza Doce",
  classeNice: "30",
  especificacao: "Bolos, doces e confeitaria sob encomenda",
  atividade: "Confeitaria artesanal exercida de forma lícita e efetiva",
  gruCentavos: 44_000,
  gruComDesconto: true,
  aceitoEm: new Date("2026-10-23T12:00:00Z"),
};

const pagos = [
  { tipo: "setup", status: "confirmado" },
  { tipo: "gru", status: "confirmado" },
];

function item(p: ReturnType<typeof checarProntidao>, id: string) {
  const i = p.itens.find((x) => x.id === id);
  if (!i) throw new Error(`item ${id} não existe`);
  return i;
}

describe("camposEmarcas", () => {
  it("um pedido completo não deixa nenhum campo obrigatório vazio", () => {
    const vazios = camposEmarcas(base).filter(([, v]) => v !== null && v.trim() === "");
    expect(vazios).toEqual([]);
  });

  it("marca figurativa não tem elemento nominativo (não se aplica)", () => {
    const campos = Object.fromEntries(
      camposEmarcas({ ...base, apresentacao: "figurativa", elementoNominativo: null })
    );
    expect(campos["Elemento nominativo"]).toBe(null);
  });

  it("cobre os campos do e-Marcas: titular, endereço, marca, classe, especificação e atividade", () => {
    const rotulos = camposEmarcas(base).map(([r]) => r);
    for (const esperado of [
      "CPF/CNPJ",
      "E-mail",
      "CEP",
      "Apresentação",
      "Natureza",
      "Elemento nominativo",
      "Classe de Nice",
      "Especificação",
      "Declaração de atividade",
    ]) {
      expect(rotulos).toContain(esperado);
    }
  });
});

describe("checarProntidao", () => {
  it("nunca marca 'pronto' enquanto houver etapa manual (GRU no e-INPI, procuração, e-INPI)", () => {
    const r = checarProntidao(base, pagos, "Kaza Doce");
    expect(r.pronto).toBe(false);
    expect(item(r, "gru-inpi").estado).toBe("pendente");
    expect(item(r, "procuracao").estado).toBe("pendente");
    expect(item(r, "einpi").estado).toBe("pendente");
  });

  it("dados completos e válidos deixam o item 'dados' ok", () => {
    expect(item(checarProntidao(base, pagos, "Kaza Doce"), "dados").estado).toBe("ok");
  });

  it("campo vazio ou CPF inválido trava o item 'dados'", () => {
    const vazio = checarProntidao({ ...base, bairro: "  " }, pagos, "Kaza Doce");
    expect(item(vazio, "dados").estado).toBe("pendente");
    expect(item(vazio, "dados").detalhe).toContain("Bairro");

    const cpfRuim = checarProntidao({ ...base, documento: "11111111111" }, pagos, "Kaza Doce");
    expect(item(cpfRuim, "dados").estado).toBe("pendente");
  });

  it("pessoa jurídica é conferida pelo CNPJ, não pelo CPF", () => {
    const pj = {
      ...base,
      tipoRequerente: "pj",
      regime: "microempresa",
      documento: "11222333000181",
    };
    expect(item(checarProntidao(pj, pagos, "Kaza Doce"), "dados").estado).toBe("ok");
    const pjComCpf = { ...pj, documento: "52998224725" };
    expect(item(checarProntidao(pjComCpf, pagos, "Kaza Doce"), "dados").estado).toBe("pendente");
  });

  it("nome diferente do pesquisado vira atenção; só acento e caixa não", () => {
    expect(item(checarProntidao(base, pagos, "kaza dôce"), "nome-confere").estado).toBe("ok");
    const outro = checarProntidao(base, pagos, "Casa Doce");
    expect(item(outro, "nome-confere").estado).toBe("atencao");
    expect(item(outro, "nome-confere").detalhe).toContain("Casa Doce");
  });

  it("valor de GRU fora da regra de desconto trava", () => {
    const cheia = { ...base, gruCentavos: 88_000, gruComDesconto: false };
    expect(item(checarProntidao(cheia, pagos, "Kaza Doce"), "gru-valor").estado).toBe("pendente");
    const socio = {
      ...base,
      participaEmpresaDoRamo: true,
      gruCentavos: 88_000,
      gruComDesconto: false,
    };
    expect(item(checarProntidao(socio, pagos, "Kaza Doce"), "gru-valor").estado).toBe("ok");
  });

  it("imagem só é exigida para marca figurativa ou mista", () => {
    expect(checarProntidao(base, pagos, "Kaza Doce").itens.some((i) => i.id === "imagem")).toBe(
      false
    );
    for (const apresentacao of ["figurativa", "mista"]) {
      const r = checarProntidao({ ...base, apresentacao }, pagos, "Kaza Doce");
      expect(item(r, "imagem").estado).toBe("pendente");
      expect(item(r, "imagem").detalhe).toContain("945");
    }
  });

  it("tradução só é perguntada quando a marca tem texto", () => {
    expect(
      checarProntidao(
        { ...base, apresentacao: "figurativa", elementoNominativo: null },
        pagos,
        "X"
      ).itens.some((i) => i.id === "traducao")
    ).toBe(false);
    expect(item(checarProntidao(base, pagos, "Kaza Doce"), "traducao").estado).toBe("atencao");
  });

  it("especificação sempre pede conferência com a lista pré-aprovada", () => {
    expect(item(checarProntidao(base, pagos, "Kaza Doce"), "especificacao").estado).toBe("atencao");
  });

  it("pagamentos: só 'confirmado' conta; pendente ou ausente trava", () => {
    const r = checarProntidao(base, [{ tipo: "setup", status: "pendente" }], "Kaza Doce");
    expect(item(r, "pagamento-setup").estado).toBe("pendente");
    expect(item(r, "pagamento-setup").detalhe).toContain("ainda não confirmada");
    expect(item(r, "pagamento-gru").detalhe).toContain("Não há cobrança");
    expect(item(checarProntidao(base, pagos, "Kaza Doce"), "pagamento-gru").estado).toBe("ok");
  });

  it("sem registro de aceites o item trava", () => {
    expect(
      item(checarProntidao({ ...base, aceitoEm: null }, pagos, "Kaza Doce"), "aceites").estado
    ).toBe("pendente");
  });
});
