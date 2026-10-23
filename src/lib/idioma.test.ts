/**
 * Testes de src/lib/idioma.ts (heurística de palavra estrangeira). Não é um dicionário:
 * conferimos os sinais que ela usa e que nomes comuns em português não disparam.
 */
import { describe, expect, it } from "vitest";
import { detectarPalavraEstrangeira } from "./idioma";

describe("detectarPalavraEstrangeira", () => {
  it.each([
    ["Sweet Shop", "Sweet"],
    ["Sweet Shop", "Shop"],
    ["Coffee House", "House"],
    ["Kaza Doce", "Kaza"],
    ["Maison Bella", "Maison"],
    ["Marketing Now", "Marketing"],
  ])("'%s' levanta suspeita em '%s'", (nome, palavra) => {
    const r = detectarPalavraEstrangeira(nome);
    expect(r.suspeita).toBe(true);
    expect(r.palavras).toContain(palavra);
  });

  it.each([
    "Doce Lar",
    "Pão Quente",
    "Casa do Bolo",
    "Café da Vovó",
    "Sabor Mineiro",
    "Cooperativa Voo Alto",
    "Ação Social",
    "Flor de Ipê",
  ])("'%s' (português) não levanta suspeita", (nome) => {
    const r = detectarPalavraEstrangeira(nome);
    expect(r.suspeita).toBe(false);
    expect(r.palavras).toEqual([]);
  });

  it("lê só as letras, ignorando pontuação e números", () => {
    expect(detectarPalavraEstrangeira("Doce & Co. 24h").suspeita).toBe(false);
    expect(detectarPalavraEstrangeira("Sweet-Shop 2000").palavras).toEqual(["Sweet", "Shop"]);
  });

  it("nome vazio não tem suspeita", () => {
    expect(detectarPalavraEstrangeira("")).toEqual({ suspeita: false, palavras: [] });
  });
});
