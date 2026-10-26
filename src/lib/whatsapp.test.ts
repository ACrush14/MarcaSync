/**
 * Testes de src/lib/whatsapp.ts: a validação do número digitado no formulário e a
 * montagem do link wa.me que o /admin usa para falar com o cliente.
 *
 * Como ler o arquivo:
 * `describe` agrupa os testes de uma função, `it("frase", ...)` é um teste e a frase
 * aparece no terminal quando ele falha. `it.each([...])` roda o mesmo teste para cada
 * linha da tabela, trocando só os valores. `toBe` compara valores simples (`true`,
 * `false`, `null`, texto).
 */
import { describe, expect, it } from "vitest";
import type { ColidenciaMatch, ColidenciaResultado } from "./colidencia";
import { calcularRisco } from "./risco-area";
import { formatarWhatsapp, linkParaCliente, mensagemWhatsapp, whatsappValido } from "./whatsapp";

describe("whatsappValido", () => {
  // Só vale UM celular brasileiro: DDD que existe + 9 + 8 dígitos, com ou sem o 55 do país.
  it.each([
    ["8591234-5678", "sem parênteses, com hífen"],
    ["(85) 91234-5678", "celular com máscara (11 dígitos)"],
    ["85912345678", "celular só com dígitos (11 dígitos)"],
    ["5585912345678", "celular com o 55 do país (13 dígitos)"],
    ["+55 (85) 91234-5678", "celular com +55 e máscara"],
    ["(55) 98123-4567", "DDD 55 (RS) sem o código do país"],
    ["  (11) 98765-4321  ", "com espaços nas pontas"],
  ])("aceita %s (%s)", (entrada) => {
    expect(whatsappValido(entrada)).toBe(true);
  });

  it.each([
    ["", "vazio"],
    ["   ", "só espaços"],
    ["abc", "só letras"],
    ["12345", "curto demais (5 dígitos)"],
    ["859123456", "9 dígitos, falta um"],
    ["859123456789", "12 dígitos que não começam com 55"],
    ["55859123456789", "14 dígitos, sobra um"],
    ["(85) 3123-4567", "telefone fixo (sem WhatsApp)"],
    ["8531234567", "fixo só com dígitos"],
    ["558531234567", "fixo com o 55 do país"],
    ["(20) 91234-5678", "DDD que não existe"],
    ["(10) 91234-5678", "DDD que não existe (10)"],
    ["(85) 81234-5678", "celular que não começa com 9"],
    ["(85) 99999-9999", "número inventado (tudo 9)"],
    ["(85) 91111-1111", "número inventado (repetido)"],
    ["zap: 85 91234 5678!", "letras no meio"],
    ["(85) 91234-5678 / (85) 98888-7777", "dois números colados"],
    ["(85) 91234-5678 ou 85 98888-7777", "dois números com texto"],
    ["85 91234-5678+", "mais no fim"],
    ["+1 555 123 4567", "número de outro país"],
  ])("recusa %s (%s)", (entrada) => {
    expect(whatsappValido(entrada)).toBe(false);
  });

  it("não quebra com algo que não é texto", () => {
    expect(whatsappValido(undefined as unknown as string)).toBe(false);
    expect(whatsappValido(null as unknown as string)).toBe(false);
    expect(whatsappValido(85912345678 as unknown as string)).toBe(false);
  });
});

describe("formatarWhatsapp", () => {
  it.each([
    ["", ""],
    ["8", "(8"],
    ["85", "(85"],
    ["859", "(85) 9"],
    ["8591234", "(85) 91234"],
    ["85912345", "(85) 91234-5"],
    ["85912345678", "(85) 91234-5678"],
    ["(85) 91234-5678", "(85) 91234-5678"],
    ["+55 85 91234-5678", "(85) 91234-5678"],
    ["5585912345678", "(85) 91234-5678"],
    ["85912345678999", "(85) 91234-5678"],
    ["abc85x91234-5678", "(85) 91234-5678"],
    ["(55) 98123-4567", "(55) 98123-4567"],
  ])("%j vira %j", (entrada, esperado) => {
    expect(formatarWhatsapp(entrada)).toBe(esperado);
  });

  it("o que a máscara devolve de um celular válido continua válido", () => {
    expect(whatsappValido(formatarWhatsapp("+55 (85) 91234-5678"))).toBe(true);
  });
});

