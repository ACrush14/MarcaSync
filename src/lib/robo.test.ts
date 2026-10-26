import { describe, expect, it } from "vitest";
import {
  ROBO_SEM_SINAL_MS,
  autorizarRobo,
  mensagemDaConferencia,
  mensagemDoEstado,
  roboSemSinal,
  tarefaDoPedido,
  validarConferencia,
  validarEstado,
} from "./robo";

describe("autorizarRobo", () => {
  const env = { ROBO_TOKEN: "segredo-do-robo" };
  it("aceita só o token certo no formato Bearer", () => {
    expect(autorizarRobo("Bearer segredo-do-robo", env)).toBe("ok");
    expect(autorizarRobo("Bearer errado", env)).toBe("negado");
    expect(autorizarRobo("Bearer segredo-do-rob", env)).toBe("negado");
    expect(autorizarRobo("Bearer segredo-do-robo-x", env)).toBe("negado");
    expect(autorizarRobo("segredo-do-robo", env)).toBe("negado");
    expect(autorizarRobo("Basic segredo-do-robo", env)).toBe("negado");
    expect(autorizarRobo("Bearer ", env)).toBe("negado");
    expect(autorizarRobo(null, env)).toBe("negado");
  });
  it("sem o token no servidor, fica DESLIGADO, e nunca aberto (nem com cabeçalho vazio)", () => {
    expect(autorizarRobo("Bearer qualquer", {})).toBe("desligado");
    expect(autorizarRobo("Bearer ", { ROBO_TOKEN: "" })).toBe("desligado");
    expect(autorizarRobo(null, {})).toBe("desligado");
  });
});

describe("tarefaDoPedido", () => {
  it("a lista do INPI é o serviço 389; texto livre é o 394; o valor é o que o site cobrou", () => {
    expect(tarefaDoPedido({ especificacaoLivre: false, gruComDesconto: true, gruCentavos: 44_000 })).toEqual({
      servico: "389",
      classes: 1,
      comDesconto: true,
      esperadoCentavos: 44_000,
    });
    expect(tarefaDoPedido({ especificacaoLivre: true, gruComDesconto: false, gruCentavos: 172_000 })).toMatchObject({
      servico: "394",
      comDesconto: false,
      esperadoCentavos: 172_000,
    });
  });
  it("não carrega dado pessoal", () => {
    const t = tarefaDoPedido({ especificacaoLivre: false, gruComDesconto: true, gruCentavos: 44_000 });
    expect(Object.keys(t).sort()).toEqual(["classes", "comDesconto", "esperadoCentavos", "servico"]);
  });
});

describe("validarConferencia", () => {
  const ok = { resultado: "ok", servico: "389", esperadoCentavos: 44_000, lidoCentavos: 44_000 };

  it("aceita conferência ok com o valor igual", () => {
    expect(validarConferencia(ok)).toEqual({
      ok: true,
      dados: { resultado: "ok", servico: "389", esperadoCentavos: 44_000, lidoCentavos: 44_000, detalhe: null },
    });
  });
  it("'ok' com valor diferente ou sem valor é recusado (o robô não pode dizer 'ok' sem ter lido)", () => {
    expect(validarConferencia({ ...ok, lidoCentavos: 88_000 }).ok).toBe(false);
    expect(validarConferencia({ ...ok, lidoCentavos: undefined }).ok).toBe(false);
    expect(validarConferencia({ ...ok, lidoCentavos: null }).ok).toBe(false);
  });
  it("'divergente' exige o valor lido; 'erro' não", () => {
    expect(validarConferencia({ ...ok, resultado: "divergente", lidoCentavos: 88_000 }).ok).toBe(true);
    expect(validarConferencia({ ...ok, resultado: "divergente", lidoCentavos: undefined }).ok).toBe(false);
    expect(validarConferencia({ resultado: "erro", servico: "394", esperadoCentavos: 86_000, detalhe: "tela mudou" }).ok).toBe(true);
  });
  it.each([
    ["resultado inventado", { ...ok, resultado: "talvez" }],
    ["serviço fora de 389/394", { ...ok, servico: "999" }],
    ["serviço como número", { ...ok, servico: 389 }],
    ["esperado negativo", { ...ok, esperadoCentavos: -1 }],
    ["esperado com centavos quebrados", { ...ok, esperadoCentavos: 440.5 }],
    ["esperado absurdo", { ...ok, esperadoCentavos: 1e12 }],
    ["lido em texto", { ...ok, resultado: "divergente", lidoCentavos: "880" }],
    ["detalhe que não é texto", { ...ok, detalhe: 5 }],
    ["vazio", {}],
  ])("recusa %s", (_n, entrada) => {
    expect(validarConferencia(entrada).ok).toBe(false);
  });
  it("limpa e corta o detalhe", () => {
    const r = validarConferencia({ resultado: "erro", servico: "389", esperadoCentavos: 1, detalhe: `a\u0000b\n${"x".repeat(900)}` });
    expect(r.ok && r.dados.detalhe?.length).toBeLessThanOrEqual(500);
    expect(r.ok && r.dados.detalhe).not.toContain("\u0000");
  });
});

