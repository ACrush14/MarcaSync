import { describe, expect, it } from "vitest";
import {
  GRU_CENTAVOS,
  botaoProibido,
  compararValor,
  estaLogado,
  extrairLinhaDoServico,
  extrairValorTotal,
  formatarReais,
  naTelaDeLogin,
  parseValorReais,
  resumirResultado,
  urlProibida,
  valorEsperado,
} from "./logica.mjs";

describe("parseValorReais", () => {
  it.each([
    ["880,00", 88_000],
    ["440,00", 44_000],
    ["1.720,00", 172_000],
    ["860,00", 86_000],
    ["0,50", 50],
    ["12.345.678,90", 1_234_567_890],
    [" 880,00 ", 88_000],
  ])("%j -> %s", (texto, esperado) => expect(parseValorReais(texto)).toBe(esperado));

  it.each(["", "880", "880.00", "R$ 880,00", "abc", "1,5", "1.72,00", null, undefined, "880,000"])(
    "recusa %j",
    (texto) => expect(parseValorReais(texto)).toBeNull()
  );
});

describe("leitura da prévia da GRU", () => {
  // o texto como o e-INPI mostra na tela
  const previa = (cod, valor) =>
    `Sr(a) Usuário: Confira o serviço antes de prosseguir.\nCod. Servico Valor\n\n${cod}\n\nPedido de registro de marca (com especificação pré-aprovada) - valor por classe\n\n${valor}\nValor total:\n${valor}\n\nPortal INPI`;

  it("lê o valor total", () => {
    expect(extrairValorTotal(previa("389", "880,00"))).toBe(88_000);
    expect(extrairValorTotal(previa("394", "1.720,00"))).toBe(172_000);
    expect(extrairValorTotal(previa("389", "440,00"))).toBe(44_000);
  });
  it("lê a linha do serviço pedido", () => {
    expect(extrairLinhaDoServico(previa("389", "440,00"), "389")).toEqual({ codigo: "389", valorCentavos: 44_000 });
    expect(extrairLinhaDoServico(previa("394", "860,00"), "394")).toEqual({ codigo: "394", valorCentavos: 86_000 });
  });
  it("não confunde com outro serviço nem com texto sem prévia", () => {
    expect(extrairLinhaDoServico(previa("389", "440,00"), "394")).toBeNull();
    expect(extrairValorTotal("Dados do Serviço\nTipo de Serviço")).toBeNull();
    expect(extrairValorTotal(null)).toBeNull();
    expect(extrairLinhaDoServico("", "389")).toBeNull();
  });
});

describe("compararValor", () => {
  it("igual: ok", () => {
    expect(compararValor({ lidoCentavos: 44_000, esperadoCentavos: 44_000 })).toMatchObject({ ok: true });
  });
  it("a mais ou a menos: problema, e diz quanto", () => {
    const mais = compararValor({ lidoCentavos: 88_000, esperadoCentavos: 44_000 });
    expect(mais.ok).toBe(false);
    expect(mais.motivo).toContain("+");
    const menos = compararValor({ lidoCentavos: 40_000, esperadoCentavos: 44_000 });
    expect(menos.ok).toBe(false);
    expect(menos.motivo).toContain("-");
  });
  it("sem leitura: problema (nunca 'ok' por falta de dado)", () => {
    expect(compararValor({ lidoCentavos: null, esperadoCentavos: 44_000 }).ok).toBe(false);
    expect(compararValor({ lidoCentavos: undefined, esperadoCentavos: 44_000 }).ok).toBe(false);
  });
});

describe("estado da sessão", () => {
  it("logado tem 'Sair do Sistema' e não tem o formulário de login", () => {
    expect(estaLogado("Seja bem-vindo\nGerar GRU\nSair do Sistema")).toBe(true);
    expect(estaLogado("Formulário de login\nLogin\nSenha")).toBe(false);
    expect(estaLogado("")).toBe(false);
    expect(estaLogado(null)).toBe(false);
  });
  it("a tela de login é reconhecida mesmo se houver texto de rodapé parecido", () => {
    expect(naTelaDeLogin("Alerta contra fraudes\nFormulário de login")).toBe(true);
    expect(naTelaDeLogin("Gerar GRU\nSair do Sistema")).toBe(false);
    // página de login que também cita "Sair do Sistema" no menu escondido: continua NÃO logado
    expect(estaLogado("Sair do Sistema\nFormulário de login")).toBe(false);
  });
});

