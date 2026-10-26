import { describe, expect, it } from "vitest";
import {
  ESTILOS,
  LOGOS_POR_RODADA,
  MAX_GERACOES_POR_DIA_PADRAO,
  MAX_GERACOES_POR_PEDIDO,
  RODADAS_POR_PEDIDO,
  estiloDaVariacao,
  extrairImagem,
  limiteDoDia,
  limparEntrada,
  montarPrompt,
  validarEntradaLogo,
} from "./logo-ia";

const BASE64 = "iVBORw0KGgo".repeat(20); // só precisa parecer dado de imagem (mais de 100 caracteres)

describe("limites", () => {
  it("4 logos por rodada, 3 rodadas por pedido, uma opção por estilo", () => {
    expect(LOGOS_POR_RODADA).toBe(4);
    expect(RODADAS_POR_PEDIDO).toBe(3);
    expect(MAX_GERACOES_POR_PEDIDO).toBe(12);
    expect(ESTILOS).toHaveLength(LOGOS_POR_RODADA);
    expect(new Set(ESTILOS.map((e) => e.id)).size).toBe(ESTILOS.length);
  });

  it("limiteDoDia usa a variável quando é um inteiro positivo, senão o padrão", () => {
    expect(limiteDoDia({ LOGO_IA_LIMITE_DIA: "50" })).toBe(50);
    for (const ruim of [undefined, "", "0", "-3", "2.5", "abc"]) {
      expect(limiteDoDia({ LOGO_IA_LIMITE_DIA: ruim })).toBe(MAX_GERACOES_POR_DIA_PADRAO);
    }
  });
});

describe("estiloDaVariacao", () => {
  it("aceita 0 a 3 e recusa o resto", () => {
    for (let i = 0; i < LOGOS_POR_RODADA; i++) expect(estiloDaVariacao(i)?.id).toBe(ESTILOS[i]?.id);
    for (const ruim of [4, -1, 1.5, "1", null, undefined, NaN]) expect(estiloDaVariacao(ruim)).toBeNull();
  });
});

describe("limparEntrada", () => {
  it("tira controles, junta espaços e corta", () => {
    expect(limparEntrada("  Kaza\u0000  \n Doce\t ", 50)).toBe("Kaza Doce");
    expect(limparEntrada("x".repeat(300), 120)).toHaveLength(120);
    expect(limparEntrada(5, 10)).toBe("");
    expect(limparEntrada(null, 10)).toBe("");
  });
});

describe("validarEntradaLogo", () => {
  const boa = { marca: "Kaza Doce", atividade: "confeitaria artesanal, bolos sob encomenda", apresentacao: "mista" };
  it("aceita marca figurativa e mista", () => {
    expect(validarEntradaLogo(boa)).toEqual({
      ok: true,
      dados: { marca: "Kaza Doce", atividade: "confeitaria artesanal, bolos sob encomenda", apresentacao: "mista" },
    });
    expect(validarEntradaLogo({ ...boa, apresentacao: "figurativa" }).ok).toBe(true);
  });
  it.each([
    ["marca só nominativa (não tem logo)", { ...boa, apresentacao: "nominativa" }],
    ["apresentação inventada", { ...boa, apresentacao: "3d" }],
    ["sem nome", { ...boa, marca: "  " }],
    ["atividade curta demais", { ...boa, atividade: "bolos" }],
    ["atividade que não é texto", { ...boa, atividade: 12345678901 }],
  ])("recusa %s", (_n, entrada) => {
    expect(validarEntradaLogo(entrada).ok).toBe(false);
  });
  it("corta nome e atividade enormes em vez de mandar tudo ao modelo", () => {
    const r = validarEntradaLogo({ ...boa, marca: "m".repeat(500), atividade: "a".repeat(2000) });
    expect(r.ok && r.dados.marca.length).toBe(120);
    expect(r.ok && r.dados.atividade.length).toBe(500);
  });
});

describe("montarPrompt", () => {
  const estilo = ESTILOS[0];
  it("mista: pede o nome escrito igual", () => {
    const p = montarPrompt({ marca: "Kaza Doce", atividade: "confeitaria", apresentacao: "mista" }, estilo);
    expect(p).toContain('"Kaza Doce"');
    expect(p).toContain("legible text");
    expect(p).not.toContain("absolutely no letters");
  });
  it("figurativa: só símbolo, sem nenhuma letra", () => {
    const p = montarPrompt({ marca: "Kaza Doce", atividade: "confeitaria", apresentacao: "figurativa" }, estilo);
    expect(p).toContain("absolutely no letters");
    expect(p).not.toContain("legible text");
  });
  it("traz a atividade, o estilo e as proibições (sem ™/®, sem copiar marca existente)", () => {
    const p = montarPrompt({ marca: "X", atividade: "venda de bolos", apresentacao: "mista" }, estilo);
    expect(p).toContain('"venda de bolos"');
    expect(p).toContain(estilo.pedido);
    expect(p).toContain("plain pure white background");
    expect(p).toContain("no trademark symbols");
    expect(p).toContain("Do not copy or imitate any existing brand");
  });
  it("cada estilo muda o pedido", () => {
    const prompts = ESTILOS.map((e) => montarPrompt({ marca: "X", atividade: "venda de bolos", apresentacao: "mista" }, e));
    expect(new Set(prompts).size).toBe(ESTILOS.length);
  });
});

describe("extrairImagem", () => {
  it("lê o formato novo (steps → content → image)", () => {
    const resposta = { steps: [{ type: "model_output", content: [{ type: "text", text: "ok" }, { type: "image", data: BASE64, mime_type: "image/png" }] }] };
    expect(extrairImagem(resposta)).toEqual({ mime: "image/png", base64: BASE64 });
  });
  it("lê o formato antigo (candidates → inlineData e inline_data)", () => {
    const a = { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/jpeg", data: BASE64 } }] } }] };
    const b = { outputs: [{ inline_data: { mime_type: "image/webp", data: BASE64 } }] };
    expect(extrairImagem(a)).toEqual({ mime: "image/jpeg", base64: BASE64 });
    expect(extrairImagem(b)).toEqual({ mime: "image/webp", base64: BASE64 });
  });
  it("tipo desconhecido vira image/png", () => {
    expect(extrairImagem({ type: "image", data: BASE64, mime_type: "application/x-evil" })?.mime).toBe("image/png");
  });
  it("devolve null quando só há texto, dados curtos, vazio ou lixo", () => {
    expect(extrairImagem({ steps: [{ content: [{ type: "text", text: "não posso criar" }] }] })).toBeNull();
    expect(extrairImagem({ type: "image", data: "abc" })).toBeNull();
    for (const ruim of [null, undefined, "texto", 5, [], {}]) expect(extrairImagem(ruim)).toBeNull();
  });
  it("não se perde em resposta muito aninhada", () => {
    let fundo: unknown = { type: "image", data: BASE64 };
    for (let i = 0; i < 20; i++) fundo = { dentro: fundo };
    expect(extrairImagem(fundo)).toBeNull();
  });
});