describe("validarEstado", () => {
  it("aceita ok, expirada e erro", () => {
    expect(validarEstado({ sessao: "ok" })).toEqual({ ok: true, sessao: "ok", detalhe: null });
    expect(validarEstado({ sessao: "expirada", detalhe: "  caiu " })).toEqual({ ok: true, sessao: "expirada", detalhe: "caiu" });
    expect(validarEstado({ sessao: "erro" }).ok).toBe(true);
  });
  it("recusa o resto", () => {
    expect(validarEstado({ sessao: "dormindo" }).ok).toBe(false);
    expect(validarEstado({}).ok).toBe(false);
    expect(validarEstado({ sessao: "ok", detalhe: 1 }).ok).toBe(false);
  });
});

describe("mensagens", () => {
  const base = { servico: "389" as const, esperadoCentavos: 44_000, lidoCentavos: 44_000, detalhe: null };
  it("ok: diz o valor e que nada foi gerado nem pago", () => {
    const m = mensagemDaConferencia("Kaza Doce", { ...base, resultado: "ok" });
    expect(m.assunto).toContain("conferida");
    expect(m.texto.replace(/\s/g, " ")).toContain("R$ 440,00");
    expect(m.texto).toContain("Nada foi gerado nem pago");
  });
  it("divergente: assunto de ATENÇÃO, com os dois valores e a causa provável", () => {
    const m = mensagemDaConferencia("Kaza Doce", { ...base, resultado: "divergente", lidoCentavos: 88_000 });
    expect(m.assunto).toMatch(/^ATENÇÃO/);
    expect(m.texto.replace(/\s/g, " ")).toContain("R$ 880,00");
    expect(m.texto.replace(/\s/g, " ")).toContain("R$ 440,00");
    expect(m.texto).toContain("desconto");
  });
  it("erro: diz que vai tentar de novo", () => {
    const m = mensagemDaConferencia("Kaza Doce", { ...base, resultado: "erro", lidoCentavos: null, detalhe: "tela mudou" });
    expect(m.texto).toContain("tela mudou");
    expect(m.texto).toContain("1 hora");
  });
  it("estado: sessão expirada e erro avisam; ok não precisa avisar", () => {
    expect(mensagemDoEstado("expirada", null)?.assunto).toContain("entre no e-INPI");
    expect(mensagemDoEstado("erro", "caiu")?.texto).toContain("caiu");
    expect(mensagemDoEstado("ok", null)).toBeNull();
  });
});

describe("roboSemSinal", () => {
  const agora = new Date("2026-10-26T12:00:00Z");
  it("sem sinal nunca visto, ou há mais de 15 minutos", () => {
    expect(roboSemSinal(null, agora)).toBe(true);
    expect(roboSemSinal("lixo", agora)).toBe(true);
    expect(roboSemSinal(new Date(agora.getTime() - ROBO_SEM_SINAL_MS - 1000), agora)).toBe(true);
  });
  it("com sinal recente, não", () => {
    expect(roboSemSinal(new Date(agora.getTime() - 60_000), agora)).toBe(false);
    expect(roboSemSinal(agora.toISOString(), agora)).toBe(false);
  });
});
