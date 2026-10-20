/**
 * Testes de src/lib/classes.ts.
 *
 * Como ler o arquivo:
 * `describe("nome", () => { ... })` agrupa os testes de uma mesma função.
 * `it("frase", () => { ... })` é um teste: a frase diz o que deve acontecer, e é ela
 * que aparece no terminal quando o teste falha.
 * `expect(valor)` pega o resultado da função, e o `.toEqual(...)` ou `.toBe(...)` diz
 * qual era o esperado. `toEqual` compara listas pelo conteúdo; `toBe` compara valores
 * simples (`true`, `false`, `null`).
 */
import { describe, expect, it } from "vitest";
import { agruparPorArea, listarClasses, mesmaArea } from "./classes";

describe("listarClasses", () => {
  it("quebra o texto nas vírgulas e tira o espaço", () => {
    expect(listarClasses("25, 35")).toEqual(["25", "35"]);
  });

  it("devolve lista vazia quando não há classe", () => {
    expect(listarClasses(null)).toEqual([]);
  });

  // O INPI manda "03" e "09"; o nosso mapa de classes usa "3" e "9".
  it("tira o zero à esquerda", () => {
    expect(listarClasses("03, 09")).toEqual(["3", "9"]);
  });

  it("descarta pedaços vazios", () => {
    expect(listarClasses("25,,35")).toEqual(["25", "35"]);
  });

  it("descarta o que não é número", () => {
    expect(listarClasses("abc, 25")).toEqual(["25"]);
  });
});

describe("mesmaArea", () => {
  it("devolve true quando a classe da marca é a sugerida", () => {
    expect(mesmaArea("30", "30", "alta")).toBe(true);
  });

  it("devolve false quando a marca é de outra classe", () => {
    expect(mesmaArea("25", "30", "alta")).toBe(false);
  });

  // "Não sei" não é a mesma coisa que "é de outro ramo".
  it("devolve null quando a marca não informa classe", () => {
    expect(mesmaArea(null, "30", "alta")).toBe(null);
  });

  it("devolve null quando a sugestão de classe tem confiança baixa", () => {
    expect(mesmaArea("30", "30", "baixa")).toBe(null);
  });

  // O bug que o teste com dados reais do INPI mostrou: "03" não batia com "3".
  it("trata '03' do INPI como a classe '3'", () => {
    expect(mesmaArea("03", "3", "alta")).toBe(true);
  });

  it("não confunde a classe 3 com a classe 30", () => {
    expect(mesmaArea("30", "3", "alta")).toBe(false);
  });
});

describe("agruparPorArea", () => {
  // Uma marca de teste: só o nome e o campo que a função lê. O `?` deixa o campo opcional.
  type Marca = { nome: string; mesmaArea?: boolean | null };
  const a: Marca = { nome: "A", mesmaArea: true };
  const b: Marca = { nome: "B", mesmaArea: false };
  const c: Marca = { nome: "C", mesmaArea: null };
  const d: Marca = { nome: "D" }; // sem o campo (por exemplo, marca montada fora da colidência)
  const e: Marca = { nome: "E", mesmaArea: true };

  it("separa em mesma área, outras áreas e sem classe", () => {
    const g = agruparPorArea([a, b, c, d, e]);
    expect(g.mesmaArea.map((m) => m.nome)).toEqual(["A", "E"]);
    expect(g.outrasAreas.map((m) => m.nome)).toEqual(["B"]);
    expect(g.semClasse.map((m) => m.nome)).toEqual(["C", "D"]);
  });

  // false ("é de outro ramo") não pode se misturar com null ("não sei").
  it("não confunde false com null", () => {
    const g = agruparPorArea([b, c]);
    expect(g.outrasAreas).toEqual([b]);
    expect(g.semClasse).toEqual([c]);
  });

  it("mantém a ordem original dentro de cada grupo", () => {
    const g = agruparPorArea([e, b, a]);
    expect(g.mesmaArea.map((m) => m.nome)).toEqual(["E", "A"]);
  });

  it("é separável quando há pelo menos uma resposta sim ou não", () => {
    expect(agruparPorArea([a, c]).separavel).toBe(true);
    expect(agruparPorArea([b]).separavel).toBe(true);
  });

  // Descrição vaga (confiança baixa): tudo vem null, e não há o que separar.
  it("não é separável quando tudo é 'não sei'", () => {
    expect(agruparPorArea([c, d]).separavel).toBe(false);
  });

  it("aceita lista vazia", () => {
    const g = agruparPorArea([]);
    expect(g).toEqual({ mesmaArea: [], outrasAreas: [], semClasse: [], separavel: false });
  });
});
