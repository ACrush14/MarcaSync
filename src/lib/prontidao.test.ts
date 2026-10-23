/**
 * Testes de src/lib/prontidao.ts: o pedido guardado tem tudo que o e-Marcas pede, e a
 * checklist diz o que falta. CPF e CNPJ aqui são números de teste válidos.
 */
import { describe, expect, it } from "vitest";
import { camposEmarcas } from "./campos-emarcas";
import {
  checarProntidao,
  type ContextoProntidao,
  type PagamentoSalvo,
  type PedidoSalvo,
} from "./prontidao";

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
  especificacao: "Bolos; Pão de queijo",
  especificacaoItens: ["Bolos", "Pão de queijo"],
  especificacaoLivre: false,
  palavraEstrangeira: false,
  traducao: null,
  cienteAnterioridade: false,
  atividade: "Confeitaria artesanal exercida de forma lícita e efetiva",
  gruCentavos: 44_000,
  gruComDesconto: true,
  aceitoEm: new Date("2026-10-23T12:00:00Z"),
};

const pagos = [
  { tipo: "setup", status: "confirmado" },
  { tipo: "gru", status: "confirmado" },
];

const contextoBase: ContextoProntidao = { marca: "Kaza Doce", riscoPct: 0, imagem: null };
const ctx = (extra: Partial<ContextoProntidao> = {}): ContextoProntidao => ({
  ...contextoBase,
  ...extra,
});
const checar = (
  d: PedidoSalvo,
  pg: PagamentoSalvo[] = pagos,
  extra: Partial<ContextoProntidao> = {}
) => checarProntidao(d, pg, ctx(extra));

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
    const r = checar(base);
    expect(r.pronto).toBe(false);
    expect(item(r, "gru-inpi").estado).toBe("pendente");
    expect(item(r, "procuracao").estado).toBe("pendente");
    expect(item(r, "einpi").estado).toBe("pendente");
  });

  it("dados completos e válidos deixam o item 'dados' ok", () => {
    expect(item(checar(base), "dados").estado).toBe("ok");
  });

  it("campo vazio ou CPF inválido trava o item 'dados'", () => {
    const vazio = checar({ ...base, bairro: "  " });
    expect(item(vazio, "dados").estado).toBe("pendente");
    expect(item(vazio, "dados").detalhe).toContain("Bairro");

    const cpfRuim = checar({ ...base, documento: "11111111111" });
    expect(item(cpfRuim, "dados").estado).toBe("pendente");
  });

  it("pessoa jurídica é conferida pelo CNPJ, não pelo CPF", () => {
    const pj = {
      ...base,
      tipoRequerente: "pj",
      regime: "microempresa",
      documento: "11222333000181",
    };
    expect(item(checar(pj), "dados").estado).toBe("ok");
    const pjComCpf = { ...pj, documento: "52998224725" };
    expect(item(checar(pjComCpf), "dados").estado).toBe("pendente");
  });

  it("nome diferente do pesquisado vira atenção; só acento e caixa não", () => {
    expect(item(checar(base, pagos, { marca: "kaza dôce" }), "nome-confere").estado).toBe("ok");
    const outro = checar(base, pagos, { marca: "Casa Doce" });
    expect(item(outro, "nome-confere").estado).toBe("atencao");
    expect(item(outro, "nome-confere").detalhe).toContain("Casa Doce");
  });

  it("valor de GRU fora da regra de desconto trava", () => {
    const cheia = { ...base, gruCentavos: 88_000, gruComDesconto: false };
    expect(item(checar(cheia), "gru-valor").estado).toBe("pendente");
    const socio = {
      ...base,
      participaEmpresaDoRamo: true,
      gruCentavos: 88_000,
      gruComDesconto: false,
    };
    expect(item(checar(socio), "gru-valor").estado).toBe("ok");
  });

  it("GRU 389 com especificação livre (ou o contrário) trava: o valor muda de serviço", () => {
    const livre = { ...base, especificacaoItens: ["bolo vegano sem glúten sob medida"] };
    // valor ainda é o do 389 (R$ 440): errado, porque o item está fora da lista
    expect(item(checar(livre), "gru-valor").estado).toBe("pendente");
    const livreCerto = { ...livre, especificacaoLivre: true, gruCentavos: 86_000 };
    expect(item(checar(livreCerto), "gru-valor").estado).toBe("ok");
  });

  it("especificação 100% da lista é ok; item fora da lista pede atenção e cita o item", () => {
    expect(item(checar(base), "especificacao").estado).toBe("ok");
    const livre = { ...base, especificacaoItens: ["Bolos", "bolo vegano sem glúten sob medida"] };
    const r = checar(livre);
    expect(item(r, "especificacao").estado).toBe("atencao");
    expect(item(r, "especificacao").detalhe).toContain("bolo vegano sem glúten sob medida");
    expect(item(r, "especificacao").detalhe).not.toContain("Fora da lista: Bolos");
  });

  it("imagem só é exigida para marca figurativa ou mista", () => {
    expect(checar(base).itens.some((i) => i.id === "imagem")).toBe(false);
    for (const apresentacao of ["figurativa", "mista"]) {
      const r = checar({ ...base, apresentacao });
      expect(item(r, "imagem").estado).toBe("pendente");
      expect(item(r, "imagem").detalhe).toContain("945");
    }
  });

  it("imagem guardada deixa ok; ampliada pede conferência de nitidez", () => {
    const mista = { ...base, apresentacao: "mista" };
    const boa = checar(mista, pagos, { imagem: { ampliada: false, largura: 1200, altura: 1200 } });
    expect(item(boa, "imagem").estado).toBe("ok");
    const ampliada = checar(mista, pagos, {
      imagem: { ampliada: true, largura: 945, altura: 945 },
    });
    expect(item(ampliada, "imagem").estado).toBe("atencao");
    expect(item(ampliada, "imagem").detalhe).toContain("ampliado");
  });

  it("tradução: não é perguntada em marca figurativa", () => {
    const r = checar({ ...base, apresentacao: "figurativa", elementoNominativo: null });
    expect(r.itens.some((i) => i.id === "traducao")).toBe(false);
  });

  it("tradução: respondeu sim sem informar trava; informando fica ok", () => {
    const sem = checar({ ...base, palavraEstrangeira: true, traducao: null });
    expect(item(sem, "traducao").estado).toBe("pendente");
    const com = checar({ ...base, palavraEstrangeira: true, traducao: "Casa doce" });
    expect(item(com, "traducao").estado).toBe("ok");
    expect(item(com, "traducao").detalhe).toContain("Casa doce");
  });

  it("tradução: cliente disse que não, mas o nome parece estrangeiro → atenção", () => {
    const r = checar({ ...base, elementoNominativo: "Sweet Shop" }, pagos, { marca: "Sweet Shop" });
    expect(item(r, "traducao").estado).toBe("atencao");
    expect(item(r, "traducao").detalhe).toContain("Sweet");
  });

  it("tradução: nome português sem suspeita fica ok", () => {
    const r = checar({ ...base, elementoNominativo: "Doce Lar" }, pagos, { marca: "Doce Lar" });
    expect(item(r, "traducao").estado).toBe("ok");
  });

  it("anterioridade: aparece só com risco alto, e diz se o cliente viu o aviso", () => {
    expect(checar(base).itens.some((i) => i.id === "anterioridade")).toBe(false);
    expect(checar(base, pagos, { riscoPct: 59 }).itens.some((i) => i.id === "anterioridade")).toBe(
      false
    );
    const sem = checar(base, pagos, { riscoPct: 82 });
    expect(item(sem, "anterioridade").estado).toBe("atencao");
    expect(item(sem, "anterioridade").detalhe).toContain("NÃO registrou");
    const com = checar({ ...base, cienteAnterioridade: true }, pagos, { riscoPct: 82 });
    expect(item(com, "anterioridade").detalhe).toContain("viu o aviso");
  });

  it("pagamentos: só 'confirmado' conta; pendente ou ausente trava", () => {
    const r = checar(base, [{ tipo: "setup", status: "pendente" }]);
    expect(item(r, "pagamento-setup").estado).toBe("pendente");
    expect(item(r, "pagamento-setup").detalhe).toContain("ainda não confirmada");
    expect(item(r, "pagamento-gru").detalhe).toContain("Não há cobrança");
    expect(item(checar(base), "pagamento-gru").estado).toBe("ok");
  });

  it("sem registro de aceites o item trava", () => {
    expect(item(checar({ ...base, aceitoEm: null }), "aceites").estado).toBe("pendente");
  });
});
