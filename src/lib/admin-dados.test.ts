import { describe, expect, it } from "vitest";
import {
  buscaCombina,
  fmtDataHora,
  fmtDia,
  fmtDocumento,
  fmtEndereco,
  haQuanto,
  linhasDeDatas,
  linhasDoTitular,
  ordenar,
  situacaoDoPagamento,
  type ItemDeBusca,
} from "./admin-dados";
import { NATUREZA_INPI, REGIMES } from "./gru";

const agora = new Date("2026-10-25T15:00:00Z");

describe("datas", () => {
  it("fmtDataHora mostra o horário de Fortaleza (UTC-3)", () => {
    expect(fmtDataHora("2026-10-24T18:30:00Z")).toBe("24/10/2026, 15:30");
    // 01:30 UTC ainda é o dia anterior no Brasil
    expect(fmtDataHora("2026-10-25T01:30:00Z")).toBe("24/10/2026, 22:30");
  });
  it("sem data ou data inválida vira travessão", () => {
    for (const v of [null, undefined, "", "lixo"]) {
      expect(fmtDataHora(v)).toBe("—");
      expect(fmtDia(v)).toBe("—");
      expect(haQuanto(v)).toBe("");
    }
  });
  it("fmtDia não troca o dia (data guardada ao meio-dia UTC)", () => {
    expect(fmtDia("2026-11-03T12:00:00Z")).toBe("03/11/2026");
  });
  it("haQuanto fala em hoje, ontem, dias e meses", () => {
    const ha = (dias: number) => new Date(agora.getTime() - dias * 86_400_000).toISOString();
    expect(haQuanto(ha(0), agora)).toBe("hoje");
    expect(haQuanto(ha(1), agora)).toBe("ontem");
    expect(haQuanto(ha(5), agora)).toBe("há 5 dias");
    expect(haQuanto(ha(31), agora)).toBe("há 1 mês");
    expect(haQuanto(ha(95), agora)).toBe("há 3 meses");
    // data no futuro não vira "há -3 dias"
    expect(haQuanto(new Date(agora.getTime() + 3 * 86_400_000).toISOString(), agora)).toBe("hoje");
  });
});

describe("buscaCombina", () => {
  const p: ItemDeBusca = {
    id: "cmvn2wtn40001sclh9webx0z7",
    marca: "Kaza Doce",
    numeroProcesso: "905922891",
    anotacoes: "Quer plano com monitoramento",
    cliente: { nome: "Ana Maria Ramos", whatsapp: "(85) 99999-1234", email: "ana@exemplo.com" },
    pedidoRegistro: { nome: "Doces Kaza LTDA", documento: "69355003000144", email: "kaza@loja.com.br" },
  };

  it.each([
    ["", true],
    ["   ", true],
    ["kaza", true],
    ["KAZA doce", true],
    ["maría", true], // acento e caixa não importam
    ["ramos ana", true], // ordem das palavras não importa
    ["85999991234", true], // WhatsApp sem máscara
    ["(85) 99999", true],
    ["99999-1234", true],
    ["69.355.003", true], // CNPJ com máscara
    ["905922891", true],
    ["kaza@loja", true], // e-mail do titular
    ["monitoramento", true], // nas anotações
    ["x0z7", true], // final do código
    ["Doces Kaza LTDA", true],
    ["nubank", false],
    ["kaza nubank", false], // todas as palavras precisam aparecer
    ["12", false], // número curto demais para casar à toa
    ["00000000", false],
  ])("%j -> %s", (termo, esperado) => {
    expect(buscaCombina(p, termo)).toBe(esperado);
  });

  it("funciona sem pedido preenchido e sem e-mail", () => {
    const semPedido: ItemDeBusca = {
      ...p,
      pedidoRegistro: null,
      numeroProcesso: null,
      anotacoes: null,
      cliente: { nome: "João", whatsapp: "85988887777" },
    };
    expect(buscaCombina(semPedido, "joão")).toBe(true);
    expect(buscaCombina(semPedido, "69355003")).toBe(false);
  });
});

