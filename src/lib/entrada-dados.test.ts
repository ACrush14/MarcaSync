/**
 * Entrada de dados: o que acontece quando o visitante digita (ou manda) algo fora do esperado.
 * O formulário nunca pode quebrar, e nada estranho pode chegar ao banco.
 */
import { describe, expect, it } from "vitest";
import { cnpjValido, cpfValido, emailValido, validarPedido, type PedidoEntrada } from "./pedido";
import { limparTexto } from "./texto";
import { linkParaCliente, whatsappValido } from "./whatsapp";

const base: PedidoEntrada = {
  tipoRequerente: "pf",
  regime: "pessoa_natural",
  participaEmpresaDoRamo: false,
  nome: "Ana Maria Ramos",
  documento: "529.982.247-25",
  email: "ana@exemplo.com.br",
  cep: "60000-000",
  logradouro: "Rua das Flores",
  numero: "100",
  complemento: "",
  bairro: "Centro",
  cidade: "Fortaleza",
  uf: "CE",
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
  aceiteTermos: true,
  cienciaDocumentosInpi: true,
  monitoramento: false,
};

const erros = (extra: Record<string, unknown>) => {
  const r = validarPedido({ ...base, ...extra } as PedidoEntrada);
  return r.ok ? {} : r.erros;
};

describe("limparTexto", () => {
  it.each([
    ["  Ana   Maria  ", "Ana Maria"],
    ["Ana\nMaria\tRamos", "Ana Maria Ramos"],
    ["Ana\u0000Maria", "Ana Maria"],
    ["\u0000\u0000\u0000", ""],
    ["​​​", ""],
    ["Kaza​Doce", "KazaDoce"],
    ["‮odnuM", "odnuM"],
    ["﻿Ana", "Ana"],
    ["Ana Maria", "Ana Maria"],
    ["Pão de Queijo ção", "Pão de Queijo ção"],
    ["日本語の名前", "日本語の名前"],
    ["Café 🙂", "Café 🙂"],
  ])("limpa %j", (entrada, esperado) => {
    expect(limparTexto(entrada)).toBe(esperado);
  });

  it.each([[null], [undefined], [42], [true], [{}], [["a"]], [() => "x"]])(
    "o que não é texto (%j) vira vazio",
    (v) => {
      expect(limparTexto(v)).toBe("");
    }
  );

  it("nunca deixa NUL nem caracteres de controle passarem", () => {
    const todos = Array.from({ length: 0x20 }, (_, i) => String.fromCharCode(i)).join("");
    expect(limparTexto(`a${todos}b`)).toBe("a b");
  });
});

describe("CPF e CNPJ", () => {
  it.each([
    ["529.982.247-25", true],
    ["52998224725", true],
    ["  529 982 247 25  ", true],
    ["529.982.247-24", false],
    ["111.111.111-11", false],
    ["000.000.000-00", false],
    ["1234567890", false],
    ["123456789012", false],
    ["", false],
    ["abcdefghijk", false],
  ])("CPF %j -> %s", (v, ok) => expect(cpfValido(v)).toBe(ok));

  it.each([
    ["69.355.003/0001-44", true],
    ["69355003000144", true],
    ["69.355.003/0001-45", false],
    ["11.111.111/1111-11", false],
    ["00000000000000", false],
    ["6935500300014", false],
    ["", false],
  ])("CNPJ %j -> %s", (v, ok) => expect(cnpjValido(v)).toBe(ok));

  it("CPF no lugar de CNPJ (e o contrário) é recusado", () => {
    expect(erros({ tipoRequerente: "pj", regime: "mei", documento: "529.982.247-25" }).documento).toBe(
      "CNPJ inválido."
    );
    expect(erros({ documento: "69.355.003/0001-44" }).documento).toBe("CPF inválido.");
  });
});

describe("e-mail", () => {
  it.each([
    ["ana@exemplo.com.br", true],
    ["ana.maria+tag@sub.exemplo.org", true],
    ["  ana@exemplo.com  ", true],
    ["ana@exemplo", false],
    ["ana@@exemplo.com", false],
    ["ana exemplo@x.com", false],
    ["@exemplo.com", false],
    ["ana@.com", false],
    ["", false],
    ["a".repeat(130) + "@x.com", false],
  ])("%j -> %s", (v, ok) => expect(emailValido(v)).toBe(ok));
});