describe("linkParaCliente", () => {
  const texto = "Olá, tudo bem?";
  const textoNaUrl = encodeURIComponent(texto);

  it("acrescenta o 55 quando o número tem só DDD + número (11 dígitos)", () => {
    expect(linkParaCliente("(85) 91234-5678", texto)).toBe(
      `https://wa.me/5585912345678?text=${textoNaUrl}`
    );
  });

  it("acrescenta o 55 também no fixo (10 dígitos)", () => {
    expect(linkParaCliente("(85) 3123-4567", texto)).toBe(
      `https://wa.me/558531234567?text=${textoNaUrl}`
    );
  });

  it("não duplica o 55 quando ele já vem na frente", () => {
    expect(linkParaCliente("+55 85 91234-5678", texto)).toBe(
      `https://wa.me/5585912345678?text=${textoNaUrl}`
    );
  });

  // Nunca um link quebrado: sem número válido, devolve null.
  it.each([
    ["", "vazio"],
    ["12345", "curto demais"],
    ["55859123456789", "longo demais"],
  ])("devolve null para %s (%s)", (entrada) => {
    expect(linkParaCliente(entrada, texto)).toBe(null);
  });

  it("codifica o texto para caber na URL", () => {
    expect(linkParaCliente("85912345678", "a b&c")).toBe(
      "https://wa.me/5585912345678?text=a%20b%26c"
    );
  });
});

describe("mensagemWhatsapp: a linha de risco", () => {
  const marca = (nome: string, pct: number, mesmaArea: boolean | null): ColidenciaMatch => ({
    nome,
    classe: null,
    pct,
    fa: "",
    fb: "",
    fonte: "real",
    mesmaArea,
  });

  // Monta uma colidência mínima a partir da lista de marcas parecidas.
  const colidencia = (matches: ColidenciaMatch[]): ColidenciaResultado => ({
    fonte: "real",
    termo: "Nubank",
    matches,
    top: matches[0] ?? null,
    ncl: { code: "42", label: "Tecnologia", confidence: "alta" },
    risco: calcularRisco(matches),
  });

  const mensagem = (c: ColidenciaResultado) =>
    mensagemWhatsapp({
      nomeCliente: "Ana",
      marca: "Nubank",
      colidencia: c,
      processoId: null,
    });

  it("fala do risco no ramo quando há marca parecida no mesmo ramo", () => {
    const m = mensagem(colidencia([marca("NU BANCO", 73, true), marca("Nubank", 100, false)]));
    expect(m).toContain("Risco de colisão no meu ramo (NCL 42): 73%");
    expect(m).toContain("mais próxima: NU BANCO");
  });

  it("avisa que só há marcas parecidas em outros ramos", () => {
    const m = mensagem(colidencia([marca("Nubank", 100, false)]));
    expect(m).toContain("Nenhuma marca parecida no meu ramo (NCL 42)");
    expect(m).toContain("até 100%");
  });

  it("sem separação por ramo, mantém a linha de risco de antes", () => {
    const m = mensagem(colidencia([marca("CASADO", 56, null)]));
    expect(m).toContain("Risco de colisão: 56% (base do INPI)");
  });

  it("avisa que o cliente já preencheu os dados do pedido", () => {
    const base = { nomeCliente: "Ana", marca: "Nubank", colidencia: null, processoId: null };
    expect(mensagemWhatsapp({ ...base, pedidoEnviado: true })).toContain(
      "Já preenchi os dados do pedido de registro no site."
    );
    expect(mensagemWhatsapp(base)).not.toContain("Já preenchi");
  });

  it("sem nome (quem ainda não se identificou) abre só com a saudação", () => {
    const base = { nomeCliente: "", marca: "Nubank", colidencia: null, processoId: null };
    const m = mensagemWhatsapp(base);
    expect(m.startsWith('Olá! Acabei de consultar a marca "Nubank"')).toBe(true);
    expect(m).not.toContain("Aqui é");
  });
});