describe("travas: o que o robô nunca aperta nem deixa passar", () => {
  it.each(["Gerar boleto", "gerar  Boleto", "Pagamento online", "PAGAMENTO ONLINE", "Pagar", "Emitir GRU", "Imprimir"])(
    "botão %j é proibido",
    (nome) => expect(botaoProibido(nome)).toBe(true)
  );
  it.each(["Confirmar", "Cancelar Serviço", "Pesquisar", "Alterar", "Receber por e-mail", "", null])(
    "botão %j é permitido",
    (nome) => expect(botaoProibido(nome)).toBe(false)
  );
  it.each([
    "https://meu.inpi.gov.br/pag/gru/boleto",
    "https://meu.inpi.gov.br/pag/gru/gerarBoleto",
    "https://meu.inpi.gov.br/pag/pagamentoOnline/iniciar",
    "https://meu.inpi.gov.br/pag/pagamento-online",
  ])("pedido de rede %s é derrubado", (url) => expect(urlProibida(url)).toBe(true));
  it.each([
    "https://meu.inpi.gov.br/pag/gru/gerar",
    "https://meu.inpi.gov.br/pag/",
    "https://meu.inpi.gov.br/pag/minhasgrus/",
    "https://meu.inpi.gov.br/pag/gru/gerar/confirmar",
  ])("pedido de rede %s passa (é a própria emissão)", (url) => expect(urlProibida(url)).toBe(false));
});

describe("valores esperados", () => {
  it("389 e 394, com e sem o desconto de 50%", () => {
    expect(valorEsperado("389", true)).toBe(44_000);
    expect(valorEsperado("389", false)).toBe(88_000);
    expect(valorEsperado(394, true)).toBe(86_000);
    expect(valorEsperado("394", false)).toBe(172_000);
  });
  it("serviço desconhecido dá erro, não um valor qualquer", () => {
    expect(() => valorEsperado("999", true)).toThrow("Serviço desconhecido");
  });
  it("o desconto é exatamente metade", () => {
    for (const { integral, desconto } of Object.values(GRU_CENTAVOS)) expect(desconto * 2).toBe(integral);
  });
});

describe("resumo", () => {
  it("uma linha legível, com OK ou PROBLEMA", () => {
    const ok = resumirResultado({ servico: "389", lidoCentavos: 44_000, esperadoCentavos: 44_000, ok: true, motivo: "bate" });
    expect(ok).toContain("OK");
    expect(ok).toContain("389");
    const ruim = resumirResultado({ servico: "394", lidoCentavos: null, esperadoCentavos: 86_000, ok: false, motivo: "sem leitura" });
    expect(ruim).toContain("PROBLEMA (sem leitura)");
    expect(ruim).toContain("—");
  });
  it("formatarReais usa vírgula", () => {
    expect(formatarReais(44_000).replace(/\s/g, " ")).toBe("R$ 440,00");
  });
});

describe("rodada do robô", () => {
  const tarefa = { processoId: "p1", servico: "389", comDesconto: true, esperadoCentavos: 44_000 };

  it("montarConferencia: ok, divergente e erro", async () => {
    const { montarConferencia } = await import("./logica.mjs");
    expect(montarConferencia(tarefa, { ok: true, lidoCentavos: 44_000 })).toEqual({
      resultado: "ok", servico: "389", esperadoCentavos: 44_000, lidoCentavos: 44_000, detalhe: null,
    });
    expect(montarConferencia(tarefa, { ok: false, lidoCentavos: 88_000, motivo: "diferente" })).toMatchObject({
      resultado: "divergente", lidoCentavos: 88_000, detalhe: "diferente",
    });
    expect(montarConferencia(tarefa, { ok: false, lidoCentavos: null, motivo: "não li o valor" })).toMatchObject({
      resultado: "erro", lidoCentavos: null,
    });
  });

  it("conferenciaComErro usa só a primeira linha da mensagem e corta o tamanho", async () => {
    const { conferenciaComErro } = await import("./logica.mjs");
    const c = conferenciaComErro(tarefa, new Error(`falhou\nlinha 2 com ${"x".repeat(500)}`));
    expect(c).toMatchObject({ resultado: "erro", lidoCentavos: null, detalhe: "falhou" });
    expect(conferenciaComErro(tarefa, "y".repeat(500)).detalhe).toHaveLength(300);
  });

  it("tarefaValida recusa o que não tem a forma certa", async () => {
    const { tarefaValida } = await import("./logica.mjs");
    expect(tarefaValida(tarefa)).toBe(true);
    for (const ruim of [null, {}, { ...tarefa, servico: "999" }, { ...tarefa, esperadoCentavos: 0 }, { ...tarefa, esperadoCentavos: 440.5 }, { ...tarefa, processoId: "" }, { ...tarefa, comDesconto: "sim" }]) {
      expect(tarefaValida(ruim)).toBe(false);
    }
  });

  it("enderecoDoSite aceita https (e http só em localhost) e tira o caminho", async () => {
    const { enderecoDoSite } = await import("./logica.mjs");
    expect(enderecoDoSite("https://www.marcasync.com.br/")).toBe("https://www.marcasync.com.br");
    expect(enderecoDoSite(" http://localhost:3002/x ")).toBe("http://localhost:3002");
    expect(() => enderecoDoSite("http://www.marcasync.com.br")).toThrow(/https/);
    expect(() => enderecoDoSite("")).toThrow();
  });
});
