/**
 * O robô tem a sua própria tabela dos valores da GRU (ele roda fora do site, sem TypeScript). Este
 * teste garante que ela não se afasta da que o site usa para cobrar.
 */
import { describe, expect, it } from "vitest";
// @ts-expect-error: módulo .mjs do robô, sem tipos
import { GRU_CENTAVOS } from "../../robo/src/logica.mjs";
import { GRU_DESCONTO_PCT, GRU_PEDIDO_CENTAVOS, GRU_PEDIDO_LIVRE_CENTAVOS, calcularGru } from "./gru";

describe("tabela de valores do robô", () => {
  it("389 e 394 batem com as constantes do site", () => {
    expect(GRU_CENTAVOS["389"].integral).toBe(GRU_PEDIDO_CENTAVOS);
    expect(GRU_CENTAVOS["394"].integral).toBe(GRU_PEDIDO_LIVRE_CENTAVOS);
  });
  it("o desconto do robô é o mesmo percentual do site", () => {
    expect(GRU_DESCONTO_PCT).toBe(50);
    for (const servico of ["389", "394"]) {
      const { integral, desconto } = GRU_CENTAVOS[servico];
      expect(desconto).toBe(Math.floor((integral * (100 - GRU_DESCONTO_PCT)) / 100));
    }
  });
  it("com o regime MEI, o que o site cobra de GRU é o que o robô espera ver", () => {
    expect(calcularGru("mei", false, false).centavos).toBe(GRU_CENTAVOS["389"].desconto);
    expect(calcularGru("mei", false, true).centavos).toBe(GRU_CENTAVOS["394"].desconto);
    expect(calcularGru("outra_empresa", false, false).centavos).toBe(GRU_CENTAVOS["389"].integral);
    expect(calcularGru("outra_empresa", false, true).centavos).toBe(GRU_CENTAVOS["394"].integral);
  });
});
