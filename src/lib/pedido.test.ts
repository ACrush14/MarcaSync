/**
 * Testes de src/lib/gru.ts (a taxa do INPI) e src/lib/pedido.ts (a validação do formulário
 * de pedido de registro). Os CPFs e CNPJs usados aqui são números de teste válidos, que
 * não pertencem a ninguém conhecido.
 */
import { describe, expect, it } from "vitest";
import { GRU_PEDIDO_CENTAVOS, GRU_PEDIDO_LIVRE_CENTAVOS, calcularGru } from "./gru";
import { analisarEspecificacao } from "./catalogo";
import {
  cnpjValido,
  cpfValido,
  emailValido,
  validarPedido as validar,
  type PedidoEntrada,
} from "./pedido";

// Nos testes usamos o catálogo real, como o servidor faz.
const validarPedido = (e: PedidoEntrada) => validar(e, analisarEspecificacao);

describe("calcularGru", () => {
  it("pessoa física sem empresa do ramo tem 50% de desconto", () => {
    expect(calcularGru("pessoa_natural", false)).toEqual({ centavos: 44_000, comDesconto: true });
  });

  it("pessoa física com participação em empresa do ramo paga o valor cheio", () => {
    expect(calcularGru("pessoa_natural", true)).toEqual({
      centavos: GRU_PEDIDO_CENTAVOS,
      comDesconto: false,
    });
  });

  it.each(["mei", "microempresa", "empresa_pequeno_porte", "sem_fins_lucrativos"] as const)(
    "%s tem desconto, mesmo marcando participação",
    (regime) => {
      expect(calcularGru(regime, true).comDesconto).toBe(true);
      expect(calcularGru(regime, false).centavos).toBe(44_000);
    }
  );

  it("especificação livre (GRU 394) custa mais, com e sem desconto", () => {
    expect(calcularGru("pessoa_natural", false, true)).toEqual({
      centavos: GRU_PEDIDO_LIVRE_CENTAVOS / 2,
      comDesconto: true,
    });
    expect(calcularGru("outra_empresa", false, true)).toEqual({
      centavos: GRU_PEDIDO_LIVRE_CENTAVOS,
      comDesconto: false,
    });
    expect(calcularGru("mei", false, true).centavos).toBeGreaterThan(
      calcularGru("mei", false, false).centavos
    );
  });

  it("outra empresa nunca tem desconto", () => {
    expect(calcularGru("outra_empresa", false)).toEqual({
      centavos: GRU_PEDIDO_CENTAVOS,
      comDesconto: false,
    });
  });
});

describe("cpfValido e cnpjValido", () => {
  it("aceita CPF válido, com ou sem máscara", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });

  it.each(["", "123", "111.111.111-11", "529.982.247-24", "52998224725 9"])(
    "recusa CPF inválido: '%s'",
    (v) => {
      expect(cpfValido(v)).toBe(false);
    }
  );

  it("aceita CNPJ válido, com ou sem máscara", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
  });

  it.each(["", "123", "00.000.000/0000-00", "11.222.333/0001-80"])(
    "recusa CNPJ inválido: '%s'",
    (v) => {
      expect(cnpjValido(v)).toBe(false);
    }
  );
});

describe("emailValido", () => {
  it("aceita e recusa o que se espera", () => {
    expect(emailValido("ana@exemplo.com.br")).toBe(true);
    expect(emailValido("ana@exemplo")).toBe(false);
    expect(emailValido("ana exemplo@x.com")).toBe(false);
    expect(emailValido("")).toBe(false);
  });
});