describe("ordenar", () => {
  const itens = [
    { marca: "b", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z", proximoContatoEm: null },
    { marca: "A", createdAt: "2026-10-10T00:00:00Z", updatedAt: "2026-10-11T00:00:00Z", proximoContatoEm: "2026-10-30T12:00:00Z" },
    { marca: "c", createdAt: "2026-10-05T00:00:00Z", proximoContatoEm: "2026-10-26T12:00:00Z" },
  ];
  const marcas = (l: { marca: string }[]) => l.map((x) => x.marca);

  it("recentes: o que deixou o contato por último vem primeiro", () => {
    expect(marcas(ordenar(itens, "recentes"))).toEqual(["A", "c", "b"]);
  });
  it("atividade: usa a última mudança (ou a criação, se não houver)", () => {
    expect(marcas(ordenar(itens, "atividade"))).toEqual(["b", "A", "c"]);
  });
  it("próximo contato: o mais urgente primeiro, e quem não tem data vai para o fim", () => {
    expect(marcas(ordenar(itens, "proximo_contato"))).toEqual(["c", "A", "b"]);
  });
  it("marca: ordem alfabética sem ligar para maiúsculas", () => {
    expect(marcas(ordenar(itens, "marca"))).toEqual(["A", "b", "c"]);
  });
  it("não altera a lista original", () => {
    const antes = marcas(itens);
    ordenar(itens, "marca");
    expect(marcas(itens)).toEqual(antes);
  });
});

describe("situacaoDoPagamento", () => {
  const pg = (tipo: string, status: string) => ({ tipo, status, confirmadoEm: null });
  it("sem cobrança, aguardando, pago e estornado", () => {
    expect(situacaoDoPagamento([])).toBe("sem_cobranca");
    expect(situacaoDoPagamento([pg("monitoramento", "pendente")])).toBe("sem_cobranca");
    expect(situacaoDoPagamento([pg("pacote", "pendente")])).toBe("aguardando");
    expect(situacaoDoPagamento([pg("pacote", "confirmado")])).toBe("pago");
    expect(situacaoDoPagamento([pg("pacote", "estornado")])).toBe("estornado");
  });
  it("modelo antigo: só está pago quando serviço e taxa estão pagos", () => {
    expect(situacaoDoPagamento([pg("setup", "confirmado"), pg("gru", "pendente")])).toBe("aguardando");
    expect(situacaoDoPagamento([pg("setup", "confirmado"), pg("gru", "confirmado")])).toBe("pago");
  });
  it("o monitoramento pendente não impede de aparecer como pago", () => {
    expect(situacaoDoPagamento([pg("pacote", "confirmado"), pg("monitoramento", "pendente")])).toBe("pago");
  });
});

describe("linhasDeDatas", () => {
  const base = {
    createdAt: "2026-10-24T18:30:00Z",
    updatedAt: "2026-10-25T12:00:00Z",
    cliente: { createdAt: "2026-10-20T10:00:00Z" },
    pedidoRegistro: { aceitoEm: "2026-10-24T19:00:00Z" },
    pagamentos: [
      { tipo: "pacote", status: "confirmado", confirmadoEm: "2026-10-24T20:00:00Z" },
      { tipo: "monitoramento", status: "pendente", confirmadoEm: null },
    ],
    gruPagaInpiEm: null,
    protocoladoEm: null,
    ultimoContatoEm: "2026-10-25T09:00:00Z",
    proximoContatoEm: "2026-11-03T12:00:00Z",
  };
  const get = (linhas: Array<[string, string]>, nome: string) => linhas.find(([n]) => n === nome)?.[1];

  it("mostra as datas com há quanto tempo, e travessão onde ainda não aconteceu", () => {
    const l = linhasDeDatas(base, agora);
    expect(get(l, "Deixou o contato")).toBe("24/10/2026, 15:30 (ontem)");
    expect(get(l, "Última atividade")).toContain("25/10/2026");
    expect(get(l, "Pagamento confirmado")).toContain("24/10/2026, 17:00");
    expect(get(l, "Próximo contato combinado")).toBe("03/11/2026");
    expect(get(l, "Taxa paga ao INPI")).toBe("—");
    expect(get(l, "Pedido protocolado")).toBe("—");
  });

  it("sem pagamento confirmado, mostra travessão", () => {
    const l = linhasDeDatas({ ...base, pagamentos: [] }, agora);
    expect(get(l, "Pagamento confirmado")).toBe("—");
  });

  it("usa a data de criação quando não há última atividade e aceita pedido vazio", () => {
    const l = linhasDeDatas({ ...base, updatedAt: undefined, pedidoRegistro: null, cliente: {} }, agora);
    expect(get(l, "Última atividade")).toContain("24/10/2026");
    expect(get(l, "Enviou os dados do pedido (aceites)")).toBe("—");
    expect(get(l, "Cliente no cadastro desde")).toBe("—");
  });
});

describe("dados do titular para o INPI", () => {
  it("diz qual Natureza Jurídica escolher no e-INPI para cada enquadramento", () => {
    for (const regime of REGIMES) {
      const l = linhasDoTitular({ tipoRequerente: regime === "pessoa_natural" ? "pf" : "pj", regime, participaEmpresaDoRamo: false });
      expect(l.find(([n]) => n.startsWith("Natureza Jurídica"))?.[1]).toBe(NATUREZA_INPI[regime]);
    }
  });
  it("MEI é pessoa jurídica com a natureza 'Microempreendedor Individual - MEI'", () => {
    const l = linhasDoTitular({ tipoRequerente: "pj", regime: "mei", participaEmpresaDoRamo: false });
    expect(l[0]?.[1]).toContain("Pessoa jurídica");
    expect(l[2]?.[1]).toBe("Microempreendedor Individual - MEI");
  });
  it("pessoa física com sociedade no ramo perde o desconto", () => {
    const l = linhasDoTitular({ tipoRequerente: "pf", regime: "pessoa_natural", participaEmpresaDoRamo: true });
    expect(l[3]?.[1]).toContain("Sim");
  });
  it("enquadramento desconhecido não quebra", () => {
    const l = linhasDoTitular({ tipoRequerente: "pj", regime: "inventado", participaEmpresaDoRamo: false });
    expect(l[1]?.[1]).toBe("inventado");
    expect(l[2]?.[1]).toContain("desconhecido");
  });
});

describe("formatação de documento e endereço", () => {
  it("CPF e CNPJ com máscara; outro tamanho fica como está", () => {
    expect(fmtDocumento("52998224725")).toBe("529.982.247-25");
    expect(fmtDocumento("69355003000144")).toBe("69.355.003/0001-44");
    expect(fmtDocumento("123")).toBe("123");
  });
  it("endereço numa linha, com complemento e CEP formatado", () => {
    expect(
      fmtEndereco({
        logradouro: "Av. Júlio Ibiapina",
        numero: "89",
        complemento: "sala 2",
        bairro: "Centro",
        cidade: "Fortaleza",
        uf: "CE",
        cep: "60170220",
      })
    ).toBe("Av. Júlio Ibiapina, 89 (sala 2), Centro, Fortaleza/CE, CEP 60170-220");
    expect(
      fmtEndereco({ logradouro: "Rua A", numero: "s/n", complemento: null, bairro: "B", cidade: "C", uf: "CE", cep: "123" })
    ).toBe("Rua A, s/n, B, C/CE, CEP 123");
  });
});