describe("WhatsApp", () => {
  it.each([
    ["(85) 91234-5678", true],
    ["85912345678", true],
    ["8591234567", true],
    ["+55 85 91234-5678", true],
    ["5585912345678", true],
    ["91234-5678", false],
    ["(85) 1234", false],
    ["123", false],
    ["", false],
    ["abcdefghijk", false],
    ["+1 555 123 4567", false],
    ["8591234567812345", false],
  ])("%j -> %s", (v, ok) => expect(whatsappValido(v)).toBe(ok));

  it("o link para o cliente só sai com número plausível", () => {
    expect(linkParaCliente("(85) 91234-5678", "oi")).toContain("wa.me/5585912345678");
    expect(linkParaCliente("123", "oi")).toBeNull();
    expect(linkParaCliente("", "oi")).toBeNull();
  });

  it("o texto do link é codificado (não deixa o cliente injetar parâmetros)", () => {
    const l = linkParaCliente("(85) 91234-5678", "oi&phone=999 #x") ?? "";
    expect(l).not.toContain("&phone=");
    expect(l).toContain(encodeURIComponent("oi&phone=999 #x"));
  });
});

describe("endereço", () => {
  it.each([
    ["60.000-000", false],
    ["60000-000", false],
    ["60000000", false],
    ["6000000", true],
    ["600000000", true],
    ["", true],
    ["abcdefgh", true],
  ])("CEP %j: erro? %s", (cep, temErro) => expect("cep" in erros({ cep })).toBe(temErro));

  it.each([
    ["ce", false],
    [" CE ", false],
    ["XX", true],
    ["", true],
    ["C", true],
    [null, true],
  ])("UF %j: erro? %s", (uf, temErro) => expect("uf" in erros({ uf })).toBe(temErro));

  it("o estado vira maiúsculo e o CEP vira só números", () => {
    const r = validarPedido({ ...base, uf: "ce", cep: "60.000-000" });
    expect(r.ok && r.dados.uf).toBe("CE");
    expect(r.ok && r.dados.cep).toBe("60000000");
  });

  it("limites de tamanho dos campos de endereço", () => {
    expect("logradouro" in erros({ logradouro: "r".repeat(121) })).toBe(true);
    expect("numero" in erros({ numero: "1".repeat(13) })).toBe(true);
    expect("complemento" in erros({ complemento: "c".repeat(61) })).toBe(true);
    expect("bairro" in erros({ bairro: "b".repeat(81) })).toBe(true);
    expect("cidade" in erros({ cidade: "c".repeat(81) })).toBe(true);
    expect(Object.keys(erros({ logradouro: "r".repeat(120), numero: "s/n", complemento: "c".repeat(60) }))).toEqual([]);
  });
});

describe("nome, marca e classe", () => {
  it("nome só com caracteres invisíveis é recusado", () => {
    expect("nome" in erros({ nome: "​​​​" })).toBe(true);
    expect("nome" in erros({ nome: "\u0000\u0000\u0000\u0000" })).toBe(true);
  });

  it("nome com NUL é limpo e aceito, sem NUL", () => {
    const r = validarPedido({ ...base, nome: "Ana\u0000 Maria" });
    expect(r.ok && r.dados.nome).toBe("Ana Maria");
  });

  it("nome com HTML é guardado como texto (a tela escapa)", () => {
    const r = validarPedido({ ...base, nome: "<img src=x onerror=alert(1)> Silva" });
    expect(r.ok && r.dados.nome).toBe("<img src=x onerror=alert(1)> Silva");
  });

  it.each([
    ["1", false],
    ["45", false],
    [" 30 ", false],
    ["0", true],
    ["46", true],
    ["-1", true],
    ["1.5", true],
    ["1e1", true],
    ["030", true],
    ["", true],
    [30, true], // número no lugar de texto
    [null, true],
  ])("classe %j: erro? %s", (classeNice, temErro) => {
    expect("classeNice" in erros({ classeNice })).toBe(temErro);
  });

  it("marca figurativa dispensa o nome; nominativa e mista exigem", () => {
    expect(erros({ apresentacao: "figurativa", elementoNominativo: "", palavraEstrangeira: undefined })).toEqual({});
    expect("elementoNominativo" in erros({ apresentacao: "nominativa", elementoNominativo: "" })).toBe(true);
    expect("elementoNominativo" in erros({ apresentacao: "mista", elementoNominativo: "  " })).toBe(true);
    expect("elementoNominativo" in erros({ elementoNominativo: "m".repeat(121) })).toBe(true);
  });

  it("apresentação inventada é recusada", () => {
    expect("apresentacao" in erros({ apresentacao: "sonora" })).toBe(true);
  });
});

