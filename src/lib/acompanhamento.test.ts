import { describe, expect, it } from "vitest";
import {
  MAX_ANOTACOES,
  contar,
  dataDoDia,
  dataEmDias,
  limparAnotacao,
  paraCampoDeData,
  precisaContatar,
  situacaoDoContato,
  validarAcompanhamento,
} from "./acompanhamento";

// 24/10/2026, 15:00 em Fortaleza = 18:00 UTC
const agora = new Date("2026-10-24T18:00:00Z");
const base = { interesse: "interessado", ultimoContatoEm: null, anotacoes: null };

describe("dataDoDia", () => {
  it("aceita datas reais e guarda ao meio-dia UTC (não vira o dia anterior)", () => {
    expect(dataDoDia("2026-11-03")?.toISOString()).toBe("2026-11-03T12:00:00.000Z");
    expect(dataDoDia("2028-02-29")).not.toBeNull();
  });
  it.each(["2026-02-30", "2026-13-01", "2027-02-29", "03/11/2026", "2026-1-1", "", "abc", "2019-12-31", "2101-01-01"])(
    "recusa %j",
    (v) => expect(dataDoDia(v)).toBeNull()
  );
});

describe("limparAnotacao", () => {
  it("mantém as quebras de linha e tira o excesso", () => {
    expect(limparAnotacao("  Ligou ontem.\r\n\r\n\r\n\r\nPediu preço.  ")).toBe("Ligou ontem.\n\nPediu preço.");
  });
  it("tira NUL, controle e invisíveis", () => {
    expect(limparAnotacao("a\u0000b​c\u0007d")).toBe("a bc d");
  });
  it("junta espaços repetidos e tabulações", () => {
    expect(limparAnotacao("a    b\t\tc")).toBe("a b c");
  });
});

describe("validarAcompanhamento", () => {
  it("aceita só os campos enviados", () => {
    const r = validarAcompanhamento({ interesse: "acompanhar" }, agora);
    expect(r).toEqual({ ok: true, dados: { interesse: "acompanhar" } });
  });

  it("monta a data, as anotações e o último contato", () => {
    const r = validarAcompanhamento(
      { interesse: "interessado", proximoContatoEm: "2026-11-03", anotacoes: "  Quer o plano com monitoramento ", contatei: true },
      agora
    );
    expect(r.ok && r.dados.proximoContatoEm?.toISOString()).toBe("2026-11-03T12:00:00.000Z");
    expect(r.ok && r.dados.anotacoes).toBe("Quer o plano com monitoramento");
    expect(r.ok && r.dados.ultimoContatoEm).toEqual(agora);
  });

  it("data vazia ou nula limpa o campo; anotação vazia vira nula", () => {
    const r = validarAcompanhamento({ proximoContatoEm: "", anotacoes: "   " }, agora);
    expect(r.ok && r.dados.proximoContatoEm).toBeNull();
    expect(r.ok && r.dados.anotacoes).toBeNull();
    expect(validarAcompanhamento({ proximoContatoEm: null }, agora).ok).toBe(true);
  });

  it("contatei: false não grava data de contato", () => {
    const r = validarAcompanhamento({ contatei: false, interesse: "novo" }, agora);
    expect(r.ok && "ultimoContatoEm" in r.dados).toBe(false);
  });

  it.each([
    ["interesse inventado", { interesse: "quente" }],
    ["interesse de outro tipo", { interesse: 5 }],
    ["data impossível", { proximoContatoEm: "2026-02-30" }],
    ["data de outro tipo", { proximoContatoEm: 20261103 }],
    ["anotação de outro tipo", { anotacoes: 123 }],
    ["anotação enorme", { anotacoes: "x".repeat(MAX_ANOTACOES + 1) }],
    ["contatei de outro tipo", { contatei: "sim" }],
    ["nada enviado", {}],
  ])("recusa %s", (_n, entrada) => {
    expect(validarAcompanhamento(entrada, agora).ok).toBe(false);
  });

  it("anotação no limite passa", () => {
    expect(validarAcompanhamento({ anotacoes: "x".repeat(MAX_ANOTACOES) }, agora).ok).toBe(true);
  });
});

