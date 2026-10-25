/**
 * Testes de src/lib/canais.ts: escolha dos canais e envio. O `fetch` é falso: nada é enviado
 * de verdade. A parte que grava no banco é coberta pelo teste de ponta a ponta no ambiente de teste.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { enviarEmail, enviarTelegram, enviarWhatsapp, tentativasPara, type Aviso } from "./canais";

const cliente: Aviso = {
  para: "cliente",
  assunto: "Pagamento recebido",
  texto: "Recebemos o seu pagamento.",
  email: "ana@exemplo.com.br",
};
const operador: Aviso = { para: "operador", assunto: "Pedido pago", texto: "Marca X" };

afterEach(() => vi.unstubAllGlobals());

describe("tentativasPara", () => {
  it("sem nenhuma variável, não há canal (o aviso fica só no painel)", () => {
    expect(tentativasPara(cliente, {})).toEqual([]);
    expect(tentativasPara(operador, {})).toEqual([]);
  });

  it("cliente: só por e-mail, e só com chave, remetente e e-mail do cliente", () => {
    const env = {
      RESEND_API_KEY: "k",
      EMAIL_REMETENTE: "MarcaSync <a@b.com>",
    };
    expect(tentativasPara(cliente, env).map((t) => t.canal)).toEqual(["email"]);
    expect(tentativasPara({ ...cliente, email: undefined }, env)).toEqual([]);
    expect(tentativasPara(cliente, { RESEND_API_KEY: "k" })).toEqual([]);
  });

  it("cliente nunca recebe pelo Telegram do operador", () => {
    const env = { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1" };
    expect(tentativasPara(cliente, env)).toEqual([]);
  });

  it("operador: Telegram e e-mail, cada um se estiver configurado", () => {
    const so = { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1" };
    expect(tentativasPara(operador, so).map((t) => t.canal)).toEqual(["telegram"]);
    const ambos = {
      ...so,
      RESEND_API_KEY: "k",
      EMAIL_REMETENTE: "MarcaSync <a@b.com>",
      EMAIL_OPERADOR: "eu@exemplo.com",
    };
    expect(tentativasPara(operador, ambos).map((t) => t.canal)).toEqual(["telegram", "email"]);
  });
});

describe("WhatsApp (CallMeBot)", () => {
  const env = { CALLMEBOT_TELEFONE: "5585999991234", CALLMEBOT_APIKEY: "1234567" };

  it("o operador recebe também por WhatsApp quando o telefone e a chave estão configurados", () => {
    expect(tentativasPara(operador, env).map((t) => t.canal)).toEqual(["whatsapp"]);
    expect(tentativasPara(operador, { CALLMEBOT_TELEFONE: "5585999991234" })).toEqual([]);
    expect(tentativasPara(operador, { CALLMEBOT_APIKEY: "1" })).toEqual([]);
  });

  it("a ordem é Telegram, WhatsApp e e-mail", () => {
    const todos = {
      ...env,
      TELEGRAM_BOT_TOKEN: "t",
      TELEGRAM_CHAT_ID: "1",
      RESEND_API_KEY: "k",
      EMAIL_REMETENTE: "MarcaSync <a@b.com>",
      EMAIL_OPERADOR: "eu@exemplo.com",
    };
    expect(tentativasPara(operador, todos).map((t) => t.canal)).toEqual(["telegram", "whatsapp", "email"]);
  });

  it("o cliente nunca recebe pelo WhatsApp do operador", () => {
    expect(tentativasPara(cliente, env)).toEqual([]);
  });

  it("enviarWhatsapp chama o CallMeBot com o telefone em formato internacional, o texto e a chave", async () => {
    const falso = vi.fn().mockResolvedValue(new Response("Message queued", { status: 200 }));
    vi.stubGlobal("fetch", falso);
    await enviarWhatsapp({ telefone: "(55) 85 99999-1234", chave: "1234567", texto: "Novo interesse: Ana\nMarca X" });
    const url = new URL((falso.mock.calls[0] as [string])[0]);
    expect(url.origin + url.pathname).toBe("https://api.callmebot.com/whatsapp.php");
    expect(url.searchParams.get("phone")).toBe("+5585999991234");
    expect(url.searchParams.get("apikey")).toBe("1234567");
    expect(url.searchParams.get("text")).toBe("Novo interesse: Ana\nMarca X");
  });

  it("corta mensagens muito longas", async () => {
    const falso = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", falso);
    await enviarWhatsapp({ telefone: "5585999991234", chave: "k", texto: "x".repeat(5000) });
    const url = new URL((falso.mock.calls[0] as [string])[0]);
    expect(url.searchParams.get("text")?.length).toBe(1500);
  });

  it("erro do serviço vira exceção SEM repetir a URL (a chave vai nela)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("erro", { status: 403 })));
    const erro = await enviarWhatsapp({ telefone: "5585999991234", chave: "segredo-123", texto: "oi" }).catch((e) => e);
    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe("CallMeBot respondeu 403.");
    expect(erro.message).not.toContain("segredo-123");
  });
});

describe("transportes", () => {
  it("enviarEmail chama a Resend com a chave e o corpo certos", async () => {
    const falso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", falso);
    await enviarEmail({
      chave: "re_x",
      de: "MarcaSync <a@b.com>",
      para: "ana@exemplo.com.br",
      assunto: "Oi",
      texto: "Corpo",
    });
    const [url, init] = falso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_x");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "MarcaSync <a@b.com>",
      to: ["ana@exemplo.com.br"],
      subject: "Oi",
      text: "Corpo",
    });
  });

  it("enviarEmail lança erro quando a Resend recusa", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 422 })));
    await expect(
      enviarEmail({ chave: "k", de: "a", para: "b", assunto: "c", texto: "d" })
    ).rejects.toThrow("422");
  });

  it("enviarTelegram usa o token na URL mas não o repete na mensagem de erro", async () => {
    const falso = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", falso);
    const erro = await enviarTelegram({ token: "SEGREDO123", chatId: "42", texto: "oi" }).catch(
      (e) => e
    );
    expect((falso.mock.calls[0] as [string])[0]).toContain("botSEGREDO123/sendMessage");
    expect(JSON.parse((falso.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({
      chat_id: "42",
      text: "oi",
    });
    expect(String(erro.message)).toContain("401");
    expect(String(erro.message)).not.toContain("SEGREDO123");
  });
});