describe("validarPedido", () => {
  const base: PedidoEntrada = {
    tipoRequerente: "pf",
    regime: "pessoa_natural",
    participaEmpresaDoRamo: false,
    nome: "  Ana   Maria Ramos ",
    documento: "529.982.247-25",
    email: "ana@exemplo.com.br",
    cep: "60.000-000",
    logradouro: "Rua das Flores",
    numero: "100",
    complemento: "",
    bairro: "Centro",
    cidade: "Fortaleza",
    uf: "ce",
    apresentacao: "nominativa",
    elementoNominativo: "Kaza Doce",
    classeNice: "30",
    especificacaoItens: ["Bolos", "Pão de queijo"],
    palavraEstrangeira: false,
    atividade: "Confeitaria artesanal exercida de forma lícita e efetiva",
    declaracaoAtividade: true,
    declaracaoVeracidade: true,
    aceiteProcuracao: true,
    aceiteLgpd: true,
    monitoramento: true,
  };

  it("aceita um pedido completo e limpa os campos", () => {
    const r = validarPedido(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados.nome).toBe("Ana Maria Ramos");
    expect(r.dados.documento).toBe("52998224725");
    expect(r.dados.cep).toBe("60000000");
    expect(r.dados.uf).toBe("CE");
    expect(r.dados.complemento).toBe(null);
    expect(r.dados.classeNice).toBe("30");
    expect(r.dados.monitoramento).toBe(true);
  });

  it("recusa CPF inválido para pessoa física", () => {
    const r = validarPedido({ ...base, documento: "111.111.111-11" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.documento).toBe("CPF inválido.");
  });

  it("pessoa jurídica exige CNPJ e um porte de empresa", () => {
    const certo = validarPedido({
      ...base,
      tipoRequerente: "pj",
      regime: "microempresa",
      documento: "11.222.333/0001-81",
    });
    expect(certo.ok).toBe(true);
    const errado = validarPedido({ ...base, tipoRequerente: "pj", regime: "pessoa_natural" });
    expect(errado.ok).toBe(false);
    if (!errado.ok) expect(errado.erros.regime).toBeDefined();
  });

  it("marca figurativa não leva elemento nominativo", () => {
    const r = validarPedido({
      ...base,
      apresentacao: "figurativa",
      elementoNominativo: "qualquer",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados.elementoNominativo).toBe(null);
  });

  it("marca nominativa exige o nome da marca", () => {
    const r = validarPedido({ ...base, elementoNominativo: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.elementoNominativo).toBeDefined();
  });

  it.each(["0", "46", "abc", "", "3.5"])("recusa a classe '%s'", (classe) => {
    const r = validarPedido({ ...base, classeNice: classe });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.classeNice).toBeDefined();
  });

  it("normaliza a classe com zero à esquerda", () => {
    const r = validarPedido({ ...base, classeNice: "03" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados.classeNice).toBe("3");
  });

  it.each([
    "declaracaoAtividade",
    "declaracaoVeracidade",
    "aceiteProcuracao",
    "aceiteLgpd",
  ] as const)("recusa sem o aceite '%s'", (campo) => {
    const r = validarPedido({ ...base, [campo]: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[campo]).toBeDefined();
  });

  it("uf, cep e e-mail inválidos geram um erro cada", () => {
    const r = validarPedido({ ...base, uf: "XX", cep: "123", email: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.erros).sort()).toEqual(["cep", "email", "uf"]);
    }
  });

  it("itens da lista pré-aprovada não marcam especificação livre", () => {
    const r = validarPedido(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados.especificacaoLivre).toBe(false);
      expect(r.dados.especificacao).toBe("Bolos; Pão de queijo");
    }
  });

  it("item fora da lista marca especificação livre e fica depois dos da lista", () => {
    const r = validarPedido({
      ...base,
      especificacaoItens: ["bolo vegano sem glúten sob medida", "bolos"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados.especificacaoLivre).toBe(true);
      expect(r.dados.especificacaoItens).toEqual(["Bolos", "bolo vegano sem glúten sob medida"]);
    }
  });

  it("exige de 1 a 50 itens, cada um com 3 a 300 caracteres", () => {
    for (const itens of [[], ["ab"], ["x".repeat(301)], Array(51).fill("Bolos"), "Bolos"]) {
      const r = validarPedido({ ...base, especificacaoItens: itens });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erros.especificacao).toBeDefined();
    }
  });

  it("palavra estrangeira: o cliente precisa responder, e a tradução é obrigatória se sim", () => {
    const semResposta = validarPedido({ ...base, palavraEstrangeira: undefined });
    expect(semResposta.ok).toBe(false);
    if (!semResposta.ok) expect(semResposta.erros.palavraEstrangeira).toBeDefined();

    const semTraducao = validarPedido({ ...base, palavraEstrangeira: true, traducao: " " });
    expect(semTraducao.ok).toBe(false);
    if (!semTraducao.ok) expect(semTraducao.erros.traducao).toBeDefined();

    const ok = validarPedido({ ...base, palavraEstrangeira: true, traducao: "Casa doce" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.dados.traducao).toBe("Casa doce");
  });

  it("marca figurativa não pergunta palavra estrangeira", () => {
    const r = validarPedido({
      ...base,
      apresentacao: "figurativa",
      palavraEstrangeira: undefined,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados.palavraEstrangeira).toBe(false);
  });

  it("não aceita campo que não é texto", () => {
    const r = validarPedido({ ...base, nome: { evil: true }, documento: 123 });
    expect(r.ok).toBe(false);
  });
});