describe("produtos e serviços (especificação)", () => {
  it("tira repetidos e espaços", () => {
    const r = validarPedido({ ...base, especificacaoItens: ["Bolos", " Bolos ", "Bolos"] });
    expect(r.ok && r.dados.especificacaoItens).toEqual(["Bolos"]);
  });

  it("de 1 a 50 itens", () => {
    expect("especificacao" in erros({ especificacaoItens: [] })).toBe(true);
    const muitos = Array.from({ length: 51 }, (_, i) => `item numero ${i}`);
    expect("especificacao" in erros({ especificacaoItens: muitos })).toBe(true);
  });

  it("cada item de 3 a 300 caracteres", () => {
    expect("especificacao" in erros({ especificacaoItens: ["ab"] })).toBe(true);
    expect("especificacao" in erros({ especificacaoItens: ["x".repeat(301)] })).toBe(true);
  });

  it("especificação total acima de 2000 caracteres é recusada", () => {
    const itens = Array.from({ length: 10 }, (_, i) => `${i}`.repeat(250));
    expect(erros({ especificacaoItens: itens }).especificacao).toMatch(/2000/);
  });

  it("itens que não são texto são ignorados, e lista que não é lista vira erro", () => {
    expect(erros({ especificacaoItens: "bolos" }).especificacao).toBeTruthy();
    expect(erros({ especificacaoItens: [1, null, {}] }).especificacao).toBeTruthy();
    const r = validarPedido({ ...base, especificacaoItens: ["Bolos", 5, null] as unknown as string[] });
    expect(r.ok && r.dados.especificacaoItens).toEqual(["Bolos"]);
  });
});

describe("palavra estrangeira e tradução", () => {
  it("responder é obrigatório para marca com nome", () => {
    expect("palavraEstrangeira" in erros({ palavraEstrangeira: undefined })).toBe(true);
    expect("palavraEstrangeira" in erros({ palavraEstrangeira: "sim" })).toBe(true);
  });
  it("se tem palavra estrangeira, a tradução é obrigatória e limitada", () => {
    expect("traducao" in erros({ palavraEstrangeira: true })).toBe(true);
    expect("traducao" in erros({ palavraEstrangeira: true, traducao: "x" })).toBe(true);
    expect("traducao" in erros({ palavraEstrangeira: true, traducao: "t".repeat(201) })).toBe(true);
    expect(erros({ palavraEstrangeira: true, traducao: "casa doce" })).toEqual({});
  });
  it("tradução enviada sem palavra estrangeira é descartada", () => {
    const r = validarPedido({ ...base, palavraEstrangeira: false, traducao: "lixo" });
    expect(r.ok && r.dados.traducao).toBeNull();
  });
});

describe("tipos trocados nos aceites", () => {
  const aceites = [
    "declaracaoAtividade",
    "declaracaoVeracidade",
    "aceiteProcuracao",
    "aceiteLgpd",
    "aceiteTermos",
    "cienciaDocumentosInpi",
  ];
  it.each(aceites.flatMap((a) => [["true"], [1], ["on"], [{}], [[true]], [null], [undefined]].map((v) => [a, v[0]])))(
    "%s com %j não vale como aceite",
    (campo, valor) => {
      expect(campo as string in erros({ [campo as string]: valor })).toBe(true);
    }
  );
});

