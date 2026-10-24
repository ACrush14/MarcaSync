import { beforeEach, describe, expect, it } from "vitest";
import { barrarSeExceder, verificarLimite, zerarLimites } from "./limite-publico";

const regra = { max: 3, janelaMs: 60_000 };

describe("verificarLimite", () => {
  beforeEach(() => zerarLimites());

  it("deixa passar até o máximo e barra o seguinte", () => {
    const t = 1_000_000;
    expect(verificarLimite("a", regra, t).permitido).toBe(true);
    expect(verificarLimite("a", regra, t + 1).permitido).toBe(true);
    expect(verificarLimite("a", regra, t + 2).permitido).toBe(true);
    const barrado = verificarLimite("a", regra, t + 3);
    expect(barrado.permitido).toBe(false);
    expect(barrado.tentarEmSegundos).toBeGreaterThanOrEqual(1);
  });

  it("libera de novo quando a janela passa", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) verificarLimite("a", regra, t + i);
    expect(verificarLimite("a", regra, t + 10).permitido).toBe(false);
    expect(verificarLimite("a", regra, t + 60_001).permitido).toBe(true);
  });

  it("conta cada chave separada", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) verificarLimite("a", regra, t + i);
    expect(verificarLimite("a", regra, t + 5).permitido).toBe(false);
    expect(verificarLimite("b", regra, t + 5).permitido).toBe(true);
  });

  it("pedido barrado não estica o castigo (não conta como tentativa)", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) verificarLimite("a", regra, t + i);
    for (let i = 0; i < 50; i++) verificarLimite("a", regra, t + 100 + i);
    // 60 s depois do primeiro pedido já pode de novo, apesar das 50 tentativas barradas.
    expect(verificarLimite("a", regra, t + 60_001).permitido).toBe(true);
  });

  it("diz quanto falta para tentar de novo", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) verificarLimite("a", regra, t);
    expect(verificarLimite("a", regra, t + 30_000).tentarEmSegundos).toBe(30);
  });
});

describe("barrarSeExceder", () => {
  beforeEach(() => zerarLimites());

  const pedido = (ip: string) =>
    new Request("http://x/api/processos", { method: "POST", headers: { "x-forwarded-for": ip } });

  it("responde 429 com Retry-After depois do limite da rota", async () => {
    let resposta: Response | null = null;
    for (let i = 0; i < 40 && !resposta; i++) resposta = barrarSeExceder(pedido("1.2.3.4"), "criarProcesso");
    expect(resposta).not.toBeNull();
    expect(resposta?.status).toBe(429);
    expect(Number(resposta?.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
  });

  it("um IP barrado não atrapalha os outros, nem as outras rotas", () => {
    for (let i = 0; i < 40; i++) barrarSeExceder(pedido("1.2.3.4"), "criarProcesso");
    expect(barrarSeExceder(pedido("5.6.7.8"), "criarProcesso")).toBeNull();
    expect(barrarSeExceder(pedido("1.2.3.4"), "buscar")).toBeNull();
  });

  it("usa o primeiro IP do x-forwarded-for", () => {
    for (let i = 0; i < 40; i++) barrarSeExceder(pedido("9.9.9.9, 10.0.0.1"), "criarProcesso");
    expect(barrarSeExceder(pedido("9.9.9.9"), "criarProcesso")?.status).toBe(429);
  });
});
