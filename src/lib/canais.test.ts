/**
 * Testes de src/lib/canais.ts: escolha dos canais e envio. O `fetch` é falso: nada é enviado
 * de verdade. A parte que grava no banco é coberta pelo teste de ponta a ponta no ambiente de teste.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { enviarEmail, enviarTelegram, tentativasPara, type Aviso } from "./canais";

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