describe("regime e tipo de requerente", () => {
  it("pessoa física só pode ser pessoa_natural; empresa não pode ser pessoa_natural", () => {
    expect("regime" in erros({ regime: "mei" })).toBe(true);
    expect("regime" in erros({ tipoRequerente: "pj", regime: "pessoa_natural", documento: "69355003000144" })).toBe(true);
    expect(erros({ tipoRequerente: "pj", regime: "mei", documento: "69355003000144" })).toEqual({});
  });
  it("valores inventados são recusados", () => {
    expect("tipoRequerente" in erros({ tipoRequerente: "gov" })).toBe(true);
    expect("regime" in erros({ regime: "super_empresa" })).toBe(true);
  });
  it("só a pessoa física guarda 'participa de empresa do ramo'", () => {
    const pj = validarPedido({ ...base, tipoRequerente: "pj", regime: "mei", documento: "69355003000144", participaEmpresaDoRamo: true });
    expect(pj.ok && pj.dados.participaEmpresaDoRamo).toBe(false);
    const pf = validarPedido({ ...base, participaEmpresaDoRamo: true });
    expect(pf.ok && pf.dados.participaEmpresaDoRamo).toBe(true);
  });
});

describe("robustez: lixo nunca derruba a validação", () => {
  // gerador pseudo-aleatório com semente fixa: o teste é sempre o mesmo e dá para reproduzir
  function gerador(semente: number) {
    let s = semente;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }
  const lixo = (rand: () => number, fundo = 0): unknown => {
    const r = rand();
    if (r < 0.1) return null;
    if (r < 0.2) return undefined;
    if (r < 0.3) return Math.floor(rand() * 1e6) - 5e5;
    if (r < 0.4) return rand() < 0.5;
    if (r < 0.55) return "x".repeat(Math.floor(rand() * 400));
    if (r < 0.65) return ["", " ", "\u0000", "​", "<script>", "' OR 1=1 --", "__proto__", "\ud800", "🙂"][Math.floor(rand() * 9)];
    if (r < 0.8 && fundo < 3) return Array.from({ length: Math.floor(rand() * 6) }, () => lixo(rand, fundo + 1));
    if (fundo < 3) {
      const o: Record<string, unknown> = {};
      for (let i = 0; i < Math.floor(rand() * 4); i++) o[["a", "__proto__", "constructor", "nome"][Math.floor(rand() * 4)] as string] = lixo(rand, fundo + 1);
      return o;
    }
    return "fim";
  };
  const campos = Object.keys(base);

  it("1500 pedidos com campos trocados por lixo: nunca lança, e só aprova se estiver completo", () => {
    const rand = gerador(12345);
    let aprovados = 0;
    for (let n = 0; n < 1500; n++) {
      const entrada: Record<string, unknown> = { ...base };
      const quantos = 1 + Math.floor(rand() * 5);
      for (let k = 0; k < quantos; k++) entrada[campos[Math.floor(rand() * campos.length)] as string] = lixo(rand);
      const r = validarPedido(entrada as PedidoEntrada);
      if (r.ok) {
        aprovados++;
        // se passou, os dados limpos precisam estar sãos
        expect(r.dados.nome.length).toBeGreaterThanOrEqual(3);
        expect(/[\u0000-\u001f]/.test(JSON.stringify(r.dados).replace(/\\u00[0-1][0-9a-f]/gi, "\u0000"))).toBe(false);
        expect(Number(r.dados.classeNice)).toBeGreaterThanOrEqual(1);
        expect(r.dados.documento).toMatch(/^\d{11}$|^\d{14}$/);
        expect(r.dados.cep).toMatch(/^\d{8}$/);
      }
    }
    expect(aprovados).toBeGreaterThanOrEqual(0);
  });

  it("entradas que não são objeto também não derrubam", () => {
    for (const v of [null, undefined, 0, "texto", [], [1, 2], true]) {
      expect(() => validarPedido((v ?? {}) as PedidoEntrada)).not.toThrow();
    }
  });

  it("chaves perigosas (__proto__, constructor) não contaminam nada", () => {
    const entrada = JSON.parse(
      '{"__proto__":{"admin":true},"constructor":{"prototype":{"x":1}},"nome":"Ana Maria Ramos"}'
    ) as PedidoEntrada;
    expect(() => validarPedido(entrada)).not.toThrow();
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it("pedido enorme é processado sem travar", () => {
    const grande = { ...base, atividade: "a".repeat(1_000_000), nome: "n".repeat(1_000_000) };
    const t = Date.now();
    const r = validarPedido(grande as PedidoEntrada);
    expect(r.ok).toBe(false);
    expect(Date.now() - t).toBeLessThan(1000);
  });
});
