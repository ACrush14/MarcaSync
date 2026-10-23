/**
 * Testes de src/lib/anterioridade.ts: quando avisar que já existe pedido ou registro parecido
 * no ramo do cliente, e quando o anterior já acabou.
 */
import { describe, expect, it } from "vitest";
import { anteriorEncerrado, avaliarAnterioridade, type MarcaAnterior } from "./anterioridade";
import type { RiscoPorArea } from "./risco-area";

function risco(
  marca: MarcaAnterior | null,
  modo: "por-ramo" | "geral" = "por-ramo"
): RiscoPorArea<MarcaAnterior> {
  return {
    modo,
    principal: marca,
    noRamo: modo === "por-ramo" ? marca : null,
    incerta: null,
    outrosRamos: null,
  };
}

const viva: MarcaAnterior = {
  nome: "Kaza Doce",
  pct: 92,
  numeroProcesso: "912345678",
  status: "Registro de marca em vigor",
  titular: "Fulana Ltda",
};

describe("anteriorEncerrado", () => {
  it.each([
    "Pedido definitivamente arquivado",
    "Registro de marca extinto",
    "Pedido de registro de marca indeferido",
    "Registro anulado (nulidade)",
    "Registro extinto por caducidade",
    "Extinto - Renúncia",
  ])("'%s' está encerrado", (s) => expect(anteriorEncerrado(s)).toBe(true));

  it.each(["Registro de marca em vigor", "Aguardando exame de mérito", "Pedido publicado"])(
    "'%s' ainda vive",
    (s) => expect(anteriorEncerrado(s)).toBe(false)
  );

  it("sem situação conhecida, não dá para dizer que acabou", () => {
    expect(anteriorEncerrado(undefined)).toBe(false);
  });
});

describe("avaliarAnterioridade", () => {
  it("risco alto e marca anterior viva: provável bloqueio, com os caminhos", () => {
    const a = avaliarAnterioridade(risco(viva));
    expect(a.nivel).toBe("provavel-bloqueio");
    expect(a.anterior?.nome).toBe("Kaza Doce");
    expect(a.texto).toContain("912345678");
    expect(a.texto).toContain("deposita primeiro");
    expect(a.alternativas.length).toBeGreaterThanOrEqual(3);
    expect(a.alternativas.join(" ")).toContain("129");
  });

  it("sem situação conhecida, trata como viva (melhor avisar a mais)", () => {
    const a = avaliarAnterioridade(risco({ ...viva, status: undefined }));
    expect(a.nivel).toBe("provavel-bloqueio");
  });

  it("anterior já arquivada: não bloqueia, mas manda conferir", () => {
    const a = avaliarAnterioridade(risco({ ...viva, status: "Pedido definitivamente arquivado" }));
    expect(a.nivel).toBe("anterior-encerrado");
    expect(a.alternativas).toEqual([]);
  });

  it("risco abaixo de 60% ou sem marca no ramo: nenhum aviso", () => {
    expect(avaliarAnterioridade(risco({ ...viva, pct: 59 })).nivel).toBe("nenhum");
    expect(avaliarAnterioridade(risco(null)).nivel).toBe("nenhum");
  });

  it("busca sem separar por ramo usa a marca principal", () => {
    expect(avaliarAnterioridade(risco(viva, "geral")).nivel).toBe("provavel-bloqueio");
  });
});