describe("situacaoDoContato", () => {
  const com = (data: string | null, interesse = "interessado") => ({
    ...base,
    interesse,
    proximoContatoEm: data ? `${data}T12:00:00Z` : null,
  });

  it("hoje, atrasado e agendado (calendário do Brasil)", () => {
    expect(situacaoDoContato(com("2026-10-24"), agora)).toBe("hoje");
    expect(situacaoDoContato(com("2026-10-23"), agora)).toBe("atrasado");
    expect(situacaoDoContato(com("2026-10-25"), agora)).toBe("agendado");
  });

  it("de madrugada no Brasil ainda é o dia anterior em UTC: o dia certo é o do Brasil", () => {
    const tarde = new Date("2026-10-25T01:30:00Z"); // 22:30 de 24/10 em Fortaleza
    expect(situacaoDoContato(com("2026-10-24"), tarde)).toBe("hoje");
    expect(situacaoDoContato(com("2026-10-25"), tarde)).toBe("agendado");
  });

  it("sem data é 'sem_data'", () => {
    expect(situacaoDoContato(com(null), agora)).toBe("sem_data");
    expect(situacaoDoContato(com(null, "novo"), agora)).toBe("sem_data");
  });

  it("sem interesse e quem já pagou estão encerrados, com ou sem data", () => {
    expect(situacaoDoContato(com("2026-10-01", "sem_interesse"), agora)).toBe("encerrado");
    expect(situacaoDoContato(com("2026-10-01"), agora, true)).toBe("encerrado");
  });

  it("data inválida guardada não quebra", () => {
    expect(situacaoDoContato({ ...base, proximoContatoEm: "lixo" }, agora)).toBe("sem_data");
  });

  it("precisaContatar só para hoje e atrasado", () => {
    expect(precisaContatar(com("2026-10-24"), agora)).toBe(true);
    expect(precisaContatar(com("2026-10-20"), agora)).toBe(true);
    expect(precisaContatar(com("2026-10-30"), agora)).toBe(false);
    expect(precisaContatar(com(null), agora)).toBe(false);
    expect(precisaContatar(com("2026-10-20", "sem_interesse"), agora)).toBe(false);
  });
});

describe("contar", () => {
  it("conta por interesse, quem contatar hoje e quem está sem data", () => {
    const itens = [
      { ...base, interesse: "novo", proximoContatoEm: null },
      { ...base, interesse: "interessado", proximoContatoEm: "2026-10-24T12:00:00Z" },
      { ...base, interesse: "interessado", proximoContatoEm: null },
      { ...base, interesse: "acompanhar", proximoContatoEm: "2026-10-01T12:00:00Z" },
      { ...base, interesse: "acompanhar", proximoContatoEm: "2026-12-01T12:00:00Z" },
      { ...base, interesse: "sem_interesse", proximoContatoEm: "2026-10-01T12:00:00Z" },
      { ...base, interesse: "interessado", proximoContatoEm: "2026-10-01T12:00:00Z", jaPagou: true },
      { ...base, interesse: "valor-estranho", proximoContatoEm: null },
    ];
    const r = contar(itens, agora);
    expect(r.total).toBe(8);
    expect(r.porInteresse).toEqual({ novo: 2, interessado: 3, acompanhar: 2, sem_interesse: 1 });
    expect(r.paraContatarHoje).toBe(2);
    expect(r.semData).toBe(1);
  });

  it("lista vazia", () => {
    expect(contar([], agora)).toEqual({
      total: 0,
      porInteresse: { novo: 0, interessado: 0, acompanhar: 0, sem_interesse: 0 },
      paraContatarHoje: 0,
      semData: 0,
    });
  });
});

describe("datas do painel", () => {
  it("paraCampoDeData", () => {
    expect(paraCampoDeData("2026-11-03T12:00:00Z")).toBe("2026-11-03");
    expect(paraCampoDeData(null)).toBe("");
    expect(paraCampoDeData("lixo")).toBe("");
  });
  it("dataEmDias usa o calendário do Brasil", () => {
    expect(dataEmDias(0, agora)).toBe("2026-10-24");
    expect(dataEmDias(3, agora)).toBe("2026-10-27");
    expect(dataEmDias(1, new Date("2026-10-25T01:30:00Z"))).toBe("2026-10-25");
  });
});
